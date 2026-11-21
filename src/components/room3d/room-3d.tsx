"use client";

/* eslint-disable @next/next/no-img-element */
import { OrbitControls } from "@react-three/drei";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { ExternalLink, Move, RotateCw, Undo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoxGeometry, Plane, Vector3 } from "three";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProductModelDto, SceneDto, SceneItemDto } from "@/lib/api-types";
import { CATEGORY_LABELS, WALL_MOUNTED, type Category } from "@/lib/categories";
import { formatMoney } from "@/lib/format";
import {
  baseHeight, clampToRoom, defaultLayout, fitsInRoom, hostOf, isDraggable, normaliseRot, windowSpec,
  type Dims, type Placement, type SceneRoom,
} from "@/lib/scene-layout";
import { cn } from "@/lib/utils";
import { GlbFurniture } from "./glb-model";
import { accentFor, FurnitureModel } from "./models";

type Layouts = Record<string, Placement[]>;
interface Selection { id: string; idx: number }

const FLOOR = new Plane(new Vector3(0, 1, 0), 0);
const HIT = new Vector3();
const rad = (deg: number) => (deg * Math.PI) / 180;
const toRoom = (s: SceneDto): SceneRoom => ({ width: s.room.width_m, length: s.room.length_m, height: s.room.height_m });
const inputsFor = (s: SceneDto) => s.items.map((i) => ({ id: i.id, category: i.category as Category, quantity: i.quantity, dims: i.dims_m }));
const cm = (m: number) => Math.round(m * 100);

function initialLayouts(scene: SceneDto): Layouts {
  const defaults = defaultLayout(inputsFor(scene), toRoom(scene));
  return Object.fromEntries(scene.items.map((i) => [i.id, i.layout && i.layout.length === i.quantity ? i.layout : defaults[i.id] ?? []]));
}

function attachedPlacement(hostCategory: Category, category: Category, host: Placement, hostDims: Dims): Placement {
  const local =
    category === "table_lamp" ? { x: hostDims.w * 0.25, z: -hostDims.d * 0.15 }
      : hostCategory === "bed" ? { x: 0, z: -hostDims.d * 0.3 }
        : { x: -hostDims.w * 0.28, z: -hostDims.d * 0.12 };
  const r = rad(host.rot);
  return { x: host.x + local.x * Math.cos(r) + local.z * Math.sin(r), z: host.z - local.x * Math.sin(r) + local.z * Math.cos(r), rot: host.rot };
}

function displayDims(item: SceneItemDto, room: SceneRoom): Dims {
  return item.category === "curtains" ? { ...item.dims_m, h: Math.min(item.dims_m.h, room.height - 0.12) } : item.dims_m;
}

