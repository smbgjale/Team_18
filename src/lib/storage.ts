import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { config } from "./config";

const filesDir = path.join(config.dataDir, "files");

function resolveKey(key: string) {
  const full = path.resolve(filesDir, key);
  if (!full.startsWith(filesDir + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export async function putFile(key: string, data: Buffer) {
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);
  return key;
}

export async function getFile(key: string) {
  return readFile(resolveKey(key));
}

export async function deleteFile(key: string) {
  await rm(resolveKey(key), { force: true });
}

export function fileUrl(key: string | null | undefined) {
  return key ? `/api/files/${key}` : null;
}
