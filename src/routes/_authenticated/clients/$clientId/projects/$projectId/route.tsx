import { useEffect, useRef } from "react";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  canManageClient,
  ensureFieldsTranslated,
  ensurePresetListTranslated,
  getCanonicalText,
  getClient,
  getLocalizedField,
  getLocalizedText,
  getProject,
  localizedFieldNeedsTranslation,
  normalizeAppLocale,
  parseRowI18n,
  presetListNeedsLocaleBackfill,
  projectCategoryConfig,
  updateClient,
  updateProject,
  type ProjectTabId,
} from "@/lib/api";
import { useAppRole } from "@/hooks/use-app-role";
import { useEntitlements } from "@/hooks/use-entitlements";
import { useI18nBackfill } from "@/hooks/use-i18n-backfill";

export const Route = createFileRoute("/_authenticated/clients/$clientId/projects/$projectId")({
  head: () => ({ meta: [{ title: "Projeto — SOM" }, { name: "robots", content: "noindex" }] }),
  component: ProjectLayout,
});

const TAB_PATHS: Record<
  ProjectTabId,
  | "/clients/$clientId/projects/$projectId/feed"
  | "/clients/$clientId/projects/$projectId/themes"
  | "/clients/$clientId/projects/$projectId/calendar"
  | "/clients/$clientId/projects/$projectId/content"
  | "/clients/$clientId/projects/$projectId/meeting"
  | "/clients/$clientId/projects/$projectId/library"
  | "/clients/$clientId/projects/$projectId/settings"
  | "/clients/$clientId/projects/$projectId/prototype"
  | "/clients/$clientId/projects/$projectId/briefing"
  | "/clients/$clientId/projects/$projectId/prompt"
  | "/clients/$clientId/projects/$projectId/schedule"
> = {
  feed: "/clients/$clientId/projects/$projectId/feed",
  themes: "/clients/$clientId/projects/$projectId/themes",
  calendar: "/clients/$clientId/projects/$projectId/calendar",
  content: "/clients/$clientId/projects/$projectId/content",
  meeting: "/clients/$clientId/projects/$projectId/meeting",
  library: "/clients/$clientId/projects/$projectId/library",
  settings: "/clients/$clientId/projects/$projectId/settings",
  prototype: "/clients/$clientId/projects/$projectId/prototype",
  briefing: "/clients/$clientId/projects/$projectId/briefing",
  prompt: "/clients/$clientId/projects/$projectId/prompt",
  schedule: "/clients/$clientId/projects/$projectId/schedule",
};

