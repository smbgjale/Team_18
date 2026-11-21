import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

process.env.HOMELY_DATA_DIR = mkdtempSync(path.join(tmpdir(), "homely-test-"));

test("sync loads the studio furniture catalogue, is idempotent, and matching respects category and budget", async () => {
  const { syncAll, listShops } = await import("../src/lib/shops/sync");
  const { queryProducts } = await import("../src/lib/products");
  const { matchItem } = await import("../src/lib/matching");

  const first = await syncAll();
  assert.deepEqual(listShops().map((s) => s.slug), ["high-fashion-home"]);
  assert.equal(first.length, 1);
  assert.ok(first[0].created > 20 && first[0].rejected.length === 0);

  const second = await syncAll();
  assert.ok(second.every((r) => r.created === 0 && r.updated === 0 && r.deactivated === 0));

  const products = queryProducts({});
  assert.ok(products.length >= 40);
  assert.ok(products.every((p) => p.shop_slug === "high-fashion-home"));
  assert.ok(products.every((p) => p.image_url?.startsWith("https://") && p.product_url.includes("highfashionhome.com")));
  const sofas = queryProducts({ categories: ["sofa"] });
  assert.ok(sofas.length >= 4);
  assert.ok(queryProducts({ categories: ["coffee_table", "bed", "dining_table"] }).length >= 9);
  assert.equal(queryProducts({ categories: ["curtains"] }).length, 0);

  const ctx = { style: "modern", allCategories: ["sofa" as const], maxPriceMinor: 500000, perItem: 5 };
  const matches = matchItem({ category: "sofa", label: "sofa", colorHexes: ["#c4b8a5"], colorNames: ["grey"] }, ctx);
  assert.ok(matches.length > 0);
  for (const m of matches) {
    assert.equal(m.product.category, "sofa");
    assert.ok((m.product.sale_price ?? m.product.price).amount_minor <= 500000);
    assert.notEqual(m.product.availability, "out_of_stock");
    assert.equal(m.product.shop.slug, "high-fashion-home");
  }
  assert.ok(matches[0].score >= matches[matches.length - 1].score);
  assert.ok(queryProducts({ direction: "modern" }).length > 0);
});
