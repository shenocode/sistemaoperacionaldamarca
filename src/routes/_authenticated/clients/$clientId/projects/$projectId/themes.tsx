import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Copy, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  addProjectThemePreset,
  canAccessClient,
  createThemeReference,
  deleteThemeReference,
  duplicateThemeReference,
  getProject,
  listThemeReferences,
  updateThemeReference,
  type ThemeReference,
} from "@/lib/api";

export const Route = createFileRoute(
  "/_authenticated/clients/$clientId/projects/$projectId/themes",
)({
  head: () => ({
    meta: [{ title: "Temas — SOM" }, { name: "robots", content: "noindex" }],
  }),
  component: ProjectThemesPage,
});

const NEW_THEME_VALUE = "__new_theme__";
const EMPTY_THEME_VALUE = "__empty_theme__";

function normalizeDraftLinks(links: string[]): string[] {
  const trimmed = links.map((link) => link.trim()).filter(Boolean);
  return trimmed.length > 0 ? trimmed : [""];
}

function ThemeReferenceCard({
  row,
  themeOptions,
  disabled,
  onRequestNewTheme,
  onSaved,
  onDuplicate,
  onDelete,
}: {
  row: ThemeReference;
  themeOptions: string[];
  disabled?: boolean;
  onRequestNewTheme: () => void;
  onSaved: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [theme, setTheme] = useState(row.theme);
  const [recommendations, setRecommendations] = useState(row.recommendations);
  const [youtubeLinks, setYoutubeLinks] = useState(() =>
    normalizeDraftLinks(row.youtube_links ?? []),
  );
  const [instagramLinks, setInstagramLinks] = useState(() =>
    normalizeDraftLinks(row.instagram_links ?? []),
  );

  useEffect(() => {
    setTheme(row.theme);
    setRecommendations(row.recommendations);
    setYoutubeLinks(normalizeDraftLinks(row.youtube_links ?? []));
    setInstagramLinks(normalizeDraftLinks(row.instagram_links ?? []));
  }, [row]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateThemeReference({
        id: row.id,
        projectId: row.project_id,
        theme,
        recommendations,
        youtubeLinks,
        instagramLinks,
      }),
    onSuccess: () => {
      onSaved();
      toast.success(t("project.themes.saved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const selectValue = theme.trim() ? theme : EMPTY_THEME_VALUE;
  const options = Array.from(
    new Set([...themeOptions, ...(theme.trim() ? [theme] : [])]),
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label>{t("project.themes.themeLabel")}</Label>
          <Select
            value={selectValue}
            disabled={disabled}
            onValueChange={(value) => {
              if (value === NEW_THEME_VALUE) {
                onRequestNewTheme();
                return;
              }
              setTheme(value === EMPTY_THEME_VALUE ? "" : value);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("project.themes.themePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY_THEME_VALUE}>
                {t("project.themes.themeEmpty")}
              </SelectItem>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
              <SelectItem value={NEW_THEME_VALUE}>{t("project.calendar.newTheme")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled}
            onClick={onDuplicate}
            aria-label={t("project.themes.duplicate")}
            title={t("project.themes.duplicate")}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled}
            onClick={onDelete}
            aria-label={t("project.themes.delete")}
            title={t("project.themes.delete")}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`theme-recs-${row.id}`}>{t("project.themes.recommendations")}</Label>
        <Textarea
          id={`theme-recs-${row.id}`}
          value={recommendations}
          disabled={disabled}
          rows={4}
          placeholder={t("project.themes.recommendationsPlaceholder")}
          onChange={(e) => setRecommendations(e.target.value)}
        />
      </div>

      <LinkListEditor
        label={t("project.themes.youtubeLinks")}
        placeholder={t("project.themes.youtubePlaceholder")}
        addLabel={t("project.themes.addLink")}
        removeLabel={t("project.themes.removeLink")}
        links={youtubeLinks}
        disabled={disabled}
        onChange={setYoutubeLinks}
      />

      <LinkListEditor
        label={t("project.themes.instagramLinks")}
        placeholder={t("project.themes.instagramPlaceholder")}
        addLabel={t("project.themes.addLink")}
        removeLabel={t("project.themes.removeLink")}
        links={instagramLinks}
        disabled={disabled}
        onChange={setInstagramLinks}
      />

      <Button
        type="button"
        disabled={disabled || saveMutation.isPending}
        onClick={() => saveMutation.mutate()}
      >
        {t("common.save")}
      </Button>
    </div>
  );
}

function LinkListEditor({
  label,
  placeholder,
  addLabel,
  removeLabel,
  links,
  disabled,
  onChange,
}: {
  label: string;
  placeholder: string;
  addLabel: string;
  removeLabel: string;
  links: string[];
  disabled?: boolean;
  onChange: (links: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <ul className="space-y-2">
        {links.map((link, index) => (
          <li key={index} className="flex gap-2">
            <Input
              className="min-w-0 flex-1"
              value={link}
              disabled={disabled}
              placeholder={placeholder}
              onChange={(e) => {
                const next = [...links];
                next[index] = e.target.value;
                onChange(next);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground"
              disabled={disabled || links.length <= 1}
              onClick={() => onChange(links.filter((_, i) => i !== index))}
              aria-label={removeLabel}
            >
              <X className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => onChange([...links, ""])}
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        {addLabel}
      </Button>
    </div>
  );
}

function ProjectThemesPage() {
  const { clientId, projectId } = Route.useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [newThemeDialogForId, setNewThemeDialogForId] = useState<string | null>(null);
  const [newTheme, setNewTheme] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ThemeReference | null>(null);

  const accessQuery = useQuery({
    queryKey: ["can-access", clientId],
    queryFn: () => canAccessClient(clientId),
  });

  const projectQuery = useQuery({
    queryKey: ["projects", "detail", projectId],
    queryFn: () => getProject(projectId),
  });

  const referencesQuery = useQuery({
    queryKey: ["theme-references", projectId],
    queryFn: () => listThemeReferences(projectId),
  });

  const canEdit = Boolean(accessQuery.data);
  const themePresets = projectQuery.data?.theme_presets ?? [];
  const rows = referencesQuery.data ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["theme-references", projectId] });
    queryClient.invalidateQueries({ queryKey: ["projects", "detail", projectId] });
  };

  const createMutation = useMutation({
    mutationFn: () => createThemeReference({ projectId }),
    onSuccess: () => {
      invalidate();
      toast.success(t("project.themes.created"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => duplicateThemeReference({ id, projectId }),
    onSuccess: () => {
      invalidate();
      toast.success(t("project.themes.duplicated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteThemeReference({ id, projectId }),
    onSuccess: () => {
      setDeleteTarget(null);
      invalidate();
      toast.success(t("project.themes.deleted"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addThemeMutation = useMutation({
    mutationFn: async ({ referenceId, theme }: { referenceId: string; theme: string }) => {
      await addProjectThemePreset(projectId, theme);
      return updateThemeReference({
        id: referenceId,
        projectId,
        theme,
      });
    },
    onSuccess: () => {
      setNewThemeDialogForId(null);
      setNewTheme("");
      invalidate();
      toast.success(t("project.calendar.themeAdded"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (accessQuery.isLoading || projectQuery.isLoading || referencesQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  if (!accessQuery.data) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
        {t("project.settings.readOnly")}
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium">{t("project.themes.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("project.themes.hint")}</p>
        </div>
        <Button
          type="button"
          disabled={!canEdit || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {t("project.themes.add")}
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={t("project.themes.empty")}
          description={t("project.themes.emptyHint")}
        />
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <ThemeReferenceCard
              key={row.id}
              row={row}
              themeOptions={themePresets}
              disabled={!canEdit}
              onRequestNewTheme={() => {
                setNewTheme("");
                setNewThemeDialogForId(row.id);
              }}
              onSaved={invalidate}
              onDuplicate={() => duplicateMutation.mutate(row.id)}
              onDelete={() => setDeleteTarget(row)}
            />
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(newThemeDialogForId)}
        onOpenChange={(open) => {
          if (!open) {
            setNewThemeDialogForId(null);
            setNewTheme("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("project.calendar.newThemeTitle")}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newThemeDialogForId || !newTheme.trim()) return;
              addThemeMutation.mutate({
                referenceId: newThemeDialogForId,
                theme: newTheme.trim(),
              });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="themes-new-theme">{t("project.themes.themeLabel")}</Label>
              <Input
                id="themes-new-theme"
                value={newTheme}
                onChange={(e) => setNewTheme(e.target.value)}
                placeholder={t("project.calendar.themePlaceholder")}
                autoFocus
                required
              />
              <p className="text-xs text-muted-foreground">{t("project.calendar.newThemeHint")}</p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setNewThemeDialogForId(null);
                  setNewTheme("");
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={addThemeMutation.isPending || !newTheme.trim()}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("project.themes.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("project.themes.deleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
              }}
            >
              {t("project.themes.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
