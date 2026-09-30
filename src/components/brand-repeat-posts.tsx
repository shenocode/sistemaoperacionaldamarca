import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ExternalLink, Repeat2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  getLocalizedText,
  listClientRepeatFormatPosts,
  normalizeAppLocale,
  updateContentRepeatLearning,
  type RepeatFormatPost,
} from "@/lib/api";

type BrandRepeatPostsProps = {
  clientId: string;
  canEdit: boolean;
};

export function BrandRepeatPosts({ clientId, canEdit }: BrandRepeatPostsProps) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const uiLocale = normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language);

  const query = useQuery({
    queryKey: ["brand-repeat-posts", clientId],
    queryFn: () => listClientRepeatFormatPosts(clientId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["brand-repeat-posts", clientId] });
    void queryClient.invalidateQueries({ queryKey: ["content"] });
  };

  const removeMutation = useMutation({
    mutationFn: (contentId: string) =>
      updateContentRepeatLearning({ contentId, repeatFormat: false }),
    onSuccess: () => {
      invalidate();
      toast.success(t("clients.repeatPosts.removed"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const posts = query.data ?? [];

  const grouped = posts.reduce<
    Record<string, { projectName: string; projectI18n: RepeatFormatPost["project_i18n"]; items: RepeatFormatPost[] }>
  >((acc, post) => {
    const bucket = acc[post.project_id] ?? {
      projectName: post.project_name,
      projectI18n: post.project_i18n,
      items: [],
    };
    bucket.items.push(post);
    acc[post.project_id] = bucket;
    return acc;
  }, {});

  return (
    <Card className="rounded-xl border-amber-500/25 bg-amber-500/5">
      <CardContent className="space-y-4 p-5">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Repeat2 className="size-4 text-amber-700 dark:text-amber-300" aria-hidden="true" />
            {t("clients.repeatPosts.title")}
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{t("clients.repeatPosts.hint")}</p>
        </div>

        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("clients.repeatPosts.empty")}</p>
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([projectId, group]) => (
              <div key={projectId} className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {getLocalizedText(group.projectI18n, "name", group.projectName, uiLocale)}
                </p>
                <ul className="space-y-3">
                  {group.items.map((post) => {
                    const title = getLocalizedText(post.i18n, "title", post.title, uiLocale);
                    return (
                      <li
                        key={post.id}
                        className="space-y-2 rounded-lg border border-border bg-background/80 p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="font-medium leading-snug">{title || t("clients.repeatPosts.untitled")}</p>
                            <p className="text-xs text-muted-foreground">
                              {t(`project.detail.formats.${post.format}`, {
                                defaultValue: post.format,
                              })}
                              {post.theme ? ` · ${post.theme}` : ""}
                            </p>
                            {(post.performance_reach || post.performance_retention) && (
                              <p className="text-xs text-muted-foreground">
                                {[
                                  post.performance_reach
                                    ? `${t("project.learning.reach")}: ${post.performance_reach}`
                                    : null,
                                  post.performance_retention
                                    ? `${t("project.learning.retention")}: ${post.performance_retention}`
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-1">
                            <Button type="button" size="sm" variant="outline" asChild>
                              <Link
                                to="/clients/$clientId/projects/$projectId/content/$contentId"
                                params={{
                                  clientId,
                                  projectId: post.project_id,
                                  contentId: post.id,
                                }}
                              >
                                <ExternalLink className="mr-1.5 size-3.5" aria-hidden="true" />
                                {t("clients.repeatPosts.open")}
                              </Link>
                            </Button>
                            {canEdit ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={removeMutation.isPending}
                                onClick={() => removeMutation.mutate(post.id)}
                              >
                                <Trash2 className="mr-1.5 size-3.5" aria-hidden="true" />
                                {t("clients.repeatPosts.remove")}
                              </Button>
                            ) : null}
                          </div>
                        </div>
                        {canEdit ? (
                          <Textarea
                            rows={2}
                            defaultValue={post.performance_note}
                            placeholder={t("clients.repeatPosts.notePlaceholder")}
                            onBlur={(e) => {
                              const note = e.target.value;
                              if (note === post.performance_note) return;
                              updateContentRepeatLearning({
                                contentId: post.id,
                                performanceNote: note,
                              })
                                .then(() => {
                                  invalidate();
                                  toast.success(t("clients.repeatPosts.noteSaved"));
                                })
                                .catch((err: Error) => toast.error(err.message));
                            }}
                          />
                        ) : post.performance_note ? (
                          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                            {post.performance_note}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
