import { supabase } from "@/integrations/supabase/client";
import type { Database, Json, Tables, TablesInsert } from "@/integrations/supabase/types";
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
import type { RowI18n } from "@/lib/i18n-content";
import {
  ensureFieldsTranslated,
  getCanonicalText,
  parseRowI18n,
} from "@/lib/i18n-content";

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
export type ContentItem = Tables<"content_items">;
export type ContentVersion = Tables<"content_versions">;
export type ContentComment = Tables<"content_comments">;
export type LibraryAsset = Tables<"library_assets">;
export type DesignTemplate = Tables<"design_templates">;
export type DesignTemplateFormat = Database["public"]["Enums"]["design_template_format"];
export type ActivityEvent = Tables<"activity_events">;
export type Profile = Tables<"profiles">;
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
    tabs: ["prototype", "briefing", "prompt", "schedule", "library", "settings"],
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
export const CLIENT_LOGOS_BUCKET = "client-logos";
export const COMMENT_AUDIO_BUCKET = "comment-audio";

export const CLIENT_LOGO_ACCEPT = ".jpg,.jpeg,.png,.gif,.webp,.svg,image/jpeg,image/png,image/gif,image/webp,image/svg+xml";

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

/** Thumbnail dedicada; se ausente e a mídia for vídeo, usa frame inicial (#t=0.1). */
export function resolveContentThumbnail(item: {
  thumbnail_url?: string | null;
  media_url?: string | null;
  media_urls?: string[] | null;
}): string | null {
  const dedicated = item.thumbnail_url?.trim();
  if (dedicated) return dedicated;
  const media = resolveContentMediaUrls(item)[0];
  if (!media) return null;
  if (isVideoUrl(media)) return `${media}#t=0.1`;
  return media;
}

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-()+ ]+/g, "_").replace(/\s+/g, "-").slice(0, 120);
}

export async function uploadContentMedia(projectId: string, file: File) {
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
      .select("name, notes, email, phone, whatsapp, instagram")
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
  return /\.(mp4|webm|mov|avi)(\?|$)/i.test(url) || url.includes("video/");
}

export function isImageUrl(url: string) {
  return /\.(jpe?g|png|gif|webp|svg|heic|heif)(\?|$)/i.test(url) || /\/image\//i.test(url);
}

async function requireUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Não autenticado");
  return data.user.id;
}

