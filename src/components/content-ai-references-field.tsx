import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  FileText,
  Film,
  Image as ImageIcon,
  Link2,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEntitlements } from "@/hooks/use-entitlements";
import { getLocalizedText, normalizeAppLocale } from "@/lib/i18n-content";
import {
  ASSISTANT_REFERENCE_MAX,
  LIBRARY_ACCEPT,
  createLibraryAsset,
  guessLibraryCategory,
  isAssistantReferenceAsset,
  isLibraryFileTooLarge,
  listLibraryAssets,
  type LibraryAsset,
  type LibraryCategory,
} from "@/lib/api";

function assetLabel(asset: LibraryAsset, locale: string) {
  return getLocalizedText(asset.i18n, "name", asset.name, locale);
}

function categoryIcon(category: LibraryCategory | string | null | undefined) {
  switch (category) {
    case "images":
      return ImageIcon;
    case "videos":
      return Film;
    case "references":
      return Link2;
    default:
      return FileText;
  }
}

function nameFromUrl(raw: string): string {
  try {
    const parsed = new URL(raw.trim());
    const host = parsed.hostname.replace(/^www\./, "");
    const path = parsed.pathname.replace(/\/+$/, "").split("/").filter(Boolean).pop();
    return path ? `${host}/${path}` : host;
  } catch {
    return raw.trim().slice(0, 80) || "Referência";
  }
}

