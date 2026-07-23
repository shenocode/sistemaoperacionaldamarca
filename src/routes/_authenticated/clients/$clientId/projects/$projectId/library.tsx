import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Upload,
  FileText,
  Image as ImageIcon,
  Video,
  BookOpen,
  Sparkles,
  FileSpreadsheet,
  FileType,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LIBRARY_ACCEPT,
  canManageClient,
  createLibraryAsset,
  guessLibraryCategory,
  listLibraryAssets,
  type LibraryCategory,
} from "@/lib/api";

const categories = [
  { key: "brand" as const, icon: Sparkles },
  { key: "pdfs" as const, icon: FileText },
  { key: "images" as const, icon: ImageIcon },
  { key: "videos" as const, icon: Video },
  { key: "documents" as const, icon: FileType },
  { key: "spreadsheets" as const, icon: FileSpreadsheet },
  { key: "references" as const, icon: BookOpen },
];

type SourceMode = "file" | "url";

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
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<SourceMode>("file");
  const [category, setCategory] = useState<LibraryCategory>("references");
  const [categoryTouched, setCategoryTouched] = useState(false);

  const assetsQuery = useQuery({
    queryKey: ["library", projectId],
    queryFn: () => listLibraryAssets(projectId),
  });

  const manageQuery = useQuery({
    queryKey: ["can-manage", clientId],
    queryFn: () => canManageClient(clientId),
  });

  const resetForm = () => {
    setName("");
    setFileUrl("");
    setFile(null);
    setSource("file");
    setCategory("references");
    setCategoryTouched(false);
  };

  const createMutation = useMutation({
    mutationFn: createLibraryAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library", projectId] });
      setOpen(false);
      resetForm();
      toast.success(t("project.library.added"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const assets = assetsQuery.data ?? [];
  const counts = Object.fromEntries(
    categories.map((c) => [c.key, assets.filter((a) => a.category === c.key).length]),
  ) as Record<LibraryCategory, number>;

  const canSubmit =
    name.trim().length > 0 &&
    (source === "file" ? Boolean(file) : Boolean(fileUrl.trim()));

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {categories.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.key} className="rounded-xl">
              <CardContent className="flex flex-col items-center justify-center gap-2 p-6 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="text-sm font-medium">{t(`project.library.categories.${c.key}`)}</p>
                <p className="text-xs text-muted-foreground">{counts[c.key] ?? 0}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {assetsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : assets.length === 0 ? (
        <EmptyState icon={Upload} title={t("project.library.empty")} />
      ) : (
        <ul className="divide-y rounded-xl border">
          {assets.map((asset) => (
            <li key={asset.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{asset.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t(`project.library.categories.${asset.category}`)}
                  {asset.file_name ? ` · ${asset.file_name}` : null}
                </p>
              </div>
              {asset.file_url ? (
                <a
                  href={asset.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline"
                >
                  {t("project.library.open")}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
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
              if (!canSubmit) return;
              createMutation.mutate({
                projectId,
                name,
                category,
                file: source === "file" ? file : null,
                fileUrl: source === "url" ? fileUrl : undefined,
              });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="asset-name">{t("project.library.name")}</Label>
              <Input
                id="asset-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("project.library.category")}</Label>
              <Select
                value={category}
                onValueChange={(v) => {
                  setCategoryTouched(true);
                  setCategory(v as LibraryCategory);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.key} value={c.key}>
                      {t(`project.library.categories.${c.key}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Tabs
              value={source}
              onValueChange={(v) => setSource(v as SourceMode)}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="file">{t("project.library.sourceFile")}</TabsTrigger>
                <TabsTrigger value="url">{t("project.library.sourceUrl")}</TabsTrigger>
              </TabsList>
              <TabsContent value="file" className="space-y-1.5 pt-3">
                <Label htmlFor="asset-file">{t("project.library.file")}</Label>
                <Input
                  id="asset-file"
                  type="file"
                  accept={LIBRARY_ACCEPT}
                  onChange={(e) => {
                    const next = e.target.files?.[0] ?? null;
                    setFile(next);
                    if (!next) return;
                    if (!name.trim()) {
                      setName(next.name.replace(/\.[^.]+$/, ""));
                    }
                    if (!categoryTouched) {
                      setCategory(guessLibraryCategory(next));
                    }
                  }}
                  required={source === "file"}
                />
                <p className="text-xs text-muted-foreground">{t("project.library.fileHint")}</p>
                {file ? (
                  <p className="text-xs text-muted-foreground">
                    {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                ) : null}
              </TabsContent>
              <TabsContent value="url" className="space-y-1.5 pt-3">
                <Label htmlFor="asset-url">{t("project.library.url")}</Label>
                <Input
                  id="asset-url"
                  type="url"
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  placeholder="https://"
                  required={source === "url"}
                />
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