async function logActivity(input: {
  type: ActivityType;
  summary: string;
  clientId?: string | null;
  projectId?: string | null;
  contentId?: string | null;
  i18n?: RowI18n;
}) {
  const actorId = await requireUserId();
  let i18n = input.i18n;
  if (!i18n) {
    try {
      i18n = await ensureFieldsTranslated({}, { summary: input.summary });
    } catch {
      i18n = undefined;
    }
  }
  await supabase.from("activity_events").insert({
    type: input.type,
    summary: input.summary,
    client_id: input.clientId ?? null,
    project_id: input.projectId ?? null,
    content_id: input.contentId ?? null,
    actor_id: actorId,
    ...(i18n ? { i18n: toI18nJson(i18n) } : {}),
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
  i18n?: unknown;
};

export type ClientWithProjects = Client & {
  projects: ClientProjectSummary[];
  last_update_at: string | null;
  /** Latest activity from a non-admin actor (approval, changes, comment, version). */
  client_updates_at: string | null;
};

const CLIENT_UPDATE_ACTIVITY_TYPES: ActivityType[] = [
  "approved",
  "changes_requested",
  "comment_added",
  "version_created",
];

async function fetchLatestClientUpdatesByClient(): Promise<Map<string, string>> {
  const [adminsRes, eventsRes] = await Promise.all([
    supabase.from("user_roles").select("user_id").eq("role", "admin"),
    supabase
      .from("activity_events")
      .select("client_id, actor_id, created_at")
      .in("type", CLIENT_UPDATE_ACTIVITY_TYPES)
      .not("client_id", "is", null)
      .not("actor_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  if (adminsRes.error) throw new Error(adminsRes.error.message);
  if (eventsRes.error) throw new Error(eventsRes.error.message);

  const adminIds = new Set((adminsRes.data ?? []).map((row) => row.user_id));
  const latest = new Map<string, string>();

  for (const event of eventsRes.data ?? []) {
    if (!event.client_id || !event.actor_id) continue;
    if (adminIds.has(event.actor_id)) continue;
    if (latest.has(event.client_id)) continue;
    latest.set(event.client_id, event.created_at);
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
        updated_at,
        content_items ( updated_at )
      )
    `,
    )
    .order("name", { ascending: true });

  if (entitlements.isTeamOwner || entitlements.isMaster) {
    clientsQuery = clientsQuery.eq("created_by", user.id);
  }

  const [clientsRes, clientUpdates] = await Promise.all([
    clientsQuery,
    fetchLatestClientUpdatesByClient(),
  ]);

  if (clientsRes.error) throw new Error(clientsRes.error.message);
  const data = clientsRes.data ?? [];
  const libraryDatesByClient = await fetchLibraryAssetDatesByClient(
    data.map((client) => client.id),
  );

  return data.map((client) => {
    const libraryAssetDates = libraryDatesByClient.get(client.id) ?? [];

    const projects: ClientProjectSummary[] = (client.projects ?? []).map(
      (project: {
        id: string;
        name: string;
        updated_at: string;
        i18n?: unknown;
        content_items?: Array<{ updated_at: string }> | null;
      }) => {
        const last_update_at =
          maxIsoDate([
            project.updated_at,
            ...(project.content_items ?? []).map((item) => item.updated_at),
            ...libraryAssetDates,
          ]) ?? project.updated_at;
        return {
          id: project.id,
          name: project.name,
          i18n: project.i18n,
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

export type BrandFonts = {
  primary?: string;
  secondary?: string;
  notes?: string;
};

export type ClientContactInput = {
  name: string;
  notes?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  instagram?: string;
  /** Public URL; empty string or null clears the logo on update. */
  logo_url?: string | null;
  brand_colors?: BrandColor[];
  brand_fonts?: BrandFonts;
  i18n?: RowI18n;
};

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
    .slice(0, 6);
}

export function parseBrandFonts(value: unknown): BrandFonts {
  if (!value || typeof value !== "object") return {};
  const row = value as { primary?: unknown; secondary?: unknown; notes?: unknown };
  return {
    primary: typeof row.primary === "string" ? row.primary : "",
    secondary: typeof row.secondary === "string" ? row.secondary : "",
    notes: typeof row.notes === "string" ? row.notes : "",
  };
}

export function brandKitFromClient(client: {
  brand_colors?: unknown;
  brand_fonts?: unknown;
}): { brand_colors: BrandColor[]; brand_fonts: BrandFonts } {
  return {
    brand_colors: parseBrandColors(client.brand_colors),
    brand_fonts: parseBrandFonts(client.brand_fonts),
  };
}

function normalizeOptionalText(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function createClient(input: ClientContactInput): Promise<Client> {
  const userId = await requireUserId();

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
    logo_url: normalizeOptionalText(input.logo_url ?? undefined),
    ...(input.i18n ? { i18n: toI18nJson(i18n) } : {}),
    created_by: userId,
  });
  if (insertError) throw new Error(insertError.message);

  const { data, error } = await supabase.from("clients").select("*").eq("id", id).single();
  const row = ensureData(data, error);
  await logActivity({
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
  };

  let { data, error } = await supabase.rpc(
    "update_client_contact",
    withBrandArgs as Database["public"]["Functions"]["update_client_contact"]["Args"],
  );

  // Remote may still be on an older RPC signature without brand kit / logo.
  if (error && /Could not find the function|PGRST202/i.test(error.message)) {
    ({ data, error } = await supabase.rpc(
      "update_client_contact",
      withLogoArgs as Database["public"]["Functions"]["update_client_contact"]["Args"],
    ));

    if (error && /Could not find the function|PGRST202/i.test(error.message)) {
      ({ data, error } = await supabase.rpc(
        "update_client_contact",
        baseArgs as Database["public"]["Functions"]["update_client_contact"]["Args"],
      ));
    }

    if (!error) {
      const patch: {
        logo_url?: string | null;
        brand_colors?: Json;
        brand_fonts?: Json;
      } = {};
      if (brandColors !== null) patch.brand_colors = brandColors as unknown as Json;
      if (brandFonts !== null) patch.brand_fonts = brandFonts as unknown as Json;
      if (input.logo_url !== undefined) {
        patch.logo_url = normalizeOptionalText(input.logo_url ?? undefined);
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
  fullName?: string;
  whatsapp?: string;
  plan?: import("./plan-entitlements").AssignablePlan;
}) {
  const { provisionGestorAccessFn } = await import("./provision-gestor-access.functions");
  return provisionGestorAccessFn({
    data: {
      email: input.email,
      password: input.password,
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

export async function getMyEntitlements() {
  const { getMyEntitlementsFn } = await import("./provision-gestor-access.functions");
  return getMyEntitlementsFn();
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
    .select("id, full_name, whatsapp")
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
  };
}

export async function updateMyProfile(input: {
  fullName: string;
  whatsapp: string;
}): Promise<MyProfile> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message);
  if (!user) throw new Error("Não autenticado.");

  const fullName = input.fullName.trim();
  const whatsapp = input.whatsapp.replace(/\D/g, "") || null;

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    full_name: fullName || null,
    whatsapp,
  });
  if (error) throw new Error(error.message);

  if (fullName) {
    await supabase.auth.updateUser({
      data: { full_name: fullName },
    });
  }

  return getMyProfile();
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
  const i18n = await ensureFieldsTranslated(input.i18n, {
    name: input.name,
    description: input.description,
  });
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
  await logActivity({
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

function isMissingSortOrderColumn(message: string) {
  return /sort_order/i.test(message) && /column|schema cache|does not exist/i.test(message);
}

export async function listContent(projectId: string) {
  const ordered = await supabase
    .from("content_items")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (!ordered.error) return ordered.data ?? [];

  // Migration `content_sort_order` may not be applied yet on the remote DB.
  // Fall back so the calendar/list don't look "empty" when the query fails.
  if (isMissingSortOrderColumn(ordered.error.message)) {
    const fallback = await supabase
      .from("content_items")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    if (fallback.error) throw new Error(fallback.error.message);
    return fallback.data ?? [];
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
  items: Array<{ id: string; sort_order: number }>,
): Promise<void> {
  const results = await Promise.all(
    items.map(({ id, sort_order }) =>
      supabase.from("content_items").update({ sort_order }).eq("id", id),
    ),
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
  mediaUrl?: string;
  format?: ContentFormat;
  materialType?: string | null;
  widthCm?: number | null;
  heightCm?: number | null;
  productionNotes?: string;
  i18n?: RowI18n;
}): Promise<ContentItem> {
  const userId = await requireUserId();
  const sortOrder = await nextContentSortOrder(input.projectId);
  let calendarBlockId: string | null = null;
  try {
    const blocks = await listCalendarBlocks(input.projectId);
    calendarBlockId = blocks[0]?.id ?? null;
  } catch {
    calendarBlockId = null;
  }
  let format = input.format;
  if (!format) {
    try {
      const project = await getProject(input.projectId);
      format = defaultContentFormatForProject(project?.categories);
    } catch {
      format = "static_feed";
    }
  }
  const i18n = await ensureFieldsTranslated(input.i18n, {
    title: input.title,
    caption: input.caption,
    cta: input.cta,
    hashtags: input.hashtags,
  });
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
    i18n: toI18nJson(i18n),
    created_by: userId,
    status: "draft" as const,
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
  const row = ensureData(data, error);
  await logActivity({
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
    thumbnail_url: source.thumbnail_url ?? null,
    format: source.format,
    material_type: source.material_type,
    width_cm: source.width_cm,
    height_cm: source.height_cm,
    production_notes: source.production_notes ?? "",
    theme: source.theme,
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
    await logActivity({
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
  const { error } = await supabase.from("content_items").delete().eq("id", input.contentId);
  if (error) throw new Error(error.message);
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
}): Promise<ContentItem> {
  const userId = await requireUserId();
  const current = await getContent(input.contentId);
  if (!current) throw new Error("Conteúdo não encontrado");

  const nextVersion = current.current_version + 1;
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

  const { data, error } = await supabase
    .from("content_items")
    .update({
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
      current_version: nextVersion,
      status: nextStatus,
      i18n: toI18nJson(nextI18n),
    })
    .eq("id", input.contentId)
    .select("*")
    .single();
  const row = ensureData(data, error);

  const versionInsert = await supabase.from("content_versions").insert({
    content_id: input.contentId,
    version_number: nextVersion,
    caption: input.caption,
    cta: input.cta,
    hashtags: input.hashtags,
    locucao,
    roteiro,
    media_url: mediaUrl,
    media_urls: mediaUrls,
    thumbnail_url: thumbnailUrl,
    format,
    material_type: materialType,
    width_cm: widthCm,
    height_cm: heightCm,
    production_notes: productionNotes,
    change_note: input.changeNote?.trim() || `Versão ${nextVersion}`,
    created_by: userId,
    i18n: toI18nJson(nextI18n),
  });
  if (versionInsert.error) throw new Error(versionInsert.error.message);

  await logActivity({
    type: "version_created",
    summary: `${row.title} — v${nextVersion}`,
    clientId: input.clientId,
    projectId: input.projectId,
    contentId: input.contentId,
  });

  return row;
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
  materialType?: string | null;
  widthCm?: number | null;
  heightCm?: number | null;
  productionNotes?: string;
  i18n?: RowI18n;
}): Promise<ContentItem> {
  const mediaUrls =
    input.mediaUrls?.filter((url) => url.trim()) ??
    (input.mediaUrl?.trim() ? [input.mediaUrl.trim()] : []);
  const mediaUrl = mediaUrls[0] ?? null;

  const { data, error } = await supabase
    .from("content_items")
    .update({
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
      ...(input.materialType !== undefined
        ? { material_type: input.materialType?.trim() || null }
        : {}),
      ...(input.widthCm !== undefined ? { width_cm: input.widthCm } : {}),
      ...(input.heightCm !== undefined ? { height_cm: input.heightCm } : {}),
      ...(input.productionNotes !== undefined
        ? { production_notes: input.productionNotes }
        : {}),
      ...(input.i18n ? { i18n: toI18nJson(input.i18n) } : {}),
    })
    .eq("id", input.contentId)
    .select("*")
    .single();
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
      .is("calendar_block_id", null);
    if (!unassigned.error && (unassigned.data?.length ?? 0) > 0) {
      const targetId = existing[existing.length - 1]?.id;
      if (targetId) {
        await supabase
          .from("content_items")
          .update({ calendar_block_id: targetId })
          .eq("project_id", projectId)
          .is("calendar_block_id", null);
      }
    }

    const content = await listContent(projectId);
    const untitled = existing.filter((block) => !block.title.trim());
    if (untitled.length > 0) {
      await Promise.all(
        untitled.map((block) => {
          const items = content.filter((item) => item.calendar_block_id === block.id);
          const title = suggestCalendarBlockTitle(items);
          return supabase.from("calendar_blocks").update({ title }).eq("id", block.id);
        }),
      );
      return listCalendarBlocks(projectId);
    }

    return existing;
  }

  const content = await listContent(projectId);
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

  const { error: linkError } = await supabase
    .from("content_items")
    .update({ calendar_block_id: block.id })
    .eq("project_id", projectId)
    .is("calendar_block_id", null);
  if (linkError && !isMissingCalendarBlockIdColumn(linkError.message)) {
    throw new Error(linkError.message);
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
    .filter((item) => item.calendar_block_id === source.id)
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
    })
    .select("*")
    .single();
  const newBlock = ensureData(blockData, blockError);

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

  await logActivity({
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

  const { error: contentError } = await supabase
    .from("content_items")
    .delete()
    .eq("project_id", input.projectId)
    .eq("calendar_block_id", input.blockId);
  if (contentError) throw new Error(contentError.message);

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

  await logActivity({
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

  await logActivity({
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

  await logActivity({
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
    await logActivity({
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

export type ContentSuggestion = {
  title: string;
  caption: string;
  cta: string;
  hashtags: string;
  theme: string | null;
  locucao: string;
  roteiro: string;
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
      const body = (await response.clone().json()) as { error?: string; message?: string };
      if (body?.error) return body.error;
      if (body?.message) return body.message;
    } catch {
      // ignore parse failures and fall through
    }
  }

  return error?.message || "Falha ao gerar sugestão";
}

export async function suggestContent(input: {
  contentId: string;
  projectId: string;
  clientId: string;
  prompt: string;
  references?: string;
  youtubeUrls?: string[];
  instagramUrls?: string[];
  transcription?: string;
  format: ContentFormat;
  locale?: string;
}): Promise<ContentSuggestion> {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("Informe um prompt");

  const { data, error } = await supabase.functions.invoke("suggest-content", {
    body: {
      contentId: input.contentId,
      projectId: input.projectId,
      clientId: input.clientId,
      prompt,
      references: input.references?.trim() || undefined,
      youtubeUrls: (input.youtubeUrls ?? []).map((u) => u.trim()).filter(Boolean),
      instagramUrls: (input.instagramUrls ?? []).map((u) => u.trim()).filter(Boolean),
      transcription: input.transcription?.trim() || undefined,
      format: input.format,
      locale: input.locale,
    },
  });

  const payload = data as { suggestion?: ContentSuggestion; error?: string } | null;

  if (error) {
    throw new Error(await readFunctionsInvokeError(error, data));
  }
  if (payload?.error) {
    throw new Error(payload.error);
  }
  if (!payload?.suggestion) {
    throw new Error("Resposta inválida do assistente");
  }

  return {
    title: payload.suggestion.title?.trim() || "",
    caption: payload.suggestion.caption ?? "",
    cta: payload.suggestion.cta ?? "",
    hashtags: payload.suggestion.hashtags ?? "",
    theme: payload.suggestion.theme?.trim() || null,
    locucao: payload.suggestion.locucao ?? "",
    roteiro: payload.suggestion.roteiro ?? "",
  };
}

export type DesignProvider = "openai" | "gemini";

export type DesignGenerationResult = {
  imageUrl: string;
  provider?: DesignProvider;
};

export async function generateDesign(input: {
  contentId: string;
  projectId: string;
  clientId: string;
  format: DesignTemplateFormat;
  provider?: DesignProvider;
  templateUrl: string;
  photoUrl: string;
  overlayText: string;
  secondaryText?: string;
  guidance?: string;
}): Promise<DesignGenerationResult> {
  const overlayText = input.overlayText.trim();
  const secondaryText = input.secondaryText?.trim() || "";
  const templateUrl = input.templateUrl.trim();
  const photoUrl = input.photoUrl.trim();
  const provider = input.provider === "gemini" ? "gemini" : "openai";
  if (!templateUrl) throw new Error("Informe o template de referência");
  if (!photoUrl) throw new Error("Informe a imagem da arte");
  if (!overlayText) throw new Error("Informe o texto da arte");

  const { data, error } = await supabase.functions.invoke("generate-design", {
    body: {
      contentId: input.contentId,
      projectId: input.projectId,
      clientId: input.clientId,
      format: input.format,
      provider,
      templateUrl,
      photoUrl,
      overlayText,
      secondaryText: secondaryText || undefined,
      guidance: input.guidance?.trim() || undefined,
    },
  });

  const payload = data as { imageUrl?: string; provider?: DesignProvider; error?: string } | null;
  if (error) {
    throw new Error(await readFunctionsInvokeError(error, data));
  }
  if (payload?.error) {
    throw new Error(payload.error);
  }
  if (!payload?.imageUrl) {
    throw new Error("Resposta inválida do assistente de design");
  }

  return { imageUrl: payload.imageUrl, provider: payload.provider ?? provider };
}

// —— Admin AI credentials ——

export type AdminAiKeysStatus = {
  openaiConfigured: boolean;
  geminiConfigured: boolean;
  openaiLast4: string | null;
  geminiLast4: string | null;
  updatedAt?: string | null;
  openaiHelpUrl: string;
  geminiHelpUrl: string;
  platformFallbackOpenAI?: boolean;
  platformFallbackGemini?: boolean;
};

type ManageAdminAiKeysResponse = {
  error?: string;
  openai?: { configured?: boolean; last4?: string | null };
  gemini?: { configured?: boolean; last4?: string | null };
  platformFallback?: { openai?: boolean; gemini?: boolean };
  updatedAt?: string | null;
  // legacy flat shape (older local contract)
  openaiConfigured?: boolean;
  geminiConfigured?: boolean;
  openaiLast4?: string | null;
  geminiLast4?: string | null;
  openaiHelpUrl?: string;
  geminiHelpUrl?: string;
};

function mapAdminAiKeysStatus(payload: ManageAdminAiKeysResponse): AdminAiKeysStatus {
  return {
    openaiConfigured: Boolean(payload.openai?.configured ?? payload.openaiConfigured),
    geminiConfigured: Boolean(payload.gemini?.configured ?? payload.geminiConfigured),
    openaiLast4: payload.openai?.last4 ?? payload.openaiLast4 ?? null,
    geminiLast4: payload.gemini?.last4 ?? payload.geminiLast4 ?? null,
    updatedAt: payload.updatedAt ?? null,
    openaiHelpUrl: payload.openaiHelpUrl || "https://platform.openai.com/api-keys",
    geminiHelpUrl: payload.geminiHelpUrl || "https://aistudio.google.com/apikey",
    platformFallbackOpenAI: Boolean(payload.platformFallback?.openai),
    platformFallbackGemini: Boolean(payload.platformFallback?.gemini),
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
  clearOpenAI?: boolean;
  clearGemini?: boolean;
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
  await logActivity({
    type: "comment_added",
    summary: `Comentário em ${input.contentTitle}`,
    clientId: input.clientId,
    projectId: input.projectId,
    contentId: input.contentId,
  });
  return row;
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
  if (await isAdmin()) {
    const entitlements = await getMyEntitlements();
    if (!entitlements.isMaster && !entitlements.brandBriefing) {
      throw new Error("Brand briefing disponível a partir do plano Studio.");
    }
  }

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

async function uploadLibraryFile(clientId: string, file: File) {
  const safeName = sanitizeFileName(file.name || "arquivo");
  const storagePath = `${clientId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(LIBRARY_BUCKET).upload(storagePath, file, {
    cacheControl: "3600",
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw new Error(error.message);

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
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  if (created.length === 0 && errors.length > 0) {
    throw new Error(errors[0]);
  }

  if (errors.length > 0) {
    throw new Error(
      `${created.length} enviado(s), ${errors.length} falhou(aram): ${errors[0]}`,
    );
  }

  return created;
}

export const DESIGN_TEMPLATE_ACCEPT = ".jpg,.jpeg,.png,image/jpeg,image/png";
export const DESIGN_TEMPLATE_FORMATS: DesignTemplateFormat[] = ["static_feed", "carousel"];
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
  file: File;
}): Promise<DesignTemplate> {
  const userId = await requireUserId();
  const uploaded = await uploadDesignTemplateFile(input.clientId, input.file);
  const { data, error } = await supabase
    .from("design_templates")
    .insert({
      client_id: input.clientId,
      name: input.name.trim() || fileTitleFallback(input.file.name),
      format: input.format,
      file_url: uploaded.fileUrl,
      storage_path: uploaded.storagePath,
      mime_type: uploaded.mimeType,
      file_size: uploaded.fileSize,
      created_by: userId,
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
  if (payload?.error) throw new Error(payload.error);
  if (error) throw new Error(error.message);
  if (!payload?.ok) throw new Error("Não foi possível enviar o pedido de ajuda.");
}

export async function getHelpRequestAttachmentUrl(requestId: string): Promise<{
  url: string;
  fileName: string;
}> {
  const { data, error } = await supabase.functions.invoke("help-request-attachment", {
    body: { requestId },
  });
  const payload = data as { url?: string; fileName?: string; error?: string } | null;
  if (payload?.error) throw new Error(payload.error);
  if (error) throw new Error(error.message);
  if (!payload?.url) throw new Error("Não foi possível abrir o anexo.");
  return { url: payload.url, fileName: payload.fileName ?? "anexo" };
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

/** Client: bump version updating title/format/theme/copy; keep media/status. */
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
  changeNote?: string;
  i18n?: RowI18n;
}): Promise<ContentItem> {
  const { data, error } = await supabase.rpc("save_client_content_version", {
    _content_id: input.contentId,
    _caption: input.caption,
    _cta: input.cta,
    _hashtags: input.hashtags,
    _change_note: input.changeNote?.trim() || undefined,
    ...(input.title !== undefined ? { _title: input.title } : {}),
    ...(input.format !== undefined ? { _format: input.format } : {}),
    ...(input.theme !== undefined ? { _theme: input.theme?.trim() ?? "" } : {}),
    ...(input.locucao !== undefined ? { _locucao: input.locucao } : {}),
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
