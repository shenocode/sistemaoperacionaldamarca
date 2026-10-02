import { supabase } from "@/integrations/supabase/client";
import type { Database, Json, Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import type { ContentStatus } from "@/components/status-badge";
import {
  DEFAULT_BRAND_BRIEFING_TEMPLATE,
  countAnsweredQuestions,
  countBriefingQuestions,
  parseBriefingAnswers,
  parseBriefingTemplate,
  type BriefingTemplate,
} from "@/lib/brand-briefing-template";
import {
  countSiteBriefingProgress,
  isSiteBriefingFormFilled,
  parseSiteBriefingForm,
  type SiteBriefingFormData,
} from "@/lib/site-briefing-form-data";
import {
  DEFAULT_SITE_BRIEFING_TEMPLATE,
  parseSiteBriefingTemplate,
} from "@/lib/site-briefing-template";
import {
  createBlankProposalDraft,
  parseCommercialTerms,
  parseInvestmentItems,
  parseProposalSections,
  type CommercialTerms,
  type InvestmentItem,
  type ProposalDraftFields,
  type ProposalSection,
} from "@/lib/proposal-template";
import { isAdminMasterEmail } from "@/lib/admin-master";
import type { RowI18n } from "@/lib/i18n-content";
import {
  ensureFieldsTranslated,
  ensurePresetListTranslated,
  getCanonicalText,
  parseRowI18n,
} from "@/lib/i18n-content";
import type { PlanEntitlements } from "@/lib/plan-entitlements";
import {
  defaultAspectForFormat,
  parseDesignAspectRatio,
  type DesignAspectRatio,
} from "@/lib/design-aspect";
import {
  parseContentMix,
  parseFunnelStage,
  type ContentMix,
  type FunnelStage,
} from "@/lib/content-strategy";

export type { ContentMix, FunnelStage } from "@/lib/content-strategy";
export { DEFAULT_CONTENT_MIX, FUNNEL_STAGES, parseContentMix, parseFunnelStage } from "@/lib/content-strategy";

export type { RowI18n, LocalizedField, AppLocale } from "@/lib/i18n-content";
export {
  getLocalizedText,
  getLocalizedField,
  parseRowI18n,
  normalizeAppLocale,
  getCanonicalText,
  translateTextField,
  translateManyFields,
  ensureFieldsTranslated,
  ensureAnswersTranslated,
  ensurePresetListTranslated,
  localizedFieldNeedsTranslation,
  fieldsNeedLocaleBackfill,
  i18nBackfillImproved,
  answersNeedLocaleBackfill,
  presetListNeedsLocaleBackfill,
  setLocalizedField,
  mergeRowI18n,
  buildLocalizedFieldFromSource,
  buildVerbatimLocalizedField,
  isLocalizedField,
  getLocalizedAnswer,
  setLocalizedAnswer,
  getLocalizedPresetList,
  setLocalizedPresetList,
} from "@/lib/i18n-content";

function toI18nJson(i18n: RowI18n | null | undefined): Json {
  return parseRowI18n(i18n) as unknown as Json;
}

export type Client = Tables<"clients">;
export type Project = Tables<"projects">;
export type CalendarBlock = Tables<"calendar_blocks">;
export type MeetingAgenda = Tables<"meeting_agendas">;
export type ThemeReference = Tables<"theme_references">;
export type BrandReferenceCreator = Tables<"brand_reference_creators">;
export type ContentItem = Tables<"content_items">;
export type ContentVersion = Tables<"content_versions">;
export type ContentComment = Tables<"content_comments">;
export type LibraryAsset = Tables<"library_assets">;
export type DesignTemplate = Tables<"design_templates">;
export type DesignTemplateFormat = Database["public"]["Enums"]["design_template_format"];
export type { DesignAspectRatio } from "@/lib/design-aspect";
export {
  DESIGN_ASPECT_RATIOS,
  defaultAspectForFormat,
  designAspectCss,
  designAspectI18nKey,
  designAspectPreviewClass,
  designAspectThumbClass,
  parseDesignAspectRatio,
} from "@/lib/design-aspect";
export type ActivityEvent = Tables<"activity_events">;
export type Profile = Tables<"profiles">;
export type CommercialProposal = Tables<"commercial_proposals">;
export type CommercialProposalStatus =
  Database["public"]["Enums"]["commercial_proposal_status"];
export type BrandBriefing = Tables<"brand_briefings">;
export type ProjectSite = Tables<"project_site">;
export type ActivityType = Database["public"]["Enums"]["activity_type"];
export type LibraryCategory = Database["public"]["Enums"]["library_category"];
export type ContentFormat = Database["public"]["Enums"]["content_format"];
export type BrandBriefingStatus = Database["public"]["Enums"]["brand_briefing_status"];
export type SiteBriefingStatus = "draft" | "in_progress" | "completed";
export type SitePrototypeStatus = "review" | "changes" | "changes_done" | "approved";

export const SITE_PROTOTYPE_STATUSES: SitePrototypeStatus[] = [
  "review",
  "changes",
  "changes_done",
  "approved",
];

export function parseSitePrototypeStatus(
  value: string | null | undefined,
): SitePrototypeStatus {
  if (
    value === "review" ||
    value === "changes" ||
    value === "changes_done" ||
    value === "approved"
  ) {
    return value;
  }
  return "review";
}

export type {
  BriefingQuestion,
  BriefingSection,
  BriefingTemplate,
} from "@/lib/brand-briefing-template";
export {
  DEFAULT_BRAND_BRIEFING_TEMPLATE,
  countAnsweredQuestions,
  countBriefingQuestions,
  parseBriefingAnswers,
  parseBriefingTemplate,
} from "@/lib/brand-briefing-template";

export const CONTENT_FORMATS: ContentFormat[] = [
  "static_feed",
  "reels",
  "stories",
  "carousel",
  "recorded_video",
  "print_material",
  "youtube_short",
];

export function isYoutubeVideoFormat(format?: ContentFormat | null) {
  return format === "recorded_video" || format === "youtube_short";
}

export function isYoutubeShortFormat(format?: ContentFormat | null) {
  return format === "youtube_short";
}

export function isReelsFormat(format?: ContentFormat | null) {
  return format === "reels";
}

/** YouTube e Reels aceitam imagem de capa dedicada (`thumbnail_url`). */
export function contentUsesDedicatedThumbnail(format?: ContentFormat | null) {
  return isYoutubeVideoFormat(format) || isReelsFormat(format);
}

export const GRAPHIC_ARTS_MATERIAL_TYPES = [
  "poster",
  "banner",
  "flyer_a5",
  "flyer_a4",
  "folder",
  "business_card",
  "outdoor",
  "sticker",
  "other",
] as const;

export type GraphicArtsMaterialType = (typeof GRAPHIC_ARTS_MATERIAL_TYPES)[number];

export type GraphicArtsMaterialPreset = {
  id: GraphicArtsMaterialType;
  widthCm: number;
  heightCm: number;
};

/** Dimensões padrão sugeridas (cm). O gestor pode alterar no cadastro/ficha. */
export const GRAPHIC_ARTS_MATERIAL_PRESETS: GraphicArtsMaterialPreset[] = [
  { id: "poster", widthCm: 40, heightCm: 60 },
  { id: "banner", widthCm: 90, heightCm: 120 },
  { id: "flyer_a5", widthCm: 14.8, heightCm: 21 },
  { id: "flyer_a4", widthCm: 21, heightCm: 29.7 },
  { id: "folder", widthCm: 21, heightCm: 29.7 },
  { id: "business_card", widthCm: 9, heightCm: 5 },
  { id: "outdoor", widthCm: 300, heightCm: 200 },
  { id: "sticker", widthCm: 10, heightCm: 10 },
  { id: "other", widthCm: 21, heightCm: 29.7 },
];

export function getGraphicArtsMaterialPreset(
  materialType?: string | null,
): GraphicArtsMaterialPreset {
  const found = GRAPHIC_ARTS_MATERIAL_PRESETS.find((p) => p.id === materialType);
  return found ?? GRAPHIC_ARTS_MATERIAL_PRESETS.find((p) => p.id === "other")!;
}

export function isPrintMaterialFormat(format?: ContentFormat | null) {
  return format === "print_material";
}

export const PROJECT_CATEGORIES = ["instagram", "graphic_arts", "videos", "site"] as const;
export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

export type ProjectTabId =
  | "feed"
  | "themes"
  | "calendar"
  | "content"
  | "library"
  | "settings"
  | "meeting"
  | "prototype"
  | "briefing"
  | "prompt"
  | "schedule";

export type ProjectCategoryConfig = {
  formats: ContentFormat[];
  tabs: ProjectTabId[];
  defaultTab: Exclude<ProjectTabId, "library" | "settings">;
  /** Experiência completa (abas + mockup) já disponível para a categoria. */
  experienceReady: boolean;
};

/**
 * Aba "Conteúdo" ocultada temporariamente (lista quase igual ao Calendário).
 * Vale para todos os perfis: cliente, gestor e admin.
 * Para reexibir: altere para `true`.
 */
export const CONTENT_TAB_ENABLED = false;

/** Capacidades por tipo de projeto. Instagram é o fluxo pronto (ex.: Marina Mazon). */
export const PROJECT_CATEGORY_CONFIG: Record<ProjectCategory, ProjectCategoryConfig> = {
  instagram: {
    formats: ["static_feed", "reels", "stories", "carousel"],
    tabs: ["feed", "themes", "calendar", "content", "meeting", "library", "settings"],
    defaultTab: "feed",
    experienceReady: true,
  },
  graphic_arts: {
    formats: ["print_material"],
    tabs: ["themes", "calendar", "content", "meeting", "library", "settings"],
    defaultTab: "content",
    experienceReady: true,
  },
  videos: {
    formats: ["recorded_video", "youtube_short"],
    tabs: ["feed", "themes", "calendar", "content", "meeting", "library", "settings"],
    defaultTab: "feed",
    experienceReady: true,
  },
  site: {
    formats: [],
    tabs: ["prototype", "briefing", "prompt", "schedule", "meeting", "library", "settings"],
    defaultTab: "prototype",
    experienceReady: true,
  },
};

/** Uma categoria por projeto (primeira válida). Legado sem categoria → Instagram. */
export function getPrimaryProjectCategory(values?: string[] | null): ProjectCategory {
  const normalized = normalizeProjectCategories(values);
  return normalized[0] ?? "instagram";
}

export function projectCategoryConfig(values?: string[] | null): ProjectCategoryConfig {
  const config = PROJECT_CATEGORY_CONFIG[getPrimaryProjectCategory(values)];
  if (CONTENT_TAB_ENABLED) return config;
  return {
    ...config,
    tabs: config.tabs.filter((tab) => tab !== "content"),
    defaultTab: config.defaultTab === "content" ? "calendar" : config.defaultTab,
  };
}

export function contentFormatsForProject(values?: string[] | null): ContentFormat[] {
  return projectCategoryConfig(values).formats;
}

/** CTA e hashtags só se aplicam a projetos de conteúdo (não Site). */
export function projectUsesContentPresets(values?: string[] | null): boolean {
  return getPrimaryProjectCategory(values) !== "site";
}

export function defaultContentFormatForProject(values?: string[] | null): ContentFormat {
  return contentFormatsForProject(values)[0] ?? "static_feed";
}

export function projectDefaultRoute(values?: string[] | null): {
  to:
    | "/clients/$clientId/projects/$projectId/feed"
    | "/clients/$clientId/projects/$projectId/calendar"
    | "/clients/$clientId/projects/$projectId/content"
    | "/clients/$clientId/projects/$projectId/prototype"
    | "/clients/$clientId/projects/$projectId/briefing"
    | "/clients/$clientId/projects/$projectId/prompt"
    | "/clients/$clientId/projects/$projectId/schedule";
} {
  const tab = projectCategoryConfig(values).defaultTab;
  if (tab === "calendar") {
    return { to: "/clients/$clientId/projects/$projectId/calendar" };
  }
  if (tab === "content") {
    return { to: "/clients/$clientId/projects/$projectId/content" };
  }
  if (tab === "prototype") {
    return { to: "/clients/$clientId/projects/$projectId/prototype" };
  }
  if (tab === "briefing") {
    return { to: "/clients/$clientId/projects/$projectId/briefing" };
  }
  if (tab === "prompt") {
    return { to: "/clients/$clientId/projects/$projectId/prompt" };
  }
  if (tab === "schedule") {
    return { to: "/clients/$clientId/projects/$projectId/schedule" };
  }
  return { to: "/clients/$clientId/projects/$projectId/feed" };
}

/** Mantém no máximo uma categoria válida (seleção única no cadastro). */
export function normalizeProjectCategories(values?: string[] | null): ProjectCategory[] {
  if (!values?.length) return [];
  const allowed = new Set<string>(PROJECT_CATEGORIES);
  const first = values.find((value): value is ProjectCategory => allowed.has(value));
  return first ? [first] : [];
}

export const CONTENT_MEDIA_BUCKET = "content-media";

function storagePathFromPublicUrl(url: string, bucket: string): string | null {
  try {
    const parsed = new URL(url);
    const marker = `/object/public/${bucket}/`;
    const idx = parsed.pathname.indexOf(marker);
    if (idx < 0) return null;
    return decodeURIComponent(parsed.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}

function contentMediaStoragePaths(
  item: {
    media_url?: string | null;
    media_urls?: string[] | null;
    thumbnail_url?: string | null;
    media_overlays?: unknown;
  },
  projectId: string,
): string[] {
  const urls = [...resolveContentMediaUrls(item)];
  if (item.thumbnail_url?.trim()) urls.push(item.thumbnail_url.trim());
  if (Array.isArray(item.media_overlays)) {
    for (const overlay of item.media_overlays) {
      if (overlay && typeof overlay === "object" && "baseUrl" in overlay) {
        const baseUrl = (overlay as { baseUrl?: unknown }).baseUrl;
        if (typeof baseUrl === "string" && baseUrl.trim()) urls.push(baseUrl.trim());
      }
    }
  }
  const paths = new Set<string>();
  for (const url of urls) {
    const path = storagePathFromPublicUrl(url, CONTENT_MEDIA_BUCKET);
    if (path && (path.startsWith(`${projectId}/`) || path.includes(`/${projectId}/`))) {
      paths.add(path);
    }
  }
  return [...paths];
}
export const MEDIA_MAX_BYTES = 150 * 1024 * 1024;
export const CLIENT_LOGOS_BUCKET = "client-logos";
export const GESTOR_LOGOS_BUCKET = "gestor-logos";
export const PROPOSAL_COVERS_BUCKET = "proposal-covers";
export const COMMENT_AUDIO_BUCKET = "comment-audio";

export const CLIENT_LOGO_ACCEPT = ".jpg,.jpeg,.png,.gif,.webp,.svg,image/jpeg,image/png,image/gif,image/webp,image/svg+xml";
export const GESTOR_LOGO_ACCEPT = CLIENT_LOGO_ACCEPT;
export const PROPOSAL_COVER_ACCEPT = ".jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/png,image/gif,image/webp";

export const CONTENT_MEDIA_ACCEPT =
  ".pdf,.jpg,.jpeg,.png,.gif,.webp,.svg,.heic,.heif,.mp4,.webm,.mov,.avi,.txt,.md,.csv,.rtf,.doc,.docx,.odt,.xls,.xlsx,.ods,image/*,video/*,application/pdf,text/plain,text/csv,text/markdown,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function resolveContentMediaUrls(item: {
  media_url?: string | null;
  media_urls?: string[] | null;
}): string[] {
  if (item.media_urls && item.media_urls.length > 0) {
    return item.media_urls.filter(Boolean);
  }
  if (item.media_url?.trim()) return [item.media_url.trim()];
  return [];
}

/** Thumbnail dedicada; YouTube usa capa oficial; vídeo direto usa frame inicial (#t=0.1). */
export function resolveContentThumbnail(item: {
  thumbnail_url?: string | null;
  media_url?: string | null;
  media_urls?: string[] | null;
}): string | null {
  const dedicated = item.thumbnail_url?.trim();
  if (dedicated) {
    const youtubeFromDedicated = extractYoutubeVideoId(dedicated);
    return youtubeFromDedicated ? youtubeThumbnailUrl(youtubeFromDedicated) : dedicated;
  }
  const media = resolveContentMediaUrls(item)[0];
  if (!media) return null;
  const youtubeId = extractYoutubeVideoId(media);
  if (youtubeId) return youtubeThumbnailUrl(youtubeId);
  if (isVideoUrl(media)) return `${media}#t=0.1`;
  return media;
}

export type DownloadableContentMedia = {
  url: string;
  role: "media" | "cover";
};

function normalizeDownloadableMediaUrl(url: string) {
  return url.trim().split("#")[0] ?? url.trim();
}

/** Capa enviada (`thumbnail_url`), sem frame gerado (#t=) nem thumbnail automática do YouTube. */
function isDownloadableCoverUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.includes("#t=")) return false;
  if (extractYoutubeVideoId(trimmed)) return false;
  return true;
}

/**
 * Arquivos para baixar no resumo de aprovações: mídias do conteúdo + capa
 * (Reels, Stories, YouTube), quando existir e for distinta.
 */
export function resolveDownloadableContentMedia(item: {
  media_url?: string | null;
  media_urls?: string[] | null;
  thumbnail_url?: string | null;
}): DownloadableContentMedia[] {
  const media = resolveContentMediaUrls(item);
  const seen = new Set(media.map(normalizeDownloadableMediaUrl).filter(Boolean));
  const items: DownloadableContentMedia[] = media.map((url) => ({
    url,
    role: "media" as const,
  }));

  const cover = item.thumbnail_url?.trim() ?? "";
  if (
    cover &&
    isDownloadableCoverUrl(cover) &&
    !seen.has(normalizeDownloadableMediaUrl(cover))
  ) {
    items.push({ url: cover, role: "cover" });
  }

  return items;
}

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-()+ ]+/g, "_").replace(/\s+/g, "-").slice(0, 120);
}

export async function uploadContentMedia(projectId: string, file: File) {
  if (file.size > MEDIA_MAX_BYTES) {
    throw new Error("O arquivo deve ter no máximo 150 MB.");
  }
  const safeName = sanitizeFileName(file.name || "arquivo");
  const storagePath = `${projectId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(CONTENT_MEDIA_BUCKET).upload(storagePath, file, {
    cacheControl: "3600",
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) {
    if (/row-level security|violates row-level/i.test(error.message)) {
      throw new Error(
        "Não foi possível enviar a mídia por falta de permissão no armazenamento. Peça para aplicar a correção de RLS de mídia no banco e tente novamente.",
      );
    }
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(CONTENT_MEDIA_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

export async function uploadContentMediaFiles(projectId: string, files: File[]) {
  const urls: string[] = [];
  for (const file of files) {
    urls.push(await uploadContentMedia(projectId, file));
  }
  return urls;
}

export async function uploadClientLogo(clientId: string, file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Envie uma imagem (PNG, JPG, WebP ou SVG).");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("O logo deve ter no máximo 2 MB.");
  }

  // 1) Prefer direct storage when the client-logos bucket already exists.
  const safeName = sanitizeFileName(file.name || "logo");
  const storagePath = `${clientId}/${crypto.randomUUID()}-${safeName}`;
  const { error: storageError } = await supabase.storage
    .from(CLIENT_LOGOS_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type || undefined,
      upsert: false,
    });

  if (!storageError) {
    const { data } = supabase.storage.from(CLIENT_LOGOS_BUCKET).getPublicUrl(storagePath);
    const logoUrl = data.publicUrl;
    // Persist logo_url immediately (edge-function path already does this).
    const { data: clientRow } = await supabase
      .from("clients")
      .select("name, notes, email, phone, whatsapp, instagram, website")
      .eq("id", clientId)
      .maybeSingle();
    if (clientRow?.name?.trim()) {
      const { error: updateError } = await supabase
        .from("clients")
        .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
        .eq("id", clientId);
      if (updateError) {
        await supabase.rpc("update_client_contact", {
          _client_id: clientId,
          _name: clientRow.name,
          _notes: clientRow.notes,
          _email: clientRow.email,
          _phone: clientRow.phone,
          _whatsapp: clientRow.whatsapp,
          _instagram: clientRow.instagram,
          _website: clientRow.website,
          _logo_url: logoUrl,
        } as Database["public"]["Functions"]["update_client_contact"]["Args"]);
      }
    }
    return logoUrl;
  }

  const storageMessage = storageError.message || "";
  const bucketMissing = /bucket not found/i.test(storageMessage);

  // 2) Fallback: edge function with service role (creates bucket + persists logo_url).
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });

  const { data, error } = await supabase.functions.invoke("upload-client-logo", {
    body: {
      clientId,
      fileName: file.name || "logo.png",
      contentType: file.type || "image/png",
      base64,
    },
  });

  if (!error) {
    const logoUrl =
      data && typeof data === "object" && "logoUrl" in data
        ? String((data as { logoUrl?: string }).logoUrl ?? "")
        : "";
    const invokeError =
      data && typeof data === "object" && "error" in data
        ? String((data as { error?: string }).error ?? "")
        : "";
    if (invokeError) throw new Error(invokeError);
    if (logoUrl) return logoUrl;
  }

  if (bucketMissing || /NOT_FOUND|not found|404|Failed to send/i.test(error?.message ?? "")) {
    throw new Error(
      "O armazenamento do logo ainda não foi configurado no banco. No Lovable, abra Cloud → SQL Editor e execute a migration supabase/migrations/20260724150000_client_logos.sql (ou publique a edge function upload-client-logo).",
    );
  }

  if (/row-level security|violates row-level/i.test(storageMessage)) {
    throw new Error(
      "Não foi possível enviar o logo por falta de permissão. Execute a migration de logos no Lovable Cloud e tente novamente.",
    );
  }

  throw new Error(error?.message || storageMessage || "Não foi possível enviar o logo.");
}

export function isVideoUrl(url: string) {
  const path = url.split(/[?#]/)[0] ?? url;
  return /\.(mp4|webm|mov|avi)$/i.test(path) || url.includes("video/");
}

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function extractYoutubeVideoId(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const candidates = /^[a-z][a-z0-9+.-]*:/i.test(value) ? [value] : [`https://${value}`, value];
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      const host = url.hostname.replace(/^www\./, "");
      let id: string | null = null;
      if (host === "youtu.be") {
        id = url.pathname.split("/").filter(Boolean)[0] ?? null;
      } else if (
        host === "youtube.com" ||
        host === "m.youtube.com" ||
        host === "music.youtube.com" ||
        host === "youtube-nocookie.com"
      ) {
        if (url.pathname === "/watch") id = url.searchParams.get("v");
        else {
          const parts = url.pathname.split("/").filter(Boolean);
          if (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live") {
            id = parts[1] ?? null;
          }
        }
      }
      const normalized = id?.split("?")[0]?.trim() ?? "";
      if (YOUTUBE_VIDEO_ID.test(normalized)) return normalized;
    } catch {
      // try next candidate
    }
  }
  return null;
}

export function youtubeThumbnailUrl(id: string) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

export function youtubeEmbedUrl(id: string, autoplay = false) {
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
  });
  if (autoplay) params.set("autoplay", "1");
  return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}

/** Arquivo de vídeo direto ou página/embed do YouTube. */
export function isPlayableVideoUrl(url: string) {
  return isVideoUrl(url) || Boolean(extractYoutubeVideoId(url));
}

export function isImageUrl(url: string) {
  return /\.(jpe?g|png|gif|webp|svg|heic|heif)(\?|$)/i.test(url) || /\/image\//i.test(url);
}

async function requireAuthUser() {
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user) return sessionData.session.user;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Não autenticado");
  return data.user;
}

async function requireUserId() {
  return (await requireAuthUser()).id;
}

