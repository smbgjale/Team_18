/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { ensureCatalogue } from "@/lib/shops/sync";

export const dynamic = "force-dynamic";

interface Row {
  name: string; description: string; price_minor: number; sale_price_minor: number | null; currency: string;
  image_url: string; availability: string; brand: string; shop_name: string; external_id: string;
}

// Stand-in for a shop's own product page. Real shops link to their own websites instead.
export default async function DemoProductPage({ params }: PageProps<"/demo-shop/[shop]/[sku]">) {
  const { shop, sku } = await params;
  await ensureCatalogue();
  const p = db().prepare(
    `SELECT p.*, s.name AS shop_name FROM products p JOIN shops s ON s.id = p.shop_id WHERE s.slug = ? AND p.external_id = ? AND s.is_demo = 1`,
  ).get(shop, sku) as Row | undefined;
  if (!p) notFound();
  const price = { amount_minor: p.sale_price_minor ?? p.price_minor, currency: p.currency };
  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 py-8">
      <div className="rounded-lg border border-amber-400/50 bg-amber-50 p-3 text-sm">
        This is a sample product page from <strong>{p.shop_name}</strong>, a demo shop bundled with the Gojjodesign MVP. With a real shop integration, this button
        would open the product page on the shop&apos;s own website. <Link href="/shop" className="underline">Back to the catalogue</Link>
      </div>
      <div className="grid gap-6 rounded-xl border bg-card p-5 md:grid-cols-2">
        <img src={p.image_url} alt={p.name} className="w-full rounded-lg bg-muted" />
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{p.brand} &middot; SKU {p.external_id}</p>
          <h1 className="text-2xl font-bold">{p.name}</h1>
          <p className="text-xl font-semibold">{formatMoney(price)}</p>
          <p className="text-muted-foreground">{p.description}</p>
          <p className="text-sm">Availability: {p.availability.replace(/_/g, " ")}</p>
        </div>
      </div>
    </main>
  );
}
