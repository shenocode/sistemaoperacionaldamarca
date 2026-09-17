import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

const DEFAULT_SITE_URL = "https://som-sistemaoperacionaldamarca.netlify.app";
const RESEND_URL = "https://api.resend.com/emails";

const DIGEST_TYPES = new Set([
  "approved",
  "changes_requested",
  "comment_added",
  "version_created",
]);

type DigestEvent = {
  event_id: string;
  client_id: string;
  client_name: string | null;
  project_id: string | null;
  project_name: string | null;
  content_id: string | null;
  content_title: string | null;
  event_type: string;
  created_at: string;
};

type GestorEmail = {
  user_id: string;
  email: string;
  full_name: string | null;
};

type ContentBucket = {
  contentId: string | null;
  title: string;
};

type ProjectDigest = {
  projectId: string | null;
  projectName: string;
  approved: ContentBucket[];
  changes: ContentBucket[];
  comments: ContentBucket[];
  edits: ContentBucket[];
};

type ClientDigest = {
  clientId: string;
  clientName: string;
  eventIds: string[];
  projects: ProjectDigest[];
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function authorized(req: Request): boolean {
  const secret = (Deno.env.get("DIGEST_CRON_SECRET") ?? "").trim();
  if (!secret) return false;
  const header = (req.headers.get("x-digest-secret") ?? "").trim();
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  return header === secret || bearer === secret;
}

function siteUrl() {
  return (Deno.env.get("SITE_URL") ?? DEFAULT_SITE_URL).replace(/\/+$/, "");
}

function calendarUrl(clientId: string, projectId: string) {
  return `${siteUrl()}/clients/${clientId}/projects/${projectId}/calendar`;
}

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

function addUnique(list: ContentBucket[], item: ContentBucket) {
  const key = item.contentId ?? item.title;
  if (list.some((row) => (row.contentId ?? row.title) === key)) return;
  list.push(item);
}

function buildDigests(events: DigestEvent[]): ClientDigest[] {
  const byClient = new Map<string, DigestEvent[]>();
  for (const event of events) {
    if (!event.client_id || !DIGEST_TYPES.has(event.event_type)) continue;
    const list = byClient.get(event.client_id) ?? [];
    list.push(event);
    byClient.set(event.client_id, list);
  }

  const digests: ClientDigest[] = [];
  for (const [clientId, list] of byClient) {
    const clientName = list[0]?.client_name?.trim() || "Cliente";
    const byProject = new Map<string, DigestEvent[]>();
    for (const event of list) {
      const key = event.project_id ?? "_none";
      const rows = byProject.get(key) ?? [];
      rows.push(event);
      byProject.set(key, rows);
    }

    const projects: ProjectDigest[] = [];
    for (const [projectKey, projectEvents] of byProject) {
      const projectName = projectEvents[0]?.project_name?.trim() || "Projeto";
      const byContent = new Map<string, DigestEvent[]>();
      for (const event of projectEvents) {
        const key = event.content_id ?? event.event_id;
        const rows = byContent.get(key) ?? [];
        rows.push(event);
        byContent.set(key, rows);
      }

      const project: ProjectDigest = {
        projectId: projectKey === "_none" ? null : projectKey,
        projectName,
        approved: [],
        changes: [],
        comments: [],
        edits: [],
      };

      for (const contentEvents of byContent.values()) {
        const first = contentEvents[0];
        const item: ContentBucket = {
          contentId: first.content_id,
          title: first.content_title?.trim() || "Ativo",
        };
        const types = new Set(contentEvents.map((row) => row.event_type));
        if (types.has("approved")) addUnique(project.approved, item);
        if (types.has("changes_requested")) addUnique(project.changes, item);
        else if (types.has("comment_added")) addUnique(project.comments, item);
        if (types.has("version_created")) addUnique(project.edits, item);
      }

      projects.push(project);
    }

    digests.push({
      clientId,
      clientName,
      eventIds: list.map((row) => row.event_id),
      projects,
    });
  }

  return digests;
}

function countActions(digest: ClientDigest) {
  return digest.projects.reduce(
    (sum, project) =>
      sum +
      project.approved.length +
      project.changes.length +
      project.comments.length +
      project.edits.length,
    0,
  );
}

function listHtml(title: string, items: ContentBucket[]) {
  if (items.length === 0) return "";
  const rows = items
    .map((item) => `<li style="margin:0 0 6px;">${escapeHtml(item.title)}</li>`)
    .join("");
  return `
    <p style="margin:16px 0 8px;font-size:13px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.04em;">
      ${escapeHtml(title)}
    </p>
    <ul style="margin:0;padding:0 0 0 18px;color:#111827;font-size:15px;line-height:1.45;">
      ${rows}
    </ul>`;
}

function digestHtml(digest: ClientDigest) {
  const total = countActions(digest);
  const projectBlocks = digest.projects
    .map((project) => {
      const showProject = digest.projects.length > 1;
      const heading = showProject
        ? `<p style="margin:20px 0 0;font-size:16px;font-weight:700;color:#111827;">${escapeHtml(project.projectName)}</p>`
        : "";
      const button =
        project.projectId
          ? `<p style="margin:20px 0 0;">
              <a href="${calendarUrl(digest.clientId, project.projectId)}"
                 style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-size:14px;font-weight:600;">
                Abrir calendário
              </a>
            </p>`
          : "";
      return `
        ${heading}
        ${listHtml("Aprovados", project.approved)}
        ${listHtml("Pediram mudança", project.changes)}
        ${listHtml("Comentários", project.comments)}
        ${listHtml("Texto ou roteiro editado", project.edits)}
        ${button}`;
    })
    .join("");

  return `<!doctype html>
<html>
  <body style="margin:0;background:#f3f4f6;padding:24px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr>
        <td style="background:#111827;color:#ffffff;padding:20px 24px;">
          <p style="margin:0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.8;">SOM</p>
          <p style="margin:8px 0 0;font-size:20px;font-weight:700;">Alterações da cliente</p>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <p style="margin:0;font-size:16px;color:#111827;">
            <strong>${escapeHtml(digest.clientName)}</strong> fez
            ${total} ${plural(total, "alteração", "alterações")} nos ativos.
          </p>
          ${projectBlocks}
          <p style="margin:28px 0 0;font-size:12px;line-height:1.5;color:#6b7280;">
            Este é um resumo a cada 30 minutos. Se a cliente não mexer em nada, você não recebe e-mail.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function digestSubject(digest: ClientDigest) {
  const total = countActions(digest);
  const parts: string[] = [];
  const approved = digest.projects.reduce((n, p) => n + p.approved.length, 0);
  const changes = digest.projects.reduce((n, p) => n + p.changes.length, 0);
  const comments = digest.projects.reduce((n, p) => n + p.comments.length, 0);
  const edits = digest.projects.reduce((n, p) => n + p.edits.length, 0);
  if (approved) parts.push(`${approved} ${plural(approved, "aprovado", "aprovados")}`);
  if (changes) parts.push(`${changes} ${plural(changes, "pedido de mudança", "pedidos de mudança")}`);
  if (comments) parts.push(`${comments} ${plural(comments, "comentário", "comentários")}`);
  if (edits) parts.push(`${edits} ${plural(edits, "edição", "edições")}`);
  const detail = parts.join(", ");
  return `${digest.clientName} — ${total} ${plural(total, "alteração", "alterações")} da cliente (${detail})`;
}

function digestText(digest: ClientDigest) {
  const lines = [
    `${digest.clientName} fez ${countActions(digest)} ${plural(countActions(digest), "alteração", "alterações")} nos ativos.`,
    "",
  ];
  for (const project of digest.projects) {
    if (digest.projects.length > 1) lines.push(project.projectName);
    const pushList = (label: string, items: ContentBucket[]) => {
      if (!items.length) return;
      lines.push(`${label}:`);
      for (const item of items) lines.push(`- ${item.title}`);
      lines.push("");
    };
    pushList("Aprovados", project.approved);
    pushList("Pediram mudança", project.changes);
    pushList("Comentários", project.comments);
    pushList("Texto ou roteiro editado", project.edits);
    if (project.projectId) {
      lines.push(calendarUrl(digest.clientId, project.projectId));
      lines.push("");
    }
  }
  return lines.join("\n");
}

async function sendResendEmail(input: {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
}) {
  const response = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof body?.message === "string"
        ? body.message
        : `Falha ao enviar e-mail (${response.status})`;
    throw new Error(message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }
  if (!authorized(req)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = (Deno.env.get("RESEND_API_KEY") ?? "").trim();
  const from = (Deno.env.get("RESEND_FROM") ?? "").trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Supabase não configurado" }, 500);
  }
  if (!resendKey || !from) {
    return jsonResponse({
      error: "Configure RESEND_API_KEY e RESEND_FROM nos secrets das Edge Functions.",
    }, 500);
  }

  try {
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: events, error: eventsError } = await admin.rpc(
      "list_pending_gestor_activity_digest",
    );
    if (eventsError) throw new Error(eventsError.message);

    const pending = (events ?? []) as DigestEvent[];
    const digests = buildDigests(pending);
    if (digests.length === 0) {
      return jsonResponse({ ok: true, sent: 0, skipped: 0 });
    }

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const digest of digests) {
      if (countActions(digest) === 0) {
        skipped += 1;
        continue;
      }

      const { data: gestores, error: gestoresError } = await admin.rpc(
        "list_client_gestor_emails",
        { _client_id: digest.clientId },
      );
      if (gestoresError) {
        errors.push(`${digest.clientName}: ${gestoresError.message}`);
        continue;
      }

      const to = Array.from(
        new Set(
          ((gestores ?? []) as GestorEmail[])
            .map((row) => row.email.trim().toLowerCase())
            .filter((email) => email.includes("@")),
        ),
      );
      if (to.length === 0) {
        skipped += 1;
        errors.push(`${digest.clientName}: gestor sem e-mail`);
        continue;
      }

      try {
        await sendResendEmail({
          apiKey: resendKey,
          from,
          to,
          subject: digestSubject(digest),
          html: digestHtml(digest),
          text: digestText(digest),
        });
        const { error: markError } = await admin.rpc("mark_gestor_activity_digest_sent", {
          _event_ids: digest.eventIds,
        });
        if (markError) throw new Error(markError.message);
        sent += 1;
      } catch (err) {
        errors.push(
          `${digest.clientName}: ${err instanceof Error ? err.message : "falha no envio"}`,
        );
      }
    }

    return jsonResponse({
      ok: errors.length === 0,
      sent,
      skipped,
      errors: errors.length ? errors : undefined,
    });
  } catch (err) {
    return jsonResponse({
      error: err instanceof Error ? err.message : "Falha no digest",
    }, 500);
  }
});
