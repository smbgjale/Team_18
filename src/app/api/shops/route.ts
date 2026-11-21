import { db } from "@/lib/db";
import { ensureCatalogue, listShops } from "@/lib/shops/sync";

export async function GET() {
  await ensureCatalogue();
  const counts = new Map(
    (db().prepare("SELECT shop_id, COUNT(*) AS n FROM products WHERE is_active = 1 GROUP BY shop_id").all() as { shop_id: string; n: number }[]).map((r) => [r.shop_id, r.n]),
  );
  return Response.json({
    items: listShops().map((s) => ({ slug: s.slug, name: s.name, website_url: s.website_url, is_demo: s.is_demo, product_count: counts.get(s.id) ?? 0 })),
  });
}