function ProjectLayout() {
  const { clientId, projectId } = Route.useParams();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { isAdmin, isClient } = useAppRole();
  const { entitlements } = useEntitlements();
  const uiLocale = normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language);
  const backfillKeyRef = useRef<string | null>(null);

  const projectQuery = useQuery({
    queryKey: ["projects", "detail", projectId],
    queryFn: () => getProject(projectId),
  });

  const clientQuery = useQuery({
    queryKey: ["clients", clientId],
    queryFn: () => getClient(clientId),
  });

  const manageQuery = useQuery({
    queryKey: ["can-manage", clientId],
    queryFn: () => canManageClient(clientId),
  });

  const categoryConfig = projectCategoryConfig(projectQuery.data?.categories);
  const project = projectQuery.data;
  const client = clientQuery.data;
  const projectI18n = parseRowI18n(project?.i18n);
  const clientI18n = parseRowI18n(client?.i18n);
  const displayProjectName = project
    ? getLocalizedText(projectI18n, "name", project.name, uiLocale)
    : t("common.loading");
  const displayProjectDescription = project
    ? getLocalizedText(projectI18n, "description", project.description ?? "", uiLocale)
    : "";
  const displayClientName = client
    ? getLocalizedText(clientI18n, "name", client.name, uiLocale)
    : t("project.back");

  // Backfill missing locale translations for name/description so switching
  // language shows localized content (not only the canonical Portuguese column).
  useEffect(() => {
    if (!project || !manageQuery.data) return;

    const currentI18n = parseRowI18n(project.i18n);
    const nameNeeds = localizedFieldNeedsTranslation(
      getLocalizedField(currentI18n, "name"),
      uiLocale,
    );
    const descriptionNeeds =
      Boolean(project.description?.trim()) &&
      localizedFieldNeedsTranslation(getLocalizedField(currentI18n, "description"), uiLocale);
    const ctaNeeds = presetListNeedsLocaleBackfill(
      currentI18n,
      "cta_presets",
      project.cta_presets ?? [],
      uiLocale,
    );
    const hashtagNeeds = presetListNeedsLocaleBackfill(
      currentI18n,
      "hashtag_presets",
      project.hashtag_presets ?? [],
      uiLocale,
    );
    const themeNeeds = presetListNeedsLocaleBackfill(
      currentI18n,
      "theme_presets",
      project.theme_presets ?? [],
      uiLocale,
    );

    if (!nameNeeds && !descriptionNeeds && !ctaNeeds && !hashtagNeeds && !themeNeeds) return;

    const key = `${project.id}:${uiLocale}:${project.updated_at}`;
    if (backfillKeyRef.current === key) return;
    backfillKeyRef.current = key;

    let cancelled = false;
    void (async () => {
      try {
        let nextI18n = await ensureFieldsTranslated(currentI18n, {
          name: project.name,
          description: project.description,
        });
        if (ctaNeeds) {
          nextI18n = (await ensurePresetListTranslated(nextI18n, "cta_presets", project.cta_presets ?? [])).i18n;
        }
        if (hashtagNeeds) {
          nextI18n = (
            await ensurePresetListTranslated(nextI18n, "hashtag_presets", project.hashtag_presets ?? [])
          ).i18n;
        }
        if (themeNeeds) {
          nextI18n = (
            await ensurePresetListTranslated(nextI18n, "theme_presets", project.theme_presets ?? [])
          ).i18n;
        }
        if (cancelled) return;
        if (JSON.stringify(nextI18n) === JSON.stringify(currentI18n)) return;

        const nameImproved =
          nameNeeds &&
          !localizedFieldNeedsTranslation(getLocalizedField(nextI18n, "name"), uiLocale);
        const descriptionImproved =
          descriptionNeeds &&
          !localizedFieldNeedsTranslation(getLocalizedField(nextI18n, "description"), uiLocale);
        const presetsImproved =
          (ctaNeeds &&
            !presetListNeedsLocaleBackfill(nextI18n, "cta_presets", project.cta_presets ?? [], uiLocale)) ||
          (hashtagNeeds &&
            !presetListNeedsLocaleBackfill(
              nextI18n,
              "hashtag_presets",
              project.hashtag_presets ?? [],
              uiLocale,
            )) ||
          (themeNeeds &&
            !presetListNeedsLocaleBackfill(nextI18n, "theme_presets", project.theme_presets ?? [], uiLocale));

        // Avoid rewrite/invalidate loops when AI translation is unavailable.
        if (!nameImproved && !descriptionImproved && !presetsImproved) return;

        await updateProject(projectId, {
          name: getCanonicalText(nextI18n, "name", project.name),
          description: getCanonicalText(nextI18n, "description", project.description ?? ""),
          i18n: nextI18n,
        });
        if (cancelled) return;
        void queryClient.invalidateQueries({ queryKey: ["projects"] });
      } catch {
        // Keep canonical fallback if AI translation is unavailable.
        backfillKeyRef.current = null;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [manageQuery.data, project, projectId, queryClient, uiLocale]);

  useI18nBackfill({
    enabled: Boolean(client) && Boolean(manageQuery.data),
    entityKey: client ? `client:${client.id}:${client.updated_at}` : "client:none",
    locale: uiLocale,
    i18n: client?.i18n,
    fields: {
      name: client?.name,
      notes: client?.notes,
    },
    onPersist: async (nextI18n) => {
      if (!client) return;
      await updateClient(clientId, {
        name: getCanonicalText(nextI18n, "name", client.name),
        notes: getCanonicalText(nextI18n, "notes", client.notes ?? "") || undefined,
        email: client.email ?? undefined,
        phone: client.phone ?? undefined,
        whatsapp: client.whatsapp ?? undefined,
        instagram: client.instagram ?? undefined,
        i18n: nextI18n,
      });
      void queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  // Clientes veem as mesmas abas do projeto; dashboard e gestão ficam
  // bloqueados por isAdmin / canManageClient (ações de escrita e rotas admin).
  const tabs = categoryConfig.tabs
    .map((tabId) => ({
      id: tabId,
      to: TAB_PATHS[tabId],
      label: t(`project.tabs.${tabId}`),
      requiresLibrary: tabId === "library",
    }))
    .filter((tab) => {
      if (tab.requiresLibrary) {
        return isClient || entitlements.library;
      }
      return true;
    });

  return (
    <div
      className={cn(
        "mx-auto w-full overflow-x-clip px-4 py-6 sm:px-6 sm:py-8 md:p-8",
        isClient ? "max-w-6xl" : "max-w-7xl",
      )}
    >
      {isAdmin ? (
        <Link
          to="/clients/$clientId"
          params={{ clientId }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {displayClientName}
        </Link>
      ) : (
        <Link
          to="/home"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {t("nav.myProjects")}
        </Link>
      )}
      <div className="mt-3 flex items-start gap-3">
        {client?.logo_url ? (
          <img
            src={client.logo_url}
            alt=""
            className="mt-0.5 h-14 w-14 shrink-0 rounded-full object-cover sm:h-20 sm:w-20 md:h-24 md:w-24"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight break-words sm:text-2xl">
            {displayProjectName}
          </h1>
          {displayProjectDescription ? (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground sm:line-clamp-none">
              {displayProjectDescription}
            </p>
          ) : null}
        </div>
      </div>

      {!categoryConfig.experienceReady ? (
        <p className="mt-4 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          {t("project.categoryExperiencePending")}
        </p>
      ) : null}

      <div
        role="tablist"
        className="-mx-4 mt-6 flex gap-1 overflow-x-auto overscroll-x-contain border-b px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            to={tab.to}
            params={{ clientId, projectId }}
            {...(tab.to === "/clients/$clientId/projects/$projectId/content"
              ? { search: {} }
              : {})}
            role="tab"
            className="shrink-0 border-b-2 -mb-px px-3 py-2 text-sm font-medium transition-colors sm:px-4"
            inactiveProps={{
              className: "border-transparent text-muted-foreground hover:text-foreground",
            }}
            activeProps={{ className: "border-primary text-primary" }}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="mt-6 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
