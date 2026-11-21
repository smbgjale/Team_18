"use client";

import { RoundedBox } from "@react-three/drei";
import { DoubleSide, FrontSide } from "three";
import type { Category } from "@/lib/categories";
import type { Dims } from "@/lib/scene-layout";

// Simplified procedural stand-ins: each one is sized to the product's real width, depth and
// height and uses its colour, but the shape is generic for the category. Origin is the centre of
// the footprint on the floor; the front faces +z.

type V3 = [number, number, number];

interface BoxProps {
  size: V3;
  at: V3;
  color: string;
  radius?: number;
  roughness?: number;
  metalness?: number;
  emissive?: string;
}

function Box({ size, at, color, radius, roughness = 0.8, metalness = 0, emissive }: BoxProps) {
  const material = <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} emissive={emissive ?? "#000000"} emissiveIntensity={emissive ? 0.6 : 0} />;
  const r = radius ? Math.min(radius, Math.min(...size) / 2 - 0.001) : 0;
  if (r > 0.002) {
    return (
      <RoundedBox args={size} radius={r} smoothness={3} position={at} castShadow receiveShadow>
        {material}
      </RoundedBox>
    );
  }
  return (
    <mesh position={at} castShadow receiveShadow>
      <boxGeometry args={size} />
      {material}
    </mesh>
  );
}

function Cyl({ rTop, rBottom, h, at, color, roughness = 0.6, metalness = 0, emissive, open, rot }: {
  rTop: number; rBottom?: number; h: number; at: V3; color: string; roughness?: number; metalness?: number; emissive?: string; open?: boolean; rot?: V3;
}) {
  return (
    <mesh position={at} rotation={rot} castShadow receiveShadow>
      <cylinderGeometry args={[rTop, rBottom ?? rTop, h, 28, 1, open]} />
      <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} emissive={emissive ?? "#000000"} emissiveIntensity={emissive ? 0.8 : 0} side={open ? DoubleSide : FrontSide} />
    </mesh>
  );
}

// Elliptical slab: `size` is [width, thickness, depth].
function Disc({ size, at, color, roughness = 0.6, rot }: { size: V3; at: V3; color: string; roughness?: number; rot?: V3 }) {
  return (
    <mesh position={at} rotation={rot} scale={size} castShadow receiveShadow>
      <cylinderGeometry args={[0.5, 0.5, 1, 48]} />
      <meshStandardMaterial color={color} roughness={roughness} />
    </mesh>
  );
}

function Legs({ w, d, h, inset, color, r = 0.018 }: { w: number; d: number; h: number; inset: number; color: string; r?: number }) {
  const xs = [-(w / 2 - inset), w / 2 - inset];
  const zs = [-(d / 2 - inset), d / 2 - inset];
  return (
    <>
      {xs.flatMap((x) => zs.map((z) => <Cyl key={`${x}:${z}`} rTop={r} h={h} at={[x, h / 2, z]} color={color} roughness={0.5} />))}
    </>
  );
}

const LINEN = "#efebe3";

function Seating({ w, d, h, color, accent, seats }: { w: number; d: number; h: number; color: string; accent: string; seats: number }) {
  const leg = 0.09;
  const seatTop = Math.min(0.46, h * 0.52);
  const arm = Math.min(0.2, w * 0.12);
  const backD = Math.min(0.22, d * 0.24);
  const cushionW = (w - arm * 2) / seats;
  return (
    <group>
      <Legs w={w} d={d} h={leg} inset={0.06} color={accent} />
      <Box size={[w, seatTop - leg - 0.1, d]} at={[0, leg + (seatTop - leg - 0.1) / 2, 0]} color={color} radius={0.03} />
      <Box size={[w, h - leg, backD]} at={[0, leg + (h - leg) / 2, -d / 2 + backD / 2]} color={color} radius={0.05} />
      {[-1, 1].map((s) => (
        <Box key={s} size={[arm, h * 0.68 - leg, d]} at={[s * (w / 2 - arm / 2), leg + (h * 0.68 - leg) / 2, 0]} color={color} radius={0.05} />
      ))}
      {Array.from({ length: seats }, (_, i) => (
        <Box key={i} size={[cushionW - 0.015, 0.12, d - backD - 0.02]} at={[-w / 2 + arm + cushionW * (i + 0.5), seatTop - 0.05, backD / 2]} color={color} radius={0.045} roughness={0.95} />
      ))}
    </group>
  );
}

