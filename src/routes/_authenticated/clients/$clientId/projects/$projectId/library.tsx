import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
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
} from "lucide-react";
import { toast } from "sonner";
import { LocalizedTextInput } from "@/components/localized-text-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  DESIGN_TEMPLATE_ACCEPT,
  DESIGN_TEMPLATE_FORMATS,
  LIBRARY_ACCEPT,
  canManageClient,
  createDesignTemplate,
  createLibraryAsset,
  createLibraryAssets,
  deleteDesignTemplate,
  ensureBrandBriefing,
  guessLibraryCategory,
  listDesignTemplates,
  listLibraryAssets,
  type DesignTemplateFormat,
  type LibraryAsset,
  type LibraryCategory,
} from "@/lib/api";
import { downloadImageFromUrl, downloadImagesAsZip } from "@/lib/download-image";
import {
  buildLocalizedFieldFromSource,
  getCanonicalText,
  getLocalizedText,
  normalizeAppLocale,
  setLocalizedField,
  translateTextField,
  type RowI18n,
} from "@/lib/i18n-content";

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

export const Route = createFileRoute(
  "/_authenticated/clients/$clientId/projects/$projectId/library",
)({
  component: LibraryPage,
});

function LibraryPage() {
  const { clientId, projectId } = Route.useParams();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
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
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [selectedGeneratedIds, setSelectedGeneratedIds] = useState<string[]>([]);
  const [downloading, setDownloading] = useState(false);

  const assetsQuery = useQuery({
    queryKey: ["library", projectId],
    queryFn: () => listLibraryAssets(projectId),
  });

  const templatesQuery = useQuery({
    queryKey: ["design-templates", projectId],
    queryFn: () => listDesignTemplates(projectId),
  });

  const briefingQuery = useQuery({
    queryKey: ["brand-briefing", clientId],
    queryFn: () => ensureBrandBriefing(clientId),
  });

  const manageQuery = useQuery({
    queryKey: ["can-manage", clientId],
    queryFn: () => canManageClient(clientId),
  });

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
    setTemplateFile(null);
  };

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
            projectId,
            name: getCanonicalText(nextI18n, "name", displayName),
            category: "references",
            fileUrl,
            i18n: nextI18n,
          }),
        ];
      }

      return createLibraryAssets(
        await Promise.all(
          files.map(async (item) => {
            let block;
            try {
              block = await translateTextField({ text: item.name });
            } catch {
              block = buildLocalizedFieldFromSource(item.name, uiLocale);
            }
            const assetI18n = setLocalizedField({}, "name", block);
            return {
              projectId,
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
      queryClient.invalidateQueries({ queryKey: ["library", projectId] });
      setOpen(false);
      resetForm();
      toast.success(
        created.length === 1 ? t("project.library.addedOne") : t("project.library.added"),
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!templateFile) throw new Error(t("project.library.templates.file"));
      return createDesignTemplate({
        projectId,
        name: templateName.trim() || fileTitle(templateFile.name),
        format: templateFormat,
        file: templateFile,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["design-templates", projectId] });
      setTemplateOpen(false);
      resetTemplateForm();
      toast.success(t("project.library.templates.added"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (templateId: string) => deleteDesignTemplate(templateId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["design-templates", projectId] });
      toast.success(t("project.library.templates.deleted"));
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
      ? files.length > 0
      : Boolean(fileUrl.trim()) && Boolean(name.trim() || fileUrl.trim());

  const briefing = briefingQuery.data;
  const briefingStatusKey = briefing?.status ?? "draft";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {manageQuery.data ? (
          <>
            <Button variant="outline" onClick={() => setTemplateOpen(true)}>
              <LayoutTemplate className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("project.library.templates.upload")}
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("project.library.upload")}
            </Button>
          </>
        ) : null}
      </div>

      <Card className="rounded-xl">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
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
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <p className="text-xs text-muted-foreground">{t("project.library.generated.hint")}</p>

          {generatedArts.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("project.library.generated.empty")}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-xs">
                  <Checkbox
                    checked={
                      selectedGeneratedIds.length > 0 &&
                      selectedGeneratedIds.length === generatedArts.length
                    }
                    onCheckedChange={(checked) => toggleSelectAllGenerated(checked === true)}
                  />
                  {t("project.library.generated.selectAll")}
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
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
                  disabled={downloading || selectedGenerated.length === 0}
                  onClick={() => void downloadGenerated(selectedGenerated, "jpg", true)}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  {t("project.library.generated.downloadSelectedJpg")}
                </Button>
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
                          className="h-16 w-16 shrink-0 rounded-md object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-muted">
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
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl">
        <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <LayoutTemplate className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-sm font-medium">
              {t("project.library.templates.title")}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {t("project.library.templates.count", { count: templates.length })}
            </p>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {templatesQuery.isLoading ? (
            <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
          ) : templates.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t("project.library.templates.empty")}</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((template) => (
                <li
                  key={template.id}
                  className="flex items-start gap-3 rounded-lg border p-2"
                >
                  <img
                    src={template.file_url}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-md object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={template.name}>
                      {template.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t(`project.library.templates.${template.format}`)}
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
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="rounded-xl border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ClipboardList className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm font-medium">
                {t("project.library.briefing.title")}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {briefingQuery.isLoading
                  ? t("common.loading")
                  : t(`project.library.briefing.status.${briefingStatusKey}`)}
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <p className="text-xs text-muted-foreground">
              {briefing
                ? t("project.library.briefing.progress", {
                    answered: briefing.answeredCount,
                    total: briefing.totalCount,
                  })
                : t("project.library.briefing.description")}
            </p>
            <Button asChild size="sm" className="w-full">
              <Link
                to="/clients/$clientId/briefing"
                params={{ clientId }}
                search={{ projectId }}
              >
                {t("project.library.briefing.open")}
              </Link>
            </Button>
          </CardContent>
        </Card>

        {categories.map((c) => {
          const Icon = c.icon;
          const categoryAssets = byCategory[c.key] ?? [];
          return (
            <Card key={c.key} className="rounded-xl">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-sm font-medium">
                    {t(`project.library.categories.${c.key}`)}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{categoryAssets.length}</p>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {categoryAssets.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("project.library.empty")}</p>
                ) : (
                  <ul className="space-y-1.5">
                    {categoryAssets.map((asset) => {
                      const displayName = localizedAssetName(asset, uiLocale);
                      return (
                      <li key={asset.id} className="flex items-start gap-2 text-sm">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                        {asset.file_url ? (
                          <a
                            href={asset.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="line-clamp-2 text-left text-primary hover:underline"
                            title={displayName}
                          >
                            {displayName}
                          </a>
                        ) : (
                          <span className="line-clamp-2 text-muted-foreground" title={displayName}>
                            {displayName}
                          </span>
                        )}
                      </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {assetsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : assets.length === 0 && templates.length === 0 ? (
        <EmptyState icon={Upload} title={t("project.library.emptyAll")} />
      ) : null}

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
                  <Input
                    id="asset-files"
                    type="file"
                    accept={LIBRARY_ACCEPT}
                    multiple
                    onChange={(e) => {
                      const selected = Array.from(e.target.files ?? []);
                      setFiles(
                        selected.map((file) => ({
                          id: crypto.randomUUID(),
                          file,
                          name: fileTitle(file.name),
                          category: guessLibraryCategory(file),
                        })),
                      );
                      e.target.value = "";
                    }}
                  />
                  <p className="text-xs text-muted-foreground">{t("project.library.fileHint")}</p>
                </div>

                {files.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {t("project.library.filesSelected", { count: files.length })}
                    </p>
                    <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-2">
                      {files.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-start justify-between gap-3 rounded-md bg-muted/40 px-2 py-1.5 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{item.name}</p>
                            <p className="text-muted-foreground">
                              {t(`project.library.categories.${item.category}`)}
                              {" · "}
                              {(item.file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                          <button
                            type="button"
                            className="shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={() =>
                              setFiles((prev) => prev.filter((f) => f.id !== item.id))
                            }
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
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
                      setRowI18n(payload.i18n);
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
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={createMutation.isPending || !canSubmit}>
                {createMutation.isPending ? t("common.loading") : t("common.save")}
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
                onValueChange={(value) => setTemplateFormat(value as DesignTemplateFormat)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DESIGN_TEMPLATE_FORMATS.map((format) => (
                    <SelectItem key={format} value={format}>
                      {t(`project.library.templates.${format}`)}
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
                disabled={!templateFile || createTemplateMutation.isPending}
              >
                {createTemplateMutation.isPending ? t("common.loading") : t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
