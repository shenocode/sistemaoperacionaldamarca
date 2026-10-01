import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FileText, Film, Image as ImageIcon, Loader2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEntitlements } from "@/hooks/use-entitlements";
import { getLocalizedText, normalizeAppLocale } from "@/lib/i18n-content";
import {
  listLibraryAssets,
  type LibraryAsset,
  type LibraryCategory,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const MEDIA_LIBRARY_CATEGORIES = new Set<LibraryCategory>([
  "images",
  "generated_arts",
  "videos",
  "pdfs",
  "documents",
  "spreadsheets",
]);

function assetLabel(asset: LibraryAsset, locale: string) {
  return getLocalizedText(asset.i18n, "name", asset.name, locale);
}

function isMediaLibraryAsset(asset: LibraryAsset) {
  if (!asset.file_url?.trim()) return false;
  if (!asset.category || !MEDIA_LIBRARY_CATEGORIES.has(asset.category)) return false;
  return true;
}

function isImageLikeAsset(asset: LibraryAsset) {
  if (asset.category === "images" || asset.category === "generated_arts") return true;
  return Boolean(asset.mime_type?.startsWith("image/"));
}

function categoryIcon(category: LibraryCategory | string | null | undefined) {
  switch (category) {
    case "images":
      return ImageIcon;
    case "generated_arts":
      return Sparkles;
    case "videos":
      return Film;
    default:
      return FileText;
  }
}

function categoryLabelKey(category: LibraryCategory | string | null | undefined) {
  if (category === "generated_arts") return "project.library.generated.title";
  if (
    category === "images" ||
    category === "videos" ||
    category === "pdfs" ||
    category === "documents" ||
    category === "spreadsheets"
  ) {
    return `project.library.categories.${category}`;
  }
  return null;
}

export function ContentMediaLibraryPicker({
  clientId,
  open,
  onOpenChange,
  onSelect,
}: {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (asset: LibraryAsset) => void;
}) {
  const { t, i18n } = useTranslation();
  const uiLocale = normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language);
  const { entitlements } = useEntitlements();

  const assetsQuery = useQuery({
    queryKey: ["library", clientId],
    queryFn: () => listLibraryAssets(clientId),
    enabled: open && entitlements.library,
  });

  const assets = useMemo(() => {
    const list = (assetsQuery.data ?? []).filter(isMediaLibraryAsset);
    return [...list].sort((a, b) => {
      const aGen = a.category === "generated_arts" ? 0 : 1;
      const bGen = b.category === "generated_arts" ? 0 : 1;
      if (aGen !== bGen) return aGen - bGen;
      return assetLabel(a, uiLocale).localeCompare(assetLabel(b, uiLocale), uiLocale);
    });
  }, [assetsQuery.data, uiLocale]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("project.detail.mediaLibraryPickTitle")}</DialogTitle>
          <DialogDescription>{t("project.detail.mediaLibraryPickHint")}</DialogDescription>
        </DialogHeader>
        {assetsQuery.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t("common.loading")}
          </p>
        ) : assets.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("project.detail.mediaLibraryPickEmpty")}
          </p>
        ) : (
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {assets.map((asset) => {
              const Icon = categoryIcon(asset.category);
              const label = assetLabel(asset, uiLocale);
              const catKey = categoryLabelKey(asset.category);
              const showThumb = isImageLikeAsset(asset) && Boolean(asset.file_url);

              return (
                <li key={asset.id}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm",
                      "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    )}
                    onClick={() => {
                      onSelect(asset);
                      onOpenChange(false);
                    }}
                  >
                    {showThumb ? (
                      <img
                        src={asset.file_url!}
                        alt=""
                        className="size-10 shrink-0 rounded-md border object-cover bg-muted"
                      />
                    ) : (
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted/40">
                        <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{label}</span>
                      {catKey ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {t(catKey)}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Botão que abre o picker — oculto se o plano não inclui Biblioteca. */
export function ContentMediaLibraryButton({
  clientId,
  disabled,
  onSelect,
  className,
}: {
  clientId: string;
  disabled?: boolean;
  onSelect: (asset: LibraryAsset) => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const { entitlements } = useEntitlements();
  const [open, setOpen] = useState(false);

  if (!entitlements.library) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={className}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <ImageIcon className="size-4" />
        {t("project.detail.sourceLibrary")}
      </Button>
      <ContentMediaLibraryPicker
        clientId={clientId}
        open={open}
        onOpenChange={setOpen}
        onSelect={onSelect}
      />
    </>
  );
}
