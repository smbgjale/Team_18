import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { config } from "./config";

const DB_BLOB = "gojjodesign/homely.db";
const FILE_PREFIX = "gojjodesign/files/";

export function blobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function dbFilePath() {
  return path.join(config.dataDir, "homely.db");
}

export async function pullDatabase(): Promise<void> {
  if (!blobConfigured()) return;
  try {
    const { head } = await import("@vercel/blob");
    const meta = await head(DB_BLOB);
    const res = await fetch(meta.url, { cache: "no-store" });
    if (!res.ok) return;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return;
    mkdirSync(config.dataDir, { recursive: true });
    writeFileSync(dbFilePath(), buf);
  } catch {
    // First deploy or Blob unused: no remote DB yet.
  }
}

export async function pushDatabase(): Promise<void> {
  if (!blobConfigured()) return;
  const file = dbFilePath();
  if (!existsSync(file)) return;
  try {
    const { put } = await import("@vercel/blob");
    await put(DB_BLOB, readFileSync(file), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/octet-stream",
    });
  } catch (e) {
    console.warn("[persist] pushDatabase skipped:", e);
  }
}

export async function putRemoteFile(key: string, data: Buffer): Promise<void> {
  if (!blobConfigured()) return;
  try {
    const { put } = await import("@vercel/blob");
    await put(`${FILE_PREFIX}${key}`, data, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch (e) {
    console.warn("[persist] putRemoteFile skipped:", e);
  }
}

export async function getRemoteFile(key: string): Promise<Buffer | null> {
  if (!blobConfigured()) return null;
  try {
    const { head } = await import("@vercel/blob");
    const meta = await head(`${FILE_PREFIX}${key}`);
    const res = await fetch(meta.url, { cache: "no-store" });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function deleteRemoteFile(key: string): Promise<void> {
  if (!blobConfigured()) return;
  try {
    const { del } = await import("@vercel/blob");
    await del(`${FILE_PREFIX}${key}`);
  } catch {
    // Missing remote object is fine.
  }
}
