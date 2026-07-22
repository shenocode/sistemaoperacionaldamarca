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

export async function listClients() {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getClient(clientId: string) {
  const { data, error } = await supabase.from("clients").select("*").eq("id", clientId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function createClient(input: { name: string; notes?: string }): Promise<Client> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("clients")
    .insert({ name: input.name.trim(), notes: input.notes?.trim() || null, created_by: userId })
    .select("*")
    .single();
  const row = ensureData(data, error);
  await logActivity({
    type: "client_created",
    summary: `Cliente criado: ${row.name}`,
    clientId: row.id,
  });
  return row;
}

export async function updateClient(
  clientId: string,
  input: { name: string; notes?: string },
): Promise<Client> {
  const { data, error } = await supabase
    .from("clients")
    .update({ name: input.name.trim(), notes: input.notes?.trim() || null })
    .eq("id", clientId)
    .select("*")
    .single();
  return ensureData(data, error);
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
  input: { name: string; description?: string; status?: string },
): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      ...(input.status ? { status: input.status } : {}),
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

export async function saveContentAsNewVersion(input: {
  contentId: string;
  clientId: string;
  projectId: string;
  title: string;
  caption: string;
  cta: string;
  hashtags: string;
  mediaUrl?: string | null;
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

  const { data, error } = await supabase
    .from("content_items")
    .update({
      title: input.title.trim(),
      caption: input.caption,
      cta: input.cta,
      hashtags: input.hashtags,
      media_url: input.mediaUrl?.trim() || null,
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
    media_url: input.mediaUrl?.trim() || null,
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
}): Promise<ContentItem> {
  const { data, error } = await supabase
    .from("content_items")
    .update({
      title: input.title.trim(),
      caption: input.caption,
      cta: input.cta,
      hashtags: input.hashtags,
      media_url: input.mediaUrl?.trim() || null,
    })
    .eq("id", input.contentId)
    .select("*")
    .single();
  return ensureData(data, error);
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

export async function listLibraryAssets(projectId: string) {
  const { data, error } = await supabase
    .from("library_assets")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createLibraryAsset(input: {
  projectId: string;
  name: string;
  category: LibraryCategory;
  fileUrl?: string;
  notes?: string;
}): Promise<LibraryAsset> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("library_assets")
    .insert({
      project_id: input.projectId,
      name: input.name.trim(),
      category: input.category,
      file_url: input.fileUrl?.trim() || null,
      notes: input.notes?.trim() || null,
      created_by: userId,
    } satisfies TablesInsert<"library_assets">)
    .select("*")
    .single();
  return ensureData(data, error);
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