function Table({ w, d, h, color, accent, drawer, round }: { w: number; d: number; h: number; color: string; accent: string; drawer?: boolean; round?: boolean }) {
  const top = 0.035;
  if (round) {
    const legs = Math.min(w, d) > 0.7 ? 4 : 3;
    return (
      <group>
        <Disc size={[w, top, d]} at={[0, h - top / 2, 0]} color={color} roughness={0.55} />
        {Array.from({ length: legs }, (_, i) => {
          const a = (i / legs) * Math.PI * 2 + Math.PI / 4;
          return <Cyl key={i} rTop={0.02} h={h - top} at={[Math.cos(a) * w * 0.3, (h - top) / 2, Math.sin(a) * d * 0.3]} color={accent} roughness={0.5} />;
        })}
      </group>
    );
  }
  return (
    <group>
      <Box size={[w, top, d]} at={[0, h - top / 2, 0]} color={color} radius={0.008} roughness={0.55} />
      <Legs w={w} d={d} h={h - top} inset={Math.min(0.06, w * 0.12)} color={accent} r={Math.min(0.022, w * 0.04)} />
      {drawer && <Box size={[w * 0.35, 0.14, d * 0.85]} at={[w * 0.28, h - top - 0.07, 0]} color={color} roughness={0.55} />}
    </group>
  );
}

function Cabinet({ w, d, h, color, accent, doors, legs = 0 }: { w: number; d: number; h: number; color: string; accent: string; doors: number; legs?: number }) {
  const bodyH = h - legs;
  return (
    <group>
      {legs > 0 && <Legs w={w} d={d} h={legs} inset={0.05} color={accent} />}
      <Box size={[w, bodyH, d]} at={[0, legs + bodyH / 2, 0]} color={color} radius={0.01} roughness={0.6} />
      {Array.from({ length: doors - 1 }, (_, i) => (
        <Box key={i} size={[0.006, bodyH - 0.04, 0.004]} at={[-w / 2 + (w / doors) * (i + 1), legs + bodyH / 2, d / 2 + 0.002]} color="#2a2622" />
      ))}
      {Array.from({ length: doors }, (_, i) => (
        <Box key={`h${i}`} size={[0.012, Math.min(0.18, bodyH * 0.3), 0.02]} at={[-w / 2 + (w / doors) * (i + 0.5) + (i % 2 ? -1 : 1) * (w / doors) * 0.35, legs + bodyH * 0.55, d / 2 + 0.01]} color={accent} metalness={0.6} roughness={0.3} />
      ))}
    </group>
  );
}

function Lampshade({ r, h, y, color }: { r: number; h: number; y: number; color: string }) {
  return (
    <group position={[0, y, 0]}>
      <Cyl rTop={r * 0.72} rBottom={r} h={h} at={[0, 0, 0]} color={color} roughness={0.9} open emissive="#ffdca8" />
      <pointLight position={[0, -h * 0.2, 0]} intensity={0.9} distance={4} decay={2} color="#ffd8a0" />
    </group>
  );
}

