import sharp, { type OverlayOptions } from "sharp";
import { WALL_MOUNTED } from "../categories";
import { placeProducts } from "../mock-layout";
import type { RenderProvider, RenderRequest, RenderResult } from "./types";

const TINT: Record<string, string> = {
  modern: "#9aa3ad", scandinavian: "#e9e2d0", minimalist: "#ece6da",
  industrial: "#7b6a5c", bohemian: "#d4a070", classic: "#c9b88f",
};

// Local stand-in used when no AI image provider is configured. It does NOT redesign the
// room: it restyles the photo's colours and overlays the chosen products' images so the whole
// flow (compare, download, shop this look, 3D view) can be tried without an API key.
export class MockRenderProvider implements RenderProvider {
  readonly name = "mock";
  readonly maxReferenceImages = 0;

  async render(req: RenderRequest): Promise<RenderResult> {
    const W = req.width;
    const H = req.height;
    const tint = TINT[req.style.id] ?? "#cccccc";

    const base = await sharp(req.sourceImage)
      .resize(W, H, { fit: "cover" })
      .median(5)
      .modulate({ saturation: 1.15, brightness: 1.05 })
      .linear(1.08, -6)
      .tint(tint)
      .blur(0.6)
      .sharpen({ sigma: 1.2 })
      .toBuffer();

    const layers: OverlayOptions[] = [];
    const items = (await placeProducts(req.products, W, H)).sort((a, b) => {
      if ((a.category === "rug") !== (b.category === "rug")) return a.category === "rug" ? -1 : 1;
      return a.bbox.y + a.bbox.h - (b.bbox.y + b.bbox.h);
    });
    for (const it of items) {
      const w = Math.max(2, Math.round(it.bbox.w * W));
      const h = Math.max(2, Math.round(it.bbox.h * H));
      const left = Math.round(it.bbox.x * W);
      const top = Math.round(it.bbox.y * H);
      if (!WALL_MOUNTED.includes(it.category) && it.category !== "rug") {
        const sw = Math.round(w * 1.1);
        const sh = Math.max(8, Math.round(h * 0.12));
        const shadow = Buffer.from(
          `<svg xmlns="http://www.w3.org/2000/svg" width="${sw}" height="${sh * 2}"><ellipse cx="${sw / 2}" cy="${sh}" rx="${sw * 0.46}" ry="${sh * 0.5}" fill="#000" opacity="0.3"/></svg>`,
        );
        layers.push({ input: await sharp(shadow).blur(5).png().toBuffer(), left: Math.max(0, left - Math.round((sw - w) / 2)), top: Math.min(H - sh * 2, top + h - sh) });
      }
      layers.push({ input: await sharp(it.png).resize(w, h, { fit: "fill" }).png().toBuffer(), left, top });
    }

    const vignette = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><radialGradient id="v" cx="50%" cy="50%" r="75%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity="0.35"/></radialGradient></defs><rect width="${W}" height="${H}" fill="url(#v)"/></svg>`,
    );
    const fontSize = Math.max(12, Math.round(W / 60));
    const badge = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect x="${fontSize}" y="${H - fontSize * 3}" rx="6" width="${fontSize * 27}" height="${fontSize * 2}" fill="#000" opacity="0.6"/><text x="${fontSize * 1.8}" y="${H - fontSize * 1.65}" font-family="sans-serif" font-size="${fontSize}" fill="#fff">DEMO PREVIEW - connect an AI provider for a real 3D-style render</text></svg>`,
    );

    const out = await sharp(base)
      .composite([...layers, { input: vignette }, { input: badge }])
      .png()
      .toBuffer();
    return { image: out, mime: "image/png", providerName: this.name, providerModel: "local-demo" };
  }
}
