export class HttpError extends Error {
  constructor(public status: number, message: string, public code = "REQUEST_FAILED") {
    super(message);
  }
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) return json({ error: error.message, code: error.code }, { status: error.status });
  console.error("Unhandled request error", error instanceof Error ? error.message : "unknown");
  return json({ error: "服务暂时不可用，请稍后重试", code: "INTERNAL_ERROR" }, { status: 500 });
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, "请求内容格式不正确", "INVALID_JSON");
  }
}

export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

function firstHeaderValue(value: string | null): string | null {
  return value?.split(",", 1)[0]?.trim() || null;
}

export function requestPublicOrigin(request: Request): string {
  const internalUrl = new URL(request.url);
  const host = firstHeaderValue(request.headers.get("host"))
    ?? firstHeaderValue(request.headers.get("x-forwarded-host"))
    ?? internalUrl.host;
  const forwardedProtocol = firstHeaderValue(request.headers.get("x-forwarded-proto"))?.toLowerCase();
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https"
    ? `${forwardedProtocol}:`
    : internalUrl.protocol;

  try {
    return new URL(`${protocol}//${host}`).origin;
  } catch {
    throw new HttpError(400, "请求地址无效", "INVALID_REQUEST_ORIGIN");
  }
}

export function requestIsSecure(request: Request): boolean {
  return requestPublicOrigin(request).startsWith("https://");
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  try {
    if (new URL(origin).origin !== requestPublicOrigin(request)) throw new Error("origin mismatch");
  } catch {
    throw new HttpError(403, "请求来源无效", "INVALID_ORIGIN");
  }
}

export function parseCookies(request: Request): Map<string, string> {
  const result = new Map<string, string>();
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    result.set(part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim()));
  }
  return result;
}

export function cookie(name: string, value: string, maxAgeSeconds: number, sameSite: "Lax" | "Strict" = "Lax", secure = true): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}; HttpOnly;${secure ? " Secure;" : ""} SameSite=${sameSite}`;
}