export function FurnitureModel({ category, dims, color, accent, round, cord = 0.5 }: {
  category: Category; dims: Dims; color: string; accent: string; round?: boolean; cord?: number;
}) {
  const { w, d, h } = dims;
  switch (category) {
    case "sofa":
      return <Seating w={w} d={d} h={h} color={color} accent={accent} seats={w > 1.7 ? 3 : 2} />;
    case "armchair":
      return <Seating w={w} d={d} h={h} color={color} accent={accent} seats={1} />;
    case "bed": {
      const frame = Math.min(0.32, h * 0.35);
      return (
        <group>
          <Box size={[w, frame - 0.06, d]} at={[0, 0.06 + (frame - 0.06) / 2, 0]} color={color} radius={0.02} />
          <Legs w={w} d={d} h={0.06} inset={0.08} color={accent} />
          <Box size={[w - 0.04, 0.22, d - 0.1]} at={[0, frame + 0.11, 0.03]} color={LINEN} radius={0.05} roughness={0.95} />
          <Box size={[w + 0.02, 0.06, d * 0.62]} at={[0, frame + 0.22, d * 0.19]} color={color} radius={0.03} roughness={0.95} />
          <Box size={[w, h, 0.08]} at={[0, h / 2, -d / 2 + 0.04]} color={color} radius={0.03} />
          {[-1, 1].map((s) => (
            <Box key={s} size={[w * 0.38, 0.13, 0.36]} at={[s * w * 0.23, frame + 0.28, -d / 2 + 0.3]} color="#fbfaf7" radius={0.06} roughness={1} />
          ))}
        </group>
      );
    }
    case "coffee_table":
    case "side_table":
    case "dining_table":
      return <Table w={w} d={d} h={h} color={color} accent={accent} round={round} />;
    case "desk":
      return <Table w={w} d={d} h={h} color={color} accent={accent} drawer />;
    case "chair": {
      const seat = Math.min(0.46, h * 0.55);
      return (
        <group>
          <Legs w={w} d={d} h={seat - 0.04} inset={0.04} color={accent} r={0.015} />
          <Box size={[w, 0.05, d * 0.92]} at={[0, seat - 0.02, 0.02]} color={color} radius={0.02} />
          <Box size={[w, h - seat, 0.04]} at={[0, seat + (h - seat) / 2, -d / 2 + 0.03]} color={color} radius={0.015} />
        </group>
      );
    }
    case "wardrobe":
      return <Cabinet w={w} d={d} h={h} color={color} accent={accent} doors={w > 1.4 ? 3 : 2} legs={0.05} />;
    case "tv_unit":
      return <Cabinet w={w} d={d} h={h} color={color} accent={accent} doors={w > 1.5 ? 3 : 2} legs={0.1} />;
    case "shelf": {
      const shelves = Math.max(2, Math.round(h / 0.38));
      return (
        <group>
          {[-1, 1].map((s) => <Box key={s} size={[0.025, h, d]} at={[s * (w / 2 - 0.0125), h / 2, 0]} color={color} />)}
          <Box size={[w, h, 0.01]} at={[0, h / 2, -d / 2 + 0.005]} color={color} />
          {Array.from({ length: shelves + 1 }, (_, i) => (
            <Box key={i} size={[w - 0.05, 0.022, d]} at={[0, 0.02 + (i * (h - 0.04)) / shelves, 0]} color={color} />
          ))}
        </group>
      );
    }
    case "rug":
      return round
        ? <Disc size={[w, Math.max(0.008, h), d]} at={[0, Math.max(0.008, h) / 2, 0]} color={color} roughness={1} />
        : <Box size={[w, Math.max(0.008, h), d]} at={[0, Math.max(0.008, h) / 2, 0]} color={color} roughness={1} />;
    case "curtains": {
      const panel = w * 0.3;
      const folds = 6;
      return (
        <group>
          <Cyl rTop={0.012} h={w + 0.2} at={[0, h + 0.03, 0.02]} rot={[0, 0, Math.PI / 2]} color={accent} metalness={0.6} roughness={0.3} />
          {[-1, 1].map((s) => (
            <group key={s} position={[s * (w / 2 - panel / 2), 0, 0]}>
              {Array.from({ length: folds }, (_, i) => (
                <Cyl key={i} rTop={panel / folds / 1.6} h={h} at={[-panel / 2 + (panel / folds) * (i + 0.5), h / 2, (i % 2) * 0.015]} color={color} roughness={1} />
              ))}
            </group>
          ))}
        </group>
      );
    }
    case "ceiling_light":
      return (
        <group>
          <Cyl rTop={0.006} h={cord} at={[0, h + cord / 2, 0]} color="#222222" />
          <Lampshade r={w / 2} h={h * 0.75} y={h * 0.5} color={color} />
        </group>
      );
    case "floor_lamp": {
      const shadeH = Math.min(0.35, h * 0.22);
      return (
        <group>
          <Cyl rTop={w * 0.36} h={0.03} at={[0, 0.015, 0]} color={accent} metalness={0.5} roughness={0.4} />
          <Cyl rTop={0.012} h={h - shadeH} at={[0, (h - shadeH) / 2, 0]} color={accent} metalness={0.5} roughness={0.4} />
          <Lampshade r={w / 2} h={shadeH} y={h - shadeH / 2} color={color} />
        </group>
      );
    }
    case "table_lamp":
      return (
        <group>
          <Cyl rTop={w * 0.2} rBottom={w * 0.3} h={h * 0.55} at={[0, h * 0.275, 0]} color={accent} roughness={0.4} />
          <Lampshade r={w / 2} h={h * 0.45} y={h * 0.775} color={color} />
        </group>
      );
    case "wall_art":
      return (
        <group>
          <Box size={[w, h, Math.max(0.02, d)]} at={[0, h / 2, 0]} color="#2a2622" />
          <Box size={[w - 0.05, h - 0.05, 0.005]} at={[0, h / 2, Math.max(0.02, d) / 2]} color={color} roughness={0.9} />
        </group>
      );
    case "mirror":
      if (round) {
        const t = Math.max(0.02, d);
        return (
          <group>
            <Disc size={[w, t, h]} at={[0, h / 2, 0]} rot={[Math.PI / 2, 0, 0]} color={color} />
            <mesh position={[0, h / 2, t / 2 + 0.002]} scale={[w - 0.05, h - 0.05, 1]}>
              <circleGeometry args={[0.5, 48]} />
              <meshStandardMaterial color="#e8eef0" metalness={1} roughness={0.05} />
            </mesh>
          </group>
        );
      }
      return (
        <group>
          <Box size={[w, h, Math.max(0.02, d)]} at={[0, h / 2, 0]} color={color} radius={0.01} />
          <Box size={[w - 0.05, h - 0.05, 0.004]} at={[0, h / 2, Math.max(0.02, d) / 2]} color="#e8eef0" metalness={1} roughness={0.05} />
        </group>
      );
    case "plant_pot":
      return (
        <group>
          <Cyl rTop={w / 2} rBottom={w * 0.36} h={h} at={[0, h / 2, 0]} color={color} roughness={0.7} />
          {[[0, 1.25, 0, 0.36], [0.12, 1.05, 0.08, 0.26], [-0.1, 1.1, -0.06, 0.28]].map(([x, y, z, r], i) => (
            <mesh key={i} position={[x * w * 2, h * y + w * r, z * w * 2]} castShadow>
              <sphereGeometry args={[w * r * 1.2, 16, 12]} />
              <meshStandardMaterial color={i ? "#4f7a4a" : "#5d8a55"} roughness={0.9} />
            </mesh>
          ))}
        </group>
      );
    case "cushion":
      return <Box size={[w, h, Math.max(0.1, d)]} at={[0, h / 2, 0]} color={color} radius={0.05} roughness={1} />;
  }
}

// Accent colour for legs and handles, taken from the product's listed materials.
export function accentFor(materials: string[]) {
  const m = materials.join(" ").toLowerCase();
  if (/brass|gold/.test(m)) return "#b08d57";
  if (/metal|steel|iron|aluminium/.test(m)) return "#2d2d2d";
  if (/walnut/.test(m)) return "#5a3d2b";
  if (/oak|ash|birch|pine|beech/.test(m)) return "#b98d5f";
  if (/rattan|cane|bamboo/.test(m)) return "#b48a58";
  return "#4a3b30";
}
