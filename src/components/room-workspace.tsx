"use client";

import { AlertTriangle, Box, Download, Loader2, RefreshCw, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CompareSlider } from "@/components/compare-slider";
import { DirectionPicker } from "@/components/direction-picker";
import { ShopThisLook } from "@/components/shop-this-look";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DesignDto, RoomDto } from "@/lib/api-types";
import { ROOM_TYPE_LABELS, type RoomType } from "@/lib/categories";
import { readApiJson } from "@/lib/api-client";
import { restoreCachedRoom } from "@/lib/room-cache";
import { getDirection, getStyle, stylesFor, type DesignDirection } from "@/lib/styles";
import { cn } from "@/lib/utils";

const Room3D = dynamic(() => import("@/components/room3d/room-3d"), {
  ssr: false,
  loading: () => <Skeleton className="aspect-[16/10] w-full rounded-xl" />,
});

const ACTIVE = ["queued", "rendering", "render_ready", "matching"];
const STEP: Record<string, string> = {
  queued: "Waiting in the queue",
  rendering: "Choosing real products and rendering your room",
  render_ready: "Checking the products in the image",
  matching: "Checking the products in the image",
};

export function RoomWorkspace({ roomId }: { roomId: string }) {
  const [room, setRoom] = useState<RoomDto | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [direction, setDirection] = useState<DesignDirection>("modern");
  const [selectedStyle, setSelectedStyle] = useState("modern");
  const [prompt, setPrompt] = useState("");
  const [budget, setBudget] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [tab, setTab] = useState("3d");
  const [sceneVersion, setSceneVersion] = useState(0);
  const initialised = useRef(false);

  const load = useCallback(async () => {
    let res = await fetch(`/api/rooms/${roomId}`);
    if (res.status === 404) {
      const restored = await restoreCachedRoom(roomId);
      if (restored) res = await fetch(`/api/rooms/${roomId}`);
    }
    if (res.status === 404) return setNotFound(true);
    if (!res.ok) return;
    const json: RoomDto = await res.json();
    setNotFound(false);
    setRoom(json);
    if (!initialised.current) {
      initialised.current = true;
      const latest = json.designs[0];
      const dir = json.design_direction ?? (latest && getStyle(latest.style)?.direction) ?? "modern";
      setDirection(dir);
      setSelectedStyle(latest && getStyle(latest.style)?.direction === dir ? latest.style : stylesFor(dir)[0].id);
      if (latest) setActiveId(latest.id);
    }
  }, [roomId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    load();
  }, [load]);

  const anyActive = room?.designs.some((d) => ACTIVE.includes(d.status));
  useEffect(() => {
    if (!anyActive) return;
    const t = setInterval(load, 1500);
    return () => clearInterval(t);
  }, [anyActive, load]);

  const changeDirection = (d: DesignDirection) => {
    setDirection(d);
    if (getStyle(selectedStyle)?.direction !== d) setSelectedStyle(stylesFor(d)[0].id);
    setRoom((r) => r && { ...r, design_direction: d });
    fetch(`/api/rooms/${roomId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ design_direction: d }) }).catch(() => {});
  };

  const selectStyle = (id: string) => {
    setSelectedStyle(id);
    const d = getStyle(id)?.direction;
    if (d) setDirection(d);
  };

  const generate = async (style = selectedStyle) => {
    setCreating(true);
    setFormError(null);
    const body: Record<string, unknown> = { style, layout_fidelity: "high" };
    if (prompt.trim()) body.prompt = prompt.trim();
    const dollars = Number(budget);
    if (budget && dollars > 0) body.budget = { amount_minor: Math.round(dollars * 100), currency: "USD" };
    try {
      // Recreate the room on this serverless instance if /tmp was wiped.
      await restoreCachedRoom(roomId);
      const res = await fetch(`/api/rooms/${roomId}/designs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await readApiJson<{ id?: string; error?: { message?: string } }>(res);
      if (!res.ok) throw new Error(json.error?.message ?? "Could not start the design");
      if (!json.id) throw new Error("The server did not return a design id.");
      setActiveId(json.id);
      await load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Could not start the design");
    } finally {
      setCreating(false);
    }
  };

  if (notFound) {
    return (
      <main className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Room not found</h1>
        <p className="mt-2 text-muted-foreground">This room may have been deleted. Upload a new photo to start again.</p>
        <Link href="/" className={cn(buttonVariants(), "mt-6")}>Upload a photo</Link>
      </main>
    );
  }
  if (!room) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Skeleton className="aspect-[3/2] w-full" />
      </main>
    );
  }

  const active: DesignDto | undefined = room.designs.find((d) => d.id === activeId) ?? room.designs[0];
  const aspect = room.width_px / room.height_px;
  const hasImage = !!active?.render_image_url && ["render_ready", "matching", "completed"].includes(active.status);
  const busy = creating || !!anyActive;
  const styleName = (id: string) => getStyle(id)?.name ?? id;
  const activeDirection = active && getStyle(active.style)?.direction;
  const selected = getStyle(selectedStyle);

  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? Math.min(Math.max(aspect, 0.7), 1.8) : 4 / 3;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-8 overflow-x-hidden px-3 py-5 sm:space-y-12 sm:px-4 sm:py-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)] lg:items-start">
        <section className="min-w-0 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                {room.name ?? ROOM_TYPE_LABELS[room.room_type as RoomType] ?? "Your room"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {active
                  ? `${styleName(active.style)} style${activeDirection ? ` · ${getDirection(activeDirection).name}` : ""}`
                  : `${getDirection(direction).name} look · choose a style to create your first design`}
              </p>
            </div>
            {active?.is_demo_preview && (
              <Badge variant="outline" className="w-fit max-w-full whitespace-normal text-left leading-snug">
                Demo preview · no AI provider connected
              </Badge>
            )}
          </div>

          {!active && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={room.original_image_url} alt="Original room" className="w-full max-w-full rounded-xl border" style={{ aspectRatio: safeAspect }} />
          )}

          {active && ACTIVE.includes(active.status) && !hasImage && (
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-xl border" style={{ aspectRatio: safeAspect }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={room.original_image_url} alt="Original room" className="size-full object-cover blur-[2px] brightness-75" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-white">
                  <Loader2 className="size-8 animate-spin" />
                  <p className="text-sm font-medium sm:text-base" role="status">{STEP[active.status]}...</p>
                  <p className="text-xs opacity-80">This usually takes under a minute.</p>
                </div>
              </div>
              {active.has_products && (
                <div className="min-w-0 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Box className="size-4 shrink-0" /> 3D view ready while the preview image finishes
                  </div>
                  <Room3D designId={active.id} version={sceneVersion} />
                </div>
              )}
            </div>
          )}

          {active?.status === "failed" && (
            <>
              <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-center sm:p-8" role="alert">
                <AlertTriangle className="size-7 text-destructive" />
                <p className="font-medium">We could not create the image for this design.</p>
                <p className="max-w-md text-sm text-muted-foreground break-words">{active.error?.message}</p>
                <Button variant="outline" onClick={() => { selectStyle(active.style); generate(active.style); }} disabled={busy}>
                  <RefreshCw /> Try again
                </Button>
              </div>
              {active.has_products && (
                <div className="min-w-0 space-y-2">
                  <p className="text-sm text-muted-foreground">The products for this design were still chosen, so you can arrange them in 3D.</p>
                  <Room3D designId={active.id} version={sceneVersion} />
                </div>
              )}
            </>
          )}

          {active && hasImage && (
            <>
              <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="min-w-0 gap-3">
                <TabsList className="grid h-auto w-full grid-cols-2 sm:inline-flex sm:w-fit">
                  <TabsTrigger value="3d" className="px-2 sm:px-3"><Box /> 3D view</TabsTrigger>
                  <TabsTrigger value="slider" className="px-2 sm:px-3">Preview image</TabsTrigger>
                </TabsList>
                <TabsContent value="3d" className="min-w-0">
                  {active.has_products ? (
                    <Room3D designId={active.id} version={sceneVersion} />
                  ) : (
                    <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground sm:p-8">
                      This design was made before designs were furnished with real products, so there is nothing to place in 3D. Generate a new design to get a 3D view.
                    </p>
                  )}
                </TabsContent>
                <TabsContent value="slider" className="min-w-0">
                  <CompareSlider before={active.original_image_url} after={active.render_image_url!} aspect={safeAspect} />
                </TabsContent>
              </Tabs>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <a href={`/api/designs/${active.id}/download?format=png`} className={cn(buttonVariants(), "w-full justify-center sm:w-auto")}>
                  <Download /> Download PNG
                </a>
                <a href={`/api/designs/${active.id}/download?format=jpeg`} className={cn(buttonVariants({ variant: "outline" }), "w-full justify-center sm:w-auto")}>
                  <Download /> Download JPEG
                </a>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {tab === "3d"
                  ? "Interactive 3D layout of the same products. Drag, rotate and zoom them. Create 3D models to replace the simplified shapes with a saved GLB of each catalogue photo. This is not a 3D model of your room."
                  : active.disclaimer}
              </p>
              {active.error && active.error.code === "warning" && <p className="text-xs text-amber-700 break-words">{active.error.message}</p>}
            </>
          )}
        </section>

        <aside className="min-w-0 space-y-5 lg:sticky lg:top-20">
          <div className="space-y-4 rounded-xl border bg-card p-3 sm:p-4">
            <div className="space-y-2">
              <h2 className="font-semibold">Modern or traditional?</h2>
              <DirectionPicker compact value={direction} onChange={changeDirection} />
            </div>
            <h3 className="text-sm font-semibold">{room.designs.length ? "Try another style" : "Pick a style"}</h3>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={`${getDirection(direction).name} styles`}>
              {stylesFor(direction).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={selectedStyle === s.id}
                  onClick={() => setSelectedStyle(s.id)}
                  title={s.description}
                  className={cn(
                    "min-w-0 rounded-lg border p-2 text-left transition-colors sm:p-2.5",
                    selectedStyle === s.id ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:bg-muted",
                  )}
                >
                  <div className="mb-1.5 flex gap-1">
                    {s.swatches.map((c) => (
                      <span key={c} className="size-3.5 rounded-full border sm:size-4" style={{ background: c }} />
                    ))}
                  </div>
                  <span className="block truncate text-sm font-medium">{s.name}</span>
                </button>
              ))}
            </div>
            {selected && <p className="text-xs leading-relaxed text-muted-foreground">{selected.description}</p>}
            <div className="space-y-1.5">
              <Label htmlFor="wishes">Wishes (optional)</Label>
              <Input id="wishes" maxLength={240} placeholder="e.g. add a reading corner" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budget">Total furniture budget in USD (optional)</Label>
              <Input id="budget" type="number" min={0} inputMode="numeric" placeholder="e.g. 3000" value={budget} onChange={(e) => setBudget(e.target.value)} />
            </div>
            <Button className="w-full" size="lg" onClick={() => generate()} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} {busy ? "Generating..." : "Generate design"}
            </Button>
            {formError && <p className="text-sm text-destructive" role="alert">{formError}</p>}
          </div>

          {room.designs.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">Your designs for this room</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {room.designs.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => { setActiveId(d.id); selectStyle(d.style); }}
                    className={cn("min-w-0 overflow-hidden rounded-lg border text-left", active?.id === d.id && "ring-2 ring-primary")}
                    aria-label={`${styleName(d.style)} design, ${d.status}`}
                  >
                    <div className="relative aspect-[4/3] bg-muted">
                      {d.render_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.render_image_url} alt="" className="size-full object-cover" />
                      ) : (
                        <div className="flex size-full items-center justify-center">
                          {d.status === "failed" ? <AlertTriangle className="size-4 text-destructive" /> : <Loader2 className="size-4 animate-spin" />}
                        </div>
                      )}
                    </div>
                    <span className="block truncate px-1.5 py-1 text-xs">{styleName(d.style)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {active && (
        <ShopThisLook
          key={active.id}
          designId={active.id}
          ready={active.status === "completed" || (active.status === "failed" && active.has_products)}
          onChanged={() => setSceneVersion((n) => n + 1)}
        />
      )}
    </main>
  );
}
