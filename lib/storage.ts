import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { randomUUID } from "node:crypto";
import { dataDirectory } from "./runtime";

function storageRoot(): string {
  return path.join(dataDirectory(), "files");
}

export function resolveStorageKey(key: string): string {
  const normalized = key.replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("/") || normalized.includes("\0")) throw new Error("无效存储键");
  const root = path.resolve(storageRoot());
  const resolved = path.resolve(root, normalized);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error("存储键超出私有目录");
  return resolved;
}

export async function writeStorageObject(key: string, value: ArrayBuffer | Uint8Array): Promise<void> {
  const destination = resolveStorageKey(key);
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o750 });
  const temporary = `${destination}.${randomUUID()}.tmp`;
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  try {
    await writeFile(temporary, bytes, { mode: 0o640 });
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

export async function readStorageObject(key: string): Promise<ArrayBuffer | null> {
  try {
    const bytes = await readFile(resolveStorageKey(key));
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function openStorageObject(key: string): Promise<{ body: ReadableStream<Uint8Array>; size: number } | null> {
  const filePath = resolveStorageKey(key);
  try {
    const metadata = await stat(filePath);
    if (!metadata.isFile()) return null;
    const body = Readable.toWeb(createReadStream(filePath)) as ReadableStream<Uint8Array>;
    return { body, size: metadata.size };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function storageObjectMatches(key: string, expectedSize: number): Promise<boolean> {
  try {
    const metadata = await stat(resolveStorageKey(key));
    return metadata.isFile() && metadata.size === expectedSize;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "EACCES" || code === "EPERM" || code === "EISDIR") return false;
    throw error;
  }
}

export async function moveStorageObject(sourceKey: string, destinationKey: string): Promise<boolean> {
  const source = resolveStorageKey(sourceKey);
  const destination = resolveStorageKey(destinationKey);
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o750 });
  try {
    await rename(source, destination);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

export async function deleteStorageObject(key: string): Promise<void> {
  await rm(resolveStorageKey(key), { force: true });
}
