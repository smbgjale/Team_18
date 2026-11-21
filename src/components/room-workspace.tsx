"use client";

import { AlertTriangle, Box, Download, Loader2, RefreshCw, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CompareSlider } from "@/components/compare-slider";
import { ShopThisLook } from "@/components/shop-this-look";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DesignDto, RoomDto, StyleDto } from "@/lib/api-types";
import { ROOM_TYPE_LABELS, type RoomType } from "@/lib/categories";
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
  const [styles, setStyles] = useState<StyleDto[]>([]);
  const [selectedStyle, setSelectedStyle] = useState("scandinavian");
  const [prompt, setPrompt] = useState("");
  const [budget, setBudget] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [tab, setTab] = useState("slider");
  const [sceneVersion, setSceneVersion] = useState(0);
  const initialised = useRef(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/rooms/${roomId}`);
    if (res.status === 404) return setNotFound(true);
    if (!res.ok) return;
    const json: RoomDto = await res.json();
    setRoom(json);
    if (!initialised.current) {
      initialised.current = true;
      if (json.designs[0]) setActiveId(json.designs[0].id);
    }
  }, [roomId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    load();
    fetch("/api/styles").then((r) => r.json()).then((j) => setStyles(j.items));
  }, [load]);

  const anyActive = room?.designs.some((d) => ACTIVE.includes(d.status));
  useEffect(() => {
    if (!anyActive) return;
    const t = setInterval(load, 1500);
    return () => clearInterval(t);
  }, [anyActive, load]);

  const generate = async () => {
    setCreating(true);
    setFormError(null);
    const body: Record<string, unknown> = { style: selectedStyle, layout_fidelity: "high" };
    if (prompt.trim()) body.prompt = prompt.trim();
    const dollars = Number(budget);
    if (budget && dollars > 0) body.budget = { amount_minor: Math.round(dollars * 100), currency: "USD" };
    try {
      const res = await fetch(`/api/rooms/${roomId}/designs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Could not start the design");
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
  const styleName = (id: string) => styles.find((s) => s.id === id)?.name ?? id;

  return (
    <main className="mx-auto max-w-6xl space-y-12 px-4 py-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{room.name ?? ROOM_TYPE_LABELS[room.room_type as RoomType] ?? "Your room"}</h1>
              <p className="text-sm text-muted-foreground">
                {active ? `${styleName(active.style)} style` : "Choose a style to create your first design"}
              </p>
            </div>
            {active?.is_demo_preview && <Badge variant="outline">Demo preview, no AI provider connected</Badge>}
          </div>

          {!active && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={room.original_image_url} alt="Original room" className="w-full rounded-xl border" style={{ aspectRatio: aspect }} />
          )}

          {active && ACTIVE.includes(active.status) && !hasImage && (
            <div className="relative overflow-hidden rounded-xl border" style={{ aspectRatio: aspect }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={room.original_image_url} alt="Original room" className="size-full object-cover blur-[2px] brightness-75" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
                <Loader2 className="size-8 animate-spin" />
                <p className="font-medium" role="status">{STEP[active.status]}...</p>
                <p className="text-xs opacity-80">This usually takes under a minute.</p>
              </div>
            </div>
          )}

          {active?.status === "failed" && (
            <>
              <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center" role="alert">
                <AlertTriangle className="size-7 text-destructive" />
                <p className="font-medium">We could not create the image for this design.</p>
                <p className="max-w-md text-sm text-muted-foreground">{active.error?.message}</p>
                <Button variant="outline" onClick={() => { setSelectedStyle(active.style); generate(); }} disabled={busy}>
                  <RefreshCw /> Try again
                </Button>
              </div>
              {active.has_products && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">The products for this design were still chosen, so you can arrange them in 3D.</p>
                  <Room3D designId={active.id} version={sceneVersion} />
                </div>
              )}
            </>
          )}

          {active && hasImage && (
            <>
              <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
                <TabsList>
                  <TabsTrigger value="slider">Slide to compare</TabsTrigger>
                  <TabsTrigger value="side">Side by side</TabsTrigger>
                  <TabsTrigger value="3d"><Box /> 3D view</TabsTrigger>
                </TabsList>
                <TabsContent value="slider">
                  <CompareSlider before={active.original_image_url} after={active.render_image_url!} aspect={aspect} />
                </TabsContent>
                <TabsContent value="side">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[{ src: active.original_image_url, label: "Original" }, { src: active.render_image_url!, label: "3D-style redesign" }].map((i) => (
                      <figure key={i.label} className="space-y-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={i.src} alt={i.label} className="w-full rounded-xl border" style={{ aspectRatio: aspect }} />
                        <figcaption className="text-xs text-muted-foreground">{i.label}</figcaption>
                      </figure>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="3d">
                  {active.has_products ? (
                    <Room3D designId={active.id} version={sceneVersion} />
                  ) : (
                    <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                      This design was made before designs were furnished with real products, so there is nothing to place in 3D. Generate a new design to get a 3D view.
                    </p>
                  )}
                </TabsContent>
              </Tabs>
              <div className="flex flex-wrap items-center gap-2">
                <a href={`/api/designs/${active.id}/download?format=png`} className={buttonVariants()}>
                  <Download /> Download PNG
                </a>
                <a href={`/api/designs/${active.id}/download?format=jpeg`} className={buttonVariants({ variant: "outline" })}>
                  <Download /> Download JPEG
                </a>
                {active.has_products && tab !== "3d" && (
                  <Button variant="outline" onClick={() => setTab("3d")}>
                    <Box /> Open 3D view
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {tab === "3d"
                  ? "Interactive 3D layout: the real products at their real sizes and colours, drawn as simplified shapes. It is a planning view, not a photo-real model of each product."
                  : active.disclaimer}
              </p>
              {active.error && active.error.code === "warning" && <p className="text-xs text-amber-700">{active.error.message}</p>}
            </>
          )}
        </section>

        <aside className="space-y-5">
          <div className="space-y-4 rounded-xl border bg-card p-4">
            <h2 className="font-semibold">{room.designs.length ? "Try another style" : "Pick a style"}</h2>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Design style">
              {styles.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={selectedStyle === s.id}
                  onClick={() => setSelectedStyle(s.id)}
                  title={s.description}
                  className={cn(
                    "rounded-lg border p-2.5 text-left transition-colors",
                    selectedStyle === s.id ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:bg-muted",
                  )}
                >
                  <div className="mb-1.5 flex gap-1">
                    {s.swatches.map((c) => (
                      <span key={c} className="size-4 rounded-full border" style={{ background: c }} />
                    ))}
                  </div>
                  <span className="text-sm font-medium">{s.name}</span>
                </button>
              ))}
            </div>
            {styles.find((s) => s.id === selectedStyle) && (
              <p className="text-xs text-muted-foreground">{styles.find((s) => s.id === selectedStyle)!.description}</p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="wishes">Wishes (optional)</Label>
              <Input id="wishes" maxLength={240} placeholder="e.g. add a reading corner" value={prompt} onChange={(e) => setPrompt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="budget">Total furniture budget in USD (optional)</Label>
              <Input id="budget" type="number" min={0} inputMode="numeric" placeholder="e.g. 3000" value={budget} onChange={(e) => setBudget(e.target.value)} />
            </div>
            <Button className="w-full" size="lg" onClick={generate} disabled={busy || styles.length === 0}>
              {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} {busy ? "Generating..." : "Generate design"}
            </Button>
            {formError && <p className="text-sm text-destructive" role="alert">{formError}</p>}
          </div>

          {room.designs.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold">Your designs for this room</h2>
              <div className="grid grid-cols-3 gap-2">
                {room.designs.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => { setActiveId(d.id); setSelectedStyle(d.style); }}
                    className={cn("overflow-hidden rounded-lg border text-left", active?.id === d.id && "ring-2 ring-primary")}
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
