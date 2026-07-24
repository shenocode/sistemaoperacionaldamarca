import { useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  LIBRARY_ACCEPT,
  canManageClient,
  createLibraryAsset,
  createLibraryAssets,
  ensureBrandBriefing,
  guessLibraryCategory,
  listLibraryAssets,
  type LibraryAsset,
  type LibraryCategory,
} from "@/lib/api";

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

export const Route = createFileRoute(
  "/_authenticated/clients/$clientId/projects/$projectId/library",
)({
  component: LibraryPage,
});

function LibraryPage() {
  const { clientId, projectId } = Route.useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [source, setSource] = useState<SourceMode>("file");

  const assetsQuery = useQuery({
    queryKey: ["library", projectId],
    queryFn: () => listLibraryAssets(projectId),
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
    setFileUrl("");
    setFiles([]);
    setSource("file");
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (source === "url") {
        return [
          await createLibraryAsset({
            projectId,
            name: name.trim() || fileUrl.trim(),
            category: "references",
            fileUrl,
          }),
        ];
      }

      return createLibraryAssets(
        files.map((item) => ({
          projectId,
          name: item.name,
          category: item.category,
          file: item.file,
        })),
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

  const assets = assetsQuery.data ?? [];
  const byCategory = Object.fromEntries(
    categories.map((c) => [
      c.key,
      assets.filter(
        (a) => a.category === c.key || (c.key === "pdfs" && a.category === "brand"),
      ),
    ]),
  ) as Record<(typeof categories)[number]["key"], LibraryAsset[]>;

  const canSubmit =
    source === "file"
      ? files.length > 0
      : Boolean(fileUrl.trim()) && Boolean(name.trim() || fileUrl.trim());

  const briefing = briefingQuery.data;
  const briefingStatusKey = briefing?.status ?? "draft";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        {manageQuery.data ? (
          <Button onClick={() => setOpen(true)}>
            <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("project.library.upload")}
          </Button>
        ) : null}
      </div>

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
                    {categoryAssets.map((asset) => (
                      <li key={asset.id} className="flex items-start gap-2 text-sm">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                        {asset.file_url ? (
                          <a
                            href={asset.file_url}
                            target="_blank"
                            rel="noreferrer"
                            className="line-clamp-2 text-left text-primary hover:underline"
                            title={asset.name}
                          >
                            {asset.name}
                          </a>
                        ) : (
                          <span className="line-clamp-2 text-muted-foreground" title={asset.name}>
                            {asset.name}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {assetsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : assets.length === 0 ? (
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
                  <Input
                    id="asset-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={source === "url"}
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
    </div>
  );
}