export function ContentAiReferencesField({
  clientId,
  selectedIds,
  onChange,
  disabled,
}: {
  clientId: string;
  selectedIds: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const uiLocale = normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language);
  const queryClient = useQueryClient();
  const { entitlements } = useEntitlements();
  const fileRef = useRef<HTMLInputElement>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<"file" | "url">("url");
  const [urlDraft, setUrlDraft] = useState("");
  const [urlName, setUrlName] = useState("");

  const assetsQuery = useQuery({
    queryKey: ["library", clientId],
    queryFn: () => listLibraryAssets(clientId),
    enabled: entitlements.library,
  });

  const assets = useMemo(
    () => (assetsQuery.data ?? []).filter(isAssistantReferenceAsset),
    [assetsQuery.data],
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const selectedAssets = useMemo(
    () =>
      selectedIds
        .map((id) => assets.find((asset) => asset.id === id))
        .filter((asset): asset is LibraryAsset => Boolean(asset)),
    [assets, selectedIds],
  );

  function toggleAsset(assetId: string, checked: boolean) {
    if (checked) {
      if (selectedIds.includes(assetId)) return;
      if (selectedIds.length >= ASSISTANT_REFERENCE_MAX) {
        toast.error(
          t("project.detail.assistant.referencesMax", { max: ASSISTANT_REFERENCE_MAX }),
        );
        return;
      }
      onChange([...selectedIds, assetId]);
      return;
    }
    onChange(selectedIds.filter((id) => id !== assetId));
  }

  function selectCreated(asset: LibraryAsset) {
    void queryClient.invalidateQueries({ queryKey: ["library", clientId] });
    const next = selectedIds.includes(asset.id)
      ? selectedIds
      : selectedIds.length >= ASSISTANT_REFERENCE_MAX
        ? selectedIds
        : [...selectedIds, asset.id];
    if (!selectedIds.includes(asset.id) && selectedIds.length >= ASSISTANT_REFERENCE_MAX) {
      toast.error(
        t("project.detail.assistant.referencesMax", { max: ASSISTANT_REFERENCE_MAX }),
      );
    } else {
      onChange(next);
      toast.success(t("project.detail.assistant.referencesAdded"));
    }
    setAddOpen(false);
    setUrlDraft("");
    setUrlName("");
  }

  const createFileMutation = useMutation({
    mutationFn: async (file: File) => {
      if (isLibraryFileTooLarge(file)) {
        throw new Error(t("project.library.fileTooLarge", { count: 1, names: file.name }));
      }
      const name = file.name.replace(/\.[^.]+$/, "") || file.name;
      return createLibraryAsset({
        clientId,
        name,
        category: guessLibraryCategory(file),
        file,
      });
    },
    onSuccess: selectCreated,
    onError: (err: Error) => toast.error(err.message),
  });

  const createUrlMutation = useMutation({
    mutationFn: async () => {
      const fileUrl = urlDraft.trim();
      if (!fileUrl) throw new Error(t("project.detail.assistant.referencesUrlRequired"));
      try {
        const parsed = new URL(fileUrl);
        if (!parsed.protocol.startsWith("http")) {
          throw new Error("invalid");
        }
      } catch {
        throw new Error(t("project.detail.assistant.referencesUrlInvalid"));
      }
      const name = urlName.trim() || nameFromUrl(fileUrl);
      return createLibraryAsset({
        clientId,
        name,
        category: "references",
        fileUrl,
      });
    },
    onSuccess: selectCreated,
    onError: (err: Error) => toast.error(err.message),
  });

  const busy = disabled || createFileMutation.isPending || createUrlMutation.isPending;

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    createFileMutation.mutate(file);
  }

  if (!entitlements.library) {
    return (
      <div className="space-y-1.5">
        <Label variant="highlight">{t("project.detail.assistant.references")}</Label>
        <p className="text-xs text-muted-foreground">
          {t("project.detail.assistant.referencesNeedsLibrary")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label variant="highlight">{t("project.detail.assistant.references")}</Label>
        <p className="text-xs text-muted-foreground">
          {t("project.detail.assistant.referencesHint")}
        </p>
      </div>

      {selectedAssets.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {selectedAssets.map((asset) => {
            const Icon = categoryIcon(asset.category);
            return (
              <li
                key={asset.id}
                className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs"
              >
                <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 truncate">{assetLabel(asset, uiLocale)}</span>
                <button
                  type="button"
                  className="shrink-0 rounded-sm text-muted-foreground hover:text-foreground"
                  disabled={busy}
                  onClick={() => toggleAsset(asset.id, false)}
                  aria-label={t("project.detail.assistant.referencesRemove")}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="rounded-md border border-border">
        {assetsQuery.isLoading ? (
          <p className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t("common.loading")}
          </p>
        ) : assets.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">
            {t("project.detail.assistant.referencesEmpty")}
          </p>
        ) : (
          <ul className="max-h-56 space-y-0.5 overflow-y-auto p-2">
            {assets.map((asset) => {
              const Icon = categoryIcon(asset.category);
              const checked = selectedSet.has(asset.id);
              const categoryLabel = t(`project.library.categories.${asset.category}`, {
                defaultValue: asset.category,
              });
              return (
                <li key={asset.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/60">
                    <Checkbox
                      checked={checked}
                      disabled={busy || (!checked && selectedIds.length >= ASSISTANT_REFERENCE_MAX)}
                      onCheckedChange={(value) => toggleAsset(asset.id, value === true)}
                      className="mt-0.5"
                    />
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{assetLabel(asset, uiLocale)}</span>
                      <span className="block text-xs text-muted-foreground">{categoryLabel}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => setAddOpen(true)}
      >
        <Plus className="size-4" />
        {t("project.detail.assistant.referencesAdd")}
      </Button>

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          if (busy) return;
          setAddOpen(open);
          if (!open) {
            setUrlDraft("");
            setUrlName("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("project.detail.assistant.referencesAddTitle")}</DialogTitle>
            <DialogDescription>
              {t("project.detail.assistant.referencesAddHint")}
            </DialogDescription>
          </DialogHeader>
          <Tabs
            value={addMode}
            onValueChange={(value) => setAddMode(value === "file" ? "file" : "url")}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="url">{t("project.detail.assistant.referencesAddUrl")}</TabsTrigger>
              <TabsTrigger value="file">
                {t("project.detail.assistant.referencesAddFile")}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="url" className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="ai-ref-url">{t("project.detail.assistant.referencesUrl")}</Label>
                <Input
                  id="ai-ref-url"
                  type="url"
                  value={urlDraft}
                  onChange={(e) => setUrlDraft(e.target.value)}
                  placeholder="https://"
                  disabled={busy}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ai-ref-url-name">
                  {t("project.detail.assistant.referencesUrlName")}
                </Label>
                <Input
                  id="ai-ref-url-name"
                  value={urlName}
                  onChange={(e) => setUrlName(e.target.value)}
                  placeholder={t("project.detail.assistant.referencesUrlNamePlaceholder")}
                  disabled={busy}
                />
              </div>
            </TabsContent>
            <TabsContent value="file" className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground">
                {t("project.detail.assistant.referencesFileHint")}
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                {createFileMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                {createFileMutation.isPending
                  ? t("project.detail.assistant.documentUploading")
                  : t("project.detail.assistant.referencesPickFile")}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept={LIBRARY_ACCEPT}
                className="sr-only"
                onChange={handleFileChange}
              />
            </TabsContent>
          </Tabs>
          {addMode === "url" ? (
            <DialogFooter>
              <Button
                type="button"
                disabled={busy || !urlDraft.trim()}
                onClick={() => createUrlMutation.mutate()}
              >
                {createUrlMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {t("common.loading")}
                  </>
                ) : (
                  t("project.detail.assistant.referencesSave")
                )}
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
