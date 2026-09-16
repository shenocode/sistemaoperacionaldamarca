import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  analyzeReferenceCreator,
  createBrandReferenceCreator,
  deleteBrandReferenceCreator,
  listBrandReferenceCreators,
  updateBrandReferenceCreator,
} from "@/lib/api";

type BrandReferenceCreatorsProps = {
  clientId: string;
  canEdit: boolean;
};

export function BrandReferenceCreators({ clientId, canEdit }: BrandReferenceCreatorsProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["brand-reference-creators", clientId],
    queryFn: () => listBrandReferenceCreators(clientId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["brand-reference-creators", clientId] });
  };

  const createMutation = useMutation({
    mutationFn: () => createBrandReferenceCreator({ clientId }),
    onSuccess: () => {
      invalidate();
      toast.success(t("clients.referenceCreators.created"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const creators = query.data ?? [];

  return (
    <Card className="rounded-xl">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{t("clients.referenceCreators.title")}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("clients.referenceCreators.hint")}
            </p>
          </div>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || creators.length >= 5}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {t("clients.referenceCreators.add")}
            </Button>
          ) : null}
        </div>
        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : creators.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("clients.referenceCreators.empty")}</p>
        ) : (
          <ul className="space-y-4">
            {creators.map((creator) => (
              <li key={creator.id} className="space-y-3 rounded-lg border p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t("clients.referenceCreators.name")}</Label>
                    <Input
                      defaultValue={creator.name}
                      disabled={!canEdit}
                      onBlur={(e) => {
                        const name = e.target.value.trim();
                        if (name === creator.name) return;
                        updateBrandReferenceCreator({ id: creator.id, clientId, name })
                          .then(() => invalidate())
                          .catch((err: Error) => toast.error(err.message));
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("clients.referenceCreators.url")}</Label>
                    <Input
                      defaultValue={creator.url}
                      disabled={!canEdit}
                      placeholder="https://instagram.com/..."
                      onBlur={(e) => {
                        const url = e.target.value.trim();
                        if (url === creator.url) return;
                        updateBrandReferenceCreator({ id: creator.id, clientId, url })
                          .then(() => invalidate())
                          .catch((err: Error) => toast.error(err.message));
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("clients.referenceCreators.notes")}</Label>
                  <Textarea
                    defaultValue={creator.notes}
                    disabled={!canEdit}
                    rows={2}
                    placeholder={t("clients.referenceCreators.notesPlaceholder")}
                    onBlur={(e) => {
                      const notes = e.target.value;
                      if (notes === creator.notes) return;
                      updateBrandReferenceCreator({ id: creator.id, clientId, notes })
                        .then(() => invalidate())
                        .catch((err: Error) => toast.error(err.message));
                    }}
                  />
                </div>
                {creator.pattern_summary ? (
                  <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                    {creator.pattern_summary}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {t("clients.referenceCreators.noSummary")}
                  </p>
                )}
                {canEdit ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={analyzingId !== null}
                      onClick={async () => {
                        setAnalyzingId(creator.id);
                        try {
                          await analyzeReferenceCreator({
                            creatorId: creator.id,
                            clientId,
                            locale: i18n.resolvedLanguage ?? i18n.language,
                          });
                          invalidate();
                          toast.success(t("clients.referenceCreators.analyzed"));
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : t("common.error"));
                        } finally {
                          setAnalyzingId(null);
                        }
                      }}
                    >
                      {analyzingId === creator.id ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1.5 h-4 w-4" />
                      )}
                      {t("clients.referenceCreators.analyze")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        deleteBrandReferenceCreator({ id: creator.id, clientId })
                          .then(() => {
                            invalidate();
                            toast.success(t("clients.referenceCreators.deleted"));
                          })
                          .catch((err: Error) => toast.error(err.message));
                      }}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      {t("clients.referenceCreators.delete")}
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
