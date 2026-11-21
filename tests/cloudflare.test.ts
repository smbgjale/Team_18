import assert from "node:assert/strict";
import { test } from "node:test";
import sharp, { type Metadata } from "sharp";

process.env.CLOUDFLARE_ACCOUNT_ID = "acc123";
process.env.CLOUDFLARE_API_TOKEN = "test-token";
process.env.OPENAI_API_KEY = "sk-test";
delete process.env.RENDER_PROVIDER;
delete process.env.VISION_PROVIDER;

const tinyPng = async () => (await sharp({ create: { width: 8, height: 8, channels: 3, background: "#888" } }).png().toBuffer()).toString("base64");

function stubFetch(handler: (req: Request) => Promise<Response>) {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => handler(new Request(input, init))) as typeof fetch;
  return () => { globalThis.fetch = original; };
}

test("Cloudflare is selected even when an OpenAI key is also set", async () => {
  const { activeRenderProvider, activeVisionProvider } = await import("../src/lib/config");
  assert.equal(activeRenderProvider(), "cloudflare");
  assert.equal(activeVisionProvider(), "cloudflare");
});

test("output size keeps the aspect ratio within Workers AI limits", async () => {
  const { outputSize } = await import("../src/lib/render/cloudflare");
  assert.deepEqual(outputSize(1536, 1024), { width: 1024, height: 688 });
  assert.deepEqual(outputSize(1024, 1536), { width: 688, height: 1024 });
});

test("FLUX prompt drops the negative list and references the input image", async () => {
  const { fluxPrompt } = await import("../src/lib/render/cloudflare");
  const p = fluxPrompt("Redesign this room. Keep the layout. Avoid: text, watermark, people");
  assert.match(p, /^Image 0 is a photo of a real room\./);
  assert.doesNotMatch(p, /watermark|Avoid/);
});

test("render sends the room photo and up to three product photos, each within 512 px", async () => {
  const { CloudflareRenderProvider } = await import("../src/lib/render/cloudflare");
  const { getStyle } = await import("../src/lib/styles");
  const b64 = await tinyPng();
  const seen: { url?: string; auth?: string | null; fields?: Record<string, string>; images?: Metadata[] } = {};
  const restore = stubFetch(async (req) => {
    const form = await req.formData();
    seen.url = req.url;
    seen.auth = req.headers.get("authorization");
    seen.fields = { prompt: String(form.get("prompt")), width: String(form.get("width")), height: String(form.get("height")) };
    seen.images = [];
    for (let i = 0; form.get(`input_image_${i}`); i++) {
      const file = form.get(`input_image_${i}`) as File;
      seen.images.push(await sharp(Buffer.from(await file.arrayBuffer())).metadata());
    }
    return Response.json({ success: true, result: { image: b64 } });
  });
  try {
    const source = await sharp({ create: { width: 1536, height: 1024, channels: 3, background: "#ccc" } }).jpeg().toBuffer();
    const productPhoto = await sharp({ create: { width: 900, height: 700, channels: 3, background: "#456" } }).png().toBuffer();
    const products = (["sofa", "rug", "coffee_table", "floor_lamp"] as const).map((category) => ({ category, name: `Test ${category}`, imageUrl: "/x.png", reference: productPhoto }));
    const out = await new CloudflareRenderProvider().render({
      sourceImage: source, prompt: "Redesign this room with the sofa in reference product image 1. Avoid: text", style: getStyle("modern")!,
      roomType: "living_room", fidelity: "high", width: 1536, height: 1024, products,
    });
    assert.equal(out.image.toString("base64"), b64);
  } finally {
    restore();
  }
  assert.equal(seen.url, "https://api.cloudflare.com/client/v4/accounts/acc123/ai/run/@cf/black-forest-labs/flux-2-klein-4b");
  assert.equal(seen.auth, "Bearer test-token");
  assert.equal(seen.fields!.width, "1024");
  assert.equal(seen.fields!.height, "688");
  assert.equal(seen.images!.length, 4, "room photo plus the three biggest products");
  for (const m of seen.images!) assert.ok(Math.max(m.width!, m.height!) <= 512);
  assert.match(seen.fields!.prompt, /Images 1 to 3 are product photos/);
  assert.match(seen.fields!.prompt, /sofa in image 1/);
});

test("a used-up daily allowance maps to provider_quota_exceeded", async () => {
  const { CloudflareRenderProvider } = await import("../src/lib/render/cloudflare");
  const { getStyle } = await import("../src/lib/styles");
  const restore = stubFetch(async () =>
    Response.json({ success: false, errors: [{ code: 4006, message: "you have used up your daily free allocation of 10,000 neurons" }] }, { status: 429 }),
  );
  try {
    const source = await sharp({ create: { width: 600, height: 600, channels: 3, background: "#ccc" } }).jpeg().toBuffer();
    await assert.rejects(
      new CloudflareRenderProvider().render({ sourceImage: source, prompt: "x", style: getStyle("modern")!, roomType: "bedroom", fidelity: "high", width: 600, height: 600, products: [] }),
      (e: { code?: string }) => e.code === "provider_quota_exceeded",
    );
  } finally {
    restore();
  }
});

test("vision parses JSON returned as text (even fenced) or as an object", async () => {
  const { CloudflareVisionProvider } = await import("../src/lib/vision/cloudflare");
  const items = { items: [
    { category: "Sofa", label: "grey sofa", confidence: 0.9, color: "Grey", bbox: { x: 0.1, y: 0.5, w: 0.4, h: 0.3 } },
    { category: "coffee table", label: "oak table", confidence: "0.8", bbox: { x: 0.3, y: 0.7, w: 0.2, h: 0.15 } },
    { category: "spaceship", label: "?", confidence: 0.9, bbox: { x: 0, y: 0, w: 0.5, h: 0.5 } },
    { category: "rug", label: "tiny", confidence: 0.9, bbox: { x: 0, y: 0, w: 0.05, h: 0.05 } },
    { category: "chair", label: "unsure", confidence: 0.2, bbox: { x: 0, y: 0, w: 0.3, h: 0.3 } },
  ] };
  const image = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#ccc" } }).png().toBuffer();
  for (const response of ["Here you go:\n```json\n" + JSON.stringify(items) + "\n```", items]) {
    const restore = stubFetch(async () => Response.json({ success: true, result: { response } }));
    try {
      const found = await new CloudflareVisionProvider().detectItems({ image, roomType: "living_room", style: "modern" });
      assert.deepEqual(found.map((f) => f.category), ["sofa", "coffee_table"]);
      assert.equal(found[0].colorName, "grey");
    } finally {
      restore();
    }
  }
});
