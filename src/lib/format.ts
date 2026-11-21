export function formatMoney(m: { amount_minor: number; currency: string } | null | undefined) {
  if (!m) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: m.currency, maximumFractionDigits: 0 }).format(m.amount_minor / 100);
}

export function titleCase(s: string) {
  return s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
