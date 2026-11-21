import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { config } from "./config";
import { blobConfigured, deleteRemoteFile, getRemoteFile, putRemoteFile } from "./persist";

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
  if (blobConfigured()) await putRemoteFile(key, data);
  return key;
}

export async function getFile(key: string) {
  try {
    return await readFile(resolveKey(key));
  } catch {
    const remote = await getRemoteFile(key);
    if (!remote) throw new Error("File not found");
    // Cache locally for the rest of this isolate.
    const full = resolveKey(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, remote);
    return remote;
  }
}

export async function deleteFile(key: string) {
  await rm(resolveKey(key), { force: true });
  await deleteRemoteFile(key);
}

export function fileUrl(key: string | null | undefined) {
  return key ? `/api/files/${key}` : null;
}