/** Best-effort audit log. Never blocks the user-facing save (no AI translate). */
function logActivity(input: {
  type: ActivityType;
  summary: string;
  clientId?: string | null;
  projectId?: string | null;
  contentId?: string | null;
  i18n?: RowI18n;
}) {
  void (async () => {
    const actorId = await requireUserId();
    await supabase.from("activity_events").insert({
      type: input.type,
      summary: input.summary,
      client_id: input.clientId ?? null,
      project_id: input.projectId ?? null,
      content_id: input.contentId ?? null,
      actor_id: actorId,
      ...(input.i18n ? { i18n: toI18nJson(input.i18n) } : {}),
    });
  })().catch(() => {
    // Activity is secondary; a failed insert must not roll back the save.
  });
}

function ensureData<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data == null) throw new Error("Resposta vazia do servidor");
  return data;
}

// —— Clients ——

export type ClientProjectSummary = {
  id: string;
  name: string;
  updated_at: string;
  last_update_at: string;
  categories?: string[] | null;
  i18n?: unknown;
};

export type ClientWithProjects = Client & {
  projects: ClientProjectSummary[];
  last_update_at: string | null;
  /** Latest activity from a non-admin actor (approval, changes, comment, version). */
  client_updates_at: string | null;
};

async function fetchLatestClientUpdatesByClient(
  clientIds: string[],
): Promise<Map<string, string>> {
  const latest = new Map<string, string>();
  if (clientIds.length === 0) return latest;

  const { data, error } = await supabase.rpc("latest_client_updates", {
    _client_ids: clientIds,
  });
  if (error) {
    console.error("latest_client_updates:", error.message);
    return latest;
  }

  for (const row of data ?? []) {
    if (row.client_id && row.created_at) {
      latest.set(row.client_id, row.created_at);
    }
  }
  return latest;
}

function maxIsoDate(dates: Array<string | null | undefined>): string | null {
  let max: string | null = null;
  for (const value of dates) {
    if (!value) continue;
    if (!max || new Date(value).getTime() > new Date(max).getTime()) max = value;
  }
  return max;
}

