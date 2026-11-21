import { STYLES } from "@/lib/styles";

export async function GET() {
  return Response.json({ items: STYLES.map(({ id, name, description, swatches }) => ({ id, name, description, swatches })) });
}
