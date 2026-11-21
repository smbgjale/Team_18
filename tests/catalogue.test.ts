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

  const first = await syncAll();
  assert.equal(first.length, 4);
  assert.ok(first.every((r) => r.created > 0 && r.rejected.length === 0));
  assert.equal(listShops().length, 4);

  const second = await syncAll();
  assert.ok(second.every((r) => r.created === 0 && r.updated === 0 && r.deactivated === 0));

  const sofas = queryProducts({ categories: ["sofa"] });
  assert.ok(sofas.length >= 6);
  assert.ok(sofas.every((p) => p.category === "sofa"));

  const ctx = { style: "scandinavian", allCategories: ["sofa" as const], maxPriceMinor: 80000, perItem: 5 };
  const matches = matchItem({ category: "sofa", label: "grey sofa", colorHexes: ["#b4b3af"], colorNames: ["grey"] }, ctx);
  assert.ok(matches.length > 0);
  for (const m of matches) {
    assert.ok(["sofa", undefined].includes(m.product.category));
    assert.ok((m.product.sale_price ?? m.product.price).amount_minor <= 80000);
    assert.notEqual(m.product.availability, "out_of_stock");
  }
  assert.ok(matches[0].score >= matches[matches.length - 1].score);
  assert.ok(new Set(matches.map((m) => m.product.shop.slug)).size >= 1);
});
