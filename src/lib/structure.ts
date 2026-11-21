import sharp from "sharp";

async function edgeMap(buf: Buffer, n = 64): Promise<Float32Array> {
  const { data } = await sharp(buf).resize(n, n, { fit: "fill" }).greyscale().blur(0.8).raw().toBuffer({ resolveWithObject: true });
  const out = new Float32Array(n * n);
  for (let y = 1; y < n - 1; y++) {
    for (let x = 1; x < n - 1; x++) {
      const g = (dx: number, dy: number) => data[(y + dy) * n + (x + dx)];
      const gx = g(1, -1) + 2 * g(1, 0) + g(1, 1) - g(-1, -1) - 2 * g(-1, 0) - g(-1, 1);
      const gy = g(-1, 1) + 2 * g(0, 1) + g(1, 1) - g(-1, -1) - 2 * g(0, -1) - g(1, -1);
      out[y * n + x] = Math.hypot(gx, gy);
    }
  }
  return out;
}

// Pearson correlation of coarse edge maps: a cheap proxy for "is the room layout still the same".
// ~1 means identical structure, ~0 unrelated. Used as a monitoring signal, not as a hard gate.
export async function structureScore(original: Buffer, render: Buffer): Promise<number> {
  const [a, b] = await Promise.all([edgeMap(original), edgeMap(render)]);
  const n = a.length;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma, y = b[i] - mb;
    num += x * y; da += x * x; db += y * y;
  }
  const denom = Math.sqrt(da * db);
  return denom === 0 ? 0 : Math.max(0, Math.round((num / denom) * 1000) / 1000);
}
