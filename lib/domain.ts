import {
  GENERATION_WINDOW_MS,
  LINK_WINDOW_MS,
  ORDER_PATTERN,
  PHONE_PATTERN,
  PRODUCT_ENTRIES,
  RECOMMENDED_DOWNLOAD_WINDOW_MS,
  type ProductEntry,
} from "./constants";

export type LinkPhase = "DRAFT" | "GENERATION_OPEN" | "DOWNLOAD_ONLY" | "EXPIRED";

export function getLinkPhase(
  publishedAt: number | null,
  generationDeadline: number | null,
  expiresAt: number | null,
  now = Date.now(),
): LinkPhase {
  if (publishedAt === null || generationDeadline === null || expiresAt === null) return "DRAFT";
  if (now < publishedAt) return "DRAFT";
  if (now < generationDeadline) return "GENERATION_OPEN";
  if (now < expiresAt) return "DOWNLOAD_ONLY";
  return "EXPIRED";
}

export function calculateDeadlines(publishedAt: number) {
  return {
    generationDeadline: publishedAt + GENERATION_WINDOW_MS,
    expiresAt: publishedAt + LINK_WINDOW_MS,
  };
}

export function recommendedDownloadDeadline(generatedAt: number, expiresAt: number): number {
  return Math.min(generatedAt + RECOMMENDED_DOWNLOAD_WINDOW_MS, expiresAt);
}

export function normalizePhone(value: unknown): string {
  return String(value ?? "").replace(/^\+?86/, "").replace(/\s+/g, "");
}

export function isValidPhone(phone: string): boolean {
  return PHONE_PATTERN.test(phone);
}

export function normalizeOrderNumber(value: unknown): string {
  const raw = String(value ?? "").trim();
  return raw.startsWith("p") ? `P${raw.slice(1)}` : raw;
}

export function isValidOrderNumber(orderNumber: string): boolean {
  return ORDER_PATTERN.test(orderNumber);
}

export function isProductEntry(value: string): value is ProductEntry {
  return PRODUCT_ENTRIES.includes(value as ProductEntry);
}

export function maskPhone(phone: string): string {
  return phone.replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2");
}

export function maskOrder(orderNumber: string): string {
  return orderNumber.replace(/^(P\d{4})\d+(\d{4})$/, "$1**********$2");
}

export function formatShanghaiTime(timestamp: number | null): string {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(timestamp);
}

export function formatLocalTime(timestamp: number, timeZone?: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    ...(timeZone ? { timeZone } : {}),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(timestamp);
}