export function buildWhatsAppNotifyUrl(whatsapp: string | null | undefined, message: string) {
  if (!whatsapp?.trim()) return null;
  const digits = whatsapp.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Open a blank tab in the user-gesture turn so async invite can navigate it later. */
export function openWhatsAppInvitePlaceholder(): Window | null {
  if (typeof window === "undefined") return null;
  return window.open("about:blank", "_blank");
}

/** Navigate a pre-opened tab to WhatsApp, or fall back to a new window / same-tab link. */
export function navigateWhatsAppInvite(tab: Window | null, url: string | null) {
  if (!url) {
    tab?.close();
    return false;
  }
  if (tab && !tab.closed) {
    tab.location.href = url;
    return true;
  }
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  return Boolean(opened);
}

const AUTH_NEXT_STORAGE_KEY = "som_auth_next";

/** Only allow in-app relative paths (blocks open redirects). */
export function isSafeAppPath(path: string | null | undefined): path is string {
  if (!path) return false;
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  if (path.includes("://")) return false;
  return true;
}

export function rememberAuthNext(path: string | null | undefined) {
  if (typeof window === "undefined") return;
  if (!isSafeAppPath(path)) {
    sessionStorage.removeItem(AUTH_NEXT_STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(AUTH_NEXT_STORAGE_KEY, path);
}

export function readAuthNext(): string | null {
  if (typeof window === "undefined") return null;
  const value = sessionStorage.getItem(AUTH_NEXT_STORAGE_KEY);
  return isSafeAppPath(value) ? value : null;
}

export function clearAuthNext() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(AUTH_NEXT_STORAGE_KEY);
}

export function extractAccessTokenFromPath(path: string): string | null {
  try {
    const url = new URL(path, "https://som.local");
    const access = url.searchParams.get("access");
    return access?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Rewrites client project deep links for post-login navigation, preserving ?access=.
 * Feed review links land on Feed; meeting agenda links stay on the Pauta tab.
 */
export function toClientProjectFeedPath(path: string | null | undefined): string | null {
  if (!isSafeAppPath(path)) return null;
  try {
    const url = new URL(path, "https://som.local");
    const match = url.pathname.match(/^\/clients\/([^/]+)\/projects\/([^/]+)(\/.*)?$/);
    if (!match) return null;
    const [, clientId, projectId, suffix = ""] = match;
    const access = url.searchParams.get("access")?.trim();
    const accessQuery = access ? `?access=${encodeURIComponent(access)}` : "";

    if (suffix.startsWith("/meeting")) {
      return `${url.pathname}${accessQuery}`;
    }

    const feedPath = `/clients/${clientId}/projects/${projectId}/feed`;
    if (!access) return feedPath;
    return `${feedPath}?access=${encodeURIComponent(access)}`;
  } catch {
    return null;
  }
}

/** Client access link to a specific meeting agenda (Pauta tab). */
export function buildMeetingAgendaUrl(
  clientId: string,
  projectId: string,
  agendaId: string,
  accessToken: string,
) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const params = new URLSearchParams({ access: accessToken });
  return `${origin}/clients/${clientId}/projects/${projectId}/meeting/${agendaId}?${params.toString()}`;
}

/** Public share URL with SSR Open Graph (client logo). Redirects humans to the feed. */
export function buildProjectReviewUrl(clientId: string, projectId: string, accessToken: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const params = new URLSearchParams({
    access: accessToken,
  });
  return `${origin}/share/${clientId}/${projectId}?${params.toString()}`;
}

/** Client access link to the Site briefing tab. */
export function buildSiteBriefingUrl(
  clientId: string,
  projectId: string,
  accessToken: string,
) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const params = new URLSearchParams({ access: accessToken });
  return `${origin}/clients/${clientId}/projects/${projectId}/briefing?${params.toString()}`;
}

/** Client access link to the Site prototype tab. */
export function buildSitePrototypeUrl(
  clientId: string,
  projectId: string,
  accessToken: string,
) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const params = new URLSearchParams({ access: accessToken });
  return `${origin}/clients/${clientId}/projects/${projectId}/prototype?${params.toString()}`;
}

/** Join the client workspace using the invite token from the review link. */
export async function claimClientAccess(accessToken: string): Promise<string> {
  const { data, error } = await supabase.rpc("claim_client_access", {
    _access_token: accessToken,
  });
  return ensureData(data, error);
}

/** Best-effort library dates for last_update; never blocks the clients list. */
async function fetchLibraryAssetDatesByClient(
  clientIds: string[],
): Promise<Map<string, string[]>> {
  if (clientIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("library_assets")
    .select("client_id, created_at")
    .in("client_id", clientIds);
  // If client-scope migration is not applied yet, ignore and continue.
  if (error) return new Map();

  const byClient = new Map<string, string[]>();
  for (const row of data ?? []) {
    if (!row.client_id) continue;
    const dates = byClient.get(row.client_id) ?? [];
    dates.push(row.created_at);
    byClient.set(row.client_id, dates);
  }
  return byClient;
}

export async function listClients(): Promise<ClientWithProjects[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const entitlements = await getMyEntitlements();

  // Portfolio owners (incl. admin master): only clients they created.
  // Team collaborators: keep RLS membership list (no created_by filter).
  // Do not nest library_assets here: a missing FK/migration would fail the whole list.
  let clientsQuery = supabase
    .from("clients")
    .select(
      `
      *,
      projects (
        id,
        name,
        i18n,
        categories,
        updated_at
      )
    `,
    )
    .order("name", { ascending: true });

  if (entitlements.isTeamOwner || entitlements.isMaster) {
    clientsQuery = clientsQuery.eq("created_by", user.id);
  }

  const clientsRes = await clientsQuery;

  if (clientsRes.error) throw new Error(clientsRes.error.message);
  const data = clientsRes.data ?? [];
  const clientIds = data.map((client) => client.id);
  const [clientUpdates, libraryDatesByClient] = await Promise.all([
    fetchLatestClientUpdatesByClient(clientIds),
    fetchLibraryAssetDatesByClient(clientIds),
  ]);

  return data.map((client) => {
    const libraryAssetDates = libraryDatesByClient.get(client.id) ?? [];

    const projects: ClientProjectSummary[] = (client.projects ?? []).map(
      (project: {
        id: string;
        name: string;
        updated_at: string;
        i18n?: unknown;
        categories?: string[] | null;
      }) => {
        const last_update_at =
          maxIsoDate([project.updated_at, ...libraryAssetDates]) ?? project.updated_at;
        return {
          id: project.id,
          name: project.name,
          i18n: project.i18n,
          categories: project.categories,
          updated_at: project.updated_at,
          last_update_at,
        };
      },
    );

    const last_update_at = maxIsoDate([
      client.updated_at,
      ...projects.map((project) => project.last_update_at),
      ...libraryAssetDates,
    ]);

    const { projects: _projects, ...rest } = client;
    return {
      ...(rest as Client),
      projects,
      last_update_at,
      client_updates_at: clientUpdates.get(client.id) ?? null,
    };
  });
}

export async function getClient(clientId: string) {
  const { data, error } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export type BrandColor = {
  name: string;
  hex: string;
};

export const MAX_BRAND_COLORS = 24;
/** Distinct secondary families (not weight variants). */
export const MAX_BRAND_SECONDARY_FONTS = 12;
export const MAX_BRAND_FONT_FACES = 24;

/** One weight/style file belonging to a family. */
export type BrandFontFace = {
  fileUrl: string;
  /** CSS font-weight, e.g. "400", "700". */
  weight: string;
  style: "normal" | "italic";
  /** UI label, e.g. "Regular", "Bold Italic". */
  label: string;
};

export type BrandFontEntry = {
  family: string;
  /** Preferred / legacy single file (usually Regular). */
  fileUrl?: string;
  /** Weight/style variants uploaded for this family. */
  faces?: BrandFontFace[];
};

export type BrandFonts = {
  primary?: string;
  secondary?: string;
  /** Public URL of a uploaded .woff2/.ttf for the primary family (custom/commercial fonts). */
  primaryFileUrl?: string;
  /** Public URL of a uploaded font file for the secondary family. */
  secondaryFileUrl?: string;
  /** Weight/style variants of the primary family. */
  primaryFaces?: BrandFontFace[];
  /** Weight/style variants of the first secondary family. */
  secondaryFaces?: BrandFontFace[];
  /**
   * Extra secondary families (each may carry its own faces).
   * Stored in jsonb — no DB migration required.
   */
  extras?: BrandFontEntry[];
  notes?: string;
};

export const BRAND_FONT_ACCEPT =
  ".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf,application/font-woff,application/font-woff2";
export const BRAND_FONT_MAX_BYTES = 2 * 1024 * 1024;

export function isBrandFontFileName(name: string) {
  return /\.(woff2?|ttf|otf)$/i.test(name || "");
}

export function brandFontFamilyFromFileName(name: string) {
  return (name || "")
    .replace(/^.*[/\\]/, "")
    .replace(/\.(woff2?|ttf|otf)$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
}

/** Infer weight/style/label from a font file name (Fontspring, common suffixes, etc.). */
export function inferBrandFontFaceMeta(fileName: string): Pick<BrandFontFace, "weight" | "style" | "label"> {
  const base = (fileName || "")
    .replace(/^.*[/\\]/, "")
    .replace(/\.(woff2?|ttf|otf)$/i, "")
    .toLowerCase();
  const compact = base.replace(/[^a-z0-9]+/g, "");

  const italic =
    /(?:^|[^a-z])(it|italic|oblique)(?:[^a-z]|$)/.test(base) ||
    /(?:bdit|ltit|mdit|sbit|blackit|bolditalic|lightitalic|mediumitalic|semibolditalic)$/.test(
      compact,
    ) ||
    compact.endsWith("it");

  let weight = "400";
  let label = "Regular";

  if (/(?:^|[^a-z])(thin|hairline)(?:[^a-z]|$)/.test(base) || compact.includes("thin")) {
    weight = "100";
    label = "Thin";
  } else if (/(?:^|[^a-z])(extralight|ultralight|xlight)(?:[^a-z]|$)/.test(base)) {
    weight = "200";
    label = "Extra Light";
  } else if (
    /(?:^|[^a-z])(lt|light)(?:[^a-z]|$)/.test(base) ||
    compact.includes("ltit") ||
    /(?:^|[^a-z])lt(?:it)?(?:[^a-z]|$)/.test(base)
  ) {
    weight = "300";
    label = "Light";
  } else if (
    /(?:^|[^a-z])(bd|bold)(?:[^a-z]|$)/.test(base) ||
    compact.includes("bdit") ||
    compact.includes("bold")
  ) {
    weight = "700";
    label = "Bold";
  } else if (
    /(?:^|[^a-z])(blk|black|heavy)(?:[^a-z]|$)/.test(base) ||
    compact.includes("black")
  ) {
    weight = "900";
    label = "Black";
  } else if (
    /(?:^|[^a-z])(sb|semibold|demibold)(?:[^a-z]|$)/.test(base) ||
    compact.includes("semibold")
  ) {
    weight = "600";
    label = "Semi Bold";
  } else if (
    /(?:^|[^a-z])(md|medium)(?:[^a-z]|$)/.test(base) ||
    compact.includes("medium")
  ) {
    weight = "500";
    label = "Medium";
  } else if (
    /(?:^|[^a-z])(reg|regular|book|roman)(?:[^a-z]|$)/.test(base) ||
    compact.endsWith("reg")
  ) {
    weight = "400";
    label = "Regular";
  }

  // Trailing Fontspring-style codes: -bd, -bdit, -lt, -ltit, -it, -reg
  const code = base.match(/[-_](bdit|ltit|mdit|sbit|bd|lt|md|sb|blk|it|reg|bold|light|italic)(?:[-_.]|$)/i)?.[1]?.toLowerCase();
  if (code === "bd" || code === "bold") {
    weight = "700";
    label = "Bold";
  } else if (code === "bdit") {
    weight = "700";
    label = "Bold";
  } else if (code === "lt" || code === "light") {
    weight = "300";
    label = "Light";
  } else if (code === "ltit") {
    weight = "300";
    label = "Light";
  } else if (code === "md" || code === "medium") {
    weight = "500";
    label = "Medium";
  } else if (code === "sb" || code === "semibold") {
    weight = "600";
    label = "Semi Bold";
  } else if (code === "blk" || code === "black") {
    weight = "900";
    label = "Black";
  } else if (code === "reg" || code === "regular") {
    weight = "400";
    label = "Regular";
  } else if (code === "it" || code === "italic") {
    weight = "400";
    label = "Regular";
  }

  const isItalic =
    italic ||
    code === "it" ||
    code === "italic" ||
    code === "bdit" ||
    code === "ltit" ||
    code === "mdit" ||
    code === "sbit";

  if (isItalic) {
    label = label === "Regular" ? "Italic" : `${label} Italic`;
  }

  return {
    weight,
    style: isItalic ? "italic" : "normal",
    label,
  };
}

export function preferredBrandFontFaceUrl(faces: BrandFontFace[] | undefined | null): string | undefined {
  if (!faces?.length) return undefined;
  const preferred =
    faces.find((face) => face.weight === "400" && face.style === "normal") ||
    faces.find((face) => face.style === "normal") ||
    faces[0];
  return preferred?.fileUrl?.trim() || undefined;
}

export function normalizeBrandFontFaces(faces: BrandFontFace[] | undefined | null): BrandFontFace[] {
  if (!faces?.length) return [];
  const seen = new Set<string>();
  const out: BrandFontFace[] = [];
  for (const face of faces) {
    const fileUrl = (face.fileUrl ?? "").trim();
    if (!fileUrl) continue;
    const weight = String(face.weight || "400").trim() || "400";
    const style = face.style === "italic" ? "italic" : "normal";
    const label = (face.label || "").trim() || (style === "italic" ? "Italic" : "Regular");
    const key = `${weight}:${style}:${fileUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ fileUrl, weight, style, label });
    if (out.length >= MAX_BRAND_FONT_FACES) break;
  }
  return out;
}

function parseBrandFontFace(value: unknown): BrandFontFace | null {
  if (!value || typeof value !== "object") return null;
  const row = value as {
    fileUrl?: unknown;
    weight?: unknown;
    style?: unknown;
    label?: unknown;
  };
  const fileUrl = typeof row.fileUrl === "string" ? row.fileUrl.trim() : "";
  if (!fileUrl) return null;
  const weight = typeof row.weight === "string" && row.weight.trim() ? row.weight.trim() : "400";
  const style = row.style === "italic" ? "italic" : "normal";
  const label =
    typeof row.label === "string" && row.label.trim()
      ? row.label.trim()
      : style === "italic"
        ? "Italic"
        : "Regular";
  return { fileUrl, weight, style, label };
}

/** Normalize kit fonts into a secondary list (first slot = legacy secondary fields). */
export function listBrandSecondaryFonts(fonts: BrandFonts | null | undefined): BrandFontEntry[] {
  const secondaryFaces = normalizeBrandFontFaces(fonts?.secondaryFaces);
  const first: BrandFontEntry = {
    family: (fonts?.secondary ?? "").trim(),
    fileUrl:
      (fonts?.secondaryFileUrl ?? "").trim() ||
      preferredBrandFontFaceUrl(secondaryFaces) ||
      undefined,
    faces: secondaryFaces,
  };
  const extras = (fonts?.extras ?? [])
    .map((entry): BrandFontEntry | null => {
      const faces = normalizeBrandFontFaces(entry?.faces);
      const family = (entry?.family ?? "").trim();
      const fileUrl =
        (entry?.fileUrl ?? "").trim() || preferredBrandFontFaceUrl(faces) || undefined;
      if (!family && !fileUrl && faces.length === 0) return null;
      return { family, fileUrl, faces };
    })
    .filter((entry): entry is BrandFontEntry => entry != null);
  if (!first.family && !first.fileUrl && (!first.faces || first.faces.length === 0) && extras.length === 0) {
    return [{ family: "", faces: [] }];
  }
  return [{ ...first, faces: first.faces ?? [] }, ...extras].slice(0, MAX_BRAND_SECONDARY_FONTS);
}

/** Write secondary list back into legacy fields + extras. */
export function brandFontsFromSecondaries(
  fonts: BrandFonts,
  secondaries: BrandFontEntry[],
): BrandFonts {
  const cleaned = secondaries
    .map((entry) => {
      const faces = normalizeBrandFontFaces(entry.faces);
      const family = (entry.family ?? "").trim();
      const fileUrl =
        (entry.fileUrl ?? "").trim() || preferredBrandFontFaceUrl(faces) || undefined;
      return { family, fileUrl, faces };
    })
    .slice(0, MAX_BRAND_SECONDARY_FONTS);
  const [first, ...rest] =
    cleaned.length > 0 ? cleaned : [{ family: "", fileUrl: undefined as string | undefined, faces: [] as BrandFontFace[] }];
  return {
    ...fonts,
    secondary: first?.family ?? "",
    secondaryFileUrl: first?.fileUrl ?? "",
    secondaryFaces: first?.faces ?? [],
    extras: rest.filter((entry) => entry.family || entry.fileUrl || entry.faces.length > 0),
  };
}

/** Sync primary faces + preferred file URL onto a BrandFonts patch. */
export function withPrimaryFaces(fonts: BrandFonts, faces: BrandFontFace[]): BrandFonts {
  const normalized = normalizeBrandFontFaces(faces);
  return {
    ...fonts,
    primaryFaces: normalized,
    primaryFileUrl: preferredBrandFontFaceUrl(normalized) ?? "",
  };
}

export type ClientContactInput = {
  name: string;
  notes?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  instagram?: string;
  website?: string;
  /** Public URL; empty string or null clears the logo on update. */
  logo_url?: string | null;
  brand_colors?: BrandColor[];
  brand_fonts?: BrandFonts;
  brand_guidance?: string;
  i18n?: RowI18n;
};

export type ClientBillingInput = {
  monthlyFee: number | null;
  paymentDay: number | null;
  pixKey: string;
  pixHolder: string;
};

const CLIENT_BILLING_STORAGE_PREFIX = "som_client_billing:";

function isMissingClientBillingColumns(message: string) {
  return (
    /monthly_fee|payment_day|pix_key|pix_holder/i.test(message) &&
    /column|schema cache|does not exist/i.test(message)
  );
}

function parseStoredClientBilling(value: unknown): ClientBillingInput | null {
  if (!value || typeof value !== "object") return null;
  const row = value as {
    monthlyFee?: unknown;
    paymentDay?: unknown;
    pixKey?: unknown;
    pixHolder?: unknown;
  };
  const monthlyFee =
    typeof row.monthlyFee === "number" && Number.isFinite(row.monthlyFee) ? row.monthlyFee : null;
  const paymentDay =
    typeof row.paymentDay === "number" && row.paymentDay >= 1 && row.paymentDay <= 31
      ? Math.round(row.paymentDay)
      : null;
  return {
    monthlyFee,
    paymentDay,
    pixKey: typeof row.pixKey === "string" ? row.pixKey : "",
    pixHolder: typeof row.pixHolder === "string" ? row.pixHolder : "",
  };
}

export function readLocalClientBilling(clientId: string): ClientBillingInput | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${CLIENT_BILLING_STORAGE_PREFIX}${clientId}`);
    if (!raw) return null;
    return parseStoredClientBilling(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeLocalClientBilling(clientId: string, billing: ClientBillingInput) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${CLIENT_BILLING_STORAGE_PREFIX}${clientId}`,
      JSON.stringify(billing),
    );
  } catch {
    // Quota / private mode: dialog still works with in-memory values.
  }
}

export function billingFromClientRow(client: {
  monthly_fee?: number | string | null;
  payment_day?: number | string | null;
  pix_key?: string | null;
  pix_holder?: string | null;
} | null | undefined): ClientBillingInput {
  const feeRaw = client?.monthly_fee;
  const monthlyFee =
    typeof feeRaw === "number" && Number.isFinite(feeRaw)
      ? feeRaw
      : feeRaw != null && feeRaw !== ""
        ? Number(feeRaw)
        : null;
  const dayRaw = client?.payment_day;
  const day =
    typeof dayRaw === "number" ? dayRaw : dayRaw != null && dayRaw !== "" ? Number(dayRaw) : NaN;
  return {
    monthlyFee: monthlyFee != null && Number.isFinite(monthlyFee) ? monthlyFee : null,
    paymentDay: Number.isFinite(day) && day >= 1 && day <= 31 ? Math.round(day) : null,
    pixKey: (client?.pix_key ?? "").trim(),
    pixHolder: (client?.pix_holder ?? "").trim(),
  };
}

function billingHasValues(billing: ClientBillingInput) {
  return (
    billing.monthlyFee != null ||
    billing.paymentDay != null ||
    Boolean(billing.pixKey.trim()) ||
    Boolean(billing.pixHolder.trim())
  );
}

export function resolveClientBilling(
  clientId: string,
  client: {
    monthly_fee?: number | string | null;
    payment_day?: number | string | null;
    pix_key?: string | null;
    pix_holder?: string | null;
  } | null | undefined,
): ClientBillingInput {
  const fromDb = billingFromClientRow(client);
  if (billingHasValues(fromDb)) return fromDb;
  return readLocalClientBilling(clientId) ?? fromDb;
}

export async function updateClientBilling(
  clientId: string,
  billing: ClientBillingInput,
): Promise<void> {
  writeLocalClientBilling(clientId, billing);
  const { error } = await supabase
    .from("clients")
    .update({
      monthly_fee: billing.monthlyFee,
      payment_day: billing.paymentDay,
      pix_key: billing.pixKey.trim() || null,
      pix_holder: billing.pixHolder.trim() || null,
    })
    .eq("id", clientId);
  if (error && isMissingClientBillingColumns(error.message)) return;
  if (error) throw new Error(error.message);
}

export function parseBrandColors(value: unknown): BrandColor[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as { name?: unknown; hex?: unknown };
      const name = typeof row.name === "string" ? row.name.trim() : "";
      const hex = typeof row.hex === "string" ? row.hex.trim() : "";
      if (!hex) return null;
      return { name, hex };
    })
    .filter((entry): entry is BrandColor => Boolean(entry))
    .slice(0, MAX_BRAND_COLORS);
}

function parseBrandFontEntry(value: unknown): BrandFontEntry | null {
  if (!value || typeof value !== "object") return null;
  const row = value as {
    family?: unknown;
    fileUrl?: unknown;
    name?: unknown;
    faces?: unknown;
  };
  const family =
    typeof row.family === "string"
      ? row.family.trim()
      : typeof row.name === "string"
        ? row.name.trim()
        : "";
  const faces = Array.isArray(row.faces)
    ? normalizeBrandFontFaces(row.faces.map(parseBrandFontFace).filter(Boolean) as BrandFontFace[])
    : [];
  const fileUrl =
    (typeof row.fileUrl === "string" ? row.fileUrl.trim() : "") ||
    preferredBrandFontFaceUrl(faces) ||
    "";
  if (!family && !fileUrl && faces.length === 0) return null;
  // Legacy single-file entry without faces → synthesize one face.
  const resolvedFaces =
    faces.length > 0
      ? faces
      : fileUrl
        ? [{ fileUrl, weight: "400", style: "normal" as const, label: "Regular" }]
        : [];
  return {
    family,
    fileUrl: fileUrl || preferredBrandFontFaceUrl(resolvedFaces),
    faces: resolvedFaces,
  };
}

export function parseBrandFonts(value: unknown): BrandFonts {
  if (!value || typeof value !== "object") return {};
  const row = value as {
    primary?: unknown;
    secondary?: unknown;
    primaryFileUrl?: unknown;
    secondaryFileUrl?: unknown;
    primaryFaces?: unknown;
    secondaryFaces?: unknown;
    extras?: unknown;
    notes?: unknown;
  };
  const primaryFacesRaw = Array.isArray(row.primaryFaces)
    ? normalizeBrandFontFaces(
        row.primaryFaces.map(parseBrandFontFace).filter(Boolean) as BrandFontFace[],
      )
    : [];
  const secondaryFacesRaw = Array.isArray(row.secondaryFaces)
    ? normalizeBrandFontFaces(
        row.secondaryFaces.map(parseBrandFontFace).filter(Boolean) as BrandFontFace[],
      )
    : [];
  const primaryFileUrl =
    (typeof row.primaryFileUrl === "string" ? row.primaryFileUrl : "") ||
    preferredBrandFontFaceUrl(primaryFacesRaw) ||
    "";
  const secondaryFileUrl =
    (typeof row.secondaryFileUrl === "string" ? row.secondaryFileUrl : "") ||
    preferredBrandFontFaceUrl(secondaryFacesRaw) ||
    "";
  const primaryFaces =
    primaryFacesRaw.length > 0
      ? primaryFacesRaw
      : primaryFileUrl
        ? [{ fileUrl: primaryFileUrl, weight: "400", style: "normal" as const, label: "Regular" }]
        : [];
  const secondaryFaces =
    secondaryFacesRaw.length > 0
      ? secondaryFacesRaw
      : secondaryFileUrl
        ? [{ fileUrl: secondaryFileUrl, weight: "400", style: "normal" as const, label: "Regular" }]
        : [];
  const extras = Array.isArray(row.extras)
    ? row.extras
        .map(parseBrandFontEntry)
        .filter((entry): entry is BrandFontEntry => Boolean(entry))
        .slice(0, MAX_BRAND_SECONDARY_FONTS - 1)
    : [];
  return {
    primary: typeof row.primary === "string" ? row.primary : "",
    secondary: typeof row.secondary === "string" ? row.secondary : "",
    primaryFileUrl,
    secondaryFileUrl,
    primaryFaces,
    secondaryFaces,
    extras,
    notes: typeof row.notes === "string" ? row.notes : "",
  };
}

/** Upload a brand kit font file (.woff2 / .woff / .ttf / .otf) to library-assets. */
export async function uploadBrandFont(clientId: string, file: File): Promise<string> {
  const name = (file.name || "").toLowerCase();
  if (!/\.(woff2?|ttf|otf)$/i.test(name)) {
    throw new Error("Envie um arquivo de fonte (.woff2, .woff, .ttf ou .otf).");
  }
  if (file.size > BRAND_FONT_MAX_BYTES) {
    throw new Error("A fonte deve ter no máximo 2 MB.");
  }

  const safeName = sanitizeFileName(file.name || "font.woff2");
  const storagePath = `${clientId}/fonts/${crypto.randomUUID()}-${safeName}`;
  const contentType =
    file.type ||
    (name.endsWith(".woff2")
      ? "font/woff2"
      : name.endsWith(".woff")
        ? "font/woff"
        : name.endsWith(".otf")
          ? "font/otf"
          : "font/ttf");

  const { error } = await supabase.storage.from(LIBRARY_BUCKET).upload(storagePath, file, {
    cacheControl: "31536000",
    contentType,
    upsert: false,
  });
  if (error) {
    if (/mime type|not supported|invalid|415/i.test(error.message)) {
      throw new Error(
        "O armazenamento ainda não aceita arquivos de fonte. No Lovable, abra Cloud → SQL Editor e execute a migration supabase/migrations/20261001140000_brand_font_uploads.sql.",
      );
    }
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(LIBRARY_BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

export function parseBrandGuidance(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function brandKitFromClient(client: {
  brand_colors?: unknown;
  brand_fonts?: unknown;
  brand_guidance?: unknown;
}): { brand_colors: BrandColor[]; brand_fonts: BrandFonts; brand_guidance: string } {
  return {
    brand_colors: parseBrandColors(client.brand_colors),
    brand_fonts: parseBrandFonts(client.brand_fonts),
    brand_guidance: parseBrandGuidance(client.brand_guidance),
  };
}

function normalizeOptionalText(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function createClient(input: ClientContactInput): Promise<Client> {
  const user = await requireAuthUser();
  const userId = user.id;

  if (!isAdminMasterEmail(user.email)) {
    const entitlements = await getMyEntitlements();
    if (!entitlements.isMaster) {
      if (!entitlements.isTeamOwner) {
        throw new Error(
          "Apenas o gestor dono do plano pode criar clientes. Peça ao gestor para atribuir um cliente à sua conta.",
        );
      }

      const { count, error: countError } = await supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("created_by", userId);
      if (countError) throw new Error(countError.message);

      const { canCreateAnotherClient } = await import("./plan-entitlements");
      if (!canCreateAnotherClient(entitlements, count ?? 0)) {
        const max = entitlements.maxClients ?? 0;
        throw new Error(
          max <= 0
            ? "Seu plano não permite criar clientes. Peça ao administrador para atribuir uma assinatura."
            : `Limite do plano atingido (${max} cliente${max === 1 ? "" : "s"}). Atualize o plano para adicionar mais.`,
        );
      }
    }
  }

  const i18n = parseRowI18n(input.i18n);
  const name = getCanonicalText(i18n, "name", input.name).trim();
  const notes = normalizeOptionalText(getCanonicalText(i18n, "notes", input.notes));
  // Avoid insert().select(): RETURNING hits SELECT RLS before membership exists.
  const id = crypto.randomUUID();
  const { error: insertError } = await supabase.from("clients").insert({
    id,
    name,
    notes,
    email: normalizeOptionalText(input.email),
    phone: normalizeOptionalText(input.phone),
    whatsapp: normalizeOptionalText(input.whatsapp),
    instagram: normalizeOptionalText(input.instagram),
    website: normalizeOptionalText(input.website),
    logo_url: normalizeOptionalText(input.logo_url ?? undefined),
    ...(input.i18n ? { i18n: toI18nJson(i18n) } : {}),
    created_by: userId,
  });
  if (insertError) throw new Error(insertError.message);

  const { data, error } = await supabase.from("clients").select("*").eq("id", id).single();
  const row = ensureData(data, error);
  logActivity({
    type: "client_created",
    summary: `Cliente criado: ${row.name}`,
    clientId: row.id,
  });
  return row;
}

export async function updateClient(clientId: string, input: ClientContactInput): Promise<Client> {
  // RPC allows client members to review/update contact fields (not only owners/admins).
  // Empty string clears logo_url; omit logo_url from input to leave unchanged (RPC null).
  // Omit brand_colors / brand_fonts to leave the kit unchanged (e.g. contact-only edits).
  const brandColors =
    input.brand_colors !== undefined ? parseBrandColors(input.brand_colors) : null;
  const brandFonts =
    input.brand_fonts !== undefined ? parseBrandFonts(input.brand_fonts) : null;
  const brandGuidance =
    input.brand_guidance === undefined ? null : input.brand_guidance.trim() || "";
  const i18n = parseRowI18n(input.i18n);
  const name = getCanonicalText(i18n, "name", input.name).trim();
  const notes = normalizeOptionalText(getCanonicalText(i18n, "notes", input.notes));

  const baseArgs = {
    _client_id: clientId,
    _name: name,
    _notes: notes,
    _email: normalizeOptionalText(input.email),
    _phone: normalizeOptionalText(input.phone),
    _whatsapp: normalizeOptionalText(input.whatsapp),
    _instagram: normalizeOptionalText(input.instagram),
    _website: normalizeOptionalText(input.website),
  };

  const withLogoArgs = {
    ...baseArgs,
    _logo_url:
      input.logo_url === undefined ? null : (normalizeOptionalText(input.logo_url ?? undefined) ?? ""),
  };

  const withBrandArgs = {
    ...withLogoArgs,
    _brand_colors: brandColors as unknown as Json,
    _brand_fonts: brandFonts as unknown as Json,
    ...(input.brand_guidance !== undefined ? { _brand_guidance: brandGuidance } : {}),
  };

  let { data, error } = await supabase.rpc(
    "update_client_contact",
    withBrandArgs as Database["public"]["Functions"]["update_client_contact"]["Args"],
  );

  // Remote may still be on an older RPC signature without website / brand kit / logo.
  if (error && /Could not find the function|PGRST202/i.test(error.message)) {
    const legacyBase = {
      _client_id: clientId,
      _name: name,
      _notes: notes,
      _email: normalizeOptionalText(input.email),
      _phone: normalizeOptionalText(input.phone),
      _whatsapp: normalizeOptionalText(input.whatsapp),
      _instagram: normalizeOptionalText(input.instagram),
    };
    const legacyLogo = {
      ...legacyBase,
      _logo_url:
        input.logo_url === undefined
          ? null
          : (normalizeOptionalText(input.logo_url ?? undefined) ?? ""),
    };
    const legacyBrand = {
      ...legacyLogo,
      _brand_colors: brandColors as unknown as Json,
      _brand_fonts: brandFonts as unknown as Json,
    };

    ({ data, error } = await supabase.rpc(
      "update_client_contact",
      legacyBrand as Database["public"]["Functions"]["update_client_contact"]["Args"],
    ));

    if (error && /Could not find the function|PGRST202/i.test(error.message)) {
      ({ data, error } = await supabase.rpc(
        "update_client_contact",
        legacyLogo as Database["public"]["Functions"]["update_client_contact"]["Args"],
      ));
    }

    if (error && /Could not find the function|PGRST202/i.test(error.message)) {
      ({ data, error } = await supabase.rpc(
        "update_client_contact",
        legacyBase as Database["public"]["Functions"]["update_client_contact"]["Args"],
      ));
    }

    if (!error) {
      const patch: {
        logo_url?: string | null;
        brand_colors?: Json;
        brand_fonts?: Json;
        brand_guidance?: string | null;
        website?: string | null;
      } = {};
      if (brandColors !== null) patch.brand_colors = brandColors as unknown as Json;
      if (brandFonts !== null) patch.brand_fonts = brandFonts as unknown as Json;
      if (input.brand_guidance !== undefined) {
        patch.brand_guidance = brandGuidance || null;
      }
      if (input.logo_url !== undefined) {
        patch.logo_url = normalizeOptionalText(input.logo_url ?? undefined);
      }
      if (input.website !== undefined) {
        patch.website = normalizeOptionalText(input.website);
      }
      if (Object.keys(patch).length > 0) {
        const { error: kitError } = await supabase.from("clients").update(patch).eq("id", clientId);
        if (kitError && !/row-level security|violates row-level|column .* does not exist/i.test(kitError.message)) {
          // Ignore when migration/RLS not applied yet for client members.
        }
      }
    }
  }

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Resposta vazia do servidor");

  if (input.i18n) {
    const { data: withI18n, error: i18nError } = await supabase
      .from("clients")
      .update({ i18n: toI18nJson(input.i18n) })
      .eq("id", clientId)
      .select("*")
      .maybeSingle();
    if (!i18nError && withI18n) return withI18n as Client;
  }

  return data as Client;
}

export async function getClientPlatformLogin(clientId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc("get_client_platform_login", {
    _client_id: clientId,
  });
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}

export type ClientGestorContact = {
  userId: string;
  fullName: string | null;
  email: string | null;
  whatsapp: string | null;
  website: string | null;
};

export async function getMyGestorContact(clientId: string): Promise<ClientGestorContact | null> {
  const { data, error } = await supabase.rpc("get_client_gestor_contact", {
    _client_id: clientId,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;

  const row = data as Record<string, unknown>;
  const userId = typeof row.userId === "string" ? row.userId : "";
  if (!userId) return null;

  return {
    userId,
    fullName: typeof row.fullName === "string" ? row.fullName : null,
    email: typeof row.email === "string" ? row.email : null,
    whatsapp: typeof row.whatsapp === "string" ? row.whatsapp : null,
    website: typeof row.website === "string" ? row.website : null,
  };
}

/** Normalize a stored website value into an absolute http(s) URL for links. */
export function websiteHref(website: string | null | undefined): string | null {
  const trimmed = website?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export async function provisionClientAccess(input: {
  clientId: string;
  email: string;
  password: string;
  fullName?: string;
}) {
  const { provisionClientAccessFn } = await import("./provision-client-access.functions");
  return provisionClientAccessFn({
    data: {
      clientId: input.clientId,
      email: input.email,
      password: input.password,
      fullName: input.fullName,
    },
  });
}

export async function listGestores() {
  const { listGestoresFn } = await import("./provision-gestor-access.functions");
  return listGestoresFn();
}

export async function listAssinantes() {
  const { listAssinantesFn } = await import("./provision-gestor-access.functions");
  return listAssinantesFn();
}

export async function setAssinanteStatus(input: {
  userId: string;
  active: boolean;
}) {
  const { setAssinanteStatusFn } = await import("./provision-gestor-access.functions");
  return setAssinanteStatusFn({ data: input });
}

export async function provisionGestorAccess(input: {
  email: string;
  password: string;
  userId?: string;
  fullName?: string;
  whatsapp?: string;
  plan?: import("./plan-entitlements").AssignablePlan;
}) {
  const { provisionGestorAccessFn } = await import("./provision-gestor-access.functions");
  return provisionGestorAccessFn({
    data: {
      email: input.email,
      password: input.password,
      userId: input.userId,
      fullName: input.fullName,
      whatsapp: input.whatsapp,
      plan: input.plan ?? "courtesy",
    },
  });
}

export async function setGestorPlan(input: {
  userId: string;
  plan: import("./plan-entitlements").AssignablePlan;
}) {
  const { setGestorPlanFn } = await import("./provision-gestor-access.functions");
  return setGestorPlanFn({ data: input });
}

export async function getClientGestor(clientId: string) {
  const { getClientGestorFn } = await import("./reassign-client-gestor.functions");
  return getClientGestorFn({ data: { clientId } });
}

export async function reassignClientGestor(input: {
  clientId: string;
  newGestorUserId: string;
}) {
  const { reassignClientGestorFn } = await import("./reassign-client-gestor.functions");
  return reassignClientGestorFn({ data: input });
}

let myEntitlementsCache: { at: number; value: PlanEntitlements } | null = null;
const MY_ENTITLEMENTS_TTL_MS = 5_000;

export async function getMyEntitlements() {
  if (myEntitlementsCache && Date.now() - myEntitlementsCache.at < MY_ENTITLEMENTS_TTL_MS) {
    return myEntitlementsCache.value;
  }
  const { getMyEntitlementsFn } = await import("./provision-gestor-access.functions");
  const value = await getMyEntitlementsFn();
  myEntitlementsCache = { at: Date.now(), value };
  return value;
}

async function assertPlanFeature(
  feature: "library" | "brandBriefing" | "presets" | "designAi",
  message: string,
) {
  const entitlements = await getMyEntitlements();
  if (entitlements.isMaster || entitlements[feature]) return;
  throw new Error(message);
}

export async function listMyTeam() {
  const { listMyTeamFn } = await import("./team-access.functions");
  return listMyTeamFn();
}

export async function provisionTeamMember(input: {
  email: string;
  password: string;
  fullName?: string;
  whatsapp?: string;
}) {
  const { provisionTeamMemberFn } = await import("./team-access.functions");
  return provisionTeamMemberFn({
    data: {
      email: input.email,
      password: input.password,
      fullName: input.fullName,
      whatsapp: input.whatsapp,
    },
  });
}

export async function removeTeamMember(memberUserId: string) {
  const { removeTeamMemberFn } = await import("./team-access.functions");
  return removeTeamMemberFn({ data: { memberUserId } });
}

export async function setTeamMemberClients(input: {
  memberUserId: string;
  clientIds: string[];
}) {
  const { setTeamMemberClientsFn } = await import("./team-access.functions");
  return setTeamMemberClientsFn({ data: input });
}

export async function resetTeamMemberPassword(input: {
  memberUserId: string;
  password: string;
}) {
  const { resetTeamMemberPasswordFn } = await import("./team-access.functions");
  return resetTeamMemberPasswordFn({ data: input });
}

export async function updateOwnPassword(password: string) {
  const trimmed = password.trim();
  if (trimmed.length < 6) {
    throw new Error("A senha deve ter pelo menos 6 caracteres.");
  }
  const { error } = await supabase.auth.updateUser({ password: trimmed });
  if (error) throw new Error(error.message);
}

export type MyProfile = {
  id: string;
  email: string | null;
  full_name: string | null;
  whatsapp: string | null;
  company_name: string | null;
  website: string | null;
  logo_url: string | null;
};

export async function getMyProfile(): Promise<MyProfile> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message);
  if (!user) throw new Error("Não autenticado.");

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, whatsapp, company_name, website, logo_url")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return {
    id: user.id,
    email: user.email ?? null,
    full_name:
      data?.full_name ??
      (typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : null),
    whatsapp: data?.whatsapp ?? null,
    company_name: data?.company_name ?? null,
    website: data?.website ?? null,
    logo_url: data?.logo_url ?? null,
  };
}

export async function updateMyProfile(input: {
  fullName: string;
  whatsapp: string;
  companyName?: string;
  website?: string;
  logoUrl?: string | null;
}): Promise<MyProfile> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message);
  if (!user) throw new Error("Não autenticado.");

  const fullName = input.fullName.trim();
  const whatsapp = input.whatsapp.replace(/\D/g, "") || null;
  const companyName = input.companyName?.trim() || null;
  const website = input.website?.trim() || null;
  const logoUrl =
    input.logoUrl === undefined
      ? undefined
      : input.logoUrl?.trim() || null;

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    full_name: fullName || null,
    whatsapp,
    company_name: companyName,
    website,
    ...(logoUrl !== undefined ? { logo_url: logoUrl } : {}),
  });
  if (error) throw new Error(error.message);

  if (fullName) {
    await supabase.auth.updateUser({
      data: { full_name: fullName },
    });
  }

  return getMyProfile();
}

export async function uploadGestorLogo(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Envie uma imagem (PNG, JPG, WebP ou SVG).");
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new Error("O logo deve ter no máximo 2 MB.");
  }

  const userId = await requireUserId();
  const safeName = sanitizeFileName(file.name || "logo");
  const storagePath = `${userId}/${crypto.randomUUID()}-${safeName}`;
  const { error: storageError } = await supabase.storage
    .from(GESTOR_LOGOS_BUCKET)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type || undefined,
      upsert: false,
    });
  if (storageError) throw new Error(storageError.message);

  const { data } = supabase.storage.from(GESTOR_LOGOS_BUCKET).getPublicUrl(storagePath);
  const logoUrl = data.publicUrl;

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, logo_url: logoUrl });
  if (error) throw new Error(error.message);

  return logoUrl;
}

// —— Commercial proposals ——

export type {
  CommercialTerms,
  InvestmentItem,
  ProposalDraftFields,
  ProposalSection,
} from "@/lib/proposal-template";

export type CommercialProposalWithClient = CommercialProposal & {
  clients: Pick<Client, "id" | "name" | "logo_url"> | null;
};

function toProposalJson(value: unknown): Json {
  return value as Json;
}

export async function listCommercialProposals(): Promise<CommercialProposalWithClient[]> {
  const { data, error } = await supabase
    .from("commercial_proposals")
    .select("*, clients ( id, name, logo_url )")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CommercialProposalWithClient[];
}

export async function getCommercialProposal(
  proposalId: string,
): Promise<CommercialProposalWithClient | null> {
  const { data, error } = await supabase
    .from("commercial_proposals")
    .select("*, clients ( id, name, logo_url )")
    .eq("id", proposalId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as CommercialProposalWithClient | null;
}

export async function createCommercialProposal(input: {
  clientId: string;
}): Promise<CommercialProposal> {
  const userId = await requireUserId();
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", input.clientId)
    .maybeSingle();
  if (clientError) throw new Error(clientError.message);
  if (!client) throw new Error("Cliente não encontrado.");

  const draft = createBlankProposalDraft(client.name);
  const { data, error } = await supabase
    .from("commercial_proposals")
    .insert({
      created_by: userId,
      client_id: client.id,
      title: draft.title,
      subtitle: draft.subtitle,
      scope_summary: draft.scope_summary,
      proposal_month: draft.proposal_month,
      cover_image_url: draft.cover_image_url,
      sections: toProposalJson(draft.sections),
      investment_items: toProposalJson(draft.investment_items),
      commercial_terms: toProposalJson(draft.commercial_terms),
      status: draft.status,
    } satisfies TablesInsert<"commercial_proposals">)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateCommercialProposal(input: {
  proposalId: string;
  clientId?: string;
  title?: string;
  subtitle?: string;
  scopeSummary?: string;
  proposalMonth?: string;
  coverImageUrl?: string | null;
  sections?: ProposalSection[];
  investmentItems?: InvestmentItem[];
  commercialTerms?: CommercialTerms;
  status?: CommercialProposalStatus;
}): Promise<CommercialProposal> {
  const patch: Database["public"]["Tables"]["commercial_proposals"]["Update"] = {};

  if (input.clientId !== undefined) patch.client_id = input.clientId;
  if (input.title !== undefined) patch.title = input.title.trim() || "PROPOSTA COMERCIAL";
  if (input.subtitle !== undefined) patch.subtitle = input.subtitle;
  if (input.scopeSummary !== undefined) patch.scope_summary = input.scopeSummary;
  if (input.proposalMonth !== undefined) patch.proposal_month = input.proposalMonth;
  if (input.coverImageUrl !== undefined) patch.cover_image_url = input.coverImageUrl;
  if (input.sections !== undefined) patch.sections = toProposalJson(input.sections);
  if (input.investmentItems !== undefined) {
    patch.investment_items = toProposalJson(input.investmentItems);
  }
  if (input.commercialTerms !== undefined) {
    patch.commercial_terms = toProposalJson(input.commercialTerms);
  }
  if (input.status !== undefined) patch.status = input.status;

  const { data, error } = await supabase
    .from("commercial_proposals")
    .update(patch)
    .eq("id", input.proposalId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteCommercialProposal(proposalId: string): Promise<void> {
  const { error } = await supabase
    .from("commercial_proposals")
    .delete()
    .eq("id", proposalId);
  if (error) throw new Error(error.message);
}

export async function uploadProposalCover(input: {
  proposalId: string;
  file: File;
}): Promise<string> {
  if (!input.file.type.startsWith("image/")) {
    throw new Error("Envie uma imagem (PNG, JPG ou WebP).");
  }
  if (input.file.size > 5 * 1024 * 1024) {
    throw new Error("A imagem de capa deve ter no máximo 5 MB.");
  }

  const userId = await requireUserId();
  const safeName = sanitizeFileName(input.file.name || "capa");
  const storagePath = `${userId}/${input.proposalId}/${crypto.randomUUID()}-${safeName}`;
  const { error: storageError } = await supabase.storage
    .from(PROPOSAL_COVERS_BUCKET)
    .upload(storagePath, input.file, {
      cacheControl: "3600",
      contentType: input.file.type || undefined,
      upsert: false,
    });
  if (storageError) throw new Error(storageError.message);

  const { data } = supabase.storage.from(PROPOSAL_COVERS_BUCKET).getPublicUrl(storagePath);
  const coverUrl = data.publicUrl;

  const { error } = await supabase
    .from("commercial_proposals")
    .update({ cover_image_url: coverUrl })
    .eq("id", input.proposalId);
  if (error) throw new Error(error.message);

  return coverUrl;
}

export function hydrateProposalDraft(
  row: CommercialProposal,
  clientName = "",
): ProposalDraftFields {
  return {
    title: row.title,
    subtitle: row.subtitle,
    scope_summary: row.scope_summary,
    proposal_month: row.proposal_month,
    cover_image_url: row.cover_image_url,
    sections: parseProposalSections(row.sections),
    investment_items: parseInvestmentItems(row.investment_items),
    commercial_terms: parseCommercialTerms(row.commercial_terms, clientName),
    status: row.status,
  };
}

// —— Projects ——

export async function listProjects(clientId: string) {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getProject(projectId: string) {
  const { data, error } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createProject(input: {
  clientId: string;
  name: string;
  description?: string;
  categories?: ProjectCategory[];
  i18n?: RowI18n;
}): Promise<Project> {
  const userId = await requireUserId();
  const categories = normalizeProjectCategories(input.categories);
  if (categories.length === 0) {
    throw new Error("Selecione o tipo do projeto.");
  }
  const i18n = parseRowI18n(input.i18n);
  const name = getCanonicalText(i18n, "name", input.name).trim();
  const description =
    getCanonicalText(i18n, "description", input.description)?.trim() || null;
  const { data, error } = await supabase
    .from("projects")
    .insert({
      client_id: input.clientId,
      name,
      description,
      categories,
      i18n: toI18nJson(i18n),
      created_by: userId,
    })
    .select("*")
    .single();
  const row = ensureData(data, error);
  logActivity({
    type: "project_created",
    summary: `Projeto criado: ${row.name}`,
    clientId: input.clientId,
    projectId: row.id,
  });
  return row;
}

export async function updateProject(
  projectId: string,
  input: {
    name: string;
    description?: string;
    status?: string;
    categories?: ProjectCategory[];
    ctaPresets?: string[];
    hashtagPresets?: string[];
    themePresets?: string[];
    i18n?: RowI18n;
  },
): Promise<Project> {
  const normalizePresets = (items?: string[]) =>
    items
      ?.map((item) => item.trim())
      .filter(Boolean)
      .filter((item, index, arr) => arr.findIndex((x) => x.toLowerCase() === item.toLowerCase()) === index);

  const { data, error } = await supabase
    .from("projects")
    .update({
      name: input.name.trim(),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.categories !== undefined
        ? { categories: normalizeProjectCategories(input.categories) }
        : {}),
      ...(input.ctaPresets !== undefined
        ? { cta_presets: normalizePresets(input.ctaPresets) ?? [] }
        : {}),
      ...(input.hashtagPresets !== undefined
        ? { hashtag_presets: normalizePresets(input.hashtagPresets) ?? [] }
        : {}),
      ...(input.themePresets !== undefined
        ? { theme_presets: normalizePresets(input.themePresets) ?? [] }
        : {}),
      ...(input.i18n ? { i18n: toI18nJson(input.i18n) } : {}),
    })
    .eq("id", projectId)
    .select("*")
    .single();
  return ensureData(data, error);
}

export async function countProjects() {
  const { count, error } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// —— Content ——

function isMissingMediaOverlaysColumn(message: string) {
  return /media_overlays/i.test(message) && /column|schema cache|does not exist/i.test(message);
}

function isMissingFunnelStageColumn(message: string) {
  return /funnel_stage/i.test(message) && /column|schema cache|does not exist/i.test(message);
}

function isMissingContentMixColumn(message: string) {
  return /content_mix/i.test(message) && /column|schema cache|does not exist/i.test(message);
}

function isMissingPerformanceColumns(message: string) {
  return /(performance_reach|performance_retention|performance_note|repeat_format)/i.test(message) &&
    /column|schema cache|does not exist/i.test(message);
}

function isMissingBrandReferenceCreatorsTable(message: string) {
  return /brand_reference_creators/i.test(message) && /(does not exist|not find|schema cache)/i.test(message);
}

const CONTENT_LIST_COLUMNS_FALLBACK =
  "id, project_id, title, status, format, theme, scheduled_at, sort_order, calendar_block_id, media_url, media_urls, thumbnail_url, media_overlays, i18n, material_type, width_cm, height_cm, created_at, updated_at, current_version, created_by";

function isMissingSortOrderColumn(message: string) {
  return /sort_order/i.test(message) && /column|schema cache|does not exist/i.test(message);
}

function isMissingArchivedAtColumn(message: string) {
  return /archived_at/i.test(message) && /column|schema cache|does not exist/i.test(message);
}

const CONTENT_LIST_COLUMNS =
  "id, project_id, title, status, format, theme, funnel_stage, scheduled_at, sort_order, calendar_block_id, media_url, media_urls, thumbnail_url, media_overlays, i18n, material_type, width_cm, height_cm, archived_at, created_at, updated_at, current_version, created_by";

const CONTENT_LIST_COLUMNS_WITHOUT_ARCHIVED =
  "id, project_id, title, status, format, theme, funnel_stage, scheduled_at, sort_order, calendar_block_id, media_url, media_urls, thumbnail_url, media_overlays, i18n, material_type, width_cm, height_cm, created_at, updated_at, current_version, created_by";

function asListContentItem(row: Record<string, unknown>): ContentItem {
  return {
    caption: "",
    cta: "",
    hashtags: "",
    locucao: "",
    roteiro: "",
    production_notes: "",
    funnel_stage: null,
    performance_note: "",
    performance_reach: "",
    performance_retention: "",
    repeat_format: false,
    archived_at: null,
    ...row,
  } as ContentItem;
}

export function isContentArchived(row: Pick<ContentItem, "archived_at"> | { archived_at?: string | null }) {
  return Boolean(row.archived_at);
}

export async function listContent(projectId: string) {
  const ordered = await supabase
    .from("content_items")
    .select(CONTENT_LIST_COLUMNS)
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (!ordered.error) {
    return (ordered.data ?? []).map((row) => asListContentItem(row as Record<string, unknown>));
  }

  if (isMissingArchivedAtColumn(ordered.error.message)) {
    const fallback = await supabase
      .from("content_items")
      .select(CONTENT_LIST_COLUMNS_WITHOUT_ARCHIVED)
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (fallback.error) throw new Error(fallback.error.message);
    return (fallback.data ?? []).map((row) => asListContentItem(row as Record<string, unknown>));
  }

  if (isMissingFunnelStageColumn(ordered.error.message)) {
    const fallback = await supabase
      .from("content_items")
      .select(CONTENT_LIST_COLUMNS_FALLBACK)
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (fallback.error) throw new Error(fallback.error.message);
    return (fallback.data ?? []).map((row) => asListContentItem(row as Record<string, unknown>));
  }

  // Migration `content_sort_order` may not be applied yet on the remote DB.
  // Fall back so the calendar/list don't look "empty" when the query fails.
  if (isMissingSortOrderColumn(ordered.error.message)) {
    const fallback = await supabase
      .from("content_items")
      .select(CONTENT_LIST_COLUMNS_WITHOUT_ARCHIVED)
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    if (fallback.error) throw new Error(fallback.error.message);
    return (fallback.data ?? []).map((row) => asListContentItem(row as Record<string, unknown>));
  }

  throw new Error(ordered.error.message);
}

async function nextContentSortOrder(projectId: string): Promise<number> {
  const { data, error } = await supabase
    .from("content_items")
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!error) return (data?.sort_order ?? -1) + 1;
  if (isMissingSortOrderColumn(error.message)) return 0;
  throw new Error(error.message);
}

export async function reorderContentItems(
  items: Array<{
    id: string;
    sort_order: number;
    scheduled_at?: string | null;
    calendar_block_id?: string | null;
  }>,
): Promise<void> {
  const results = await Promise.all(
    items.map(({ id, sort_order, scheduled_at, calendar_block_id }) => {
      const patch: {
        sort_order: number;
        scheduled_at?: string | null;
        calendar_block_id?: string | null;
      } = { sort_order };
      if (scheduled_at !== undefined) patch.scheduled_at = scheduled_at;
      if (calendar_block_id !== undefined) patch.calendar_block_id = calendar_block_id;
      return supabase.from("content_items").update(patch).eq("id", id);
    }),
  );
  const firstError = results.find((result) => result.error)?.error;
  if (firstError) throw new Error(firstError.message);
}

export async function getContent(contentId: string) {
  const { data, error } = await supabase
    .from("content_items")
    .select("*")
    .eq("id", contentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createContent(input: {
  projectId: string;
  clientId: string;
  title: string;
  caption?: string;
  cta?: string;
  hashtags?: string;
  locucao?: string;
  mediaUrl?: string;
  format?: ContentFormat;
  theme?: string | null;
  funnelStage?: FunnelStage | null;
  materialType?: string | null;
  widthCm?: number | null;
  heightCm?: number | null;
  productionNotes?: string;
  scheduledAt?: string | null;
  calendarBlockId?: string | null;
  i18n?: RowI18n;
}): Promise<ContentItem> {
  const [userId, sortOrder, blocks, project] = await Promise.all([
    requireUserId(),
    nextContentSortOrder(input.projectId),
    listCalendarBlocks(input.projectId).catch(() => []),
    input.format ? Promise.resolve(null) : getProject(input.projectId).catch(() => null),
  ]);
  const calendarBlockId =
    input.calendarBlockId !== undefined
      ? input.calendarBlockId
      : (blocks[0]?.id ?? null);
  const format = input.format ?? defaultContentFormatForProject(project?.categories);
  const i18n = parseRowI18n(input.i18n);
  const materialType =
    input.materialType?.trim() ||
    (format === "print_material" ? "poster" : null);
  const preset = getGraphicArtsMaterialPreset(materialType);
  const widthCm =
    input.widthCm !== undefined && input.widthCm !== null
      ? input.widthCm
      : format === "print_material"
        ? preset.widthCm
        : null;
  const heightCm =
    input.heightCm !== undefined && input.heightCm !== null
      ? input.heightCm
      : format === "print_material"
        ? preset.heightCm
        : null;
  const baseInsert = {
    project_id: input.projectId,
    title: getCanonicalText(i18n, "title", input.title).trim(),
    caption: getCanonicalText(i18n, "caption", input.caption)?.trim() || "",
    cta: getCanonicalText(i18n, "cta", input.cta)?.trim() || "",
    hashtags: getCanonicalText(i18n, "hashtags", input.hashtags)?.trim() || "",
    media_url: input.mediaUrl?.trim() || null,
    format,
    material_type: materialType,
    width_cm: widthCm,
    height_cm: heightCm,
    production_notes: input.productionNotes?.trim() || "",
    locucao: input.locucao?.trim() || "",
    theme: input.theme?.trim() || null,
    funnel_stage: parseFunnelStage(input.funnelStage),
    i18n: toI18nJson(i18n),
    created_by: userId,
    status: "draft" as const,
    scheduled_at: input.scheduledAt ?? null,
    ...(calendarBlockId ? { calendar_block_id: calendarBlockId } : {}),
  };
  let { data, error } = await supabase
    .from("content_items")
    .insert({ ...baseInsert, sort_order: sortOrder })
    .select("*")
    .single();
  if (error && isMissingSortOrderColumn(error.message)) {
    const retry = await supabase.from("content_items").insert(baseInsert).select("*").single();
    data = retry.data;
    error = retry.error;
  }
  if (error && isMissingCalendarBlockIdColumn(error.message)) {
    const { calendar_block_id: _ignored, ...withoutBlock } = baseInsert as typeof baseInsert & {
      calendar_block_id?: string;
    };
    const retry = await supabase
      .from("content_items")
      .insert({ ...withoutBlock, sort_order: sortOrder })
      .select("*")
      .single();
    data = retry.data;
    error = retry.error;
  }
  if (error && isMissingFunnelStageColumn(error.message)) {
    const { funnel_stage: _ignoredFunnel, ...withoutFunnel } = baseInsert as typeof baseInsert & {
      funnel_stage?: string | null;
    };
    const retry = await supabase
      .from("content_items")
      .insert({ ...withoutFunnel, sort_order: sortOrder })
      .select("*")
      .single();
    data = retry.data;
    error = retry.error;
  }
  const row = ensureData(data, error);
  logActivity({
    type: "content_created",
    summary: `Conteúdo criado: ${row.title}`,
    clientId: input.clientId,
    projectId: input.projectId,
    contentId: row.id,
  });
  return row;
}

/**
 * Duplica um conteúdo como novo item em rascunho.
 * Copia só o estado atual dos campos (título, copy, mídia, etc.).
 * O histórico de versões é sempre zerado: o clone nasce em v1 e nenhuma
 * linha de `content_versions` do original é copiada (o trigger
 * `on_content_created` cria apenas a versão inicial do novo id).
 */
export async function duplicateContent(input: {
  contentId: string;
  clientId: string;
  projectId: string;
  /** Dias a avançar na data agendada (padrão: 7). */
  advanceDays?: number;
  calendarBlockId?: string | null;
  sortOrder?: number;
  /** Quando true, não registra activity (ex.: duplicação em lote de bloco). */
  silent?: boolean;
}): Promise<ContentItem> {
  const userId = await requireUserId();
  const source = await getContent(input.contentId);
  if (!source) throw new Error("Conteúdo não encontrado");
  if (source.project_id !== input.projectId) {
    throw new Error("Conteúdo não pertence a este projeto");
  }

  const advanceDays = input.advanceDays ?? 7;
  let scheduledAt: string | null = null;
  if (source.scheduled_at) {
    const next = new Date(source.scheduled_at);
    if (!Number.isNaN(next.getTime())) {
      next.setDate(next.getDate() + advanceDays);
      scheduledAt = next.toISOString();
    }
  }

  const mediaUrls = resolveContentMediaUrls(source);
  const sortOrder =
    input.sortOrder !== undefined ? input.sortOrder : await nextContentSortOrder(input.projectId);
  const calendarBlockId =
    input.calendarBlockId !== undefined ? input.calendarBlockId : source.calendar_block_id;

  // Intencionalmente NÃO copia current_version nem content_versions do source.
  const baseInsert = {
    project_id: input.projectId,
    title: source.title,
    caption: source.caption,
    cta: source.cta,
    hashtags: source.hashtags,
    locucao: source.locucao ?? "",
    roteiro: source.roteiro ?? "",
    media_url: mediaUrls[0] ?? null,
    media_urls: mediaUrls,
    media_overlays: (source as ContentItem & { media_overlays?: Json }).media_overlays ?? [],
    thumbnail_url: source.thumbnail_url ?? null,
    format: source.format,
    material_type: source.material_type,
    width_cm: source.width_cm,
    height_cm: source.height_cm,
    production_notes: source.production_notes ?? "",
    theme: source.theme,
    funnel_stage: parseFunnelStage((source as ContentItem).funnel_stage),
    scheduled_at: scheduledAt,
    calendar_block_id: calendarBlockId,
    created_by: userId,
    status: "draft" as const,
    current_version: 1,
  };
  let { data, error } = await supabase
    .from("content_items")
    .insert({ ...baseInsert, sort_order: sortOrder })
    .select("*")
    .single();
  if (error && isMissingSortOrderColumn(error.message)) {
    const retry = await supabase.from("content_items").insert(baseInsert).select("*").single();
    data = retry.data;
    error = retry.error;
  }
  if (error && isMissingCalendarBlockIdColumn(error.message)) {
    const { calendar_block_id: _ignored, ...withoutBlock } = baseInsert;
    const retry = await supabase
      .from("content_items")
      .insert({ ...withoutBlock, sort_order: sortOrder })
      .select("*")
      .single();
    data = retry.data;
    error = retry.error;
  }
  if (error && isMissingMediaOverlaysColumn(error.message)) {
    const { media_overlays: _ignoredOverlays, ...withoutOverlays } = baseInsert;
    const retry = await supabase
      .from("content_items")
      .insert({ ...withoutOverlays, sort_order: sortOrder })
      .select("*")
      .single();
    data = retry.data;
    error = retry.error;
  }
  if (error && isMissingFunnelStageColumn(error.message)) {
    const { funnel_stage: _ignoredFunnel, ...withoutFunnel } = baseInsert;
    const retry = await supabase
      .from("content_items")
      .insert({ ...withoutFunnel, sort_order: sortOrder })
      .select("*")
      .single();
    data = retry.data;
    error = retry.error;
  }
  let row = ensureData(data, error);

  // Garante histórico zerado mesmo se algum default/trigger alterar current_version.
  if (row.current_version !== 1) {
    const { data: fixed, error: fixError } = await supabase
      .from("content_items")
      .update({ current_version: 1 })
      .eq("id", row.id)
      .select("*")
      .single();
    row = ensureData(fixed, fixError);
  }

  if (!input.silent) {
    logActivity({
      type: "content_created",
      summary: `Conteúdo duplicado: ${row.title}`,
      clientId: input.clientId,
      projectId: input.projectId,
      contentId: row.id,
    });
  }
  return row;
}

export async function deleteContent(input: {
  contentId: string;
  projectId: string;
}): Promise<void> {
  const current = await getContent(input.contentId);
  if (!current) throw new Error("Conteúdo não encontrado");
  if (current.project_id !== input.projectId) {
    throw new Error("Conteúdo não pertence a este projeto");
  }
  const storagePaths = contentMediaStoragePaths(current, input.projectId);
  const { error } = await supabase.from("content_items").delete().eq("id", input.contentId);
  if (error) throw new Error(error.message);
  if (storagePaths.length > 0) {
    await supabase.storage.from(CONTENT_MEDIA_BUCKET).remove(storagePaths);
  }
}

export async function archiveContent(input: {
  contentId: string;
  projectId: string;
}): Promise<ContentItem> {
  const current = await getContent(input.contentId);
  if (!current) throw new Error("Conteúdo não encontrado");
  if (current.project_id !== input.projectId) {
    throw new Error("Conteúdo não pertence a este projeto");
  }
  const { data, error } = await supabase
    .from("content_items")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", input.contentId)
    .select("*")
    .single();
  if (error) {
    if (isMissingArchivedAtColumn(error.message)) {
      throw new Error(
        "Arquivar ainda não está disponível neste projeto (coluna archived_at). Peça para aplicar a migration no Supabase.",
      );
    }
    throw new Error(error.message);
  }
  return ensureData(data, error);
}

export async function restoreContent(input: {
  contentId: string;
  projectId: string;
}): Promise<ContentItem> {
  const current = await getContent(input.contentId);
  if (!current) throw new Error("Conteúdo não encontrado");
  if (current.project_id !== input.projectId) {
    throw new Error("Conteúdo não pertence a este projeto");
  }
  const { data, error } = await supabase
    .from("content_items")
    .update({ archived_at: null })
    .eq("id", input.contentId)
    .select("*")
    .single();
  if (error) {
    if (isMissingArchivedAtColumn(error.message)) {
      throw new Error(
        "Restaurar ainda não está disponível neste projeto (coluna archived_at). Peça para aplicar a migration no Supabase.",
      );
    }
    throw new Error(error.message);
  }
  return ensureData(data, error);
}

export async function saveContentAsNewVersion(input: {
  contentId: string;
  clientId: string;
  projectId: string;
  title: string;
  caption: string;
  cta: string;
  hashtags: string;
  locucao?: string;
  roteiro?: string;
  mediaUrl?: string | null;
  mediaUrls?: string[];
  thumbnailUrl?: string | null;
  format?: ContentFormat;
  theme?: string | null;
  materialType?: string | null;
  widthCm?: number | null;
  heightCm?: number | null;
  productionNotes?: string;
  changeNote?: string;
  i18n?: RowI18n;
  mediaOverlays?: Json;
}): Promise<ContentItem> {
  const current = await getContent(input.contentId);
  if (!current) throw new Error("Conteúdo não encontrado");

  const nextStatus =
    current.status === "approved" ||
    current.status === "published" ||
    current.status === "review" ||
    current.status === "changes_done"
      ? "draft"
      : current.status;

  const mediaUrls =
    input.mediaUrls?.filter((url) => url.trim()) ??
    (input.mediaUrl?.trim() ? [input.mediaUrl.trim()] : []);
  const mediaUrl = mediaUrls[0] ?? null;
  const thumbnailUrl =
    input.thumbnailUrl !== undefined
      ? input.thumbnailUrl?.trim() || null
      : current.thumbnail_url;
  const format = input.format ?? current.format ?? "static_feed";
  const locucao = input.locucao ?? current.locucao ?? "";
  const roteiro = input.roteiro ?? current.roteiro ?? "";
  const theme =
    input.theme !== undefined ? input.theme?.trim() || null : current.theme;
  const materialType =
    input.materialType !== undefined
      ? input.materialType?.trim() || null
      : current.material_type;
  const widthCm = input.widthCm !== undefined ? input.widthCm : current.width_cm;
  const heightCm = input.heightCm !== undefined ? input.heightCm : current.height_cm;
  const productionNotes =
    input.productionNotes !== undefined
      ? input.productionNotes
      : (current.production_notes ?? "");
  const nextI18n = input.i18n ?? parseRowI18n(current.i18n);

  const patch: Record<string, unknown> = {
    title: input.title.trim(),
    caption: input.caption,
    cta: input.cta,
    hashtags: input.hashtags,
    locucao,
    roteiro,
    media_url: mediaUrl,
    media_urls: mediaUrls,
    thumbnail_url: thumbnailUrl,
    format,
    theme,
    material_type: materialType,
    width_cm: widthCm,
    height_cm: heightCm,
    production_notes: productionNotes,
    status: nextStatus,
    i18n: toI18nJson(nextI18n),
  };
  if (input.mediaOverlays !== undefined) {
    patch.media_overlays = input.mediaOverlays;
  }

  const { data, error } = await supabase.rpc("save_gestor_content_version", {
    _content_id: input.contentId,
    _patch: patch as Json,
    _change_note: input.changeNote?.trim() || null,
  });
  if (error) {
    if (/schema cache|could not find the function|PGRST202|does not exist/i.test(error.message)) {
      throw new Error(
        "Aplique a migration de versionamento atômico no SQL Editor do Supabase (save_gestor_content_version) e recarregue.",
      );
    }
    throw new Error(error.message);
  }
  return data as ContentItem;
}

export async function updateContentFields(input: {
  contentId: string;
  title: string;
  caption: string;
  cta: string;
  hashtags: string;
  locucao?: string;
  roteiro?: string;
  mediaUrl?: string | null;
  mediaUrls?: string[];
  thumbnailUrl?: string | null;
  format?: ContentFormat;
  theme?: string | null;
  funnelStage?: FunnelStage | null;
  materialType?: string | null;
  widthCm?: number | null;
  heightCm?: number | null;
  productionNotes?: string;
  performanceReach?: string;
  performanceRetention?: string;
  performanceNote?: string;
  repeatFormat?: boolean;
  i18n?: RowI18n;
  mediaOverlays?: Json;
}): Promise<ContentItem> {
  const mediaUrls =
    input.mediaUrls?.filter((url) => url.trim()) ??
    (input.mediaUrl?.trim() ? [input.mediaUrl.trim()] : []);
  const mediaUrl = mediaUrls[0] ?? null;

  const fieldsPatch = {
      title: input.title.trim(),
      caption: input.caption,
      cta: input.cta,
      hashtags: input.hashtags,
      ...(input.locucao !== undefined ? { locucao: input.locucao } : {}),
      ...(input.roteiro !== undefined ? { roteiro: input.roteiro } : {}),
      media_url: mediaUrl,
      media_urls: mediaUrls,
      ...(input.thumbnailUrl !== undefined
        ? { thumbnail_url: input.thumbnailUrl?.trim() || null }
        : {}),
      ...(input.format ? { format: input.format } : {}),
      ...(input.theme !== undefined ? { theme: input.theme?.trim() || null } : {}),
      ...(input.funnelStage !== undefined ? { funnel_stage: parseFunnelStage(input.funnelStage) } : {}),
      ...(input.materialType !== undefined
        ? { material_type: input.materialType?.trim() || null }
        : {}),
      ...(input.widthCm !== undefined ? { width_cm: input.widthCm } : {}),
      ...(input.heightCm !== undefined ? { height_cm: input.heightCm } : {}),
      ...(input.productionNotes !== undefined
        ? { production_notes: input.productionNotes }
        : {}),
      ...(input.performanceReach !== undefined
        ? { performance_reach: input.performanceReach }
        : {}),
      ...(input.performanceRetention !== undefined
        ? { performance_retention: input.performanceRetention }
        : {}),
      ...(input.performanceNote !== undefined ? { performance_note: input.performanceNote } : {}),
      ...(input.repeatFormat !== undefined ? { repeat_format: input.repeatFormat } : {}),
      ...(input.i18n ? { i18n: toI18nJson(input.i18n) } : {}),
  };

  let { data, error } = await supabase
    .from("content_items")
    .update({
      ...fieldsPatch,
      ...(input.mediaOverlays !== undefined ? { media_overlays: input.mediaOverlays } : {}),
    })
    .eq("id", input.contentId)
    .select("*")
    .single();
  if (error && input.mediaOverlays !== undefined && isMissingMediaOverlaysColumn(error.message)) {
    const retry = await supabase
      .from("content_items")
      .update(fieldsPatch)
      .eq("id", input.contentId)
      .select("*")
      .single();
    data = retry.data;
    error = retry.error;
  }
  if (error && isMissingFunnelStageColumn(error.message)) {
    const { funnel_stage: _omitFunnel, ...withoutFunnel } = fieldsPatch as typeof fieldsPatch & {
      funnel_stage?: string | null;
    };
    const retry = await supabase
      .from("content_items")
      .update(withoutFunnel)
      .eq("id", input.contentId)
      .select("*")
      .single();
    data = retry.data;
    error = retry.error;
  }
  if (error && isMissingPerformanceColumns(error.message)) {
    const {
      performance_reach: _r,
      performance_retention: _t,
      performance_note: _n,
      repeat_format: _f,
      ...withoutPerf
    } = fieldsPatch as typeof fieldsPatch & {
      performance_reach?: string;
      performance_retention?: string;
      performance_note?: string;
      repeat_format?: boolean;
    };
    const retry = await supabase
      .from("content_items")
      .update(withoutPerf)
      .eq("id", input.contentId)
      .select("*")
      .single();
    data = retry.data;
    error = retry.error;
  }
  return ensureData(data, error);
}

export async function updateContentCalendar(input: {
  contentId: string;
  scheduledAt?: string | null;
  theme?: string | null;
  format?: ContentFormat;
  title?: string;
  i18n?: RowI18n;
}): Promise<ContentItem> {
  const patch: {
    scheduled_at?: string | null;
    theme?: string | null;
    format?: ContentFormat;
    title?: string;
    i18n?: Json;
  } = {};
  if (input.scheduledAt !== undefined) {
    patch.scheduled_at = input.scheduledAt;
  }
  if (input.theme !== undefined) {
    patch.theme = input.theme?.trim() || null;
  }
  if (input.format !== undefined) {
    patch.format = input.format;
  }
  if (input.title !== undefined) {
    const nextTitle = input.title.trim();
    if (!nextTitle) throw new Error("Título inválido");
    patch.title = nextTitle;
  }
  if (input.i18n) {
    patch.i18n = toI18nJson(input.i18n);
  }

  const { data, error } = await supabase
    .from("content_items")
    .update(patch)
    .eq("id", input.contentId)
    .select("*")
    .single();
  return ensureData(data, error);
}

export async function addProjectThemePreset(projectId: string, theme: string): Promise<Project> {
  const project = await getProject(projectId);
  if (!project) throw new Error("Projeto não encontrado");
  const next = theme.trim();
  if (!next) throw new Error("Tema inválido");
  const existing = project.theme_presets ?? [];
  if (existing.some((item) => item.toLowerCase() === next.toLowerCase())) {
    return project;
  }
  return updateProject(projectId, {
    name: project.name,
    description: project.description ?? undefined,
    status: project.status,
    themePresets: [...existing, next],
  });
}

export async function addProjectTextPreset(
  projectId: string,
  field: "cta" | "hashtags",
  value: string,
): Promise<Project> {
  const project = await getProject(projectId);
  if (!project) throw new Error("Projeto não encontrado");
  const next = value.trim();
  if (!next) throw new Error("Valor inválido");

  const column = field === "cta" ? "cta_presets" : "hashtag_presets";
  const existing = project[column] ?? [];
  if (existing.some((item) => item.toLowerCase() === next.toLowerCase())) {
    return project;
  }

  const nextItems = [...existing, next];
  const { i18n } = await ensurePresetListTranslated(parseRowI18n(project.i18n), column, nextItems);

  return updateProject(projectId, {
    name: project.name,
    description: project.description ?? undefined,
    status: project.status,
    ...(field === "cta" ? { ctaPresets: nextItems } : { hashtagPresets: nextItems }),
    i18n,
  });
}

function isMissingCalendarBlocksTable(message: string) {
  return /calendar_blocks/i.test(message) && /relation|table|schema cache|does not exist/i.test(message);
}

function isMissingCalendarBlockIdColumn(message: string) {
  return /calendar_block_id/i.test(message) && /column|schema cache|does not exist/i.test(message);
}

export function suggestCalendarBlockTitle(
  items: Array<{ scheduled_at: string | null }>,
  locale: string = "pt-BR",
): string {
  const dates = items
    .map((item) => (item.scheduled_at ? new Date(item.scheduled_at) : null))
    .filter((d): d is Date => d != null && !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (dates.length === 0) {
    if (locale.startsWith("en")) return "New period";
    if (locale.startsWith("es")) return "Nuevo período";
    return "Novo período";
  }

  const start = dates[0];
  const end = dates[dates.length - 1];
  const monthName = new Intl.DateTimeFormat(locale, { month: "long" }).format(start);
  const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const pad = (n: number) => String(n).padStart(2, "0");
  const startLabel = `${pad(start.getDate())}/${pad(start.getMonth() + 1)}`;
  const endLabel = `${pad(end.getDate())}/${pad(end.getMonth() + 1)}`;

  if (locale.startsWith("en")) return `${capitalized} — from ${startLabel} to ${endLabel}`;
  if (locale.startsWith("es")) return `${capitalized} — del ${startLabel} al ${endLabel}`;
  return `${capitalized} - de ${startLabel} a ${endLabel}`;
}

function calendarPeriodAdvanceDays(items: Array<{ scheduled_at: string | null }>): number {
  const times = items
    .map((item) => (item.scheduled_at ? new Date(item.scheduled_at).getTime() : NaN))
    .filter((t) => !Number.isNaN(t));
  if (times.length < 2) return 28;
  const spanDays = Math.round((Math.max(...times) - Math.min(...times)) / (1000 * 60 * 60 * 24));
  return Math.max(28, spanDays + 1);
}

export async function listCalendarBlocks(projectId: string): Promise<CalendarBlock[]> {
  const { data, error } = await supabase
    .from("calendar_blocks")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (!error) return data ?? [];
  if (isMissingCalendarBlocksTable(error.message)) return [];
  throw new Error(error.message);
}

export async function ensureCalendarBlocks(projectId: string): Promise<CalendarBlock[]> {
  const existing = await listCalendarBlocks(projectId);
  if (existing.length > 0) {
    const unassigned = await supabase
      .from("content_items")
      .select("id")
      .eq("project_id", projectId)
      .is("calendar_block_id", null)
      .is("archived_at", null);
    let unassignedRows = unassigned.data;
    let unassignedError = unassigned.error;
    if (unassignedError && isMissingArchivedAtColumn(unassignedError.message)) {
      const fallback = await supabase
        .from("content_items")
        .select("id")
        .eq("project_id", projectId)
        .is("calendar_block_id", null);
      unassignedRows = fallback.data;
      unassignedError = fallback.error;
    }
    if (!unassignedError && (unassignedRows?.length ?? 0) > 0) {
      const targetId = existing[existing.length - 1]?.id;
      if (targetId) {
        const link = await supabase
          .from("content_items")
          .update({ calendar_block_id: targetId })
          .eq("project_id", projectId)
          .is("calendar_block_id", null)
          .is("archived_at", null);
        if (link.error && isMissingArchivedAtColumn(link.error.message)) {
          await supabase
            .from("content_items")
            .update({ calendar_block_id: targetId })
            .eq("project_id", projectId)
            .is("calendar_block_id", null);
        }
      }
    }

    const content = await listContent(projectId);
    const untitled = existing.filter((block) => !block.title.trim());
    if (untitled.length > 0) {
      await Promise.all(
        untitled.map((block) => {
          const items = content.filter(
            (item) => item.calendar_block_id === block.id && !isContentArchived(item),
          );
          const title = suggestCalendarBlockTitle(items);
          return supabase.from("calendar_blocks").update({ title }).eq("id", block.id);
        }),
      );
      return listCalendarBlocks(projectId);
    }

    return existing;
  }

  const content = (await listContent(projectId)).filter((item) => !isContentArchived(item));
  if (content.length === 0) return [];

  const title = suggestCalendarBlockTitle(content);
  const { data, error } = await supabase
    .from("calendar_blocks")
    .insert({ project_id: projectId, title, sort_order: 0 })
    .select("*")
    .single();
  if (error) {
    if (isMissingCalendarBlocksTable(error.message)) return [];
    throw new Error(error.message);
  }
  const block = ensureData(data, error);

  const linkActive = await supabase
    .from("content_items")
    .update({ calendar_block_id: block.id })
    .eq("project_id", projectId)
    .is("calendar_block_id", null)
    .is("archived_at", null);
  if (linkActive.error) {
    if (isMissingArchivedAtColumn(linkActive.error.message)) {
      const fallback = await supabase
        .from("content_items")
        .update({ calendar_block_id: block.id })
        .eq("project_id", projectId)
        .is("calendar_block_id", null);
      if (fallback.error && !isMissingCalendarBlockIdColumn(fallback.error.message)) {
        throw new Error(fallback.error.message);
      }
    } else if (!isMissingCalendarBlockIdColumn(linkActive.error.message)) {
      throw new Error(linkActive.error.message);
    }
  }

  return [block];
}

export async function updateCalendarBlockTitle(
  blockId: string,
  title: string,
  i18n?: RowI18n,
): Promise<CalendarBlock> {
  const next = title.trim();
  if (!next) throw new Error("Título inválido");
  const { data, error } = await supabase
    .from("calendar_blocks")
    .update({ title: next, ...(i18n ? { i18n: toI18nJson(i18n) } : {}) })
    .eq("id", blockId)
    .select("*")
    .single();
  return ensureData(data, error);
}

export async function updateCalendarBlockMix(
  blockId: string,
  mix: ContentMix,
): Promise<CalendarBlock> {
  const next = parseContentMix(mix);
  const { data, error } = await supabase
    .from("calendar_blocks")
    .update({ content_mix: next })
    .eq("id", blockId)
    .select("*")
    .single();
  if (error && isMissingContentMixColumn(error.message)) {
    const fallback = await supabase.from("calendar_blocks").select("*").eq("id", blockId).maybeSingle();
    return ensureData(fallback.data, fallback.error);
  }
  return ensureData(data, error);
}

export function calendarBlockMix(block: CalendarBlock | null | undefined): ContentMix {
  return parseContentMix((block as CalendarBlock & { content_mix?: unknown } | null)?.content_mix);
}

export async function duplicateCalendarBlock(input: {
  blockId: string;
  clientId: string;
  projectId: string;
  locale?: string;
}): Promise<{ block: CalendarBlock; items: ContentItem[] }> {
  const blocks = await listCalendarBlocks(input.projectId);
  const source = blocks.find((block) => block.id === input.blockId);
  if (!source) throw new Error("Bloco de calendário não encontrado");

  const allContent = await listContent(input.projectId);
  const sourceItems = allContent
    .filter((item) => item.calendar_block_id === source.id && !isContentArchived(item))
    .sort(sortContentByManualOrder);

  const advanceDays = calendarPeriodAdvanceDays(sourceItems);

  // Novo bloco abaixo dos existentes.
  const nextSortOrder =
    blocks.reduce((max, block) => Math.max(max, block.sort_order ?? 0), -1) + 1;

  const placeholderTitle = source.title.trim() || suggestCalendarBlockTitle(sourceItems, input.locale);
  const { data: blockData, error: blockError } = await supabase
    .from("calendar_blocks")
    .insert({
      project_id: input.projectId,
      title: placeholderTitle,
      sort_order: nextSortOrder,
      content_mix: calendarBlockMix(source),
    })
    .select("*")
    .single();
  let resolvedBlock = blockData;
  let resolvedBlockError = blockError;
  if (blockError && isMissingContentMixColumn(blockError.message)) {
    const retry = await supabase
      .from("calendar_blocks")
      .insert({
        project_id: input.projectId,
        title: placeholderTitle,
        sort_order: nextSortOrder,
      })
      .select("*")
      .single();
    resolvedBlock = retry.data;
    resolvedBlockError = retry.error;
  }
  const newBlock = ensureData(resolvedBlock, resolvedBlockError);

  const maxSort = allContent.reduce((max, item) => Math.max(max, item.sort_order ?? 0), -1);
  const created: ContentItem[] = [];
  for (let i = 0; i < sourceItems.length; i += 1) {
    const item = sourceItems[i];
    const cloned = await duplicateContent({
      contentId: item.id,
      clientId: input.clientId,
      projectId: input.projectId,
      advanceDays,
      calendarBlockId: newBlock.id,
      sortOrder: maxSort + 1 + i,
      silent: true,
    });
    created.push(cloned);
  }

  const suggestedTitle = suggestCalendarBlockTitle(created, input.locale);
  const { data: titled, error: titleError } = await supabase
    .from("calendar_blocks")
    .update({ title: suggestedTitle })
    .eq("id", newBlock.id)
    .select("*")
    .single();
  const finalBlock = ensureData(titled, titleError);

  logActivity({
    type: "content_created",
    summary: `Calendário duplicado: ${finalBlock.title}`,
    clientId: input.clientId,
    projectId: input.projectId,
  });

  return { block: finalBlock, items: created };
}

export async function deleteCalendarBlock(input: {
  blockId: string;
  projectId: string;
}): Promise<void> {
  const blocks = await listCalendarBlocks(input.projectId);
  const target = blocks.find((block) => block.id === input.blockId);
  if (!target) throw new Error("Bloco de calendário não encontrado");

  // Keep archived content: unlink from the block instead of hard-deleting it.
  const { error: unlinkArchivedError } = await supabase
    .from("content_items")
    .update({ calendar_block_id: null })
    .eq("project_id", input.projectId)
    .eq("calendar_block_id", input.blockId)
    .not("archived_at", "is", null);
  if (unlinkArchivedError && !isMissingArchivedAtColumn(unlinkArchivedError.message)) {
    throw new Error(unlinkArchivedError.message);
  }

  const activeDelete = unlinkArchivedError && isMissingArchivedAtColumn(unlinkArchivedError.message)
    ? await supabase
        .from("content_items")
        .delete()
        .eq("project_id", input.projectId)
        .eq("calendar_block_id", input.blockId)
    : await supabase
        .from("content_items")
        .delete()
        .eq("project_id", input.projectId)
        .eq("calendar_block_id", input.blockId)
        .is("archived_at", null);

  if (activeDelete.error) {
    if (isMissingArchivedAtColumn(activeDelete.error.message)) {
      const fallback = await supabase
        .from("content_items")
        .delete()
        .eq("project_id", input.projectId)
        .eq("calendar_block_id", input.blockId);
      if (fallback.error) throw new Error(fallback.error.message);
    } else {
      throw new Error(activeDelete.error.message);
    }
  }

  const { error: blockError } = await supabase
    .from("calendar_blocks")
    .delete()
    .eq("id", input.blockId)
    .eq("project_id", input.projectId);
  if (blockError) throw new Error(blockError.message);
}

// —— Meeting agendas ——

export type MeetingAgendaTopic = {
  title: string;
  description?: string | null;
  /** Marked for follow-up / "providenciar" — highlighted in the agenda list. */
  needsAction?: boolean;
};

export function parseMeetingAgendaTopics(value: Json | null | undefined): MeetingAgendaTopic[] {
  if (!value || !Array.isArray(value)) return [];
  const topics: MeetingAgendaTopic[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const title = typeof item.title === "string" ? item.title : "";
    const description =
      item.description == null
        ? null
        : typeof item.description === "string"
          ? item.description
          : null;
    const needsAction = item.needsAction === true || item.needs_action === true;
    topics.push({ title, description, needsAction });
  }
  return topics;
}

function meetingAgendaTopicsToJson(topics: MeetingAgendaTopic[]): Json {
  return topics.map((topic) => ({
    title: topic.title.trim(),
    description: topic.description?.trim() || null,
    needsAction: topic.needsAction === true,
  })) as Json;
}

function isMissingMeetingAgendasTable(message: string) {
  return /meeting_agendas/i.test(message) && /(does not exist|not find)/i.test(message);
}

export async function listMeetingAgendas(projectId: string): Promise<MeetingAgenda[]> {
  const { data, error } = await supabase
    .from("meeting_agendas")
    .select("*")
    .eq("project_id", projectId)
    .order("scheduled_at", { ascending: false, nullsFirst: false });
  if (!error) return data ?? [];
  if (isMissingMeetingAgendasTable(error.message)) return [];
  throw new Error(error.message);
}

export async function getMeetingAgenda(agendaId: string): Promise<MeetingAgenda> {
  const { data, error } = await supabase
    .from("meeting_agendas")
    .select("*")
    .eq("id", agendaId)
    .single();
  return ensureData(data, error);
}

export async function createMeetingAgenda(input: {
  projectId: string;
  clientId: string;
  scheduledAt?: string | null;
  topics?: MeetingAgendaTopic[];
}): Promise<MeetingAgenda> {
  const topics = input.topics ?? [];
  const { data, error } = await supabase
    .from("meeting_agendas")
    .insert({
      project_id: input.projectId,
      scheduled_at: input.scheduledAt ?? null,
      topics: meetingAgendaTopicsToJson(topics),
    })
    .select("*")
    .single();
  const agenda = ensureData(data, error);

  logActivity({
    type: "meeting_agenda_created",
    summary: "Pauta de reunião criada",
    clientId: input.clientId,
    projectId: input.projectId,
  });

  return agenda;
}

function isMissingMeetingAgendaNotesColumn(message: string) {
  return (
    /meeting_agendas/i.test(message) &&
    /\bnotes\b/i.test(message) &&
    /(does not exist|schema cache|could not find)/i.test(message)
  );
}

export async function updateMeetingAgenda(input: {
  agendaId: string;
  clientId: string;
  projectId: string;
  scheduledAt?: string | null;
  topics?: MeetingAgendaTopic[];
  notes?: string | null;
}): Promise<MeetingAgenda> {
  const patch: {
    scheduled_at?: string | null;
    topics?: Json;
    notes?: string | null;
  } = {};
  if (input.scheduledAt !== undefined) {
    patch.scheduled_at = input.scheduledAt;
  }
  if (input.topics !== undefined) {
    patch.topics = meetingAgendaTopicsToJson(input.topics);
  }
  if (input.notes !== undefined) {
    patch.notes = input.notes?.trim() || null;
  }

  let { data, error } = await supabase
    .from("meeting_agendas")
    .update(patch)
    .eq("id", input.agendaId)
    .eq("project_id", input.projectId)
    .select("*")
    .single();

  // notes column ships in a later migration — retry without it until applied.
  if (error && patch.notes !== undefined && isMissingMeetingAgendaNotesColumn(error.message)) {
    const { notes: _ignored, ...patchWithoutNotes } = patch;
    ({ data, error } = await supabase
      .from("meeting_agendas")
      .update(patchWithoutNotes)
      .eq("id", input.agendaId)
      .eq("project_id", input.projectId)
      .select("*")
      .single());
  }

  const agenda = ensureData(data, error);

  logActivity({
    type: "meeting_agenda_updated",
    summary: "Pauta de reunião atualizada",
    clientId: input.clientId,
    projectId: input.projectId,
  });

  return agenda;
}

export async function deleteMeetingAgenda(input: {
  agendaId: string;
  clientId: string;
  projectId: string;
}): Promise<void> {
  const { error } = await supabase
    .from("meeting_agendas")
    .delete()
    .eq("id", input.agendaId)
    .eq("project_id", input.projectId);
  if (error) throw new Error(error.message);

  logActivity({
    type: "meeting_agenda_deleted",
    summary: "Pauta de reunião removida",
    clientId: input.clientId,
    projectId: input.projectId,
  });
}

function isMissingThemeReferencesTable(message: string) {
  return /theme_references/i.test(message) && /(does not exist|not find)/i.test(message);
}

function normalizeLinkList(links: string[] | null | undefined): string[] {
  return (links ?? []).map((link) => link.trim()).filter(Boolean);
}

async function nextThemeReferenceSortOrder(projectId: string): Promise<number> {
  const { data, error } = await supabase
    .from("theme_references")
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isMissingThemeReferencesTable(error.message)) return 0;
    throw new Error(error.message);
  }
  return (data?.sort_order ?? 0) - 1;
}

export async function listThemeReferences(projectId: string): Promise<ThemeReference[]> {
  const { data, error } = await supabase
    .from("theme_references")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (!error) return data ?? [];
  if (isMissingThemeReferencesTable(error.message)) return [];
  throw new Error(error.message);
}

export async function createThemeReference(input: {
  projectId: string;
  theme?: string;
  recommendations?: string;
  links?: string[];
}): Promise<ThemeReference> {
  const sortOrder = await nextThemeReferenceSortOrder(input.projectId);
  const { data, error } = await supabase
    .from("theme_references")
    .insert({
      project_id: input.projectId,
      theme: input.theme?.trim() ?? "",
      recommendations: input.recommendations ?? "",
      links: normalizeLinkList(input.links),
      sort_order: sortOrder,
    })
    .select("*")
    .single();
  return ensureData(data, error);
}

export async function updateThemeReference(input: {
  id: string;
  projectId: string;
  theme?: string;
  recommendations?: string;
  links?: string[];
}): Promise<ThemeReference> {
  const patch: {
    theme?: string;
    recommendations?: string;
    links?: string[];
  } = {};
  if (input.theme !== undefined) patch.theme = input.theme.trim();
  if (input.recommendations !== undefined) patch.recommendations = input.recommendations;
  if (input.links !== undefined) patch.links = normalizeLinkList(input.links);

  const { data, error } = await supabase
    .from("theme_references")
    .update(patch)
    .eq("id", input.id)
    .eq("project_id", input.projectId)
    .select("*")
    .single();
  return ensureData(data, error);
}

export async function duplicateThemeReference(input: {
  id: string;
  projectId: string;
}): Promise<ThemeReference> {
  const { data: source, error: loadError } = await supabase
    .from("theme_references")
    .select("*")
    .eq("id", input.id)
    .eq("project_id", input.projectId)
    .single();
  const row = ensureData(source, loadError);
  return createThemeReference({
    projectId: input.projectId,
    theme: row.theme,
    recommendations: row.recommendations,
    links: row.links ?? [],
  });
}

export async function deleteThemeReference(input: {
  id: string;
  projectId: string;
}): Promise<void> {
  const { error } = await supabase
    .from("theme_references")
    .delete()
    .eq("id", input.id)
    .eq("project_id", input.projectId);
  if (error) throw new Error(error.message);
}

const MAX_REFERENCE_CREATORS = 5;

async function nextReferenceCreatorSortOrder(clientId: string): Promise<number> {
  const { data, error } = await supabase
    .from("brand_reference_creators")
    .select("sort_order")
    .eq("client_id", clientId)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isMissingBrandReferenceCreatorsTable(error.message)) return 0;
    throw new Error(error.message);
  }
  return (data?.sort_order ?? 0) - 1;
}

export async function listBrandReferenceCreators(clientId: string): Promise<BrandReferenceCreator[]> {
  const { data, error } = await supabase
    .from("brand_reference_creators")
    .select("*")
    .eq("client_id", clientId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (!error) return data ?? [];
  if (isMissingBrandReferenceCreatorsTable(error.message)) return [];
  throw new Error(error.message);
}

export async function createBrandReferenceCreator(input: {
  clientId: string;
  name?: string;
  url?: string;
  notes?: string;
}): Promise<BrandReferenceCreator> {
  const existing = await listBrandReferenceCreators(input.clientId);
  if (existing.length >= MAX_REFERENCE_CREATORS) {
    throw new Error(`Limite de ${MAX_REFERENCE_CREATORS} criadores de referência por marca.`);
  }
  const sortOrder = await nextReferenceCreatorSortOrder(input.clientId);
  const { data, error } = await supabase
    .from("brand_reference_creators")
    .insert({
      client_id: input.clientId,
      name: input.name?.trim() ?? "",
      url: input.url?.trim() ?? "",
      notes: input.notes?.trim() ?? "",
      sort_order: sortOrder,
    })
    .select("*")
    .single();
  return ensureData(data, error);
}

export async function updateBrandReferenceCreator(input: {
  id: string;
  clientId: string;
  name?: string;
  url?: string;
  notes?: string;
  patternSummary?: string;
}): Promise<BrandReferenceCreator> {
  const patch: {
    name?: string;
    url?: string;
    notes?: string;
    pattern_summary?: string;
  } = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.url !== undefined) patch.url = input.url.trim();
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.patternSummary !== undefined) patch.pattern_summary = input.patternSummary;
  const { data, error } = await supabase
    .from("brand_reference_creators")
    .update(patch)
    .eq("id", input.id)
    .eq("client_id", input.clientId)
    .select("*")
    .single();
  return ensureData(data, error);
}

export async function deleteBrandReferenceCreator(input: {
  id: string;
  clientId: string;
}): Promise<void> {
  const { error } = await supabase
    .from("brand_reference_creators")
    .delete()
    .eq("id", input.id)
    .eq("client_id", input.clientId);
  if (error) throw new Error(error.message);
}

export type RepeatFormatPost = {
  id: string;
  project_id: string;
  project_name: string;
  project_i18n: RowI18n;
  title: string;
  format: ContentFormat;
  theme: string | null;
  performance_reach: string;
  performance_retention: string;
  performance_note: string;
  updated_at: string;
  i18n: RowI18n;
};

/** Posts marked "repeat this format" across all projects of a client (brand learning). */
export async function listClientRepeatFormatPosts(clientId: string): Promise<RepeatFormatPost[]> {
  const projects = await listProjects(clientId);
  if (projects.length === 0) return [];

  const projectById = new Map(
    projects.map((project) => [project.id, project] as const),
  );
  const projectIds = projects.map((project) => project.id);

  const { data, error } = await supabase
    .from("content_items")
    .select(
      "id, project_id, title, format, theme, performance_reach, performance_retention, performance_note, updated_at, i18n",
    )
    .in("project_id", projectIds)
    .eq("repeat_format", true)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    if (isMissingPerformanceColumns(error.message)) return [];
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => {
      const project = projectById.get(row.project_id as string);
      if (!project) return null;
      return {
        id: row.id as string,
        project_id: row.project_id as string,
        project_name: project.name,
        project_i18n: parseRowI18n(project.i18n),
        title: (row.title as string) ?? "",
        format: (row.format as ContentFormat) ?? "static_feed",
        theme: (row.theme as string | null) ?? null,
        performance_reach: (row.performance_reach as string) ?? "",
        performance_retention: (row.performance_retention as string) ?? "",
        performance_note: (row.performance_note as string) ?? "",
        updated_at: (row.updated_at as string) ?? "",
        i18n: parseRowI18n(row.i18n),
      } satisfies RepeatFormatPost;
    })
    .filter((row): row is RepeatFormatPost => Boolean(row));
}

/** Lightweight patch for the brand-learning "repeat format" pool. */
export async function updateContentRepeatLearning(input: {
  contentId: string;
  repeatFormat?: boolean;
  performanceNote?: string;
}): Promise<void> {
  const patch: {
    repeat_format?: boolean;
    performance_note?: string;
  } = {};
  if (input.repeatFormat !== undefined) patch.repeat_format = input.repeatFormat;
  if (input.performanceNote !== undefined) patch.performance_note = input.performanceNote;
  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase
    .from("content_items")
    .update(patch)
    .eq("id", input.contentId);
  if (error) {
    if (isMissingPerformanceColumns(error.message)) {
      throw new Error(
        "Aplique a migration de aprendizado de conteúdo no SQL Editor do Supabase (colunas performance_* / repeat_format).",
      );
    }
    throw new Error(error.message);
  }
}

function sortContentByManualOrder(a: ContentItem, b: ContentItem) {
  const aOrder = a.sort_order ?? 0;
  const bOrder = b.sort_order ?? 0;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return a.title.localeCompare(b.title);
}

export async function setContentStatus(input: {
  contentId: string;
  clientId: string;
  projectId: string;
  status: ContentStatus;
  title: string;
}): Promise<ContentItem> {
  const activityMap: Partial<Record<ContentStatus, ActivityType>> = {
    review: "submitted_for_review",
    changes_done: "submitted_for_review",
    approved: "approved",
    changes: "changes_requested",
    published: "published",
  };

  const summaryMap: Partial<Record<ContentStatus, string>> = {
    review: `Enviado para revisão: ${input.title}`,
    changes_done: `Ajustes concluídos: ${input.title}`,
    approved: `Aprovado: ${input.title}`,
    changes: `Mudanças solicitadas: ${input.title}`,
    published: `Publicado: ${input.title}`,
  };

  const { data, error } = await supabase
    .from("content_items")
    .update({ status: input.status })
    .eq("id", input.contentId)
    .select("*")
    .single();
  if (
    error &&
    input.status === "changes_done" &&
    /invalid input value for enum content_status/i.test(error.message)
  ) {
    throw new Error(
      'O status "Ajustes concluídos" ainda não está ativo no banco. Aplique a migration ensure_content_status_changes_done (ou rode no SQL Editor: alter type public.content_status add value if not exists \'changes_done\';).',
    );
  }
  const row = ensureData(data, error);

  const type = activityMap[input.status];
  if (type) {
    logActivity({
      type,
      summary: summaryMap[input.status] ?? input.title,
      clientId: input.clientId,
      projectId: input.projectId,
      contentId: input.contentId,
    });
  }

  return row;
}

export type PendingApproval = ContentItem & {
  projects: Pick<Project, "id" | "name" | "client_id" | "i18n"> & {
    clients: Pick<Client, "id" | "name" | "i18n">;
  };
};

export async function listPendingApprovals(): Promise<PendingApproval[]> {
  const { data, error } = await supabase
    .from("content_items")
    .select("*, projects!inner(id, name, i18n, client_id, clients!inner(id, name, i18n))")
    .in("status", ["review", "changes_done"])
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as PendingApproval[];
}

// —— Versions ——

export async function listVersions(contentId: string) {
  const { data, error } = await supabase
    .from("content_versions")
    .select("*")
    .eq("content_id", contentId)
    .order("version_number", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function restoreVersion(input: {
  contentId: string;
  clientId: string;
  projectId: string;
  version: ContentVersion;
}) {
  const current = await getContent(input.contentId);
  return saveContentAsNewVersion({
    contentId: input.contentId,
    clientId: input.clientId,
    projectId: input.projectId,
    title: current?.title ?? "Conteúdo",
    caption: input.version.caption,
    cta: input.version.cta,
    hashtags: input.version.hashtags,
    locucao: input.version.locucao ?? "",
    roteiro: input.version.roteiro ?? "",
    mediaUrl: input.version.media_url,
    mediaUrls: resolveContentMediaUrls(input.version),
    thumbnailUrl: input.version.thumbnail_url,
    format: input.version.format,
    materialType: input.version.material_type,
    widthCm: input.version.width_cm,
    heightCm: input.version.height_cm,
    productionNotes: input.version.production_notes ?? "",
    changeNote: `Restaurado da v${input.version.version_number}`,
  });
}

// —— AI content assistant (admin) ——

export type WebSource = {
  title: string;
  url: string;
  snippet: string;
};

export type ContentSuggestion = {
  title: string;
  caption: string;
  cta: string;
  hashtags: string;
  theme: string | null;
  locucao: string;
  locucaoHook: string;
  locucaoBody: string;
  locucaoCta: string;
  roteiro: string;
  webSources?: WebSource[];
  webSearchUnavailable?: boolean;
};

export type ContentIdea = {
  title: string;
  format: ContentFormat;
  funnelStage: FunnelStage;
  hook: string;
  why: string;
  theme: string | null;
};

async function readFunctionsInvokeError(
  error: { message?: string; context?: Response } | null,
  data: unknown,
): Promise<string> {
  const fromData =
    data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
      ? (data as { error: string }).error
      : null;
  if (fromData) return fromData;

  const response = error?.context;
  if (response && typeof response.json === "function") {
    try {
      const body = (await response.clone().json()) as { error?: string; message?: string; code?: string };
      if (body?.error) return body.error;
      if (body?.message) return body.message;
    } catch {
      // ignore parse failures and fall through
    }
  }

  const raw = error?.message || "";
  if (/Failed to send|FunctionsFetchError|NOT_FOUND|not found/i.test(raw)) {
    return "A função de IA não está publicada neste projeto. No Lovable, publique de novo (ou no Supabase → Edge Functions, faça o deploy) e tente outra vez.";
  }

  return raw || "Falha ao gerar sugestão";
}

export type DesignProvider = "openai" | "gemini";
/** Providers for text assistants (copy, ideas). Claude cannot generate design images. */
export type AiChatProvider = "openai" | "gemini" | "claude";

export function normalizeAiChatProvider(value: unknown): AiChatProvider {
  if (value === "gemini" || value === "claude") return value;
  return "openai";
}

/** Max library items the content assistant can send in one generation. */
export const ASSISTANT_REFERENCE_MAX = 8;

function rewriteAssistantLimitError(message: string): string {
  if (/limite de requisi[cç][oõ]es|rate limit|too many requests|saturada/i.test(message)) {
    return "O assistente não usou a sua conta OpenAI (por isso o painel da OpenAI continua em $0). Salve a chave em Configurações → Chaves de IA e gere de novo.";
  }
  return message;
}

export async function suggestContent(input: {
  contentId: string;
  projectId: string;
  clientId: string;
  prompt: string;
  references?: string;
  youtubeUrls?: string[];
  instagramUrls?: string[];
  tiktokUrls?: string[];
  transcription?: string;
  libraryAssetIds?: string[];
  libraryAssetId?: string;
  documentUrl?: string;
  documentName?: string;
  format: ContentFormat;
  locale?: string;
  provider?: AiChatProvider;
  webSearch?: boolean;
  mode?: "generate" | "refine";
  refineInstruction?: string;
  currentDraft?: ContentSuggestion;
}): Promise<ContentSuggestion> {
  const prompt = input.prompt.trim();
  const refineInstruction = input.refineInstruction?.trim() ?? "";
  if (input.mode !== "refine" && !prompt) throw new Error("Informe um prompt");
  if (input.mode === "refine" && !refineInstruction) throw new Error("Informe o ajuste");

  const libraryAssetIds = [
    ...new Set((input.libraryAssetIds ?? []).map((id) => id.trim()).filter(Boolean)),
  ].slice(0, ASSISTANT_REFERENCE_MAX);

  const { data, error } = await supabase.functions.invoke("suggest-content", {
    body: {
      contentId: input.contentId,
      projectId: input.projectId,
      clientId: input.clientId,
      prompt,
      references: input.references?.trim() || undefined,
      youtubeUrls: (input.youtubeUrls ?? []).map((u) => u.trim()).filter(Boolean),
      instagramUrls: (input.instagramUrls ?? []).map((u) => u.trim()).filter(Boolean),
      tiktokUrls: (input.tiktokUrls ?? []).map((u) => u.trim()).filter(Boolean),
      transcription: input.transcription?.trim() || undefined,
      libraryAssetIds: libraryAssetIds.length > 0 ? libraryAssetIds : undefined,
      libraryAssetId: input.libraryAssetId?.trim() || undefined,
      documentUrl: input.documentUrl?.trim() || undefined,
      documentName: input.documentName?.trim() || undefined,
      format: input.format,
      locale: input.locale,
      provider: normalizeAiChatProvider(input.provider),
      webSearch: Boolean(input.webSearch),
      mode: input.mode === "refine" ? "refine" : "generate",
      refineInstruction: refineInstruction || undefined,
      currentDraft: input.currentDraft
        ? {
            title: input.currentDraft.title,
            caption: input.currentDraft.caption,
            cta: input.currentDraft.cta,
            hashtags: input.currentDraft.hashtags,
            theme: input.currentDraft.theme,
            locucao: input.currentDraft.locucao,
            locucaoHook: input.currentDraft.locucaoHook,
            locucaoBody: input.currentDraft.locucaoBody,
            locucaoCta: input.currentDraft.locucaoCta,
            roteiro: input.currentDraft.roteiro,
          }
        : undefined,
    },
  });

  const payload = data as {
    suggestion?: ContentSuggestion & {
      locucaoHook?: string;
      locucao_hook?: string;
      locucaoBody?: string;
      locucao_body?: string;
      locucaoCta?: string;
      locucao_cta?: string;
    };
    sources?: WebSource[];
    webSearchUnavailable?: boolean;
    error?: string;
  } | null;

  if (error) {
    throw new Error(rewriteAssistantLimitError(await readFunctionsInvokeError(error, data)));
  }
  if (payload?.error) {
    throw new Error(rewriteAssistantLimitError(payload.error));
  }
  if (!payload?.suggestion) {
    throw new Error("Resposta inválida do assistente");
  }

  const suggestion = payload.suggestion;
  return {
    title: suggestion.title?.trim() || "",
    caption: suggestion.caption ?? "",
    cta: suggestion.cta ?? "",
    hashtags: suggestion.hashtags ?? "",
    theme: suggestion.theme?.trim() || null,
    locucao: suggestion.locucao ?? "",
    locucaoHook: suggestion.locucaoHook ?? suggestion.locucao_hook ?? "",
    locucaoBody: suggestion.locucaoBody ?? suggestion.locucao_body ?? "",
    locucaoCta: suggestion.locucaoCta ?? suggestion.locucao_cta ?? "",
    roteiro: suggestion.roteiro ?? "",
    webSources: payload.sources ?? [],
    webSearchUnavailable: Boolean(payload.webSearchUnavailable),
  };
}

export async function suggestContentIdeas(input: {
  projectId: string;
  clientId: string;
  calendarBlockId?: string | null;
  mix?: ContentMix;
  count?: number;
  prompt?: string;
  locale?: string;
  provider?: AiChatProvider;
  webSearch?: boolean;
  allowedFormats?: ContentFormat[];
}): Promise<{ ideas: ContentIdea[]; mix: ContentMix; webSources: WebSource[]; webSearchUnavailable: boolean }> {
  const body = {
    mode: "ideas" as const,
    projectId: input.projectId,
    clientId: input.clientId,
    calendarBlockId: input.calendarBlockId ?? undefined,
    mix: input.mix,
    count: input.count,
    prompt: input.prompt?.trim() || undefined,
    locale: input.locale,
    provider: normalizeAiChatProvider(input.provider),
    webSearch: Boolean(input.webSearch),
    allowedFormats: input.allowedFormats,
  };

  const first = await supabase.functions.invoke("suggest-content", { body });
  let data = first.data;
  let error = first.error;

  if (error && /Failed to send|FunctionsFetchError|NOT_FOUND|not found/i.test(error.message ?? "")) {
    const fallback = await supabase.functions.invoke("suggest-content-ideas", { body });
    data = fallback.data;
    error = fallback.error;
  }

  const payload = data as {
    ideas?: ContentIdea[];
    mix?: ContentMix;
    sources?: WebSource[];
    webSearchUnavailable?: boolean;
    error?: string;
  } | null;

  if (error) {
    const message = await readFunctionsInvokeError(error, data);
    if (/informe um prompt|par[aâ]metros inv[aá]lidos/i.test(message)) {
      throw new Error(
        "A função de ideias ainda não foi publicada. No Lovable, clique em Publish (isso atualiza a Edge Function suggest-content) e tente de novo.",
      );
    }
    throw new Error(rewriteAssistantLimitError(message));
  }
  if (payload?.error) {
    if (/informe um prompt|par[aâ]metros inv[aá]lidos/i.test(payload.error)) {
      throw new Error(
        "A função de ideias ainda não foi publicada. No Lovable, clique em Publish (isso atualiza a Edge Function suggest-content) e tente de novo.",
      );
    }
    throw new Error(rewriteAssistantLimitError(payload.error));
  }
  if (!payload?.ideas?.length) {
    throw new Error("Resposta inválida do assistente de ideias");
  }

  return {
    ideas: payload.ideas.map((idea) => ({
      title: idea.title?.trim() || "Sem título",
      format: idea.format,
      funnelStage: parseFunnelStage(idea.funnelStage) ?? "tofu",
      hook: idea.hook ?? "",
      why: idea.why ?? "",
      theme: idea.theme?.trim() || null,
    })),
    mix: parseContentMix(payload.mix ?? input.mix),
    webSources: payload.sources ?? [],
    webSearchUnavailable: Boolean(payload.webSearchUnavailable),
  };
}

export async function analyzeReferenceCreator(input: {
  creatorId: string;
  clientId: string;
  locale?: string;
  provider?: AiChatProvider;
}): Promise<BrandReferenceCreator> {
  const { data, error } = await supabase.functions.invoke("analyze-reference-creator", {
    body: {
      creatorId: input.creatorId,
      clientId: input.clientId,
      locale: input.locale,
      provider: normalizeAiChatProvider(input.provider),
    },
  });
  const payload = data as { creator?: BrandReferenceCreator; error?: string } | null;
  if (error) {
    throw new Error(rewriteAssistantLimitError(await readFunctionsInvokeError(error, data)));
  }
  if (payload?.error) {
    throw new Error(rewriteAssistantLimitError(payload.error));
  }
  if (!payload?.creator) {
    throw new Error("Resposta inválida da análise");
  }
  return payload.creator;
}

export type DesignGenerationResult = {
  imageUrl: string;
  provider?: DesignProvider;
  /** Camadas extraídas no modo open_editable (textos do template viram editáveis). */
  layers?: unknown;
};

export async function generateDesign(input: {
  contentId: string;
  projectId: string;
  clientId: string;
  format: ContentFormat;
  aspectRatio?: DesignAspectRatio;
  provider?: DesignProvider;
  templateUrl: string;
  photoUrl?: string;
  overlayText: string;
  secondaryText?: string;
  guidance?: string;
  /** Extrai textos do template e devolve fundo limpo + layers. */
  mode?: "generate" | "open_editable";
}): Promise<DesignGenerationResult> {
  const mode = input.mode === "open_editable" ? "open_editable" : "generate";
  const overlayText = input.overlayText.trim();
  const secondaryText = input.secondaryText?.trim() || "";
  const templateUrl = input.templateUrl.trim();
  const photoUrl = input.photoUrl?.trim() || "";
  const provider = input.provider === "gemini" ? "gemini" : "openai";
  const aspectRatio = parseDesignAspectRatio(
    input.aspectRatio,
    defaultAspectForFormat(input.format),
  );
  if (!templateUrl) throw new Error("Informe o template de referência");
  if (mode === "generate" && !overlayText) throw new Error("Informe o texto da arte");

  const { data, error } = await supabase.functions.invoke("generate-design", {
    body: {
      contentId: input.contentId,
      projectId: input.projectId,
      clientId: input.clientId,
      format: input.format,
      aspectRatio,
      provider,
      mode,
      templateUrl,
      photoUrl: photoUrl || undefined,
      overlayText: overlayText || " ",
      secondaryText: secondaryText || undefined,
      guidance: input.guidance?.trim() || undefined,
    },
  });

  const payload = data as {
    imageUrl?: string;
    provider?: DesignProvider;
    layers?: unknown;
    error?: string;
  } | null;
  if (error) {
    throw new Error(await readFunctionsInvokeError(error, data));
  }
  if (payload?.error) {
    throw new Error(payload.error);
  }
  if (!payload?.imageUrl) {
    throw new Error("Resposta inválida do assistente de design");
  }

  return {
    imageUrl: payload.imageUrl,
    provider: payload.provider ?? provider,
    layers: payload.layers,
  };
}

// —— Admin AI credentials ——

export type AdminAiKeysStatus = {
  openaiConfigured: boolean;
  geminiConfigured: boolean;
  claudeConfigured: boolean;
  openaiLast4: string | null;
  geminiLast4: string | null;
  claudeLast4: string | null;
  updatedAt?: string | null;
  openaiHelpUrl: string;
  geminiHelpUrl: string;
  claudeHelpUrl: string;
  platformFallbackOpenAI?: boolean;
  platformFallbackGemini?: boolean;
  platformFallbackClaude?: boolean;
};

type ManageAdminAiKeysResponse = {
  error?: string;
  openai?: { configured?: boolean; last4?: string | null };
  gemini?: { configured?: boolean; last4?: string | null };
  claude?: { configured?: boolean; last4?: string | null };
  platformFallback?: { openai?: boolean; gemini?: boolean; claude?: boolean };
  updatedAt?: string | null;
  // legacy flat shape (older local contract)
  openaiConfigured?: boolean;
  geminiConfigured?: boolean;
  claudeConfigured?: boolean;
  openaiLast4?: string | null;
  geminiLast4?: string | null;
  claudeLast4?: string | null;
  openaiHelpUrl?: string;
  geminiHelpUrl?: string;
  claudeHelpUrl?: string;
};

function mapAdminAiKeysStatus(payload: ManageAdminAiKeysResponse): AdminAiKeysStatus {
  return {
    openaiConfigured: Boolean(payload.openai?.configured ?? payload.openaiConfigured),
    geminiConfigured: Boolean(payload.gemini?.configured ?? payload.geminiConfigured),
    claudeConfigured: Boolean(payload.claude?.configured ?? payload.claudeConfigured),
    openaiLast4: payload.openai?.last4 ?? payload.openaiLast4 ?? null,
    geminiLast4: payload.gemini?.last4 ?? payload.geminiLast4 ?? null,
    claudeLast4: payload.claude?.last4 ?? payload.claudeLast4 ?? null,
    updatedAt: payload.updatedAt ?? null,
    openaiHelpUrl: payload.openaiHelpUrl || "https://platform.openai.com/api-keys",
    geminiHelpUrl: payload.geminiHelpUrl || "https://aistudio.google.com/apikey",
    claudeHelpUrl: payload.claudeHelpUrl || "https://console.anthropic.com/settings/keys",
    platformFallbackOpenAI: Boolean(payload.platformFallback?.openai),
    platformFallbackGemini: Boolean(payload.platformFallback?.gemini),
    platformFallbackClaude: Boolean(payload.platformFallback?.claude),
  };
}

export async function getAdminAiKeysStatus(): Promise<AdminAiKeysStatus> {
  const { data, error } = await supabase.functions.invoke("manage-admin-ai-keys", {
    body: { action: "get" },
  });
  if (error) throw new Error(await readFunctionsInvokeError(error, data));
  const payload = data as ManageAdminAiKeysResponse;
  if (payload?.error) throw new Error(payload.error);
  return mapAdminAiKeysStatus(payload);
}

export async function saveAdminAiKeys(input: {
  openaiKey?: string;
  geminiKey?: string;
  claudeKey?: string;
  clearOpenAI?: boolean;
  clearGemini?: boolean;
  clearClaude?: boolean;
}): Promise<AdminAiKeysStatus> {
  let last: ManageAdminAiKeysResponse | null = null;

  const invoke = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("manage-admin-ai-keys", { body });
    if (error) throw new Error(await readFunctionsInvokeError(error, data));
    const payload = data as ManageAdminAiKeysResponse;
    if (payload?.error) throw new Error(payload.error);
    last = payload;
  };

  if (input.clearOpenAI) {
    await invoke({ action: "delete", provider: "openai" });
  } else if (input.openaiKey?.trim()) {
    await invoke({ action: "save", provider: "openai", apiKey: input.openaiKey.trim() });
  }

  if (input.clearGemini) {
    await invoke({ action: "delete", provider: "gemini" });
  } else if (input.geminiKey?.trim()) {
    await invoke({ action: "save", provider: "gemini", apiKey: input.geminiKey.trim() });
  }

  if (input.clearClaude) {
    await invoke({ action: "delete", provider: "claude" });
  } else if (input.claudeKey?.trim()) {
    await invoke({ action: "save", provider: "claude", apiKey: input.claudeKey.trim() });
  }

  if (!last) {
    return getAdminAiKeysStatus();
  }
  return mapAdminAiKeysStatus(last);
}

// —— Comments ——

export type CommentWithAuthor = ContentComment & {
  profiles: Pick<Profile, "full_name" | "avatar_url"> | null;
};

export async function listComments(contentId: string): Promise<CommentWithAuthor[]> {
  // Client-side + RLS (same path as addComment). Avoids server-fn/service-role failures
  // that made inserts succeed while the card stayed empty.
  const { data, error } = await supabase
    .from("content_comments")
    .select("*, profiles!content_comments_user_id_fkey(full_name, avatar_url)")
    .eq("content_id", contentId)
    .order("created_at", { ascending: true });

  if (!error) return (data ?? []) as CommentWithAuthor[];

  // Nested profiles can fail under some RLS setups — still return the comments.
  const { data: rows, error: fallbackError } = await supabase
    .from("content_comments")
    .select("*")
    .eq("content_id", contentId)
    .order("created_at", { ascending: true });
  if (fallbackError) throw new Error(fallbackError.message || error.message);
  return (rows ?? []).map((row) => ({ ...row, profiles: null }));
}

export async function uploadCommentAudio(input: {
  projectId: string;
  contentId: string;
  blob: Blob;
}): Promise<{ publicUrl: string; storagePath: string }> {
  const userId = await requireUserId();
  const mime = input.blob.type || "audio/webm";
  const ext =
    mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")
      ? "m4a"
      : mime.includes("ogg")
        ? "ogg"
        : mime.includes("mpeg") || mime.includes("mp3")
          ? "mp3"
          : mime.includes("wav")
            ? "wav"
            : "webm";
  const storagePath = `${input.projectId}/${input.contentId}/${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(COMMENT_AUDIO_BUCKET).upload(storagePath, input.blob, {
    cacheControl: "3600",
    contentType: mime,
    upsert: false,
  });
  if (error) {
    if (/bucket not found/i.test(error.message)) {
      throw new Error(
        "Bucket de áudio de comentários ainda não existe. Aplique a migration comment-audio no Supabase e tente novamente.",
      );
    }
    if (/row-level security|violates row-level/i.test(error.message)) {
      throw new Error(
        "Não foi possível enviar o áudio por falta de permissão. Aplique a migration de comentários em áudio no banco e tente novamente.",
      );
    }
    throw new Error(error.message);
  }
  const { data } = supabase.storage.from(COMMENT_AUDIO_BUCKET).getPublicUrl(storagePath);
  return { publicUrl: data.publicUrl, storagePath };
}

export async function addComment(input: {
  contentId: string;
  clientId: string;
  projectId: string;
  body: string;
  contentTitle: string;
  i18n?: RowI18n;
  audioUrl?: string | null;
  audioStoragePath?: string | null;
}): Promise<ContentComment> {
  const userId = await requireUserId();
  const body = input.body.trim();
  const audioUrl = input.audioUrl?.trim() || null;
  if (!body && !audioUrl) {
    throw new Error("Comentário vazio.");
  }
  const { data, error } = await supabase
    .from("content_comments")
    .insert({
      content_id: input.contentId,
      user_id: userId,
      body,
      ...(audioUrl
        ? {
            audio_url: audioUrl,
            audio_storage_path: input.audioStoragePath?.trim() || null,
          }
        : {}),
      ...(input.i18n ? { i18n: toI18nJson(input.i18n) } : {}),
    })
    .select("*")
    .single();
  const row = ensureData(data, error);
  logActivity({
    type: "comment_added",
    summary: `Comentário em ${input.contentTitle}`,
    clientId: input.clientId,
    projectId: input.projectId,
    contentId: input.contentId,
  });
  return row;
}

export async function updateComment(input: {
  commentId: string;
  body: string;
  i18n?: RowI18n;
}): Promise<ContentComment> {
  const body = input.body.trim();
  const { data: current, error: currentError } = await supabase
    .from("content_comments")
    .select("audio_url")
    .eq("id", input.commentId)
    .maybeSingle();
  if (currentError) throw new Error(currentError.message);
  const hasAudio = Boolean(current?.audio_url?.trim());
  if (!body && !hasAudio) {
    throw new Error("Comentário vazio.");
  }
  const { data, error } = await supabase
    .from("content_comments")
    .update({
      body,
      i18n: toI18nJson(input.i18n),
    })
    .eq("id", input.commentId)
    .select("*")
    .single();
  return ensureData(data, error);
}

export async function deleteComment(commentId: string): Promise<void> {
  const { data: row } = await supabase
    .from("content_comments")
    .select("audio_storage_path")
    .eq("id", commentId)
    .maybeSingle();
  const { error } = await supabase.from("content_comments").delete().eq("id", commentId);
  if (error) throw new Error(error.message);
  const path = row?.audio_storage_path?.trim();
  if (path) {
    await supabase.storage.from(COMMENT_AUDIO_BUCKET).remove([path]);
  }
}

export async function updateCommentI18n(
  commentId: string,
  i18n: RowI18n,
): Promise<ContentComment> {
  const { data, error } = await supabase
    .from("content_comments")
    .update({ i18n: toI18nJson(i18n) })
    .eq("id", commentId)
    .select("*")
    .single();
  return ensureData(data, error);
}

/** Persist i18n only (canonical text columns unchanged). Used by locale backfill. */
export async function updateContentI18n(
  contentId: string,
  i18n: RowI18n,
): Promise<ContentItem> {
  const { data, error } = await supabase
    .from("content_items")
    .update({ i18n: toI18nJson(i18n) })
    .eq("id", contentId)
    .select("*")
    .single();
  return ensureData(data, error);
}

export async function updateLibraryAssetI18n(
  assetId: string,
  i18n: RowI18n,
): Promise<LibraryAsset> {
  const { data, error } = await supabase
    .from("library_assets")
    .update({ i18n: toI18nJson(i18n) })
    .eq("id", assetId)
    .select("*")
    .single();
  return ensureData(data, error);
}

export async function updateActivityEventI18n(
  eventId: string,
  i18n: RowI18n,
): Promise<void> {
  const { error } = await supabase
    .from("activity_events")
    .update({ i18n: toI18nJson(i18n) })
    .eq("id", eventId);
  if (error) throw new Error(error.message);
}

// —— Brand briefing / Guia de marca ——

export type BrandBriefingView = BrandBriefing & {
  templateParsed: BriefingTemplate;
  answersParsed: Record<string, string>;
  answeredCount: number;
  totalCount: number;
};

function toBrandBriefingView(row: BrandBriefing): BrandBriefingView {
  const templateParsed = parseBriefingTemplate(row.template);
  const answersParsed = parseBriefingAnswers(row.answers);
  return {
    ...row,
    templateParsed,
    answersParsed,
    answeredCount: countAnsweredQuestions(templateParsed, answersParsed),
    totalCount: countBriefingQuestions(templateParsed),
  };
}

export async function getBrandBriefing(clientId: string): Promise<BrandBriefingView | null> {
  const { data, error } = await supabase
    .from("brand_briefings")
    .select("*")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toBrandBriefingView(data) : null;
}

export async function ensureBrandBriefing(clientId: string): Promise<BrandBriefingView> {
  await assertPlanFeature(
    "brandBriefing",
    "Brand briefing disponível a partir do plano Studio.",
  );

  const existing = await getBrandBriefing(clientId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("brand_briefings")
    .insert({
      client_id: clientId,
      template: DEFAULT_BRAND_BRIEFING_TEMPLATE as unknown as Json,
      answers: {} as Json,
      status: "draft",
    })
    .select("*")
    .single();

  if (error) {
    // Race: another request created it
    if (/duplicate|unique/i.test(error.message)) {
      const again = await getBrandBriefing(clientId);
      if (again) return again;
    }
    throw new Error(error.message);
  }

  return toBrandBriefingView(ensureData(data, error));
}

export async function upsertBrandBriefingAnswers(input: {
  clientId: string;
  answers: Record<string, string>;
  i18n?: RowI18n;
}): Promise<BrandBriefingView> {
  const briefing = await ensureBrandBriefing(input.clientId);
  const nextAnswers = { ...briefing.answersParsed, ...input.answers };
  const answered = countAnsweredQuestions(briefing.templateParsed, nextAnswers);
  const nextStatus: BrandBriefingStatus =
    briefing.status === "completed"
      ? "completed"
      : answered > 0
        ? "in_progress"
        : "draft";
  const nextI18n = input.i18n
    ? { ...parseRowI18n(briefing.i18n), ...input.i18n }
    : parseRowI18n(briefing.i18n);

  const { data, error } = await supabase
    .from("brand_briefings")
    .update({
      answers: nextAnswers as unknown as Json,
      status: nextStatus,
      i18n: toI18nJson(nextI18n),
    })
    .eq("client_id", input.clientId)
    .select("*")
    .single();

  return toBrandBriefingView(ensureData(data, error));
}

export type BriefingCoachMessage = {
  role: "user" | "assistant";
  content: string;
};

export type BriefingCoachResult = {
  type: "follow_up" | "suggestion";
  content: string;
};

export async function briefingCoach(input: {
  clientId: string;
  questionId: string;
  questionLabel: string;
  currentAnswer?: string;
  messages: BriefingCoachMessage[];
  locale?: string;
}): Promise<BriefingCoachResult> {
  const { data, error } = await supabase.functions.invoke("briefing-coach", {
    body: {
      clientId: input.clientId,
      questionId: input.questionId,
      questionLabel: input.questionLabel,
      currentAnswer: input.currentAnswer?.trim() || undefined,
      messages: input.messages,
      locale: input.locale,
    },
  });

  const payload = data as (BriefingCoachResult & { error?: string }) | null;
  if (error) {
    throw new Error(payload?.error || error.message || "Falha no coach do briefing");
  }
  if (payload?.error) throw new Error(payload.error);
  if (!payload?.type || !payload.content?.trim()) {
    throw new Error("Resposta inválida do coach");
  }
  return { type: payload.type, content: payload.content.trim() };
}

export async function generateBrandGuide(
  clientId: string,
  locale?: string,
): Promise<BrandBriefingView> {
  const { data, error } = await supabase.functions.invoke("generate-brand-guide", {
    body: { clientId, locale },
  });

  const payload = data as { briefing?: BrandBriefing; error?: string } | null;
  if (error) {
    throw new Error(payload?.error || error.message || "Falha ao gerar o guia de marca");
  }
  if (payload?.error) throw new Error(payload.error);
  if (payload?.briefing) {
    return toBrandBriefingView(payload.briefing);
  }

  const refreshed = await getBrandBriefing(clientId);
  if (!refreshed) throw new Error("Briefing não encontrado após gerar o guia");
  return refreshed;
}

export async function completeBrandBriefing(
  clientId: string,
  locale?: string,
): Promise<BrandBriefingView> {
  await ensureBrandBriefing(clientId);
  return generateBrandGuide(clientId, locale);
}

// —— Site project (prototype / briefing / PRD / schedule) ——

export type SiteScheduleRow = {
  id: string;
  fase: string;
  prazo: string;
  entregas: string;
};

export function createEmptyScheduleRows(count = 5): SiteScheduleRow[] {
  return Array.from({ length: count }, () => ({
    id: crypto.randomUUID(),
    fase: "",
    prazo: "",
    entregas: "",
  }));
}

export function parseSiteSchedule(raw: unknown): SiteScheduleRow[] {
  if (!Array.isArray(raw) || raw.length === 0) return createEmptyScheduleRows(5);
  const rows: SiteScheduleRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    rows.push({
      id: typeof row.id === "string" && row.id ? row.id : crypto.randomUUID(),
      fase: typeof row.fase === "string" ? row.fase : "",
      prazo: typeof row.prazo === "string" ? row.prazo : "",
      entregas: typeof row.entregas === "string" ? row.entregas : "",
    });
  }
  return rows.length > 0 ? rows : createEmptyScheduleRows(5);
}

export type ProjectSiteView = ProjectSite & {
  templateParsed: BriefingTemplate;
  formParsed: SiteBriefingFormData;
  scheduleParsed: SiteScheduleRow[];
  answeredCount: number;
  totalCount: number;
};

function toProjectSiteView(row: ProjectSite): ProjectSiteView {
  const templateParsed = parseSiteBriefingTemplate(row.briefing_template);
  const formParsed = parseSiteBriefingForm(row.briefing_answers);
  const progress = countSiteBriefingProgress(formParsed);
  return {
    ...row,
    templateParsed,
    formParsed,
    scheduleParsed: parseSiteSchedule(row.schedule),
    answeredCount: progress.answered,
    totalCount: progress.total,
  };
}

export async function getProjectSite(projectId: string): Promise<ProjectSiteView | null> {
  const { data, error } = await supabase
    .from("project_site")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw error;
  return data ? toProjectSiteView(data) : null;
}

export async function ensureProjectSite(projectId: string): Promise<ProjectSiteView> {
  const existing = await getProjectSite(projectId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("project_site")
    .insert({
      project_id: projectId,
      briefing_template: DEFAULT_SITE_BRIEFING_TEMPLATE as unknown as Json,
      briefing_answers: parseSiteBriefingForm(null) as unknown as Json,
      briefing_status: "draft",
      prototype_status: "review",
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const again = await getProjectSite(projectId);
      if (again) return again;
    }
    throw error;
  }

  return toProjectSiteView(ensureData(data, error));
}

function resolveSiteBriefingStatus(
  form: SiteBriefingFormData,
  current: SiteBriefingStatus | string,
): SiteBriefingStatus {
  if (current === "completed") return "completed";
  return isSiteBriefingFormFilled(form) ? "in_progress" : "draft";
}

export async function updateProjectSitePrototypeUrl(input: {
  projectId: string;
  prototypeUrl: string | null;
}): Promise<ProjectSiteView> {
  await ensureProjectSite(input.projectId);
  const { data, error } = await supabase
    .from("project_site")
    .update({
      prototype_url: input.prototypeUrl?.trim() || null,
    })
    .eq("project_id", input.projectId)
    .select("*")
    .single();
  return toProjectSiteView(ensureData(data, error));
}

export async function upsertSiteBriefingForm(input: {
  projectId: string;
  form: SiteBriefingFormData;
}): Promise<ProjectSiteView> {
  const site = await ensureProjectSite(input.projectId);
  const nextStatus = resolveSiteBriefingStatus(input.form, site.briefing_status);
  const { data, error } = await supabase
    .from("project_site")
    .update({
      briefing_answers: input.form as unknown as Json,
      briefing_template: DEFAULT_SITE_BRIEFING_TEMPLATE as unknown as Json,
      briefing_status: nextStatus,
    })
    .eq("project_id", input.projectId)
    .select("*")
    .single();
  return toProjectSiteView(ensureData(data, error));
}

export async function updateSiteManagerNotes(input: {
  projectId: string;
  managerNotes: string;
}): Promise<ProjectSiteView> {
  await ensureProjectSite(input.projectId);
  const { data, error } = await supabase
    .from("project_site")
    .update({
      manager_notes: input.managerNotes.trim() || null,
    })
    .eq("project_id", input.projectId)
    .select("*")
    .single();
  return toProjectSiteView(ensureData(data, error));
}

export async function updateSitePrototypeFeedback(input: {
  projectId: string;
  prototypeNotes?: string;
  prototypeChangeRequests?: string;
}): Promise<ProjectSiteView> {
  await ensureProjectSite(input.projectId);
  const patch: {
    prototype_notes?: string | null;
    prototype_change_requests?: string | null;
  } = {};
  if (input.prototypeNotes !== undefined) {
    patch.prototype_notes = input.prototypeNotes.trim() || null;
  }
  if (input.prototypeChangeRequests !== undefined) {
    patch.prototype_change_requests = input.prototypeChangeRequests.trim() || null;
  }
  const { data, error } = await supabase
    .from("project_site")
    .update(patch)
    .eq("project_id", input.projectId)
    .select("*")
    .single();
  return toProjectSiteView(ensureData(data, error));
}

export async function updateSitePrototypeStatus(input: {
  projectId: string;
  status: SitePrototypeStatus;
}): Promise<ProjectSiteView> {
  await ensureProjectSite(input.projectId);
  const { data, error } = await supabase
    .from("project_site")
    .update({
      prototype_status: input.status,
    })
    .eq("project_id", input.projectId)
    .select("*")
    .single();
  return toProjectSiteView(ensureData(data, error));
}

export async function updateSiteSchedule(input: {
  projectId: string;
  schedule: SiteScheduleRow[];
}): Promise<ProjectSiteView> {
  await ensureProjectSite(input.projectId);
  const { data, error } = await supabase
    .from("project_site")
    .update({
      schedule: input.schedule as unknown as Json,
    })
    .eq("project_id", input.projectId)
    .select("*")
    .single();
  return toProjectSiteView(ensureData(data, error));
}

export async function markSiteBriefingCompleted(projectId: string): Promise<ProjectSiteView> {
  await ensureProjectSite(projectId);
  const { data, error } = await supabase
    .from("project_site")
    .update({ briefing_status: "completed" })
    .eq("project_id", projectId)
    .select("*")
    .single();
  return toProjectSiteView(ensureData(data, error));
}

export async function updateSitePrdMarkdown(input: {
  projectId: string;
  prdMarkdown: string;
}): Promise<ProjectSiteView> {
  await ensureProjectSite(input.projectId);
  const { data, error } = await supabase
    .from("project_site")
    .update({
      prd_markdown: input.prdMarkdown,
    })
    .eq("project_id", input.projectId)
    .select("*")
    .single();
  return toProjectSiteView(ensureData(data, error));
}

export async function generateSitePrd(
  projectId: string,
  locale?: string,
): Promise<ProjectSiteView> {
  const { data, error } = await supabase.functions.invoke("generate-site-prd", {
    body: { projectId, locale },
  });

  const payload = data as { site?: ProjectSite; error?: string } | null;
  if (error) {
    throw new Error(payload?.error || error.message || "Falha ao gerar o Prompt (PRD)");
  }
  if (payload?.error) throw new Error(payload.error);
  if (payload?.site) {
    return toProjectSiteView(payload.site);
  }

  const refreshed = await getProjectSite(projectId);
  if (!refreshed) throw new Error("Dados do site não encontrados após gerar o PRD");
  return refreshed;
}

// —— Library ——

export const LIBRARY_BUCKET = "library-assets";
export const LIBRARY_MAX_BYTES = MEDIA_MAX_BYTES;
export const LIBRARY_MAX_MB = Math.round(LIBRARY_MAX_BYTES / 1024 / 1024);

export const ASSISTANT_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ASSISTANT_DOCUMENT_MAX_MB = 10;
export const ASSISTANT_DOCUMENT_ACCEPT =
  ".pdf,.txt,.md,.csv,.doc,.docx,.xls,.xlsx,.rtf,application/pdf,text/plain,text/csv,text/markdown,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const ASSISTANT_DOCUMENT_EXT = /\.(pdf|txt|md|csv|docx?|xlsx?|rtf)\b/i;
const ASSISTANT_DOCUMENT_MIME =
  /(pdf|wordprocessingml|spreadsheetml|msword|ms-excel|text\/plain|text\/csv|text\/markdown|rtf)/i;

export function isAssistantDocumentFile(file: File) {
  return (
    ASSISTANT_DOCUMENT_EXT.test(file.name) || ASSISTANT_DOCUMENT_MIME.test(file.type || "")
  );
}

export function isAssistantDocumentAsset(asset: {
  category?: string | null;
  name?: string | null;
  file_name?: string | null;
  file_url?: string | null;
  mime_type?: string | null;
  storage_path?: string | null;
}) {
  if (!asset.file_url && !asset.storage_path) return false;
  if (
    asset.category === "pdfs" ||
    asset.category === "documents" ||
    asset.category === "spreadsheets"
  ) {
    return true;
  }
  const hay = `${asset.file_name ?? ""} ${asset.name ?? ""} ${asset.file_url ?? ""} ${asset.mime_type ?? ""}`;
  return ASSISTANT_DOCUMENT_EXT.test(hay) || ASSISTANT_DOCUMENT_MIME.test(hay);
}

export function isAssistantDocumentTooLarge(file: File) {
  return file.size > ASSISTANT_DOCUMENT_MAX_BYTES;
}

/** Library assets usable as multi-select references in the content assistant. */
export function isAssistantReferenceAsset(asset: {
  category?: string | null;
  file_url?: string | null;
  storage_path?: string | null;
}) {
  if (asset.category === "generated_arts") return false;
  return Boolean(asset.file_url || asset.storage_path);
}

export function formatLibraryFileSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function isLibraryFileTooLarge(file: File) {
  return file.size > LIBRARY_MAX_BYTES;
}

export class PartialLibraryUploadError extends Error {
  readonly created: LibraryAsset[];
  readonly errors: string[];

  constructor(created: LibraryAsset[], errors: string[]) {
    super(
      `${created.length} enviado(s), ${errors.length} falhou(aram): ${errors[0]}`,
    );
    this.name = "PartialLibraryUploadError";
    this.created = created;
    this.errors = errors;
  }
}

export const LIBRARY_ACCEPT =
  ".pdf,.jpg,.jpeg,.png,.gif,.webp,.svg,.heic,.heif,.mp4,.webm,.mov,.avi,.txt,.md,.csv,.rtf,.doc,.docx,.odt,.xls,.xlsx,.ods,image/*,video/*,application/pdf,text/plain,text/csv,text/markdown,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const IMAGE_MIME = /^image\//;
const VIDEO_MIME = /^video\//;
const PDF_MIME = /^application\/pdf$/;
const SPREADSHEET_MIME =
  /^(text\/csv|application\/vnd\.ms-excel|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|application\/vnd\.oasis\.opendocument\.spreadsheet)$/;
const DOCUMENT_MIME =
  /^(text\/plain|text\/markdown|application\/rtf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|application\/vnd\.oasis\.opendocument\.text)$/;

export function guessLibraryCategory(file: File): LibraryCategory {
  const mime = file.type || "";
  const name = file.name.toLowerCase();

  if (IMAGE_MIME.test(mime) || /\.(jpe?g|png|gif|webp|svg|heic|heif)$/.test(name)) {
    return "images";
  }
  if (VIDEO_MIME.test(mime) || /\.(mp4|webm|mov|avi)$/.test(name)) {
    return "videos";
  }
  if (PDF_MIME.test(mime) || name.endsWith(".pdf")) {
    return "pdfs";
  }
  if (SPREADSHEET_MIME.test(mime) || /\.(csv|xls|xlsx|ods)$/.test(name)) {
    return "spreadsheets";
  }
  if (DOCUMENT_MIME.test(mime) || /\.(txt|md|rtf|doc|docx|odt)$/.test(name)) {
    return "documents";
  }
  return "references";
}

export async function listLibraryAssets(clientId: string) {
  const { data, error } = await supabase
    .from("library_assets")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

function libraryFileTooLargeMessage(file: File) {
  return `O arquivo "${file.name}" (${formatLibraryFileSize(file.size)}) deve ter no máximo ${LIBRARY_MAX_MB} MB.`;
}

async function uploadLibraryFile(clientId: string, file: File) {
  if (isLibraryFileTooLarge(file)) {
    throw new Error(libraryFileTooLargeMessage(file));
  }
  const safeName = sanitizeFileName(file.name || "arquivo");
  const storagePath = `${clientId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(LIBRARY_BUCKET).upload(storagePath, file, {
    cacheControl: "3600",
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) {
    if (/maximum allowed size|payload too large|exceeded the maximum|file size limit|413/i.test(error.message)) {
      throw new Error(libraryFileTooLargeMessage(file));
    }
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(LIBRARY_BUCKET).getPublicUrl(storagePath);
  return {
    storagePath,
    fileUrl: data.publicUrl,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || null,
  };
}

export async function createLibraryAsset(input: {
  clientId: string;
  name: string;
  category: LibraryCategory;
  fileUrl?: string;
  file?: File | null;
  notes?: string;
  i18n?: RowI18n;
}): Promise<LibraryAsset> {
  await assertPlanFeature("library", "Biblioteca disponível a partir do plano Studio.");
  const userId = await requireUserId();
  let uploaded:
    | {
        storagePath: string;
        fileUrl: string;
        fileName: string;
        fileSize: number;
        mimeType: string | null;
      }
    | undefined;

  if (input.file) {
    uploaded = await uploadLibraryFile(input.clientId, input.file);
  }

  const { data, error } = await supabase
    .from("library_assets")
    .insert({
      client_id: input.clientId,
      name: input.name.trim(),
      category: input.category,
      file_url: uploaded?.fileUrl ?? (input.fileUrl?.trim() || null),
      storage_path: uploaded?.storagePath ?? null,
      file_name:
        uploaded?.fileName ??
        (input.category === "generated_arts" ? `${input.name.trim() || "arte"}.png` : null),
      file_size: uploaded?.fileSize ?? null,
      mime_type:
        uploaded?.mimeType ?? (input.category === "generated_arts" ? "image/png" : null),
      notes: input.notes?.trim() || null,
      created_by: userId,
      ...(input.i18n ? { i18n: toI18nJson(input.i18n) } : {}),
    } satisfies TablesInsert<"library_assets">)
    .select("*")
    .single();

  if (error && uploaded) {
    await supabase.storage.from(LIBRARY_BUCKET).remove([uploaded.storagePath]);
  }

  return ensureData(data, error);
}

export async function saveGeneratedArtToLibrary(input: {
  clientId: string;
  imageUrl: string;
  name: string;
  notes?: string;
}): Promise<LibraryAsset> {
  const url = input.imageUrl.trim();
  if (!url) throw new Error("URL da arte inválida");
  const name = input.name.trim() || "Arte gerada";
  return createLibraryAsset({
    clientId: input.clientId,
    name,
    category: "generated_arts",
    fileUrl: url,
    notes: input.notes,
  });
}

export async function deleteLibraryAssets(assetIds: string[]): Promise<void> {
  const ids = [...new Set(assetIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return;

  const { data: rows, error: fetchError } = await supabase
    .from("library_assets")
    .select("id, storage_path, file_url")
    .in("id", ids);
  if (fetchError) throw new Error(fetchError.message);
  if (!rows?.length) throw new Error("Arquivo(s) não encontrado(s)");

  const { error } = await supabase.from("library_assets").delete().in("id", ids);
  if (error) throw new Error(error.message);

  const libraryPaths = new Set<string>();
  const contentPaths = new Set<string>();
  for (const row of rows) {
    if (row.storage_path) libraryPaths.add(row.storage_path);
    if (row.file_url) {
      const fromLibrary = storagePathFromPublicUrl(row.file_url, LIBRARY_BUCKET);
      if (fromLibrary) libraryPaths.add(fromLibrary);
      const fromContent = storagePathFromPublicUrl(row.file_url, CONTENT_MEDIA_BUCKET);
      if (fromContent) contentPaths.add(fromContent);
    }
  }

  if (libraryPaths.size > 0) {
    await supabase.storage.from(LIBRARY_BUCKET).remove([...libraryPaths]);
  }
  if (contentPaths.size > 0) {
    await supabase.storage.from(CONTENT_MEDIA_BUCKET).remove([...contentPaths]);
  }
}

export async function deleteLibraryAsset(assetId: string): Promise<void> {
  await deleteLibraryAssets([assetId]);
}

export async function createLibraryAssets(
  inputs: Array<{
    clientId: string;
    name: string;
    category: LibraryCategory;
    fileUrl?: string;
    file?: File | null;
    notes?: string;
    i18n?: RowI18n;
  }>,
): Promise<LibraryAsset[]> {
  const created: LibraryAsset[] = [];
  const errors: string[] = [];

  for (const input of inputs) {
    try {
      created.push(await createLibraryAsset(input));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const label = input.file?.name || input.name;
      errors.push(label ? `${label}: ${message}` : message);
    }
  }

  if (created.length === 0 && errors.length > 0) {
    throw new Error(errors[0]);
  }

  if (errors.length > 0) {
    throw new PartialLibraryUploadError(created, errors);
  }

  return created;
}

export const DESIGN_TEMPLATE_ACCEPT = ".jpg,.jpeg,.png,image/jpeg,image/png";
export const DESIGN_TEMPLATE_FORMATS: DesignTemplateFormat[] = [...CONTENT_FORMATS];
const DESIGN_TEMPLATE_MAX_BYTES = 20 * 1024 * 1024;

export async function listDesignTemplates(
  clientId: string,
  format?: DesignTemplateFormat,
): Promise<DesignTemplate[]> {
  let query = supabase
    .from("design_templates")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (format) query = query.eq("format", format);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function uploadDesignTemplateFile(clientId: string, file: File) {
  if (file.size > DESIGN_TEMPLATE_MAX_BYTES) {
    throw new Error("Template deve ter no máximo 20 MB.");
  }
  const mime = file.type || "image/jpeg";
  if (!/^image\/(jpeg|png)$/i.test(mime) && !/\.(jpe?g|png)$/i.test(file.name)) {
    throw new Error("Use JPG ou PNG para templates de arte.");
  }
  const safeName = sanitizeFileName(file.name || "template.png");
  const storagePath = `${clientId}/templates/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(LIBRARY_BUCKET).upload(storagePath, file, {
    cacheControl: "3600",
    contentType: mime,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(LIBRARY_BUCKET).getPublicUrl(storagePath);
  return {
    storagePath,
    fileUrl: data.publicUrl,
    fileSize: file.size,
    mimeType: mime,
  };
}

export async function createDesignTemplate(input: {
  clientId: string;
  name: string;
  format: DesignTemplateFormat;
  aspectRatio?: DesignAspectRatio;
  file: File;
  backgroundUrl?: string | null;
  layout?: unknown;
}): Promise<DesignTemplate> {
  await assertPlanFeature("library", "Biblioteca disponível a partir do plano Studio.");
  const userId = await requireUserId();
  const uploaded = await uploadDesignTemplateFile(input.clientId, input.file);
  const aspectRatio = parseDesignAspectRatio(
    input.aspectRatio,
    defaultAspectForFormat(input.format),
  );
  const { data, error } = await supabase
    .from("design_templates")
    .insert({
      client_id: input.clientId,
      name: input.name.trim() || fileTitleFallback(input.file.name),
      format: input.format,
      aspect_ratio: aspectRatio,
      file_url: uploaded.fileUrl,
      storage_path: uploaded.storagePath,
      mime_type: uploaded.mimeType,
      file_size: uploaded.fileSize,
      created_by: userId,
      ...(input.backgroundUrl?.trim()
        ? { background_url: input.backgroundUrl.trim() }
        : {}),
      ...(input.layout != null ? { layout: input.layout as TablesInsert<"design_templates">["layout"] } : {}),
    } satisfies TablesInsert<"design_templates">)
    .select("*")
    .single();

  if (error) {
    await supabase.storage.from(LIBRARY_BUCKET).remove([uploaded.storagePath]);
    throw new Error(error.message);
  }
  return ensureData(data, error);
}

function fileTitleFallback(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "") || fileName;
}

/** Persiste projeto em camadas (fundo limpo + textos) num template da biblioteca. */
export async function updateDesignTemplateProject(
  templateId: string,
  input: { backgroundUrl: string; layout: unknown },
): Promise<DesignTemplate> {
  const backgroundUrl = input.backgroundUrl.trim();
  if (!backgroundUrl) throw new Error("Informe o fundo do template.");
  const { data, error } = await supabase
    .from("design_templates")
    .update({
      background_url: backgroundUrl,
      layout: input.layout as TablesUpdate<"design_templates">["layout"],
    })
    .eq("id", templateId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return ensureData(data, error);
}

export async function deleteDesignTemplate(templateId: string): Promise<void> {
  const { data: row, error: fetchError } = await supabase
    .from("design_templates")
    .select("id, storage_path")
    .eq("id", templateId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Template não encontrado");

  const { error } = await supabase.from("design_templates").delete().eq("id", templateId);
  if (error) throw new Error(error.message);

  if (row.storage_path) {
    await supabase.storage.from(LIBRARY_BUCKET).remove([row.storage_path]);
  }
}

// —— Dashboard ——

export async function listRecentActivity(limit = 10) {
  const { data, error } = await supabase
    .from("activity_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function canAccessClient(clientId: string) {
  const { data, error } = await supabase.rpc("can_access_client", { _client_id: clientId });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function canManageClient(clientId: string) {
  const { data, error } = await supabase.rpc("can_manage_client", { _client_id: clientId });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function isAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) throw new Error(error.message);
  return Boolean(data);
}

/** User was provisioned as gestor/admin, has active plan/team seat, or linked to a client. */
export async function hasPlatformAccess(): Promise<boolean> {
  if (await isAdmin()) return true;

  // Active manual/Stripe subscription (gestor) — even with 0 clients yet.
  const { data: plan, error: planError } = await supabase.rpc("active_subscription_plan");
  if (planError) throw new Error(planError.message);
  if (plan) return true;

  // Team collaborator under a plan owner (or owner resolved via membership).
  const { data: ownerId, error: ownerError } = await supabase.rpc("get_team_owner_id");
  if (ownerError) throw new Error(ownerError.message);
  if (ownerId) return true;

  // Client platform login linked to at least one project.
  const projects = await listAccessibleProjects();
  return projects.length > 0;
}

export type SubscriptionPlanKey = "solo" | "studio" | "agency";

/** Starts Stripe Checkout for a monthly subscription plan. */
export async function startSubscriptionCheckout(
  plan: SubscriptionPlanKey,
  customerEmail?: string,
): Promise<void> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const { data, error } = await supabase.functions.invoke("create-checkout-session", {
    body: {
      plan,
      customerEmail: customerEmail?.trim() || undefined,
      successUrl: `${origin}/assinatura/sucesso`,
      cancelUrl: `${origin}/assinatura/cancelada`,
    },
  });

  const payload = data as { url?: string; error?: string } | null;
  if (payload?.error) throw new Error(payload.error);
  if (error) throw new Error(error.message);
  if (!payload?.url) throw new Error("Não foi possível iniciar o checkout.");

  window.location.assign(payload.url);
}

export async function changeSubscriptionPlan(plan: SubscriptionPlanKey): Promise<void> {
  const { data, error } = await supabase.functions.invoke("update-subscription-plan", {
    body: { plan },
  });
  const payload = data as { plan?: string; error?: string } | null;
  if (payload?.error) throw new Error(payload.error);
  if (error) throw new Error(error.message);
}

export async function openBillingPortal(returnPath = "/profile/assinatura"): Promise<void> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const { data, error } = await supabase.functions.invoke("create-billing-portal-session", {
    body: { returnUrl: `${origin}${returnPath}` },
  });
  const payload = data as { url?: string; error?: string } | null;
  if (payload?.error) throw new Error(payload.error);
  if (error) throw new Error(error.message);
  if (!payload?.url) throw new Error("Não foi possível abrir o portal de cobrança.");
  window.location.assign(payload.url);
}

export type CheckoutSessionStatus = "ready" | "pending" | "failed" | "invalid";

export async function getCheckoutSessionStatus(
  sessionId: string,
): Promise<{ status: CheckoutSessionStatus; email?: string }> {
  const { data, error } = await supabase.functions.invoke("checkout-session-status", {
    body: { sessionId },
  });
  const payload = data as { status?: CheckoutSessionStatus; email?: string; error?: string } | null;
  if (payload?.error) throw new Error(payload.error);
  if (error) throw new Error(error.message);
  const status = payload?.status;
  if (status !== "ready" && status !== "pending" && status !== "failed" && status !== "invalid") {
    return { status: "pending" };
  }
  return { status, email: payload?.email };
}

export type ContactLeadIntent = "trial" | "human";

export type ContactLeadNiche = "agency" | "social_media" | "brand_owner";

export type ContactLead = {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  whatsapp: string;
  intent: ContactLeadIntent;
  niche: ContactLeadNiche;
  locale: string | null;
  source: string;
};

export async function submitContactLead(input: {
  name: string;
  email: string;
  whatsapp: string;
  intent: ContactLeadIntent;
  niche: ContactLeadNiche;
  locale?: string;
}): Promise<void> {
  const { data, error } = await supabase.functions.invoke("submit-contact-lead", {
    body: {
      name: input.name.trim(),
      email: input.email.trim(),
      whatsapp: input.whatsapp.replace(/\D/g, ""),
      intent: input.intent,
      niche: input.niche,
      locale: input.locale,
      source: "landing",
    },
  });

  const payload = data as { ok?: boolean; error?: string } | null;
  if (payload?.error) throw new Error(payload.error);
  if (error) throw new Error(error.message);
  if (!payload?.ok) throw new Error("Não foi possível salvar o contato.");
}

export async function listContactLeads(): Promise<ContactLead[]> {
  const { data, error } = await supabase
    .from("contact_leads")
    .select("id, created_at, name, email, whatsapp, intent, niche, locale, source")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    name: row.name,
    email: row.email,
    whatsapp: row.whatsapp,
    intent: row.intent as ContactLeadIntent,
    niche: row.niche as ContactLeadNiche,
    locale: row.locale,
    source: row.source,
  }));
}

export type HelpRequestKind = "gestor_platform" | "client_gestor";

export type HelpRequest = {
  id: string;
  createdAt: string;
  kind: HelpRequestKind;
  message: string;
  senderEmail: string;
  senderUserId: string;
  senderName: string | null;
  clientId: string | null;
  clientName: string | null;
  attachmentFileName: string | null;
  hasAttachment: boolean;
};

async function readHelpFunctionInvokeError(
  data: unknown,
  error: { message: string; name?: string; context?: unknown } | null,
): Promise<string | null> {
  if (data && typeof data === "object" && data !== null && "error" in data) {
    const msg = String((data as { error?: unknown }).error ?? "").trim();
    if (msg) return msg;
  }
  if (!error) return null;

  const ctx = error.context as {
    clone?: () => Response;
    json?: () => Promise<unknown>;
    text?: () => Promise<string>;
  } | null;

  if (ctx) {
    try {
      const response = typeof ctx.clone === "function" ? ctx.clone() : null;
      const body = response
        ? await response.json().catch(async () => {
            const text = await (typeof ctx.clone === "function" ? ctx.clone().text() : ctx.text?.());
            return text ? { error: text } : null;
          })
        : await ctx.json?.();
      if (body && typeof body === "object" && "error" in body) {
        const msg = String((body as { error?: unknown }).error ?? "").trim();
        if (msg) return msg;
      }
    } catch {
      // ignore parse failures
    }
  }

  if (/non-2xx|FunctionsHttpError|FunctionsRelayError|FunctionsFetchError/i.test(
    `${error.name ?? ""} ${error.message}`,
  )) {
    return "Não foi possível enviar o pedido. Verifique se a migration de ajuda foi aplicada no Cloud e se a função submit-help-request está publicada.";
  }
  return error.message;
}

export async function submitHelpRequest(input: {
  message: string;
  clientId?: string;
  locale?: string;
  attachment?: { fileName: string; contentType: string; base64: string };
}): Promise<void> {
  const { data, error } = await supabase.functions.invoke("submit-help-request", {
    body: {
      message: input.message.trim(),
      clientId: input.clientId,
      locale: input.locale,
      attachment: input.attachment,
    },
  });

  const payload = data as { ok?: boolean; error?: string } | null;
  if (payload?.ok) return;

  const invokeError = await readHelpFunctionInvokeError(payload, error);
  if (invokeError) throw new Error(invokeError);
  throw new Error("Não foi possível enviar o pedido de ajuda.");
}

export async function getHelpRequestAttachmentUrl(requestId: string): Promise<{
  url: string;
  fileName: string;
}> {
  const { data, error } = await supabase.functions.invoke("help-request-attachment", {
    body: { requestId },
  });
  const payload = data as { url?: string; fileName?: string; error?: string } | null;
  if (payload?.url) {
    return { url: payload.url, fileName: payload.fileName ?? "anexo" };
  }
  const invokeError = await readHelpFunctionInvokeError(payload, error);
  if (invokeError) throw new Error(invokeError);
  throw new Error("Não foi possível abrir o anexo.");
}

export async function listReceivedHelpRequests(options?: {
  kind?: HelpRequestKind;
}): Promise<HelpRequest[]> {
  let query = supabase
    .from("help_requests")
    .select(
      `
      id,
      created_at,
      kind,
      message,
      sender_email,
      sender_user_id,
      client_id,
      attachment_file_name,
      attachment_storage_path,
      clients ( name, i18n )
    `,
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (options?.kind) {
    query = query.eq("kind", options.kind);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => {
    const client = row.clients as { name: string; i18n: unknown } | null;
    return {
      id: row.id,
      createdAt: row.created_at,
      kind: row.kind as HelpRequestKind,
      message: row.message,
      senderEmail: row.sender_email,
      senderUserId: row.sender_user_id,
      senderName: null,
      clientId: row.client_id,
      clientName: client?.name ?? null,
      attachmentFileName: row.attachment_file_name,
      hasAttachment: Boolean(row.attachment_storage_path),
    };
  });
}

export type { DashboardBusinessStats } from "@/lib/dashboard-metrics";

/** Platform business metrics for admin master dashboard. */
export async function getDashboardBusinessStats() {
  const { computeDashboardBusinessStats } = await import("@/lib/dashboard-metrics");

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);
  const sinceIso = sixMonthsAgo.toISOString();

  const [assinantes, subscriptionsResult, leadsResult] = await Promise.all([
    listAssinantes(),
    supabase.from("subscriptions").select("created_at").gte("created_at", sinceIso),
    supabase
      .from("contact_leads" as "subscriptions")
      .select("created_at")
      .gte("created_at", sinceIso),
  ]);

  if (subscriptionsResult.error) throw new Error(subscriptionsResult.error.message);
  if (leadsResult.error) throw new Error(leadsResult.error.message);

  return computeDashboardBusinessStats({
    assinantes: assinantes.map((a) => ({
      isMaster: a.isMaster,
      isActive: a.isActive,
      plan: a.plan,
      clientCount: a.clientCount,
    })),
    subscriptionCreatedAts: (subscriptionsResult.data ?? []).map((r) => r.created_at),
    leadCreatedAts: (leadsResult.data ?? []).map((r) => r.created_at),
  });
}

export type ClientHomeProject = {
  clientId: string;
  clientName: string;
  clientLogoUrl: string | null;
  projectId: string;
  projectName: string;
};

export type ClientHomeTarget =
  | { type: "project"; clientId: string; projectId: string }
  | { type: "picker"; projects: ClientHomeProject[] }
  | { type: "empty" };

export async function listAccessibleProjects(): Promise<ClientHomeProject[]> {
  const clients = await listClients();
  const projects: ClientHomeProject[] = [];
  for (const client of clients) {
    for (const project of client.projects) {
      projects.push({
        clientId: client.id,
        clientName: client.name,
        clientLogoUrl: client.logo_url,
        projectId: project.id,
        projectName: project.name,
      });
    }
  }
  return projects;
}

export async function getClientHomeTarget(): Promise<ClientHomeTarget> {
  const projects = await listAccessibleProjects();
  if (projects.length === 0) return { type: "empty" };
  if (projects.length === 1) {
    return {
      type: "project",
      clientId: projects[0].clientId,
      projectId: projects[0].projectId,
    };
  }
  return { type: "picker", projects };
}

/** Path after login: admins go to dashboard; clients to their project feed or picker. */
export async function resolvePostLoginPath(): Promise<
  | { to: "/dashboard" }
  | { to: "/home" }
  | {
      to: "/clients/$clientId/projects/$projectId/feed";
      params: { clientId: string; projectId: string };
      search: { access?: string };
    }
> {
  if (await isAdmin()) return { to: "/dashboard" };
  const target = await getClientHomeTarget();
  if (target.type === "project") {
    return {
      to: "/clients/$clientId/projects/$projectId/feed",
      params: { clientId: target.clientId, projectId: target.projectId },
      search: {},
    };
  }
  return { to: "/home" };
}

/** Client: bump version updating title/format/theme/copy/roteiro; keep media/status. */
export async function saveClientContentVersion(input: {
  contentId: string;
  clientId: string;
  projectId: string;
  caption: string;
  cta: string;
  hashtags: string;
  title?: string;
  format?: ContentFormat;
  /** `null` or `""` clears theme; omit to leave unchanged. */
  theme?: string | null;
  /** Omit to leave unchanged. */
  locucao?: string;
  /** Omit to leave unchanged. */
  roteiro?: string;
  changeNote?: string;
  i18n?: RowI18n;
}): Promise<ContentItem> {
  const { data, error } = await supabase.rpc("save_client_content_version", {
    _content_id: input.contentId,
    _caption: input.caption ?? null,
    _cta: input.cta ?? null,
    _hashtags: input.hashtags ?? null,
    _change_note: input.changeNote?.trim() || null,
    _title: input.title ?? null,
    _format: input.format ?? null,
    _theme: input.theme !== undefined ? (input.theme?.trim() ?? "") : null,
    _locucao: input.locucao ?? null,
    _roteiro: input.roteiro ?? null,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Resposta vazia do servidor");

  if (input.i18n) {
    const { data: withI18n, error: i18nError } = await supabase
      .from("content_items")
      .update({ i18n: toI18nJson(input.i18n) })
      .eq("id", input.contentId)
      .select("*")
      .maybeSingle();
    if (!i18nError && withI18n) return withI18n as ContentItem;
  }

  return data as ContentItem;
}
