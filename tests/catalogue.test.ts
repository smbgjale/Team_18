import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

process.env.HOMELY_DATA_DIR = mkdtempSync(path.join(tmpdir(), "homely-test-"));

test("sync loads the sample shops, is idempotent, and matching respects category and budget", async () => {
  const { syncAll, listShops } = await import("../src/lib/shops/sync");
  const { queryProducts } = await import("../src/lib/products");
  const { matchItem } = await import("../src/lib/matching");

  const shops = ["sabahar", "ethiopian-cultural-shop"];
  const first = await syncAll();
  assert.deepEqual(listShops().map((s) => s.slug).sort(), [...shops].sort());
  assert.equal(first.length, 2);
  assert.ok(first.every((r) => r.created > 0 && r.rejected.length < r.seen));

  const second = await syncAll();
  assert.ok(second.every((r) => r.created === 0 && r.updated === 0 && r.deactivated === 0));

  const products = queryProducts({});
  assert.ok(products.length >= 10);
  assert.ok(products.every((p) => shops.includes(p.shop_slug)));
  assert.deepEqual(queryProducts({ categories: ["sofa"] }), []);

  const ctx = { style: "african", allCategories: ["cushion" as const], maxPriceMinor: 10000, perItem: 5 };
  const matches = matchItem({ category: "cushion", label: "cotton cushion", colorHexes: ["#b87333"], colorNames: ["copper"] }, ctx);
  assert.ok(matches.length > 0);
  for (const m of matches) {
    assert.equal(m.product.category, "cushion");
    assert.ok((m.product.sale_price ?? m.product.price).amount_minor <= 10000);
    assert.notEqual(m.product.availability, "out_of_stock");
    assert.ok(shops.includes(m.product.shop.slug));
  }
  assert.ok(matches[0].score >= matches[matches.length - 1].score);

  const traditional = queryProducts({ direction: "traditional" });
  assert.equal(traditional.length, products.length);
  assert.equal(queryProducts({ direction: "modern" }).length, 0);
});
