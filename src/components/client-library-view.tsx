import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Video,
  Link2,
  FileSpreadsheet,
  FileType,
  ClipboardList,
  LayoutTemplate,
  Trash2,
  Download,
  Sparkles,
  ChevronDown,
  ChevronLeft,
  Palette,
} from "lucide-react";
import { toast } from "sonner";
import { BrandKitFields, type BrandKitValue } from "@/components/brand-kit-fields";
import { LocalizedTextInput } from "@/components/localized-text-field";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  DESIGN_ASPECT_RATIOS,
  DESIGN_TEMPLATE_ACCEPT,
  DESIGN_TEMPLATE_FORMATS,
  LIBRARY_ACCEPT,
  LIBRARY_MAX_MB,
  PartialLibraryUploadError,
  brandKitFromClient,
  canManageClient,
  createDesignTemplate,
  createLibraryAsset,
  createLibraryAssets,
  defaultAspectForFormat,
  deleteDesignTemplate,
  deleteLibraryAssets,
  designAspectI18nKey,
  designAspectThumbClass,
  ensureBrandBriefing,
  ensureProjectSite,
  formatLibraryFileSize,
  getClient,
  getPrimaryProjectCategory,
  guessLibraryCategory,
  isLibraryFileTooLarge,
  listDesignTemplates,
  listLibraryAssets,
  listProjects,
  parseDesignAspectRatio,
  updateClient,
  type DesignAspectRatio,
  type DesignTemplateFormat,
  type LibraryAsset,
  type LibraryCategory,
  type Project,
  type ProjectSiteView,
} from "@/lib/api";
import { downloadImageFromUrl, downloadImagesAsZip } from "@/lib/download-image";
import {
  buildLocalizedFieldFromSource,
  getCanonicalText,
  getLocalizedText,
  normalizeAppLocale,
  parseRowI18n,
  setLocalizedField,
  translateTextField,
  type RowI18n,
} from "@/lib/i18n-content";
import { useAppRole } from "@/hooks/use-app-role";
import { useEntitlements } from "@/hooks/use-entitlements";
import { cn } from "@/lib/utils";

const categories = [
  { key: "pdfs" as const, icon: FileText },
  { key: "images" as const, icon: ImageIcon },
  { key: "videos" as const, icon: Video },
  { key: "documents" as const, icon: FileType },
  { key: "spreadsheets" as const, icon: FileSpreadsheet },
  { key: "references" as const, icon: Link2 },
];

type SourceMode = "file" | "url";

type PendingFile = {
  id: string;
  file: File;
  name: string;
  category: LibraryCategory;
};

function fileTitle(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "") || fileName;
}

function localizedAssetName(asset: LibraryAsset, locale: string) {
  return getLocalizedText(asset.i18n, "name", asset.name, locale);
}

