import { CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";

export async function GET() {
  return Response.json({ items: CATEGORIES.map((id) => ({ id, name: CATEGORY_LABELS[id] })) });
}
