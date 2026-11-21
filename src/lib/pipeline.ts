import { nanoid } from "nanoid";
import sharp from "sharp";
import { BUDGET_WEIGHT, COMPATIBLE, type Category, type RoomType } from "./categories";
import { db } from "./db";
import { getDesign, getRoom, listDesignProducts, listItems, roomDims, setStatus } from "./designs";
import { furnishRoom } from "./furnish";
import { matchItem, type MatchContext } from "./matching";
import { loadProductImage } from "./product-images";
import { getRenderProvider, RenderError, type RenderProduct } from "./render";
import { ensureCatalogue } from "./shops/sync";
import { getFile, putFile } from "./storage";
import { structureScore } from "./structure";
import { buildPrompt, getStyle } from "./styles";
import { getVisionProvider } from "./vision";

function runDesignSafe(designId: string) {
  return runDesign(designId).catch((e) => {
    console.error(`[design ${designId}] unexpected failure`, e);
    try {
      setStatus(designId, "failed", {
        error_code: "internal_error",
        error_message: "Something went wrong while generating the design.",
      });
    } catch (statusError) {
      console.error(`[design ${designId}] could not mark failed`, statusError);
    }
  });
}

/** Schedule design work. Prefer Next.js `after()` on serverless so the job can finish after the HTTP response. */
export function startDesignJob(designId: string, schedule?: (task: Promise<unknown>) => void) {
  const task = runDesignSafe(designId);
  if (schedule) {
    schedule(task);
    return;
  }
  // Local/dev fallback. setImmediate is dropped on many serverless platforms once the response ends.
  setImmediate(() => {
    void task;
  });
}

function selectProducts(designId: string) {
  const design = getDesign(designId)!;
  const room = getRoom(design.room_id)!;
  const { picks } = furnishRoom({
    roomType: room.room_type as RoomType,
    style: design.style,
    budgetMinor: design.budget_total_minor,
    budgetCurrency: design.budget_currency,
    room: roomDims(room),
  });
  const insert = db().prepare("INSERT INTO design_products (id, design_id, product_id, category, quantity, sort) VALUES (?,?,?,?,?,?)");
  db().transaction(() => {
    db().prepare("DELETE FROM design_products WHERE design_id = ?").run(designId);
    picks.forEach((p, i) => insert.run(nanoid(12), designId, p.product.id, p.category, p.quantity, i));
  })();
}

const firstWord = (json: string) => (JSON.parse(json) as string[])[0] ?? null;

