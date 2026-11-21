import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { judgeProductImage } from "../src/lib/shops/image-quality";

async function jpeg(width: number, height: number, draw: (pixels: Buffer) => void) {
  const pixels = Buffer.alloc(width * height * 3, 255);
  draw(pixels);
  return sharp(pixels, { raw: { width, height, channels: 3 } }).jpeg().toBuffer();
}

test("a product on a white studio background passes", async () => {
  const buf = await jpeg(800, 800, (px) => {
    for (let y = 220; y < 580; y++) {
      for (let x = 180; x < 620; x++) {
        const i = (y * 800 + x) * 3;
        px[i] = 40; px[i + 1] = 50; px[i + 2] = 70;
      }
    }
  });
  const verdict = await judgeProductImage(buf);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.format, "jpeg");
  assert.equal(verdict.width, 800);
  assert.ok(verdict.cleanEdges >= 6);
  assert.ok(verdict.topClear);
});

test("a photo smaller than 512 px is rejected", async () => {
  const buf = await jpeg(200, 200, (px) => { px[100 * 200 * 3] = 0; });
  const verdict = await judgeProductImage(buf);
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /512/);
});

test("a full-bleed photo with no studio background is rejected", async () => {
  const buf = await jpeg(700, 700, (px) => px.fill(30));
  const verdict = await judgeProductImage(buf);
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /studio background/);
});

test("an empty white frame is rejected", async () => {
  const buf = await jpeg(700, 700, () => {});
  const verdict = await judgeProductImage(buf);
  assert.equal(verdict.ok, false);
  assert.match(verdict.reason, /does not fill/);
});
