import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_DIMS_CM, ROOM_ITEMS, itemQuantity, type Category, type RoomType } from "../src/lib/categories";
import { clampToRoom, defaultLayout, fitsInRoom, halfExtents, hostOf, isDraggable, normaliseRot } from "../src/lib/scene-layout";

const dims = (c: Category) => {
  const [w, d, h] = DEFAULT_DIMS_CM[c];
  return { w: w / 100, d: d / 100, h: h / 100 };
};

for (const roomType of Object.keys(ROOM_ITEMS) as RoomType[]) {
  test(`default ${roomType} layout keeps every floor item inside the room`, () => {
    const room = { width: 4.2, length: 3.8, height: 2.6 };
    const items = ROOM_ITEMS[roomType].map((category, i) => ({ id: `i${i}`, category, quantity: itemQuantity(category, roomType), dims: dims(category) }));
    const layout = defaultLayout(items, room);
    for (const it of items) {
      assert.equal(layout[it.id]?.length, it.quantity, `${it.category} has a placement per unit`);
      for (const p of layout[it.id]) {
        const { hx, hz } = halfExtents(it.dims, p.rot);
        assert.ok(Math.abs(p.x) <= room.width / 2 - hx + 0.06, `${it.category} x inside`);
        assert.ok(Math.abs(p.z) <= room.length / 2 - hz + 0.06, `${it.category} z inside`);
      }
    }
  });
}

test("sofa goes against the back wall with the coffee table in front of it", () => {
  const room = { width: 5, length: 4.2, height: 2.6 };
  const items = (["sofa", "coffee_table"] as Category[]).map((c) => ({ id: c, category: c, quantity: 1, dims: dims(c) }));
  const layout = defaultLayout(items, room);
  assert.ok(layout.sofa[0].z < -1.5);
  assert.ok(layout.coffee_table[0].z > layout.sofa[0].z + dims("sofa").d / 2);
});

test("clamping, rotation and attachment rules", () => {
  const room = { width: 3, length: 3, height: 2.6 };
  const p = clampToRoom({ x: 9, z: -9, rot: 450 }, { w: 2, d: 1, h: 1 }, room);
  assert.deepEqual(p, { x: 1, z: -0.5, rot: 90 });
  const rotated = clampToRoom({ x: 9, z: 0, rot: 90 }, { w: 2, d: 1, h: 1 }, room);
  assert.equal(rotated.x, 1);
  assert.equal(normaliseRot(-270), 90);
  assert.equal(normaliseRot(180), -180);
  assert.equal(fitsInRoom({ w: 3.2, d: 1, h: 1 }, room), false);
  const present = new Set<Category>(["sofa", "cushion", "table_lamp", "wall_art"]);
  assert.equal(hostOf("cushion", present), "sofa");
  assert.equal(hostOf("table_lamp", present), null);
  assert.equal(isDraggable("cushion", present), false);
  assert.equal(isDraggable("table_lamp", present), true);
  assert.equal(isDraggable("wall_art", present), false);
});
