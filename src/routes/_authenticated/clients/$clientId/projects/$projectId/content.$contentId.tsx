import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Check, MessageSquareWarning, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status-badge";

export const Route = createFileRoute(
  "/_authenticated/clients/$clientId/projects/$projectId/content/$contentId",
)({
  head: () => ({ meta: [{ title: "Conteúdo — SOM" }, { name: "robots", content: "noindex" }] }),
  component: ContentDetailPage,
});

function ContentDetailPage() {
  const { clientId, projectId, contentId } = Route.useParams();
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          to="/clients/$clientId/projects/$projectId/content"
          params={{ clientId, projectId }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {t("project.tabs.content")}
        </Link>
        <div className="flex items-center gap-2">
          <StatusBadge status="review" />
          <Button variant="outline">
            <MessageSquareWarning className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("project.detail.requestChanges")}
          </Button>
          <Button>
            <Check className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("project.detail.approve")}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">{t("project.detail.preview")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                #{contentId}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardContent className="space-y-4 p-6">
              <div className="space-y-1.5">
                <Label htmlFor="caption">{t("project.detail.caption")}</Label>
                <Textarea id="caption" rows={4} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="cta">{t("project.detail.cta")}</Label>
                  <Input id="cta" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hashtags">{t("project.detail.hashtags")}</Label>
                  <Input id="hashtags" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-base">{t("project.detail.comments")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{t("project.detail.noComments")}</p>
              <form className="flex gap-2">
                <Input
                  placeholder={t("project.detail.leaveComment")}
                  aria-label={t("project.detail.leaveComment")}
                />
                <Button type="submit" size="icon" aria-label={t("project.detail.send")}>
                  <Send className="h-4 w-4" aria-hidden="true" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">{t("project.detail.versions")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              <li className="flex items-center justify-between rounded-md border p-3 text-sm">
                <span className="font-medium">{t("project.detail.version")} 1</span>
                <span className="text-xs text-muted-foreground">—</span>
              </li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
