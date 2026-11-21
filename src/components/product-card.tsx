/* eslint-disable @next/next/no-img-element */
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import type { ProductDto } from "@/lib/api-types";

const AVAIL: Record<string, { label: string; variant: "secondary" | "outline" | "destructive" } | null> = {
  in_stock: { label: "In stock", variant: "secondary" },
  low_stock: { label: "Low stock", variant: "outline" },
  out_of_stock: { label: "Out of stock", variant: "destructive" },
  preorder: { label: "Pre-order", variant: "outline" },
  unknown: null,
};

export function ProductCard({ product, href, matchLabel }: { product: ProductDto; href?: string; matchLabel?: string }) {
  const avail = AVAIL[product.availability];
  const link = href ?? product.product_url;
  return (
    <article className="flex flex-col overflow-hidden rounded-xl border bg-card">
      <div className="relative aspect-[4/3] bg-muted">
        <img src={product.image_url} alt={product.name} className="size-full object-cover" loading="lazy" />
        {matchLabel && <Badge className="absolute left-2 top-2">{matchLabel}</Badge>}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate font-medium">{product.shop.name}</span>
          {avail && <Badge variant={avail.variant}>{avail.label}</Badge>}
        </div>
        <h4 className="line-clamp-2 text-sm font-semibold leading-snug">{product.name}</h4>
        {product.description && <p className="line-clamp-2 text-xs text-muted-foreground">{product.description}</p>}
        {product.dimensions_cm?.width && (
          <p className="text-xs text-muted-foreground">
            {[product.dimensions_cm.width, product.dimensions_cm.depth, product.dimensions_cm.height].filter(Boolean).join(" x ")} cm
          </p>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <div>
            {product.sale_price ? (
              <>
                <span className="text-base font-bold">{formatMoney(product.sale_price)}</span>{" "}
                <span className="text-xs text-muted-foreground line-through">{formatMoney(product.price)}</span>
              </>
            ) : (
              <span className="text-base font-bold">{formatMoney(product.price)}</span>
            )}
          </div>
          <a href={link} target="_blank" rel="noopener noreferrer sponsored" className={buttonVariants({ size: "sm" })}>
            View on shop <ExternalLink className="size-3.5" />
          </a>
        </div>
      </div>
    </article>
  );
}
