import { csvConnectorFactory } from "./csv-connector";
import { curatedConnectorFactory } from "./curated-connector";
import { shopifyConnectorFactory } from "./shopify-connector";
import { woocommerceConnectorFactory } from "./woocommerce-connector";
import type { ConnectorFactory, ShopConnector, ShopRecord } from "./types";

// Register new connector types here (e.g. affiliate_network, rest_api).
const FACTORIES: Record<string, ConnectorFactory> = {
  feed_csv: csvConnectorFactory,
  curated_json: curatedConnectorFactory,
  shopify: shopifyConnectorFactory,
  woocommerce: woocommerceConnectorFactory,
};

export function registerConnector(type: string, factory: ConnectorFactory) {
  FACTORIES[type] = factory;
}

export function connectorFor(shop: ShopRecord): ShopConnector {
  const f = FACTORIES[shop.connector_type];
  if (!f) throw new Error(`No connector registered for type "${shop.connector_type}"`);
  return f(shop);
}
