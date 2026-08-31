import type { AnyClient } from "./admin-clients.ts";

/** Fail-open: a missing RPC must not block checkout. */
export async function consumeRateLimit(
  admin: AnyClient,
  key: string,
  maxHits: number,
  windowSeconds: number,
): Promise<boolean> {
  const { data, error } = await admin.rpc("consume_edge_rate_limit", {
    _key: key,
    _max_hits: maxHits,
    _window_seconds: windowSeconds,
  });
  if (error) {
    console.error("consume_edge_rate_limit:", error.message);
    return true;
  }
  return Boolean(data);
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || "unknown";
}