export function ClientLibraryView({
  clientId,
  projectId,
  variant = "standalone",
}: {
  clientId: string;
  /** When embedded in a project, scopes the Site briefing card to that project. */
  projectId?: string;
  /** `standalone` = página da marca; `embedded` = aba dentro do projeto (mantém o menu). */
  variant?: "standalone" | "embedded";
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { isClient } = useAppRole();
  const { entitlements, loading: entitlementsLoading } = useEntitlements();
  const libraryAllowed = entitlements.library;
  const embedded = variant === "embedded";
  const uiLocale = normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [rowI18n, setRowI18n] = useState<RowI18n>({});
  const [fileUrl, setFileUrl] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [source, setSource] = useState<SourceMode>("file");
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateFormat, setTemplateFormat] = useState<DesignTemplateFormat>("static_feed");
  const [templateAspect, setTemplateAspect] = useState<DesignAspectRatio>("4:5");
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [selectedGeneratedIds, setSelectedGeneratedIds] = useState<string[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [brandKitOpen, setBrandKitOpen] = useState(false);
  const [openCategories, setOpenCategories] = useState<
    Partial<Record<(typeof categories)[number]["key"], boolean>>
  >({});
  const [generatedOpen, setGeneratedOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [brandKit, setBrandKit] = useState<BrandKitValue>({
    brand_colors: [],
    brand_fonts: {},
    brand_guidance: "",
  });

  const clientQuery = useQuery({
    queryKey: ["clients", clientId],
    queryFn: () => getClient(clientId),
    enabled: libraryAllowed,
  });

  const assetsQuery = useQuery({
    queryKey: ["library", clientId],
    queryFn: () => listLibraryAssets(clientId),
    enabled: libraryAllowed,
  });

  const templatesQuery = useQuery({
    queryKey: ["design-templates", clientId],
    queryFn: () => listDesignTemplates(clientId),
    enabled: libraryAllowed,
  });

  const briefingQuery = useQuery({
    queryKey: ["brand-briefing", clientId],
    queryFn: () => ensureBrandBriefing(clientId),
    enabled: libraryAllowed,
  });

  const projectsQuery = useQuery({
    queryKey: ["projects", clientId],
    queryFn: () => listProjects(clientId),
    enabled: libraryAllowed,
  });

  const siteProjects = useMemo(() => {
    const projects = projectsQuery.data ?? [];
    const sites = projects.filter(
      (project) => getPrimaryProjectCategory(project.categories) === "site",
    );
    if (projectId) {
      return sites.filter((project) => project.id === projectId);
    }
    return sites;
  }, [projectsQuery.data, projectId]);

  const siteBriefingsQuery = useQuery({
    queryKey: ["project-site-library", clientId, siteProjects.map((p) => p.id).join(",")],
    queryFn: async () => {
      const entries: Array<{ project: Project; site: ProjectSiteView }> = [];
      for (const project of siteProjects) {
        const site = await ensureProjectSite(project.id);
        entries.push({ project, site });
      }
      return entries;
    },
    enabled: libraryAllowed && siteProjects.length > 0,
  });

  const manageQuery = useQuery({
    queryKey: ["can-manage", clientId],
    queryFn: () => canManageClient(clientId),
    enabled: libraryAllowed,
  });

  useEffect(() => {
    if (!clientQuery.data) return;
    setBrandKit(brandKitFromClient(clientQuery.data));
  }, [clientQuery.data]);

  const resetForm = () => {
    setName("");
    setRowI18n({});
    setFileUrl("");
    setFiles([]);
    setSource("file");
  };

  const resetTemplateForm = () => {
    setTemplateName("");
    setTemplateFormat("static_feed");
    setTemplateAspect("4:5");
    setTemplateFile(null);
  };

  const saveBrandKitMutation = useMutation({
    mutationFn: async () => {
      const client = clientQuery.data;
      if (!client) throw new Error(t("common.loading"));
      return updateClient(clientId, {
        name: client.name,
        notes: client.notes ?? undefined,
        email: client.email ?? undefined,
        phone: client.phone ?? undefined,
        whatsapp: client.whatsapp ?? undefined,
        instagram: client.instagram ?? undefined,
        website: client.website ?? undefined,
        brand_colors: brandKit.brand_colors,
        brand_fonts: brandKit.brand_fonts,
        brand_guidance: brandKit.brand_guidance,
        i18n: client.i18n as RowI18n | undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients", clientId] });
      toast.success(t("project.library.brandKit.saved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (source === "url") {
        const displayName = name.trim() || fileUrl.trim();
        let nextI18n = rowI18n;
        if (!getCanonicalText(nextI18n, "name", "").trim() && displayName) {
          try {
            const block = await translateTextField({ text: displayName });
            nextI18n = setLocalizedField(nextI18n, "name", block);
          } catch {
            nextI18n = setLocalizedField(
              nextI18n,
              "name",
              buildLocalizedFieldFromSource(displayName, uiLocale),
            );
          }
        }
        return [
          await createLibraryAsset({
            clientId,
            name: getCanonicalText(nextI18n, "name", displayName),
            category: "references",
            fileUrl,
            i18n: nextI18n,
          }),
        ];
      }

      const oversized = files.filter((item) => isLibraryFileTooLarge(item.file));
      const valid = files.filter((item) => !isLibraryFileTooLarge(item.file));
      if (oversized.length > 0) {
        setFiles(valid);
        const tooLargeMessage = t("project.library.fileTooLarge", {
          count: oversized.length,
          names: oversized
            .map((item) => `${item.file.name} (${formatLibraryFileSize(item.file.size)})`)
            .join(", "),
        });
        if (valid.length === 0) {
          throw new Error(tooLargeMessage);
        }
        toast.error(tooLargeMessage);
      }

      return createLibraryAssets(
        await Promise.all(
          valid.map(async (item) => {
            let block;
            try {
              block = await translateTextField({ text: item.name });
            } catch {
              block = buildLocalizedFieldFromSource(item.name, uiLocale);
            }
            const assetI18n = setLocalizedField({}, "name", block);
            return {
              clientId,
              name: getCanonicalText(assetI18n, "name", item.name),
              category: item.category,
              file: item.file,
              i18n: assetI18n,
            };
          }),
        ),
      );
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["library", clientId] });
      setOpen(false);
      resetForm();
      toast.success(
        created.length === 1 ? t("project.library.addedOne") : t("project.library.added"),
      );
    },
    onError: (err: Error) => {
      toast.error(err.message);
      if (err instanceof PartialLibraryUploadError) {
        queryClient.invalidateQueries({ queryKey: ["library", clientId] });
        const uploadedNames = new Set(
          err.created.map((asset) => asset.file_name).filter(Boolean),
        );
        setFiles((prev) => prev.filter((item) => !uploadedNames.has(item.file.name)));
      }
    },
  });

  const createTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!templateFile) throw new Error(t("project.library.templates.file"));
      return createDesignTemplate({
        clientId,
        name: templateName.trim() || fileTitle(templateFile.name),
        format: templateFormat,
        aspectRatio: templateAspect,
        file: templateFile,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["design-templates", clientId] });
      setTemplateOpen(false);
      resetTemplateForm();
      toast.success(t("project.library.templates.added"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (templateId: string) => deleteDesignTemplate(templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["design-templates", clientId] });
      toast.success(t("project.library.templates.deleted"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteGeneratedMutation = useMutation({
    mutationFn: (assetIds: string[]) => deleteLibraryAssets(assetIds),
    onSuccess: (_data, assetIds) => {
      queryClient.invalidateQueries({ queryKey: ["library", clientId] });
      setSelectedGeneratedIds((prev) => prev.filter((id) => !assetIds.includes(id)));
      toast.success(t("project.library.generated.deleted"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteAssetMutation = useMutation({
    mutationFn: (assetIds: string[]) => deleteLibraryAssets(assetIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library", clientId] });
      toast.success(t("project.library.deleted"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const assets = assetsQuery.data ?? [];
  const templates = templatesQuery.data ?? [];

  const generatedArts = useMemo(
    () => assets.filter((asset) => asset.category === "generated_arts"),
    [assets],
  );
  const byCategory = Object.fromEntries(
    categories.map((c) => [
      c.key,
      assets.filter(
        (a) => a.category === c.key || (c.key === "pdfs" && a.category === "brand"),
      ),
    ]),
  ) as Record<(typeof categories)[number]["key"], LibraryAsset[]>;

  const selectedGenerated = generatedArts.filter((asset) =>
    selectedGeneratedIds.includes(asset.id),
  );

  function toggleGeneratedSelection(id: string, checked: boolean) {
    setSelectedGeneratedIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((item) => item !== id);
    });
  }

  function toggleSelectAllGenerated(checked: boolean) {
    setSelectedGeneratedIds(checked ? generatedArts.map((asset) => asset.id) : []);
  }

  function confirmDeleteGenerated(assetIds: string[]) {
    if (assetIds.length === 0) return;
    if (
      !window.confirm(
        t("project.library.generated.deleteConfirm", { count: assetIds.length }),
      )
    ) {
      return;
    }
    deleteGeneratedMutation.mutate(assetIds);
  }

  function confirmDeleteAsset(assetId: string) {
    if (!window.confirm(t("project.library.deleteConfirm"))) return;
    deleteAssetMutation.mutate([assetId]);
  }

  async function downloadGenerated(
    items: LibraryAsset[],
    format: "png" | "jpg",
    asZip: boolean,
  ) {
    const downloadable = items.filter((item) => item.file_url);
    if (downloadable.length === 0) {
      toast.error(t("project.library.generated.downloadEmpty"));
      return;
    }
    setDownloading(true);
    try {
      if (asZip || downloadable.length > 1) {
        await downloadImagesAsZip(
          downloadable.map((item) => ({
            url: item.file_url!,
            name: item.name || item.file_name || "arte",
          })),
          format,
          "artes-geradas",
        );
      } else {
        const item = downloadable[0];
        await downloadImageFromUrl(
          item.file_url!,
          item.name || item.file_name || "arte",
          format,
        );
      }
      toast.success(t("project.library.generated.downloadStarted"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("project.library.generated.downloadError"),
      );
    } finally {
      setDownloading(false);
    }
  }

  const canSubmit =
    source === "file"
      ? files.some((item) => !isLibraryFileTooLarge(item.file))
      : Boolean(fileUrl.trim()) && Boolean(name.trim() || fileUrl.trim());

  const briefing = briefingQuery.data;
  const briefingStatusKey = briefing?.status ?? "draft";

  return (
    <div
      className={cn(
        "space-y-6",
        !embedded && "mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 md:p-8",
      )}
    >
      {!embedded ? (
        <Link
          to="/clients/$clientId"
          params={{ clientId }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {clientQuery.data?.name ?? t("nav.clients")}
        </Link>
      ) : null}

      {embedded ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{t("project.library.sharedHint")}</p>
          {libraryAllowed ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              {manageQuery.data ? (
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setTemplateOpen(true)}
                >
                  <LayoutTemplate className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t("project.library.templates.upload")}
                </Button>
              ) : null}
              <Button className="w-full sm:w-auto" onClick={() => setOpen(true)}>
                <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("project.library.upload")}
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <PageHeader
          title={t("project.tabs.library")}
          description={t("project.library.sharedHint")}
          actions={
            libraryAllowed ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                {manageQuery.data ? (
                  <Button variant="outline" onClick={() => setTemplateOpen(true)}>
                    <LayoutTemplate className="mr-2 h-4 w-4" aria-hidden="true" />
                    {t("project.library.templates.upload")}
                  </Button>
                ) : null}
                <Button onClick={() => setOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t("project.library.upload")}
                </Button>
              </div>
            ) : undefined
          }
        />
      )}

      {entitlementsLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : !libraryAllowed ? (
        <p className="text-sm text-muted-foreground">{t("accessRelease.featureLocked")}</p>
      ) : (
        <>
          <Collapsible open={brandKitOpen} onOpenChange={setBrandKitOpen}>
            <Card className="rounded-xl border-primary/20 bg-primary/5">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className={`flex w-full flex-row items-center gap-3 px-6 pt-6 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-t-xl [&[data-state=open]_svg.brand-kit-chevron]:rotate-180 ${
                    brandKitOpen ? "pb-3" : "pb-6 rounded-b-xl"
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Palette className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-sm font-medium">
                      {t("project.library.brandKit.title")}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {t("project.library.brandKit.hint")}
                    </p>
                  </div>
                  <ChevronDown
                    className="brand-kit-chevron h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
                    aria-hidden="true"
                  />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-6 pt-0">
                  <BrandKitFields
                    showHeader={false}
                    idPrefix="library-brand-kit"
                    value={brandKit}
                    onChange={setBrandKit}
                  />

                  <Separator />

                  <Collapsible open={templatesOpen} onOpenChange={setTemplatesOpen}>
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex w-full flex-row items-center gap-3 rounded-lg text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&[data-state=open]_svg.templates-chevron]:rotate-180"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <LayoutTemplate className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">
                            {t("project.library.templates.title")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("project.library.templates.count", { count: templates.length })}
                          </p>
                        </div>
                        <ChevronDown
                          className="templates-chevron h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
                          aria-hidden="true"
                        />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-3">
                      {templatesQuery.isLoading ? (
                        <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
                      ) : templates.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          {t("project.library.templates.empty")}
                        </p>
                      ) : (
                        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {templates.map((template) => (
                            <li
                              key={template.id}
                              className="flex items-start gap-3 rounded-lg border bg-background p-2"
                            >
                              <img
                                src={template.file_url}
                                alt=""
                                className={cn(
                                  "shrink-0 rounded-md object-cover",
                                  designAspectThumbClass(
                                    parseDesignAspectRatio(
                                      template.aspect_ratio,
                                      defaultAspectForFormat(template.format),
                                    ),
                                  ),
                                )}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium" title={template.name}>
                                  {template.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {t(`project.detail.formats.${template.format}`)}
                                  {" · "}
                                  {t(
                                    `project.library.templates.aspects.${designAspectI18nKey(
                                      parseDesignAspectRatio(
                                        template.aspect_ratio,
                                        defaultAspectForFormat(template.format),
                                      ),
                                    )}`,
                                  )}
                                </p>
                                {manageQuery.data ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="mt-1 h-7 px-2"
                                    disabled={deleteTemplateMutation.isPending}
                                    onClick={() => deleteTemplateMutation.mutate(template.id)}
                                  >
                                    <Trash2 className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                                    {t("project.library.templates.delete")}
                                  </Button>
                                ) : null}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CollapsibleContent>
                  </Collapsible>

                  <Separator />

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-primary" aria-hidden="true" />
                        <p className="text-sm font-medium">
                          {t("project.library.briefing.title")}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {briefingQuery.isLoading
                          ? t("common.loading")
                          : briefing
                            ? t("project.library.briefing.progress", {
                                answered: briefing.answeredCount,
                                total: briefing.totalCount,
                              })
                            : t("project.library.briefing.description")}
                        {" · "}
                        {t(`project.library.briefing.status.${briefingStatusKey}`)}
                      </p>
                    </div>
                    <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
                      <Link to="/clients/$clientId/briefing" params={{ clientId }}>
                        {t("project.library.briefing.open")}
                      </Link>
                    </Button>
                  </div>

                  {(siteBriefingsQuery.data ?? []).map(({ project, site }) => {
                    const statusKey =
                      site.briefing_status === "completed" ||
                      site.briefing_status === "in_progress" ||
                      site.briefing_status === "draft"
                        ? site.briefing_status
                        : "draft";
                    const projectName = getLocalizedText(
                      parseRowI18n(project.i18n),
                      "name",
                      project.name,
                      uiLocale,
                    );
                    return (
                      <div key={project.id}>
                        <Separator className="my-3" />
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <ClipboardList className="h-4 w-4 text-primary" aria-hidden="true" />
                              <p className="text-sm font-medium">
                                {t("project.library.siteBriefing.title")}
                              </p>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {t("project.library.siteBriefing.project", { name: projectName })}
                              {" · "}
                              {t("project.library.siteBriefing.progress", {
                                answered: site.answeredCount,
                                total: site.totalCount,
                              })}
                              {" · "}
                              {t(`project.library.briefing.status.${statusKey}`)}
                            </p>
                          </div>
                          <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
                            <Link
                              to="/clients/$clientId/projects/$projectId/briefing"
                              params={{ clientId, projectId: project.id }}
                            >
                              {t("project.library.siteBriefing.open")}
                            </Link>
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  <Button
                    type="button"
                    size="sm"
                    disabled={saveBrandKitMutation.isPending || clientQuery.isLoading}
                    onClick={() => saveBrandKitMutation.mutate()}
                  >
                    {saveBrandKitMutation.isPending
                      ? t("common.loading")
                      : t("project.library.brandKit.save")}
                  </Button>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {!isClient ? (
            <Collapsible open={generatedOpen} onOpenChange={setGeneratedOpen}>
              <Card className="rounded-xl">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className={`flex w-full flex-row items-center gap-3 px-6 pt-6 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-t-xl [&[data-state=open]_svg.generated-chevron]:rotate-180 ${
                      generatedOpen ? "pb-3" : "pb-6 rounded-b-xl"
                    }`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Sparkles className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-sm font-medium">
                        {t("project.library.generated.title")}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {t("project.library.generated.count", { count: generatedArts.length })}
                      </p>
                    </div>
                    <ChevronDown
                      className="generated-chevron h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
                      aria-hidden="true"
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="space-y-3 pt-0">
                    <p className="text-xs text-muted-foreground">
                      {t("project.library.generated.hint")}
                    </p>

                    {generatedArts.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {t("project.library.generated.empty")}
                      </p>
                    ) : (
                      <>
                        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                          <label className="flex items-center gap-2 text-xs">
                            <Checkbox
                              checked={
                                selectedGeneratedIds.length > 0 &&
                                selectedGeneratedIds.length === generatedArts.length
                              }
                              onCheckedChange={(checked) =>
                                toggleSelectAllGenerated(checked === true)
                              }
                            />
                            {t("project.library.generated.selectAll")}
                          </label>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="w-full sm:w-auto"
                            disabled={downloading || selectedGenerated.length === 0}
                            onClick={() => void downloadGenerated(selectedGenerated, "png", true)}
                          >
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                            {t("project.library.generated.downloadSelectedPng")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="w-full sm:w-auto"
                            disabled={downloading || selectedGenerated.length === 0}
                            onClick={() => void downloadGenerated(selectedGenerated, "jpg", true)}
                          >
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                            {t("project.library.generated.downloadSelectedJpg")}
                          </Button>
                          {manageQuery.data ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
                              disabled={
                                deleteGeneratedMutation.isPending || selectedGenerated.length === 0
                              }
                              onClick={() =>
                                confirmDeleteGenerated(selectedGenerated.map((asset) => asset.id))
                              }
                            >
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                              {t("project.library.generated.deleteSelected")}
                            </Button>
                          ) : null}
                        </div>

                        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {generatedArts.map((asset) => (
                            <li key={asset.id} className="rounded-lg border p-2">
                              <div className="flex items-start gap-3">
                                <Checkbox
                                  checked={selectedGeneratedIds.includes(asset.id)}
                                  onCheckedChange={(checked) =>
                                    toggleGeneratedSelection(asset.id, checked === true)
                                  }
                                  aria-label={localizedAssetName(asset, uiLocale)}
                                />
                                {asset.file_url ? (
                                  <img
                                    src={asset.file_url}
                                    alt=""
                                    className="h-[4.5rem] w-12 shrink-0 rounded-md object-cover"
                                  />
                                ) : (
                                  <div className="flex h-[4.5rem] w-12 shrink-0 items-center justify-center rounded-md bg-muted">
                                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p
                                    className="truncate text-sm font-medium"
                                    title={localizedAssetName(asset, uiLocale)}
                                  >
                                    {localizedAssetName(asset, uiLocale)}
                                  </p>
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2"
                                      disabled={downloading || !asset.file_url}
                                      onClick={() => void downloadGenerated([asset], "png", false)}
                                    >
                                      PNG
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2"
                                      disabled={downloading || !asset.file_url}
                                      onClick={() => void downloadGenerated([asset], "jpg", false)}
                                    >
                                      JPG
                                    </Button>
                                    {manageQuery.data ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                        disabled={deleteGeneratedMutation.isPending}
                                        aria-label={t("project.library.generated.delete")}
                                        onClick={() => confirmDeleteGenerated([asset.id])}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                      </Button>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => {
              const Icon = c.icon;
              const categoryAssets = byCategory[c.key] ?? [];
              const isOpen = openCategories[c.key] === true;
              return (
                <Collapsible
                  key={c.key}
                  open={isOpen}
                  onOpenChange={(next) =>
                    setOpenCategories((prev) => ({ ...prev, [c.key]: next }))
                  }
                >
                  <Card className="rounded-xl">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className={`flex w-full flex-row items-center gap-3 px-6 pt-6 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-t-xl [&[data-state=open]_svg.category-chevron]:rotate-180 ${
                          isOpen ? "pb-3" : "pb-6 rounded-b-xl"
                        }`}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-sm font-medium">
                            {t(`project.library.categories.${c.key}`)}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">{categoryAssets.length}</p>
                        </div>
                        <ChevronDown
                          className="category-chevron h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200"
                          aria-hidden="true"
                        />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        {categoryAssets.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            {t("project.library.empty")}
                          </p>
                        ) : (
                          <ul className="space-y-1.5">
                            {categoryAssets.map((asset) => {
                              const displayName = localizedAssetName(asset, uiLocale);
                              return (
                                <li key={asset.id} className="group flex items-start gap-2 text-sm">
                                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                                  {asset.file_url ? (
                                    <a
                                      href={asset.file_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="min-w-0 flex-1 line-clamp-2 text-left text-primary hover:underline"
                                      title={displayName}
                                    >
                                      {displayName}
                                    </a>
                                  ) : (
                                    <span
                                      className="min-w-0 flex-1 line-clamp-2 text-muted-foreground"
                                      title={displayName}
                                    >
                                      {displayName}
                                    </span>
                                  )}
                                  {manageQuery.data ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 shrink-0 px-2 text-destructive opacity-70 hover:bg-destructive/10 hover:text-destructive hover:opacity-100 group-hover:opacity-100"
                                      disabled={deleteAssetMutation.isPending}
                                      aria-label={t("project.library.delete")}
                                      onClick={() => confirmDeleteAsset(asset.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                    </Button>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>

          {assetsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
          ) : assets.length === 0 && templates.length === 0 ? (
            <EmptyState icon={Upload} title={t("project.library.emptyAll")} />
          ) : null}
        </>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("project.library.upload")}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!canSubmit || createMutation.isPending) return;
              createMutation.mutate();
            }}
          >
            <Tabs
              value={source}
              onValueChange={(v) => setSource(v as SourceMode)}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="file">{t("project.library.sourceFile")}</TabsTrigger>
                <TabsTrigger value="url">{t("project.library.sourceUrl")}</TabsTrigger>
              </TabsList>

              <TabsContent value="file" className="space-y-3 pt-3">
                <div className="space-y-1.5">
                  <Label htmlFor="asset-files">{t("project.library.file")}</Label>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <input
                      ref={fileInputRef}
                      id="asset-files"
                      type="file"
                      accept={LIBRARY_ACCEPT}
                      multiple
                      className="sr-only"
                      disabled={createMutation.isPending}
                      onChange={(e) => {
                        const selected = Array.from(e.target.files ?? []);
                        const accepted: PendingFile[] = [];
                        const rejected: File[] = [];
                        for (const file of selected) {
                          if (isLibraryFileTooLarge(file)) {
                            rejected.push(file);
                            continue;
                          }
                          accepted.push({
                            id: crypto.randomUUID(),
                            file,
                            name: fileTitle(file.name),
                            category: guessLibraryCategory(file),
                          });
                        }
                        if (rejected.length > 0) {
                          toast.error(
                            t("project.library.fileTooLarge", {
                              count: rejected.length,
                              names: rejected
                                .map((file) => `${file.name} (${formatLibraryFileSize(file.size)})`)
                                .join(", "),
                            }),
                          );
                        }
                        if (accepted.length > 0) {
                          setFiles((prev) => {
                            const existing = new Set(
                              prev.map((item) => `${item.file.name}:${item.file.size}`),
                            );
                            return [
                              ...prev,
                              ...accepted.filter(
                                (item) => !existing.has(`${item.file.name}:${item.file.size}`),
                              ),
                            ];
                          });
                        }
                        e.target.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={createMutation.isPending}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {t("project.library.chooseFiles")}
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      {files.length > 0
                        ? t("project.library.filesSelected", { count: files.length })
                        : t("project.library.noFilesChosen")}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">{t("project.library.fileHint")}</p>
                </div>

                {files.length > 0 ? (
                  <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-2">
                    {[...files]
                      .sort((a, b) => b.file.size - a.file.size)
                      .map((item) => {
                        const tooLarge = isLibraryFileTooLarge(item.file);
                        return (
                          <li
                            key={item.id}
                            className="flex items-start justify-between gap-3 rounded-md bg-muted/40 px-2 py-1.5 text-xs"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium">{item.name}</p>
                              <p
                                className={
                                  tooLarge ? "text-destructive" : "text-muted-foreground"
                                }
                              >
                                {t(`project.library.categories.${item.category}`)}
                                {" · "}
                                {formatLibraryFileSize(item.file.size)}
                                {tooLarge
                                  ? ` · ${t("project.library.fileTooLargeBadge", { max: LIBRARY_MAX_MB })}`
                                  : ""}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="shrink-0 text-muted-foreground hover:text-foreground"
                              disabled={createMutation.isPending}
                              onClick={() =>
                                setFiles((prev) => prev.filter((f) => f.id !== item.id))
                              }
                            >
                              ×
                            </button>
                          </li>
                        );
                      })}
                  </ul>
                ) : null}
              </TabsContent>

              <TabsContent value="url" className="space-y-3 pt-3">
                <div className="space-y-1.5">
                  <Label htmlFor="asset-name">{t("project.library.urlName")}</Label>
                  <LocalizedTextInput
                    id="asset-name"
                    field="name"
                    i18n={rowI18n}
                    fallback={name}
                    onI18nCommit={(payload) => {
                      setRowI18n((prev) => setLocalizedField(prev, payload.field, payload.block));
                      setName(payload.display);
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="asset-url">{t("project.library.url")}</Label>
                  <Input
                    id="asset-url"
                    type="url"
                    value={fileUrl}
                    onChange={(e) => setFileUrl(e.target.value)}
                    placeholder="https://"
                    required={source === "url"}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={createMutation.isPending}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                loading={createMutation.isPending}
                loadingLabel={t("common.saving")}
                disabled={!canSubmit}
              >
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={templateOpen}
        onOpenChange={(next) => {
          setTemplateOpen(next);
          if (!next) resetTemplateForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("project.library.templates.upload")}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!templateFile || createTemplateMutation.isPending) return;
              createTemplateMutation.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="template-name">{t("project.library.templates.name")}</Label>
              <Input
                id="template-name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder={templateFile ? fileTitle(templateFile.name) : ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("project.library.templates.format")}</Label>
              <Select
                value={templateFormat}
                onValueChange={(value) => {
                  const next = value as DesignTemplateFormat;
                  setTemplateFormat(next);
                  setTemplateAspect(defaultAspectForFormat(next));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DESIGN_TEMPLATE_FORMATS.map((format) => (
                    <SelectItem key={format} value={format}>
                      {t(`project.detail.formats.${format}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("project.library.templates.aspect")}</Label>
              <Select
                value={templateAspect}
                onValueChange={(value) => setTemplateAspect(value as DesignAspectRatio)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DESIGN_ASPECT_RATIOS.map((ratio) => (
                    <SelectItem key={ratio} value={ratio}>
                      {t(`project.library.templates.aspects.${designAspectI18nKey(ratio)}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="template-file">{t("project.library.templates.file")}</Label>
              <Input
                id="template-file"
                type="file"
                accept={DESIGN_TEMPLATE_ACCEPT}
                className="min-w-0 max-w-full"
                onChange={(e) => setTemplateFile(e.target.files?.[0] ?? null)}
                required
              />
              <p className="text-xs text-muted-foreground">
                {t("project.library.templates.fileHint")}
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTemplateOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                loading={createTemplateMutation.isPending}
                loadingLabel={t("common.saving")}
                disabled={!templateFile}
              >
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
