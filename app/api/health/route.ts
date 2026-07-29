import { first } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await first<{ value: number }>("SELECT 1 AS value");
  if (result?.value !== 1) return Response.json({ ok: false }, { status: 503 });
  return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
