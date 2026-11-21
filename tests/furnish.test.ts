import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import sharp from "sharp";

process.env.HOMELY_DATA_DIR = mkdtempSync(path.join(tmpdir(), "homely-furnish-"));
process.env.RENDER_PROVIDER = "mock";
process.env.VISION_PROVIDER = "mock";

test("furnishRoom picks one in-stock product per category that fits the room", async () => {
  const { syncAll } = await import("../src/lib/shops/sync");
  const { furnishRoom, fitsRoom } = await import("../src/lib/furnish");
  const { ROOM_ITEMS } = await import("../src/lib/categories");
  await syncAll();

  const { picks } = furnishRoom({ roomType: "living_room", style: "modern", room: { width: 500, length: 420 } });
  const filled = picks.map((p) => p.category);
  assert.ok(filled.includes("sofa") && filled.includes("coffee_table"));
  assert.ok(filled.every((c) => ROOM_ITEMS.living_room.includes(c)));
  for (const p of picks) {
    assert.notEqual(p.product.availability, "out_of_stock");
    assert.ok(fitsRoom(p.product, { width: 500, length: 420 }));
    assert.equal(p.product.shop_slug, "high-fashion-home");
    assert.ok(p.product.image_url?.includes("width=1400"));
  }
});

test("an African heritage room uses Ethiopian Etsy decor and keeps the sofa from the furniture shop", async () => {
  const { furnishRoom } = await import("../src/lib/furnish");
  const { picks } = furnishRoom({ roomType: "living_room", style: "african", room: { width: 500, length: 420 } });
  const sofa = picks.find((p) => p.category === "sofa");
  assert.equal(sofa?.product.shop_slug, "high-fashion-home");
  const etsy = picks.filter((p) => p.product.shop_slug === "etsy-ethiopian-home-decor");
  assert.ok(etsy.some((p) => p.category === "wall_art" || p.category === "cushion" || p.category === "rug"));
});

test("a traditional design uses traditional products where that category has them", async () => {
  const { furnishRoom } = await import("../src/lib/furnish");
  const { queryProducts } = await import("../src/lib/products");
  const { getStyle } = await import("../src/lib/styles");
  const { picks } = furnishRoom({ roomType: "living_room", style: "rustic", budgetMinor: 800000, budgetCurrency: "USD", room: { width: 480, length: 420 } });
  assert.ok(picks.length >= 3);
  for (const p of picks) {
    const tags = JSON.parse(p.product.style_tags) as string[];
    const traditional = tags.some((t) => getStyle(t)?.direction === "traditional");
    if (traditional) continue;
    const pool = queryProducts({ categories: [p.category], direction: "traditional", excludeOutOfStock: true });
    assert.equal(pool.length, 0, `${p.category} fell back even though a traditional product exists`);
  }
});

test("furnishRoom trades down to stay within a budget", async () => {
  const { furnishRoom, pickTotal } = await import("../src/lib/furnish");
  const free = furnishRoom({ roomType: "bedroom", style: "modern", room: { width: 420, length: 400 } });
  const budget = Math.round(pickTotal(free.picks) * 0.6);
  const tight = furnishRoom({ roomType: "bedroom", style: "modern", budgetMinor: budget, budgetCurrency: "USD", room: { width: 420, length: 400 } });
  assert.ok(pickTotal(tight.picks) <= budget || tight.overBudget);
  assert.ok(pickTotal(tight.picks) < pickTotal(free.picks));
});

test("a design run (demo provider) stores its products, renders them and marks them as visible", async () => {
  const { db } = await import("../src/lib/db");
  const { putFile, getFile } = await import("../src/lib/storage");
  const { runDesign } = await import("../src/lib/pipeline");
  const { getDesign, listDesignProducts } = await import("../src/lib/designs");
  const { buildPrompt, getStyle } = await import("../src/lib/styles");

  const photo = await sharp({ create: { width: 900, height: 600, channels: 3, background: "#c8bfb0" } }).jpeg().toBuffer();
  await putFile("rooms/r1/original.jpg", photo);
  db().prepare("INSERT INTO rooms (id, name, room_type, original_image_key, width_px, height_px) VALUES (?,?,?,?,?,?)").run("r1", null, "living_room", "rooms/r1/original.jpg", 900, 600);
  db().prepare("INSERT INTO designs (id, room_id, style, layout_fidelity, budget_total_minor, budget_currency) VALUES (?,?,?,?,?,?)").run("d1", "r1", "industrial", "high", 1500000, "USD");
  await runDesign("d1");

  const design = getDesign("d1")!;
  assert.equal(design.status, "completed");
  const products = listDesignProducts("d1");
  assert.ok(products.length >= 4);
  assert.ok(products.every((p) => p.product.shop_slug === "high-fashion-home"));
  assert.ok(products.every((p) => p.in_render === 1));
  for (const p of products) assert.ok(design.prompt_used!.includes(p.product.name), `prompt names ${p.product.name}`);
  const render = await sharp(await getFile(design.render_image_key!)).metadata();
  assert.equal(render.width, 900);

  const prompt = buildPrompt({ style: getStyle("modern")!, roomType: "bedroom", fidelity: "high", products: [{ category: "bed", name: "Oslo Bed", colorName: "oak", refIndex: 1 }] });
  assert.match(prompt, /oak bed \("Oslo Bed", exactly as shown in reference product image 1\)/);
});
