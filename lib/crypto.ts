import { requireSecret } from "./runtime";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function randomToken(bytes = 24): string {
  return toBase64(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function randomId(): string {
  return crypto.randomUUID();
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return toBase64(new Uint8Array(digest));
}

export async function sha256Bytes(value: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = value instanceof Uint8Array
    ? value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer
    : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return toBase64(new Uint8Array(digest));
}

async function getAesKey(): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(requireSecret("APP_SECRET")));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function seal(value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await getAesKey(), encoder.encode(value));
  const output = new Uint8Array(iv.length + ciphertext.byteLength);
  output.set(iv);
  output.set(new Uint8Array(ciphertext), iv.length);
  return toBase64(output);
}

export async function unseal(value: string): Promise<string> {
  const packed = fromBase64(value);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: packed.slice(0, 12) }, await getAesKey(), packed.slice(12));
  return decoder.decode(plaintext);
}

export async function hmacSha1Base64(key: string, value: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey("raw", encoder.encode(key), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}
