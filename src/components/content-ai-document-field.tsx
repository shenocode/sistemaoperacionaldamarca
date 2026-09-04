import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FileText, FolderOpen, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useEntitlements } from "@/hooks/use-entitlements";
import { getLocalizedText, normalizeAppLocale } from "@/lib/i18n-content";
import {
  ASSISTANT_DOCUMENT_ACCEPT,
  ASSISTANT_DOCUMENT_MAX_MB,
  createLibraryAsset,
  guessLibraryCategory,
  isAssistantDocumentAsset,
  isAssistantDocumentFile,
  isAssistantDocumentTooLarge,
  listLibraryAssets,
  uploadContentMedia,
  type LibraryAsset,
  type LibraryCategory,
} from "@/lib/api";

export type AssistantDocumentRef = {
  libraryAssetId?: string;
  documentUrl?: string;
  documentName: string;
};

function assistantLibraryCategory(file: File): LibraryCategory {
  const guessed = guessLibraryCategory(file);
  if (guessed === "pdfs" || guessed === "documents" || guessed === "spreadsheets") return guessed;
  return "documents";
}

function assetLabel(asset: LibraryAsset, locale: string) {
  return getLocalizedText(asset.i18n, "name", asset.name, locale);
}

export function ContentAiDocumentField({
  clientId,
  projectId,
  value,
  onChange,
  disabled,
}: {
  clientId: string;
  projectId: string;
  value: AssistantDocumentRef | null;
  onChange: (next: AssistantDocumentRef | null) => void;
  disabled?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const uiLocale = normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language);
  const queryClient = useQueryClient();
  const { entitlements } = useEntitlements();
  const fileRef = useRef<HTMLInputElement>(null);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const assetsQuery = useQuery({
    queryKey: ["library", clientId],
    queryFn: () => listLibraryAssets(clientId),
    enabled: libraryOpen && entitlements.library,
  });

  const documents = useMemo(
    () => (assetsQuery.data ?? []).filter(isAssistantDocumentAsset),
    [assetsQuery.data],
  );

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!isAssistantDocumentFile(file)) {
        throw new Error(t("project.detail.assistant.documentInvalidType"));
      }
      if (isAssistantDocumentTooLarge(file)) {
        throw new Error(
          t("project.detail.assistant.documentTooLarge", { max: ASSISTANT_DOCUMENT_MAX_MB }),
        );
      }
      if (entitlements.library) {
        try {
          const name = file.name.replace(/\.[^.]+$/, "") || file.name;
          const asset = await createLibraryAsset({
            clientId,
            name,
            category: assistantLibraryCategory(file),
            file,
          });
          return {
            ref: {
              libraryAssetId: asset.id,
              documentName: asset.file_name || asset.name,
            } satisfies AssistantDocumentRef,
            savedToLibrary: true,
          };
        } catch {
          // Continua com upload avulso para não bloquear a geração.
        }
      }
      const documentUrl = await uploadContentMedia(projectId, file);
      return {
        ref: { documentUrl, documentName: file.name } satisfies AssistantDocumentRef,
        savedToLibrary: false,
      };
    },
    onSuccess: ({ ref, savedToLibrary }) => {
      onChange(ref);
      if (savedToLibrary) {
        void queryClient.invalidateQueries({ queryKey: ["library", clientId] });
        toast.success(t("project.detail.assistant.documentSavedToLibrary"));
      } else {
        toast.success(t("project.detail.assistant.documentAdded"));
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    uploadMutation.mutate(file);
  }

  function selectAsset(asset: LibraryAsset) {
    onChange({
      libraryAssetId: asset.id,
      documentName: asset.file_name || assetLabel(asset, uiLocale),
    });
    setLibraryOpen(false);
    toast.success(t("project.detail.assistant.documentAdded"));
  }

  return (
    <div className="space-y-1.5">
      <Label variant="highlight">{t("project.detail.assistant.document")}</Label>
      <p className="text-xs text-muted-foreground">{t("project.detail.assistant.documentHint")}</p>

      {value ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-sm">{value.documentName}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            disabled={disabled}
            onClick={() => onChange(null)}
            aria-label={t("project.detail.assistant.documentRemove")}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {entitlements.library ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || uploadMutation.isPending}
              onClick={() => setLibraryOpen(true)}
            >
              <FolderOpen className="size-4" />
              {t("project.detail.assistant.documentFromLibrary")}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || uploadMutation.isPending}
            onClick={() => fileRef.current?.click()}
          >
            {uploadMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {uploadMutation.isPending
              ? t("project.detail.assistant.documentUploading")
              : t("project.detail.assistant.documentUpload")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept={ASSISTANT_DOCUMENT_ACCEPT}
            className="sr-only"
            onChange={handleFileChange}
          />
        </div>
      )}

      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("project.detail.assistant.documentPickTitle")}</DialogTitle>
            <DialogDescription>{t("project.detail.assistant.documentPickHint")}</DialogDescription>
          </DialogHeader>
          {assetsQuery.isLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t("common.loading")}
            </p>
          ) : documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("project.detail.assistant.documentPickEmpty")}
            </p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {documents.map((asset) => (
                <li key={asset.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => selectAsset(asset)}
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 truncate">{assetLabel(asset, uiLocale)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
