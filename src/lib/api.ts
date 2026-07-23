import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables, TablesInsert } from "@/integrations/supabase/types";
import type { ContentStatus } from "@/components/status-badge";

export type Client = Tables<"clients">;
export type Project = Tables<"projects">;
export type ContentItem = Tables<"content_items">;
export type ContentVersion = Tables<"content_versions">;
export type ContentComment = Tables<"content_comments">;
export type LibraryAsset = Tables<"library_assets">;
export type ActivityEvent = Tables<"activity_events">;
export type Profile = Tables<"profiles">;
export type ActivityType = Database["public"]["Enums"]["activity_type"];
export type LibraryCategory = Database["public"]["Enums"]["library_category"];
export type ContentFormat = Database["public"]["Enums"]["content_format"];

export const CONTENT_FORMATS: ContentFormat[] = [
  "static_feed",
  "reels",
  "stories",
  "carousel",
];

export const CONTENT_MEDIA_BUCKET = "content-media";

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
}) {
  const actorId = await requireUserId();
  await supabase.from("activity_events").insert({
    type: input.type,
    summary: input.summary,
    client_id: input.clientId ?? null,
    project_id: input.projectId ?? null,
    content_id: input.contentId ?? null,
    actor_id: actorId,
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
};

export type ClientWithProjects = Client & {
  projects: ClientProjectSummary[];
  last_update_at: string | null;
};

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

/** Deep link to pending approvals; `access` lets the client claim membership after auth. */
export function buildProjectReviewUrl(clientId: string, projectId: string, accessToken: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const params = new URLSearchParams({
    filter: "review",
    access: accessToken,
  });
  return `${origin}/clients/${clientId}/projects/${projectId}/content?${params.toString()}`;
}

/** Join the client workspace using the invite token from the review link. */
export async function claimClientAccess(accessToken: string): Promise<string> {
  const { data, error } = await supabase.rpc("claim_client_access", {
    _access_token: accessToken,
  });
  return ensureData(data, error);
}

export async function listClients(): Promise<ClientWithProjects[]> {
  const { data, error } = await supabase
    .from("clients")
    .select(
      `
      *,
      projects (
        id,
        name,
        updated_at,
        content_items ( updated_at ),
        library_assets ( created_at )
      )
    `,
    )
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);

  return (data ?? []).map((client) => {
    const projects: ClientProjectSummary[] = (client.projects ?? []).map(
      (project: {
        id: string;
        name: string;
        updated_at: string;
        content_items?: Array<{ updated_at: string }> | null;
        library_assets?: Array<{ created_at: string }> | null;
      }) => {
        const last_update_at =
          maxIsoDate([
            project.updated_at,
            ...(project.content_items ?? []).map((item) => item.updated_at),
            ...(project.library_assets ?? []).map((asset) => asset.created_at),
          ]) ?? project.updated_at;
        return {
          id: project.id,
          name: project.name,
          updated_at: project.updated_at,
          last_update_at,
        };
      },
    );

    const last_update_at = maxIsoDate([
      client.updated_at,
      ...projects.map((project) => project.last_update_at),
    ]);

    const { projects: _projects, ...rest } = client;
    return {
      ...(rest as Client),
      projects,
      last_update_at,
    };
  });
}

export async function getClient(clientId: string) {
  const { data, error } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export type ClientContactInput = {
  name: string;
  notes?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  instagram?: string;
};

function normalizeOptionalText(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function createClient(input: ClientContactInput): Promise<Client> {
  const userId = await requireUserId();
  // Avoid insert().select(): RETURNING hits SELECT RLS before membership exists.
  const id = crypto.randomUUID();
  const { error: insertError } = await supabase.from("clients").insert({
    id,
    name: input.name.trim(),
    notes: normalizeOptionalText(input.notes),
    email: normalizeOptionalText(input.email),
    phone: normalizeOptionalText(input.phone),
    whatsapp: normalizeOptionalText(input.whatsapp),
    instagram: normalizeOptionalText(input.instagram),
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
  const { data, error } = await supabase.rpc("update_client_contact", {
    _client_id: clientId,
    _name: input.name.trim(),
    _notes: normalizeOptionalText(input.notes),
    _email: normalizeOptionalText(input.email),
    _phone: normalizeOptionalText(input.phone),
    _whatsapp: normalizeOptionalText(input.whatsapp),
    _instagram: normalizeOptionalText(input.instagram),
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Resposta vazia do servidor");
  return data as Client;
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
}): Promise<Project> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      client_id: input.clientId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
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
    ctaPresets?: string[];
    hashtagPresets?: string[];
    themePresets?: string[];
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
      description: input.description?.trim() || null,
      ...(input.status ? { status: input.status } : {}),
      ...(input.ctaPresets !== undefined
        ? { cta_presets: normalizePresets(input.ctaPresets) ?? [] }
        : {}),
      ...(input.hashtagPresets !== undefined
        ? { hashtag_presets: normalizePresets(input.hashtagPresets) ?? [] }
        : {}),
      ...(input.themePresets !== undefined
        ? { theme_presets: normalizePresets(input.themePresets) ?? [] }
        : {}),
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

export async function listContent(projectId: string) {
  const { data, error } = await supabase
    .from("content_items")
    .select("*")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
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
}): Promise<ContentItem> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("content_items")
    .insert({
      project_id: input.projectId,
      title: input.title.trim(),
      caption: input.caption?.trim() || "",
      cta: input.cta?.trim() || "",
      hashtags: input.hashtags?.trim() || "",
      media_url: input.mediaUrl?.trim() || null,
      created_by: userId,
      status: "draft",
    })
    .select("*")
    .single();
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

/** Copia um conteúdo do calendário para o próximo período (+7 dias se houver data). */
export async function duplicateContent(input: {
  contentId: string;
  clientId: string;
  projectId: string;
  /** Dias a avançar na data agendada (padrão: 7). */
  advanceDays?: number;
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

  const { data, error } = await supabase
    .from("content_items")
    .insert({
      project_id: input.projectId,
      title: source.title,
      caption: source.caption,
      cta: source.cta,
      hashtags: source.hashtags,
      media_url: mediaUrls[0] ?? null,
      media_urls: mediaUrls,
      format: source.format,
      theme: source.theme,
      scheduled_at: scheduledAt,
      created_by: userId,
      status: "draft",
      current_version: 1,
    })
    .select("*")
    .single();
  const row = ensureData(data, error);
  await logActivity({
    type: "content_created",
    summary: `Conteúdo duplicado: ${row.title}`,
    clientId: input.clientId,
    projectId: input.projectId,
    contentId: row.id,
  });
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
  mediaUrl?: string | null;
  mediaUrls?: string[];
  format?: ContentFormat;
  changeNote?: string;
}): Promise<ContentItem> {
  const userId = await requireUserId();
  const current = await getContent(input.contentId);
  if (!current) throw new Error("Conteúdo não encontrado");

  const nextVersion = current.current_version + 1;
  const nextStatus =
    current.status === "approved" || current.status === "published" || current.status === "review"
      ? "draft"
      : current.status;

  const mediaUrls =
    input.mediaUrls?.filter((url) => url.trim()) ??
    (input.mediaUrl?.trim() ? [input.mediaUrl.trim()] : []);
  const mediaUrl = mediaUrls[0] ?? null;
  const format = input.format ?? current.format ?? "static_feed";

  const { data, error } = await supabase
    .from("content_items")
    .update({
      title: input.title.trim(),
      caption: input.caption,
      cta: input.cta,
      hashtags: input.hashtags,
      media_url: mediaUrl,
      media_urls: mediaUrls,
      format,
      current_version: nextVersion,
      status: nextStatus,
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
    media_url: mediaUrl,
    media_urls: mediaUrls,
    format,
    change_note: input.changeNote?.trim() || `Versão ${nextVersion}`,
    created_by: userId,
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
  mediaUrl?: string | null;
  mediaUrls?: string[];
  format?: ContentFormat;
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
      media_url: mediaUrl,
      media_urls: mediaUrls,
      ...(input.format ? { format: input.format } : {}),
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
}): Promise<ContentItem> {
  const patch: {
    scheduled_at?: string | null;
    theme?: string | null;
    format?: ContentFormat;
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

export async function setContentStatus(input: {
  contentId: string;
  clientId: string;
  projectId: string;
  status: ContentStatus;
  title: string;
}): Promise<ContentItem> {
  const activityMap: Partial<Record<ContentStatus, ActivityType>> = {
    review: "submitted_for_review",
    approved: "approved",
    changes: "changes_requested",
    published: "published",
  };

  const summaryMap: Partial<Record<ContentStatus, string>> = {
    review: `Enviado para revisão: ${input.title}`,
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
  projects: Pick<Project, "id" | "name" | "client_id"> & {
    clients: Pick<Client, "id" | "name">;
  };
};

export async function listPendingApprovals(): Promise<PendingApproval[]> {
  const { data, error } = await supabase
    .from("content_items")
    .select("*, projects!inner(id, name, client_id, clients!inner(id, name))")
    .eq("status", "review")
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
    mediaUrl: input.version.media_url,
    mediaUrls: resolveContentMediaUrls(input.version),
    format: input.version.format,
    changeNote: `Restaurado da v${input.version.version_number}`,
  });
}

// —— Comments ——

export type CommentWithAuthor = ContentComment & {
  profiles: Pick<Profile, "full_name" | "avatar_url"> | null;
};

export async function listComments(contentId: string): Promise<CommentWithAuthor[]> {
  const { data, error } = await supabase
    .from("content_comments")
    .select("*, profiles(full_name, avatar_url)")
    .eq("content_id", contentId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as CommentWithAuthor[];
}

export async function addComment(input: {
  contentId: string;
  clientId: string;
  projectId: string;
  body: string;
  contentTitle: string;
}): Promise<ContentComment> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("content_comments")
    .insert({
      content_id: input.contentId,
      user_id: userId,
      body: input.body.trim(),
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

export async function listLibraryAssets(projectId: string) {
  const { data, error } = await supabase
    .from("library_assets")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function uploadLibraryFile(projectId: string, file: File) {
  const safeName = sanitizeFileName(file.name || "arquivo");
  const storagePath = `${projectId}/${crypto.randomUUID()}-${safeName}`;
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
  projectId: string;
  name: string;
  category: LibraryCategory;
  fileUrl?: string;
  file?: File | null;
  notes?: string;
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
    uploaded = await uploadLibraryFile(input.projectId, input.file);
  }

  const { data, error } = await supabase
    .from("library_assets")
    .insert({
      project_id: input.projectId,
      name: input.name.trim(),
      category: input.category,
      file_url: uploaded?.fileUrl ?? (input.fileUrl?.trim() || null),
      storage_path: uploaded?.storagePath ?? null,
      file_name: uploaded?.fileName ?? null,
      file_size: uploaded?.fileSize ?? null,
      mime_type: uploaded?.mimeType ?? null,
      notes: input.notes?.trim() || null,
      created_by: userId,
    } satisfies TablesInsert<"library_assets">)
    .select("*")
    .single();

  if (error && uploaded) {
    await supabase.storage.from(LIBRARY_BUCKET).remove([uploaded.storagePath]);
  }

  return ensureData(data, error);
}

export async function createLibraryAssets(
  inputs: Array<{
    projectId: string;
    name: string;
    category: LibraryCategory;
    fileUrl?: string;
    file?: File | null;
    notes?: string;
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

export type ClientHomeProject = {
  clientId: string;
  clientName: string;
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

/** Path after login: admins go to dashboard; clients to their project or picker. */
export async function resolvePostLoginPath(): Promise<
  | { to: "/dashboard" }
  | { to: "/home" }
  | {
      to: "/clients/$clientId/projects/$projectId/content";
      params: { clientId: string; projectId: string };
      search: { filter?: "review"; access?: string };
    }
> {
  if (await isAdmin()) return { to: "/dashboard" };
  const target = await getClientHomeTarget();
  if (target.type === "project") {
    return {
      to: "/clients/$clientId/projects/$projectId/content",
      params: { clientId: target.clientId, projectId: target.projectId },
      search: {},
    };
  }
  return { to: "/home" };
}

/** Client-only: bump version updating caption/cta/hashtags, keep media/format/status. */
export async function saveClientContentVersion(input: {
  contentId: string;
  clientId: string;
  projectId: string;
  caption: string;
  cta: string;
  hashtags: string;
  changeNote?: string;
}): Promise<ContentItem> {
  const { data, error } = await supabase.rpc("save_client_content_version", {
    _content_id: input.contentId,
    _caption: input.caption,
    _cta: input.cta,
    _hashtags: input.hashtags,
    _change_note: input.changeNote?.trim() || null,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Resposta vazia do servidor");
  return data as ContentItem;
}
