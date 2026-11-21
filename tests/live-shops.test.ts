import assert from "node:assert/strict";
import { test } from "node:test";
import { shopifyProducts } from "../src/lib/shops/shopify-connector";
import { wooAmounts, wooHomeKind } from "../src/lib/shops/woocommerce-connector";

test("home-goods names from Ethiopian Cultural Shop map only baskets", () => {
  assert.equal(wooHomeKind("Muday Basket"), "Basket");
  assert.equal(wooHomeKind("Hand Made Mesobwerk Basket"), "Basket");
  assert.equal(wooHomeKind("Mini Habesha Agelegil Basket"), "Basket");
  assert.equal(wooHomeKind("Handmade Mesob"), "Mesob");
  assert.equal(wooHomeKind("Three piece Messob"), "Mesob");
  assert.equal(wooHomeKind("Ethiopian Tea Cups"), "Other");
  assert.equal(wooHomeKind("Artificial Ketema(Plastic Grass)"), "Other");
});

test("WooCommerce store prices are in minor units", () => {
  const amounts = wooAmounts({ price: "4000", regular_price: "5000", currency_minor_unit: 2, currency_code: "USD" });
  assert.deepEqual(amounts, { price: 50, sale: 40, currency: "USD" });
});

test("a Shopify product becomes one row per variant, with its own photo and link", () => {
  const rows = shopifyProducts("https://sabahar.com", [{
    id: 1,
    title: "Zenach Handwoven Ethiopian Cotton Throw Pillow Cover",
    handle: "zenach-cushion",
    vendor: "sabahar",
    body_html: "<p>Handwoven cotton.</p>",
    product_type: "cushion",
    tags: ["Handmade"],
    options: [{ name: "Color", position: 1 }],
    images: [{ src: "https://cdn.shopify.com/pillow.jpg" }],
    variants: [
      { id: 11, title: "Copper", option1: "Copper", option2: null, option3: null, sku: "A", available: true, price: "84.00", compare_at_price: null, featured_image: { src: "https://cdn.shopify.com/copper.jpg" } },
      { id: 12, title: "Grey", option1: "Grey", option2: null, option3: null, sku: "B", available: false, price: "84.00", compare_at_price: "96.00", featured_image: null },
    ],
  }], ["african"]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].externalId, "11");
  assert.equal(rows[0].name, "Zenach Handwoven Ethiopian Cotton Throw Pillow Cover — Copper");
  assert.equal(rows[0].shopCategoryPath, "cushion");
  assert.deepEqual(rows[0].colors, ["copper"]);
  assert.equal(rows[0].imageUrl, "https://cdn.shopify.com/copper.jpg");
  assert.equal(rows[0].productUrl, "https://sabahar.com/products/zenach-cushion?variant=11");
  assert.equal(rows[0].availability, "in_stock");
  assert.deepEqual(rows[0].styleTags, ["african"]);
  assert.equal(rows[1].price, 96);
  assert.equal(rows[1].salePrice, 84);
  assert.equal(rows[1].imageUrl, "https://cdn.shopify.com/pillow.jpg");
  assert.equal(rows[1].availability, "out_of_stock");
});
