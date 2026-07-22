import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Upload, FileText, Image as ImageIcon, Video, BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_authenticated/clients/$clientId/projects/$projectId/library")({
  component: LibraryPage,
});

function LibraryPage() {
  const { t } = useTranslation();
  const categories = [
    { key: "brand", icon: Sparkles },
    { key: "pdfs", icon: FileText },
    { key: "images", icon: ImageIcon },
    { key: "videos", icon: Video },
    { key: "references", icon: BookOpen },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button>
          <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("project.library.upload")}
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {categories.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.key} className="rounded-xl">
              <CardContent className="flex flex-col items-center justify-center gap-2 p-6 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="text-sm font-medium">{t(`project.library.categories.${c.key}`)}</p>
                <p className="text-xs text-muted-foreground">0</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <EmptyState icon={Upload} title={t("project.library.empty")} />
    </div>
  );
}
