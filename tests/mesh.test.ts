import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import sharp from "sharp";

process.env.HOMELY_DATA_DIR = mkdtempSync(path.join(tmpdir(), "homely-mesh-"));
process.env.IMAGE_TO_3D_PROVIDER = "local";
delete process.env.MESHY_API_KEY;

test("a photo becomes a GLB that three.js can parse", async () => {
  const { buildTexturedBoxGlb } = await import("../src/lib/mesh/glb");
  const jpeg = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#c45a3a" } }).jpeg().toBuffer();
  const glb = buildTexturedBoxGlb(jpeg);
  assert.equal(glb.toString("utf8", 0, 4), "glTF");
  assert.equal(glb.readUInt32LE(4), 2);
  assert.equal(glb.readUInt32LE(8), glb.length);

  const jsonLength = glb.readUInt32LE(12);
  assert.equal(glb.readUInt32LE(16), 0x4e4f534a);
  const doc = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8"));
  assert.equal(doc.asset.version, "2.0");
  assert.equal(doc.meshes.length, 1);
  assert.equal(doc.accessors[0].count, 24);
  assert.equal(doc.accessors[3].count, 36);
  assert.equal(doc.images[0].mimeType, "image/jpeg");
  const imageView = doc.bufferViews[4];
  const binStart = 20 + jsonLength + 8;
  const embedded = glb.subarray(binStart + imageView.byteOffset, binStart + imageView.byteOffset + imageView.byteLength);
  assert.equal(embedded[0], 0xff);
  assert.equal(embedded[1], 0xd8);

  class FakeImage {
    listeners = new Map<string, () => void>();
    addEventListener(type: string, fn: () => void) { this.listeners.set(type, fn); }
    removeEventListener(type: string) { this.listeners.delete(type); }
    set src(_value: string) { queueMicrotask(() => this.listeners.get("load")?.call(this)); }
  }
  const g = globalThis as unknown as { self?: typeof globalThis; document?: unknown };
  g.self = globalThis;
  g.document = { createElementNS: () => new FakeImage(), createElement: () => new FakeImage() };
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
  const parsed = await new Promise<{ scene: { children: unknown[] } }>((resolve, reject) => {
    const copy = new ArrayBuffer(glb.byteLength);
    new Uint8Array(copy).set(glb);
    new GLTFLoader().parse(copy, "", resolve, reject);
  });
  assert.ok(parsed.scene.children.length >= 1);
});

test("meshy task responses map to pending, ready or failed", async () => {
  const { interpretMeshy } = await import("../src/lib/mesh/meshy");
  assert.deepEqual(interpretMeshy({ status: "IN_PROGRESS" }), { status: "pending" });
  assert.deepEqual(interpretMeshy({ status: "PENDING" }), { status: "pending" });
  assert.deepEqual(interpretMeshy({ status: "SUCCEEDED", model_urls: { glb: "https://cdn.example/model.glb" } }), { status: "ready", url: "https://cdn.example/model.glb" });
  assert.equal(interpretMeshy({ status: "SUCCEEDED", model_url: "https://cdn.example/shortcut.glb" }).status, "ready");
  assert.equal(interpretMeshy({ status: "SUCCEEDED" }).status, "failed");
  assert.equal(interpretMeshy({ status: "FAILED", task_error: { message: "bad image" } }).status, "failed");
  assert.equal(interpretMeshy({ status: "CANCELED" }).status, "failed");
});

test("a saved model is reused until the catalogue photo changes", async () => {
  const { db } = await import("../src/lib/db");
  const { ensureProductModel, storedGlb } = await import("../src/lib/mesh/store");
  const { MeshError } = await import("../src/lib/mesh/meshy");

  db().prepare("INSERT OR IGNORE INTO shops (id, slug, name, website_url, currency, connector_type, agreement_type) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    "shop_mesh", "mesh-test", "Mesh Test", "https://example.com", "USD", "curated_json", "public_catalogue",
  );
  db().prepare("DELETE FROM product_models WHERE product_id = ?").run("prod_mesh_1");
  db().prepare("INSERT OR REPLACE INTO products (id, shop_id, external_id, name, category, price_minor, currency, product_url, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    "prod_mesh_1", "shop_mesh", "ext1", "Test sofa", "sofa", 10000, "USD", "https://example.com/p", "https://example.com/sofa.jpg",
  );

  const firstJpeg = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#336699" } }).jpeg().toBuffer();
  const secondJpeg = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#993333" } }).jpeg().toBuffer();
  const first = await ensureProductModel("prod_mesh_1", { image: firstJpeg });
  assert.equal(first.status, "ready");
  assert.equal(first.provider, "local");
  assert.equal(first.preview, true);
  assert.match(first.url ?? "", /^\/api\/files\/models\/prod_mesh_1\.glb\?v=/);
  const saved = await storedGlb("prod_mesh_1");
  assert.equal(saved?.toString("utf8", 0, 4), "glTF");

  const again = await ensureProductModel("prod_mesh_1", { image: secondJpeg });
  assert.equal(again.status, "ready");
  assert.equal(again.url, first.url);
  const still = await storedGlb("prod_mesh_1");
  assert.deepEqual(still, saved);
  const row = db().prepare("SELECT generations FROM product_models WHERE product_id = ?").get("prod_mesh_1") as { generations: number };
  assert.equal(row.generations, 1);

  db().prepare("UPDATE products SET image_url = ? WHERE id = ?").run("https://example.com/sofa-new.jpg", "prod_mesh_1");
  const rebuilt = await ensureProductModel("prod_mesh_1", { image: secondJpeg });
  assert.equal(rebuilt.status, "ready");
  assert.notEqual(rebuilt.url, first.url);
  const replaced = await storedGlb("prod_mesh_1");
  assert.notDeepEqual(replaced, saved);
  const after = db().prepare("SELECT generations FROM product_models WHERE product_id = ?").get("prod_mesh_1") as { generations: number };
  assert.equal(after.generations, 2);

  process.env.IMAGE_TO_3D_PROVIDER = "meshy";
  await assert.rejects(() => ensureProductModel("prod_mesh_1", { image: firstJpeg }), (error: unknown) => error instanceof MeshError && error.code === "missing_key");
  process.env.IMAGE_TO_3D_PROVIDER = "local";
  const kept = await ensureProductModel("prod_mesh_1");
  assert.equal(kept.status, "ready");
  assert.equal(kept.provider, "local");
});
