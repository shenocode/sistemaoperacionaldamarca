export const FUNNEL_STAGES = ["tofu", "mofu", "bofu"] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export type ContentMix = {
  tofu: number;
  mofu: number;
  bofu: number;
};

export const DEFAULT_CONTENT_MIX: ContentMix = { tofu: 50, mofu: 30, bofu: 20 };

export function isFunnelStage(value: unknown): value is FunnelStage {
  return value === "tofu" || value === "mofu" || value === "bofu";
}

export function parseFunnelStage(value: unknown): FunnelStage | null {
  return isFunnelStage(value) ? value : null;
}

function clampPercent(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function parseContentMix(value: unknown): ContentMix {
  if (!value || typeof value !== "object") return { ...DEFAULT_CONTENT_MIX };
  const raw = value as Record<string, unknown>;
  const mix: ContentMix = {
    tofu: clampPercent(raw.tofu, DEFAULT_CONTENT_MIX.tofu),
    mofu: clampPercent(raw.mofu, DEFAULT_CONTENT_MIX.mofu),
    bofu: clampPercent(raw.bofu, DEFAULT_CONTENT_MIX.bofu),
  };
  const total = mix.tofu + mix.mofu + mix.bofu;
  if (total <= 0) return { ...DEFAULT_CONTENT_MIX };
  if (total === 100) return mix;
  return {
    tofu: Math.round((mix.tofu / total) * 100),
    mofu: Math.round((mix.mofu / total) * 100),
    bofu: Math.max(0, 100 - Math.round((mix.tofu / total) * 100) - Math.round((mix.mofu / total) * 100)),
  };
}

export function mixCounts(mix: ContentMix, total: number): ContentMix {
  const n = Math.max(1, Math.min(14, Math.round(total)));
  const tofu = Math.round((mix.tofu / 100) * n);
  const mofu = Math.round((mix.mofu / 100) * n);
  let bofu = n - tofu - mofu;
  if (bofu < 0) {
    return { tofu: Math.max(0, tofu + bofu), mofu, bofu: 0 };
  }
  return { tofu, mofu, bofu };
}
