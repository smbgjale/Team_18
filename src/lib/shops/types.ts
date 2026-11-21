export type Availability = "in_stock" | "low_stock" | "out_of_stock" | "preorder" | "unknown";

export interface RawProduct {
  externalId: string;
  name: string;
  description?: string;
  shopCategoryPath: string;
  price: number | null;
  salePrice?: number | null;
  currency?: string;
  productUrl: string;
  imageUrl: string;
  brand?: string;
  colors?: string[];
  materials?: string[];
  styleTags?: string[];
  dimensionsCm?: { width?: number; depth?: number; height?: number };
  availability: Availability;
}

export interface ShopRecord {
  id: string;
  slug: string;
  name: string;
  website_url: string;
  currency: string;
  connector_type: string;
  connector_config: Record<string, unknown>;
  category_map: Record<string, string>;
  affiliate_template: string | null;
  is_demo: boolean;
}

// Every shop integration implements this. The core only depends on this interface, so a new
// shop is added by registering a connector type and inserting a row into `shops`.
export interface ShopConnector {
  fetchProducts(): AsyncIterable<RawProduct>;
  // Optional: cheap price/stock refresh between full syncs.
  fetchAvailability?(externalIds: string[]): Promise<Record<string, Availability>>;
}

export type ConnectorFactory = (shop: ShopRecord) => ShopConnector;
