import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";

process.env.CLOUDFLARE_ACCOUNT_ID = "acc123";
process.env.CLOUDFLARE_API_TOKEN = "test-token";
delete process.env.OPENAI_API_KEY;
delete process.env.RENDER_PROVIDER;
delete process.env.VISION_PROVIDER;

const tinyPng = async () => (await sharp({ create: { width: 8, height: 8, channels: 3, background: "#888" } }).png().toBuffer()).toString("base64");

function stubFetch(handler: (req: Request) => Promise<Response>) {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => handler(new Request(input, init))) as typeof fetch;
  return () => { globalThis.fetch = original; };
}

test("Cloudflare is selected automatically when its credentials are set", async () => {
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

test("render sends a multipart request with a reference image no larger than 512 px", async () => {
  const { CloudflareRenderProvider } = await import("../src/lib/render/cloudflare");
  const { getStyle } = await import("../src/lib/styles");
  const b64 = await tinyPng();
  let seen: { url: string; auth: string | null; fields: Record<string, string>; imageMeta?: sharp.Metadata } | null = null;
  const restore = stubFetch(async (req) => {
    const form = await req.formData();
    const img = form.get("input_image_0") as File;
    seen = {
      url: req.url,
      auth: req.headers.get("authorization"),
      fields: { prompt: String(form.get("prompt")), width: String(form.get("width")), height: String(form.get("height")) },
      imageMeta: await sharp(Buffer.from(await img.arrayBuffer())).metadata(),
    };
    return Response.json({ success: true, result: { image: b64 } });
  });
  try {
    const source = await sharp({ create: { width: 1536, height: 1024, channels: 3, background: "#ccc" } }).jpeg().toBuffer();
    const out = await new CloudflareRenderProvider().render({
      sourceImage: source, prompt: "Redesign this room. Avoid: text", style: getStyle("modern")!, roomType: "living_room", fidelity: "high", width: 1536, height: 1024,
    });
    assert.equal(out.image.toString("base64"), b64);
  } finally {
    restore();
  }
  assert.ok(seen);
  const s = seen as NonNullable<typeof seen>;
  assert.equal(s.url, "https://api.cloudflare.com/client/v4/accounts/acc123/ai/run/@cf/black-forest-labs/flux-2-klein-4b");
  assert.equal(s.auth, "Bearer test-token");
  assert.equal(s.fields.width, "1024");
  assert.equal(s.fields.height, "688");
  assert.ok(Math.max(s.imageMeta!.width!, s.imageMeta!.height!) <= 512);
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
      new CloudflareRenderProvider().render({ sourceImage: source, prompt: "x", style: getStyle("modern")!, roomType: "bedroom", fidelity: "high", width: 600, height: 600 }),
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
