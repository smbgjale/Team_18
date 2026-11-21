import { DIRECTIONS, STYLES } from "@/lib/styles";

export async function GET() {
  return Response.json({
    directions: DIRECTIONS.map(({ id, name, description, swatches }) => ({ id, name, description, swatches })),
    items: STYLES.map(({ id, name, direction, description, swatches }) => ({ id, name, direction, description, swatches })),
  });
}
