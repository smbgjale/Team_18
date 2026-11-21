"use client";

import type { DesignDirection } from "@/lib/styles";

export type CachedRoom = {
  id: string;
  roomType: string;
  designDirection: DesignDirection;
  name: string | null;
  fileName: string;
  mimeType: string;
  bytes: ArrayBuffer;
  savedAt: number;
};

const DB_NAME = "gojjodesign-rooms";
const STORE = "rooms";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open room cache."));
  });
}

export async function saveCachedRoom(room: CachedRoom): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(room);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Could not save room cache."));
  });
  db.close();
}

export async function getCachedRoom(id: string): Promise<CachedRoom | null> {
  const db = await openDb();
  const room = await new Promise<CachedRoom | null>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as CachedRoom | undefined) ?? null);
    req.onerror = () => reject(req.error ?? new Error("Could not read room cache."));
  });
  db.close();
  return room;
}

export async function cachedRoomToFile(room: CachedRoom): Promise<File> {
  return new File([room.bytes], room.fileName, { type: room.mimeType || "image/jpeg" });
}

/** Recreate a missing room on the server from the browser cache (needed on Vercel without Blob). */
export async function restoreCachedRoom(id: string): Promise<boolean> {
  const cached = await getCachedRoom(id);
  if (!cached) return false;
  const file = await cachedRoomToFile(cached);
  const body = new FormData();
  body.set("file", file);
  body.set("room_type", cached.roomType);
  body.set("design_direction", cached.designDirection);
  if (cached.name) body.set("name", cached.name);
  body.set("room_id", cached.id);
  const res = await fetch("/api/rooms/restore", { method: "POST", body });
  return res.ok;
}
