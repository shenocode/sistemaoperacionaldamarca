import { useTranslation } from "react-i18next";
import { BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";

type BrandGuideViewProps = {
  markdown: string | null | undefined;
  updatedAt?: string | null;
};

export function BrandGuideView({ markdown, updatedAt }: BrandGuideViewProps) {
  const { t } = useTranslation();
  const content = markdown?.trim();

  if (!content) {
    return (
      <EmptyState
        icon={BookOpen}
        title={t("briefing.guide.emptyTitle")}
        description={t("briefing.guide.emptyDescription")}
      />
    );
  }

  return (
    <Card className="rounded-xl">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">{t("briefing.guide.title")}</CardTitle>
        {updatedAt ? (
          <p className="text-xs text-muted-foreground">
            {t("briefing.guide.updatedAt", {
              date: new Date(updatedAt).toLocaleString(),
            })}
          </p>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
          {content}
        </div>
      </CardContent>
    </Card>
  );
}