function RoomShell({ room, wall, floor }: { room: SceneRoom; wall: string; floor: string }) {
  const { width: W, length: L, height: H } = room;
  const win = windowSpec(room);
  const frame = "#f7f5f0";
  const skirting = [
    { size: [W, 0.08, 0.015] as const, at: [0, 0.04, -L / 2 + 0.008] as const },
    { size: [0.015, 0.08, L] as const, at: [-W / 2 + 0.008, 0.04, 0] as const },
    { size: [0.015, 0.08, L] as const, at: [W / 2 - 0.008, 0.04, 0] as const },
  ];
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[W, L]} />
        <meshStandardMaterial color={floor} roughness={0.8} />
      </mesh>
      <mesh position={[0, H / 2, -L / 2]} receiveShadow>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial color={wall} roughness={0.95} />
      </mesh>
      <mesh position={[-W / 2, H / 2, 0]} rotation-y={Math.PI / 2} receiveShadow>
        <planeGeometry args={[L, H]} />
        <meshStandardMaterial color={wall} roughness={0.95} />
      </mesh>
      <mesh position={[W / 2, H / 2, 0]} rotation-y={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[L, H]} />
        <meshStandardMaterial color={wall} roughness={0.95} />
      </mesh>
      <group position={[win.x, win.bottom + win.height / 2, -L / 2]}>
        <mesh position={[0, 0, 0.004]}>
          <planeGeometry args={[win.width, win.height]} />
          <meshStandardMaterial color="#d6e7f3" emissive="#d9ecff" emissiveIntensity={0.85} />
        </mesh>
        {[
          { size: [win.width + 0.08, 0.05, 0.05], at: [0, win.height / 2, 0.02] },
          { size: [win.width + 0.08, 0.05, 0.08], at: [0, -win.height / 2, 0.035] },
          { size: [0.05, win.height, 0.05], at: [-win.width / 2, 0, 0.02] },
          { size: [0.05, win.height, 0.05], at: [win.width / 2, 0, 0.02] },
          { size: [0.03, win.height, 0.03], at: [0, 0, 0.015] },
        ].map((b, i) => (
          <mesh key={i} position={b.at as [number, number, number]} castShadow>
            <boxGeometry args={b.size as [number, number, number]} />
            <meshStandardMaterial color={frame} roughness={0.6} />
          </mesh>
        ))}
      </group>
      {skirting.map((s, i) => (
        <mesh key={i} position={[...s.at]} receiveShadow>
          <boxGeometry args={[...s.size]} />
          <meshStandardMaterial color={frame} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function SelectionOutline({ dims }: { dims: Dims }) {
  const box = useMemo(() => new BoxGeometry(dims.w + 0.04, Math.max(0.03, dims.h) + 0.04, Math.max(0.03, dims.d) + 0.04), [dims.w, dims.h, dims.d]);
  return (
    <lineSegments position={[0, dims.h / 2, 0]} raycast={() => null}>
      <edgesGeometry args={[box]} />
      <lineBasicMaterial color="#2563eb" />
    </lineSegments>
  );
}

interface SceneProps {
  scene: SceneDto;
  layouts: Layouts;
  selected: Selection | null;
  onSelect: (s: Selection) => void;
  onMove: (id: string, idx: number, p: Placement) => void;
}

function Furniture({ scene, layouts, selected, onSelect, onMove }: SceneProps) {
  const get = useThree((s) => s.get);
  const drag = useRef<{ id: string; idx: number; dx: number; dz: number } | null>(null);
  const room = toRoom(scene);
  const present = new Set(scene.items.map((i) => i.category as Category));
  const byCategory = new Map(scene.items.map((i) => [i.category as Category, i]));

  const setOrbit = (enabled: boolean) => {
    const controls = get().controls as unknown as { enabled: boolean } | null;
    if (controls) controls.enabled = enabled;
  };

  return (
    <>
      {scene.items.flatMap((item) => {
        const category = item.category as Category;
        const hostCategory = hostOf(category, present);
        const host = hostCategory ? byCategory.get(hostCategory) : undefined;
        const hostPlacement = host ? layouts[host.id]?.[0] : undefined;
        const dims = displayDims(item, room);
        const draggable = isDraggable(category, present);
        return (layouts[item.id] ?? []).map((p, idx) => {
          const placed = host && hostPlacement && hostCategory ? attachedPlacement(hostCategory, category, hostPlacement, host.dims_m) : p;
          const y = baseHeight(category, dims, room, host && hostPlacement ? host.dims_m.h : null);
          const isSelected = selected?.id === item.id && selected.idx === idx;
          return (
            <group
              key={`${item.id}:${idx}`}
              position={[placed.x, y, placed.z]}
              rotation-y={rad(placed.rot)}
              onPointerDown={(e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                onSelect({ id: item.id, idx });
                if (!draggable || (e.pointerType === "mouse" && e.button !== 0)) return;
                if (!e.ray.intersectPlane(FLOOR, HIT)) return;
                drag.current = { id: item.id, idx, dx: HIT.x - p.x, dz: HIT.z - p.z };
                (e.target as unknown as Element).setPointerCapture(e.pointerId);
                setOrbit(false);
              }}
              onPointerMove={(e: ThreeEvent<PointerEvent>) => {
                const d = drag.current;
                if (!d || d.id !== item.id || d.idx !== idx) return;
                e.stopPropagation();
                if (!e.ray.intersectPlane(FLOOR, HIT)) return;
                onMove(item.id, idx, clampToRoom({ x: HIT.x - d.dx, z: HIT.z - d.dz, rot: p.rot }, item.dims_m, room));
              }}
              onPointerUp={(e: ThreeEvent<PointerEvent>) => {
                if (!drag.current) return;
                e.stopPropagation();
                (e.target as unknown as Element).releasePointerCapture(e.pointerId);
                drag.current = null;
                setOrbit(true);
              }}
              onPointerOver={(e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                document.body.style.cursor = draggable ? "grab" : "pointer";
              }}
              onPointerOut={() => {
                document.body.style.cursor = "";
              }}
            >
              {item.model.status === "ready" && item.model.url ? (
                <GlbFurniture
                  url={item.model.url}
                  dims={dims}
                  fallback={
                    <FurnitureModel
                      category={category}
                      dims={dims}
                      color={item.color_hex}
                      accent={accentFor(item.product.materials)}
                      round={item.round}
                      cord={category === "ceiling_light" ? Math.max(0.1, room.height - y - dims.h) : undefined}
                    />
                  }
                />
              ) : (
                <FurnitureModel
                  category={category}
                  dims={dims}
                  color={item.color_hex}
                  accent={accentFor(item.product.materials)}
                  round={item.round}
                  cord={category === "ceiling_light" ? Math.max(0.1, room.height - y - dims.h) : undefined}
                />
              )}
              {isSelected && <SelectionOutline dims={dims} />}
            </group>
          );
        });
      })}
    </>
  );
}

export default function Room3D({ designId, version }: { designId: string; version: number }) {
  const [scene, setScene] = useState<SceneDto | null>(null);
  const [failed, setFailed] = useState(false);
  const [layouts, setLayouts] = useState<Layouts>({});
  const [selected, setSelected] = useState<Selection | null>(null);
  const [dirty, setDirty] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [roomDraft, setRoomDraft] = useState<{ width: string; length: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [modelBusy, setModelBusy] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [modelNote, setModelNote] = useState<string | null>(null);
  const roomChanged = useRef(false);
  const pendingModels = scene?.items.some((item) => item.model.status === "pending") ?? false;

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/designs/${designId}/scene`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json: SceneDto) => {
        setScene(json);
        setLayouts(initialLayouts(json));
        setFailed(false);
      })
      .catch((e) => e?.name !== "AbortError" && setFailed(true));
    return () => ctrl.abort();
  }, [designId, version, attempt]);

  useEffect(() => {
    if (!dirty || !scene) return;
    const t = setTimeout(() => {
      setSaveState("saving");
      const body: Record<string, unknown> = { items: Object.entries(layouts).filter(([, l]) => l.length).map(([id, layout]) => ({ id, layout })) };
      if (roomChanged.current) body.room = { width_m: scene.room.width_m, length_m: scene.room.length_m };
      fetch(`/api/designs/${designId}/scene`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then((r) => {
          if (!r.ok) throw new Error();
          roomChanged.current = false;
          setSaveState("saved");
        })
        .catch(() => setSaveState("error"));
    }, 700);
    return () => clearTimeout(t);
  }, [dirty, layouts, scene, designId]);

  useEffect(() => {
    if (!pendingModels) return;
    const apply = (items: { product_id: string; model: ProductModelDto }[]) => {
      const byProduct = new Map(items.map((item) => [item.product_id, item.model]));
      setScene((prev) => prev && {
        ...prev,
        items: prev.items.map((item) => {
          const model = byProduct.get(item.product.id);
          return model ? { ...item, model } : item;
        }),
      });
    };
    const tick = () => {
      fetch(`/api/designs/${designId}/models`)
        .then((r) => (r.ok ? r.json() : null))
        .then((body: { items?: { product_id: string; model: ProductModelDto }[] } | null) => body?.items && apply(body.items))
        .catch(() => undefined);
    };
    const timer = setInterval(tick, 4000);
    return () => clearInterval(timer);
  }, [pendingModels, designId]);

  const change = useCallback((next: (prev: Layouts) => Layouts) => {
    setLayouts(next);
    setDirty((n) => n + 1);
  }, []);

  const onMove = useCallback((id: string, idx: number, p: Placement) => {
    change((prev) => ({ ...prev, [id]: prev[id].map((q, i) => (i === idx ? p : q)) }));
  }, [change]);

  if (failed) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center" role="alert">
        <p className="text-sm">The 3D view could not be loaded.</p>
        <Button variant="outline" size="sm" onClick={() => { setFailed(false); setAttempt((n) => n + 1); }}>Try again</Button>
      </div>
    );
  }
  if (!scene) return <Skeleton className="aspect-[16/10] w-full rounded-xl" />;
  if (!scene.items.length) {
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        This design has no products to place yet. Generate a new design to furnish the room with real products.
      </p>
    );
  }

  const room = toRoom(scene);
  const present = new Set(scene.items.map((i) => i.category as Category));
  const selItem = selected ? scene.items.find((i) => i.id === selected.id) : undefined;
  const selCategory = selItem?.category as Category | undefined;
  const selDraggable = !!selCategory && isDraggable(selCategory, present);
  const tooBig = scene.items.filter((i) => !WALL_MOUNTED.includes(i.category as Category) && !fitsInRoom(i.dims_m, room));
  const M = Math.max(room.width, room.length);
  const modelStates = scene.items.map((item) => item.model);
  const readyModels = modelStates.filter((model) => model.status === "ready");
  const needsModels = modelStates.filter((model) => model.status === "missing" || model.status === "failed").length;
  const pendingCount = modelStates.filter((model) => model.status === "pending").length;
  const photoPreview = readyModels.some((model) => model.preview);
  const generatedMesh = readyModels.some((model) => model.provider === "meshy");
  const modelBadge = readyModels.length === 0
    ? "Real sizes, simplified shapes"
    : readyModels.length === modelStates.length
      ? generatedMesh && !photoPreview ? "Generated 3D models" : photoPreview && !generatedMesh ? "Saved photo models" : "Saved 3D models"
      : "Some pieces are 3D models";
  const failedModel = scene.items.find((item) => item.model.status === "failed" && item.model.error);

  const rotate = () => {
    if (!selected || !selItem) return;
    change((prev) => ({
      ...prev,
      [selected.id]: prev[selected.id].map((q, i) => (i === selected.idx ? clampToRoom({ ...q, rot: normaliseRot(q.rot + 90) }, selItem.dims_m, room) : q)),
    }));
  };

  const nudge = (dx: number, dz: number) => {
    if (!selected || !selItem || !selDraggable) return;
    change((prev) => ({
      ...prev,
      [selected.id]: prev[selected.id].map((q, i) => (i === selected.idx ? clampToRoom({ ...q, x: q.x + dx, z: q.z + dz }, selItem.dims_m, room) : q)),
    }));
  };

  const resetLayout = () => change(() => defaultLayout(inputsFor(scene), room));

  const createModels = () => {
    setModelBusy(true);
    setModelError(null);
    setModelNote(null);
    fetch(`/api/designs/${designId}/models`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (!r.ok) throw new Error(body?.error?.message ?? "The 3D models could not be created.");
        const byProduct = new Map<string, ProductModelDto>((body.items ?? []).map((item: { product_id: string; model: ProductModelDto }) => [item.product_id, item.model]));
        setScene((prev) => prev && {
          ...prev,
          items: prev.items.map((item) => {
            const model = byProduct.get(item.product.id);
            return model ? { ...item, model } : item;
          }),
        });
        if (body.notice) setModelNote(body.notice);
      })
      .catch((e: Error) => setModelError(e.message))
      .finally(() => setModelBusy(false));
  };

  const applyRoom = () => {
    if (!roomDraft) return;
    const width = Number(roomDraft.width);
    const length = Number(roomDraft.length);
    if (!(width >= 2 && width <= 15 && length >= 2 && length <= 15)) return;
    const next: SceneDto = { ...scene, room: { ...scene.room, width_m: width, length_m: length } };
    const nextRoom = toRoom(next);
    const defaults = defaultLayout(inputsFor(next), nextRoom);
    roomChanged.current = true;
    setScene(next);
    setRoomDraft(null);
    change((prev) => Object.fromEntries(scene.items.map((i) => [
      i.id,
      WALL_MOUNTED.includes(i.category as Category) ? defaults[i.id] : (prev[i.id] ?? defaults[i.id]).map((q) => clampToRoom(q, i.dims_m, nextRoom)),
    ])));
  };

  return (
    <div className="space-y-4">
      <div
        className="relative overflow-hidden rounded-xl border bg-[#f3f1ec] outline-none focus-visible:ring-2 focus-visible:ring-primary"
        tabIndex={0}
        aria-label="Interactive 3D room. Select a product, then use the arrow keys to move it and R to rotate it."
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.5 : 0.1;
          const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
          if (moves[e.key]) { e.preventDefault(); nudge(...moves[e.key]); }
          if (e.key === "r" || e.key === "R") rotate();
          if (e.key === "Escape") setSelected(null);
        }}
      >
        <div className="aspect-[4/3] w-full sm:aspect-[16/10]">
          <Canvas
            shadows="percentage"
            dpr={[1, 2]}
            camera={{ position: [room.width * 0.45, M * 0.95 + 0.8, room.length / 2 + M * 0.95], fov: 42, near: 0.1, far: 100 }}
            onPointerMissed={() => setSelected(null)}
            fallback={<p className="p-8 text-center text-sm text-muted-foreground">Your browser cannot display 3D graphics (WebGL is turned off or unsupported).</p>}
          >
            <color attach="background" args={["#f3f1ec"]} />
            <hemisphereLight args={["#ffffff", "#cbbba5", 0.85]} />
            <ambientLight intensity={0.25} />
            <directionalLight
              position={[room.width * 0.4, room.height * 2.2, room.length * 1.1]}
              intensity={1.5}
              castShadow
              shadow-mapSize={[2048, 2048]}
              shadow-camera-left={-M}
              shadow-camera-right={M}
              shadow-camera-top={M}
              shadow-camera-bottom={-M}
              shadow-bias={-0.0004}
            />
            <RoomShell room={room} wall={scene.room.wall_hex} floor={scene.room.floor_hex} />
            <Furniture scene={scene} layouts={layouts} selected={selected} onSelect={setSelected} onMove={onMove} />
            <OrbitControls makeDefault target={[0, 0.6, 0]} enableDamping maxPolarAngle={Math.PI / 2 - 0.08} minDistance={1.5} maxDistance={M * 3} />
          </Canvas>
        </div>
        <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="bg-background/90">{modelBadge}</Badge>
          <Badge variant="outline" className="bg-background/90">Room {room.width.toFixed(1)} x {room.length.toFixed(1)} m</Badge>
          {saveState === "saving" && <Badge variant="outline" className="bg-background/90">Saving...</Badge>}
          {saveState === "saved" && <Badge variant="outline" className="bg-background/90">Layout saved</Badge>}
          {saveState === "error" && <Badge variant="destructive">Could not save layout</Badge>}
        </div>
        {selItem && (
          <div className="pointer-events-none absolute inset-x-0 top-12 flex justify-center px-3">
            <span className="max-w-full truncate rounded-md bg-foreground/90 px-2.5 py-1 text-xs font-medium text-background shadow">
              {selItem.product.name}{selDraggable ? " · drag to move, R to rotate" : ""}
            </span>
          </div>
        )}
        <p className="pointer-events-none absolute inset-x-3 bottom-2 text-center text-[11px] text-muted-foreground">
          <Move className="mr-1 inline size-3" />Drag furniture to move it · drag empty space to look around · scroll or pinch to zoom
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium">3D models from the catalogue photos</p>
          <p className="text-sm text-muted-foreground">
            The redesign above stays an AI image of your room, with the same walls, windows and doors. These models use the same products and are saved, so a product is not converted again.
            {(photoPreview || readyModels.length === 0) && " Without an image-to-3D key, each model is a saved GLB textured with the catalogue photo. Set MESHY_API_KEY for a generated mesh."}
          </p>
          {modelNote && <p className="text-sm text-muted-foreground">{modelNote}</p>}
          {modelError && <p className="text-sm text-destructive" role="alert">{modelError}</p>}
          {failedModel && <p className="text-sm text-destructive" role="alert">{failedModel.product.name}: {failedModel.model.error}</p>}
        </div>
        {(needsModels > 0 || pendingCount > 0) && (
          <Button className="shrink-0" onClick={createModels} disabled={modelBusy || pendingCount > 0}>
            {modelBusy || pendingCount > 0 ? "Creating 3D models..." : needsModels === scene.items.length ? "Create 3D models" : `Create ${needsModels} remaining`}
          </Button>
        )}
      </div>

      {tooBig.length > 0 && (
        <p className="rounded-lg border border-amber-400/50 bg-amber-50 p-3 text-sm text-amber-900">
          {tooBig.map((i) => i.product.name).join(", ")} {tooBig.length === 1 ? "is" : "are"} larger than this room. Check the room size below or choose a smaller product.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <div className="space-y-3 rounded-xl border bg-card p-4">
          {selItem ? (
            <>
              <div className="flex gap-3">
                <img src={selItem.product.image_url} alt="" className="size-20 shrink-0 rounded-lg border object-cover" />
                <div className="min-w-0 space-y-0.5">
                  <p className="text-xs text-muted-foreground">{CATEGORY_LABELS[selItem.category as Category]} · {selItem.product.shop.name}</p>
                  <p className="font-semibold leading-snug">{selItem.product.name}</p>
                  <p className="text-sm">
                    {formatMoney(selItem.product.sale_price ?? selItem.product.price)}
                    {selItem.quantity > 1 && <span className="text-muted-foreground"> x {selItem.quantity}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {cm(selItem.dims_m.w)} x {cm(selItem.dims_m.d)} x {cm(selItem.dims_m.h)} cm {selItem.dims_from_shop ? "(from the shop)" : "(typical size; the shop gave no dimensions)"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {selDraggable && (
                  <Button variant="outline" size="sm" onClick={rotate}>
                    <RotateCw /> Rotate 90°
                  </Button>
                )}
                <a href={`${selItem.product.product_url}?design=${designId}&item=${selItem.id}`} target="_blank" rel="noopener noreferrer sponsored" className={buttonVariants({ size: "sm" })}>
                  View on shop <ExternalLink className="size-3.5" />
                </a>
              </div>
              {!selDraggable && <p className="text-xs text-muted-foreground">This item is fixed to a wall or sits on another piece of furniture.</p>}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select a piece of furniture in the room or in the list to see its details, rotate it or open it in the shop.</p>
          )}
          <div className="border-t pt-3">
            {roomDraft ? (
              <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); applyRoom(); }}>
                <div className="space-y-1">
                  <Label htmlFor="room-w">Width (m)</Label>
                  <Input id="room-w" type="number" step={0.1} min={2} max={15} value={roomDraft.width} onChange={(e) => setRoomDraft({ ...roomDraft, width: e.target.value })} className="w-24" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="room-l">Length (m)</Label>
                  <Input id="room-l" type="number" step={0.1} min={2} max={15} value={roomDraft.length} onChange={(e) => setRoomDraft({ ...roomDraft, length: e.target.value })} className="w-24" />
                </div>
                <Button type="submit" size="sm">Apply</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setRoomDraft(null)}>Cancel</Button>
              </form>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">
                  Room: {room.width.toFixed(1)} x {room.length.toFixed(1)} m (estimated, edit to match yours)
                </span>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => setRoomDraft({ width: String(room.width), length: String(room.length) })}>Edit size</Button>
                  <Button variant="ghost" size="sm" onClick={resetLayout}><Undo2 /> Reset layout</Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="font-semibold">Products in this room</h3>
            {scene.total && <span className="text-sm">Total <strong>{formatMoney(scene.total)}</strong></span>}
          </div>
          <ul className="divide-y">
            {scene.items.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => setSelected({ id: i.id, idx: 0 })}
                  className={cn("flex w-full items-center gap-2 rounded-md px-1.5 py-2 text-left text-sm hover:bg-muted", selected?.id === i.id && "bg-primary/5")}
                >
                  <span className="size-3.5 shrink-0 rounded-full border" style={{ background: i.color_hex }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">
                    {i.product.name}
                    <span className="text-muted-foreground"> · {CATEGORY_LABELS[i.category as Category]}{i.quantity > 1 ? ` x ${i.quantity}` : ""}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {i.model.status === "ready" ? (i.model.preview ? "Photo" : "3D") : i.model.status === "pending" ? "Creating" : i.model.status === "failed" ? "Failed" : ""}
                  </span>
                  <span className="shrink-0 tabular-nums">{formatMoney(i.product.sale_price ?? i.product.price)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