// The room image is a separate system from image-to-3D. It keeps the uploaded room's walls, windows and doors
// and uses catalogue photos only as references. GLB conversion lives in src/lib/mesh and is started by the user.
export async function runDesign(designId: string) {
  const design = getDesign(designId);
  if (!design) return;
  const room = getRoom(design.room_id);
  const style = getStyle(design.style);
  if (!room || !style) return setStatus(designId, "failed", { error_code: "not_found", error_message: "Room or style not found" });
  const roomType = room.room_type as RoomType;
  const provider = getRenderProvider();
  setStatus(designId, "rendering", { provider: provider.name });

  await ensureCatalogue();
  selectProducts(designId);
  const chosen = listDesignProducts(designId);

  // The biggest pieces are sent as reference photos; the rest are described in the prompt.
  const byImportance = [...chosen].sort((a, b) => BUDGET_WEIGHT[b.category] - BUDGET_WEIGHT[a.category]);
  const refIds = new Set(byImportance.slice(0, provider.maxReferenceImages).map((c) => c.id));
  const products: (RenderProduct & { refIndex?: number; id: string })[] = [];
  let refIndex = 0;
  for (const c of byImportance) {
    const reference = refIds.has(c.id) ? await loadProductImage(c.product.image_url) : null;
    products.push({ id: c.id, category: c.category, name: c.product.name, imageUrl: c.product.image_url, reference: reference ?? undefined, refIndex: reference ? ++refIndex : undefined });
  }

  const fidelity = design.layout_fidelity as "high" | "medium" | "low";
  const prompt = buildPrompt({
    style,
    roomType,
    userPrompt: design.user_prompt ?? undefined,
    fidelity,
    products: byImportance.map((c, i) => ({
      category: c.category,
      name: c.product.name,
      colorName: firstWord(c.product.colors),
      material: firstWord(c.product.materials),
      quantity: c.quantity,
      refIndex: products[i].refIndex,
    })),
  });
  setStatus(designId, "rendering", { prompt_used: prompt });

  const original = await getFile(room.original_image_key);
  let renderPng: Buffer;
  try {
    const result = await provider.render({ sourceImage: original, prompt, style, roomType, fidelity, width: room.width_px, height: room.height_px, products });
    renderPng = await sharp(result.image).png().toBuffer();
  } catch (e) {
    const err = e instanceof RenderError ? e : null;
    console.error(`[design ${designId}] render failed`, e);
    return setStatus(designId, "failed", {
      error_code: err?.code ?? "provider_unavailable",
      error_message:
        err?.code === "provider_policy_rejected"
          ? err.message
          : err?.code === "provider_quota_exceeded"
            ? "The free daily AI allowance has been used up. Please try again after midnight UTC."
            : "The image generation service could not create this design. Please try again.",
    });
  }

  const renderKey = await putFile(`designs/${designId}/render.png`, renderPng);
  let score: number | null = null;
  try { score = await structureScore(original, renderPng); } catch { /* monitoring signal only */ }
  setStatus(designId, "render_ready", { render_image_key: renderKey, structure_score: score });

  // Check which of the chosen products the image actually shows; generative models sometimes drop one.
  setStatus(designId, "matching");
  try {
    const detected = await getVisionProvider().detectItems({ image: renderPng, roomType, style: style.id, expected: chosen.map((c) => c.category) });
    const seen = new Set(detected.map((d) => d.category));
    const update = db().prepare("UPDATE design_products SET in_render = ? WHERE id = ?");
    for (const c of chosen) {
      const visible = seen.has(c.category) || (COMPATIBLE[c.category] ?? []).some((alt) => seen.has(alt));
      update.run(visible ? 1 : 0, c.id);
    }
  } catch (e) {
    console.error(`[design ${designId}] visibility check failed`, e);
  }
  setStatus(designId, "completed");
}

export function matchContextFor(designId: string, overrides: Partial<MatchContext> = {}): MatchContext {
  const design = getDesign(designId)!;
  const products = listDesignProducts(designId);
  const categories = products.length ? products.map((p) => p.category) : listItems(designId).map((i) => i.category);
  return {
    style: design.style,
    budgetMinor: design.budget_total_minor,
    budgetCurrency: design.budget_currency,
    allCategories: [...new Set(categories)] as Category[],
    ...overrides,
  };
}

export function matchesForItem(item: ReturnType<typeof listItems>[number], ctx: MatchContext) {
  const colors = JSON.parse(item.dominant_colors) as { hex: string; name: string }[];
  return matchItem({ category: item.category, label: item.label, colorHexes: colors.map((c) => c.hex), colorNames: colors.map((c) => c.name) }, ctx);
}

export function alternativesFor(chosen: ReturnType<typeof listDesignProducts>[number], ctx: MatchContext) {
  const p = chosen.product;
  const colors = JSON.parse(p.colors) as string[];
  const matches = matchItem(
    {
      category: chosen.category,
      label: `${p.name} ${(JSON.parse(p.materials) as string[]).join(" ")}`,
      colorHexes: p.dominant_color_hex ? [p.dominant_color_hex] : [],
      colorNames: colors,
    },
    { ...ctx, perItem: (ctx.perItem ?? 3) + 1 },
  );
  return matches.filter((m) => m.product.id !== p.id).slice(0, ctx.perItem ?? 3).map((m, i) => ({ ...m, rank: i + 1 }));
}
