"use client";

import { ImagePlus, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ROOM_TYPES, ROOM_TYPE_LABELS } from "@/lib/categories";
import { cn } from "@/lib/utils";

export function UploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [roomType, setRoomType] = useState("living_room");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = (f: File | null) => {
    setError(null);
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const submit = async (f: File) => {
    setBusy(true);
    setError(null);
    const body = new FormData();
    body.set("file", f);
    body.set("room_type", roomType);
    try {
      const res = await fetch("/api/rooms", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Upload failed");
      router.push(`/rooms/${json.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setBusy(false);
    }
  };

  const useSample = async () => {
    const blob = await (await fetch("/sample-room.jpg")).blob();
    await submit(new File([blob], "sample-room.jpg", { type: "image/jpeg" }));
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) choose(f);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        className={cn(
          "relative flex min-h-56 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed bg-card p-6 text-center transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/60",
        )}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Selected room" className="absolute inset-0 size-full object-cover" />
        ) : (
          <>
            <ImagePlus className="size-9 text-muted-foreground" />
            <p className="font-medium">Drop a photo of your room here</p>
            <p className="text-sm text-muted-foreground">or click to browse. JPEG, PNG or WebP, up to 15 MB.</p>
          </>
        )}
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => choose(e.target.files?.[0] ?? null)} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="room-type">Room type</Label>
          <select
            id="room-type"
            value={roomType}
            onChange={(e) => setRoomType(e.target.value)}
            className="h-9 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {ROOM_TYPES.map((t) => (
              <option key={t} value={t}>{ROOM_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <Button size="lg" disabled={!file || busy} onClick={() => file && submit(file)} className="h-9 sm:w-48">
          {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Continue
        </Button>
      </div>

      <button type="button" disabled={busy} onClick={useSample} className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50">
        No photo handy? Try a sample room
      </button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
