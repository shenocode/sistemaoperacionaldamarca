import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
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
import { canManageClient, getProject, updateProject } from "@/lib/api";

export const Route = createFileRoute(
  "/_authenticated/clients/$clientId/projects/$projectId/settings",
)({
  component: ProjectSettingsPage,
});

function PresetListEditor({
  label,
  hint,
  placeholder,
  addLabel,
  removeLabel,
  emptyLabel,
  items,
  onChange,
}: {
  label: string;
  hint: string;
  placeholder: string;
  addLabel: string;
  removeLabel: string;
  emptyLabel: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const addItem = () => {
    const value = draft.trim();
    if (!value) return;
    if (items.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...items, value]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <div>
        <Label>{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={addItem} disabled={!draft.trim()}>
          <Plus className="h-4 w-4" />
          <span className="sr-only">{addLabel}</span>
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2 rounded-md border bg-background px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{item}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground"
                onClick={() => onChange(items.filter((entry) => entry !== item))}
                aria-label={removeLabel}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProjectSettingsPage() {
  const { clientId, projectId } = Route.useParams();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");
  const [ctaPresets, setCtaPresets] = useState<string[]>([]);
  const [hashtagPresets, setHashtagPresets] = useState<string[]>([]);

  const projectQuery = useQuery({
    queryKey: ["projects", "detail", projectId],
    queryFn: () => getProject(projectId),
  });

  const manageQuery = useQuery({
    queryKey: ["can-manage", clientId],
    queryFn: () => canManageClient(clientId),
  });

  useEffect(() => {
    if (!projectQuery.data) return;
    setName(projectQuery.data.name);
    setDescription(projectQuery.data.description ?? "");
    setStatus(projectQuery.data.status);
    setCtaPresets(projectQuery.data.cta_presets ?? []);
    setHashtagPresets(projectQuery.data.hashtag_presets ?? []);
  }, [projectQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateProject(projectId, {
        name,
        description,
        status,
        ctaPresets,
        hashtagPresets,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(t("common.saved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (manageQuery.isLoading || projectQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  if (!manageQuery.data) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
        {t("project.settings.readOnly")}
      </div>
    );
  }

  return (
    <form
      className="max-w-lg space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        saveMutation.mutate();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="settings-name">{t("clients.projectName")}</Label>
        <Input
          id="settings-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="settings-description">{t("clients.projectDescription")}</Label>
        <Textarea
          id="settings-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />
      </div>
      <div className="space-y-1.5">
        <Label>{t("project.settings.status")}</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{t("clients.active")}</SelectItem>
            <SelectItem value="archived">{t("clients.archived")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4 border-t pt-4">
        <div>
          <h2 className="text-sm font-medium">{t("project.settings.presetsTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("project.settings.presetsHint")}</p>
        </div>
        <PresetListEditor
          label={t("project.settings.ctaPresets")}
          hint={t("project.settings.ctaPresetsHint")}
          placeholder={t("project.settings.ctaPlaceholder")}
          addLabel={t("project.settings.addPreset")}
          removeLabel={t("project.settings.removePreset")}
          emptyLabel={t("project.settings.noCtaPresets")}
          items={ctaPresets}
          onChange={setCtaPresets}
        />
        <PresetListEditor
          label={t("project.settings.hashtagPresets")}
          hint={t("project.settings.hashtagPresetsHint")}
          placeholder={t("project.settings.hashtagPlaceholder")}
          addLabel={t("project.settings.addPreset")}
          removeLabel={t("project.settings.removePreset")}
          emptyLabel={t("project.settings.noHashtagPresets")}
          items={hashtagPresets}
          onChange={setHashtagPresets}
        />
      </div>

      <Button type="submit" disabled={saveMutation.isPending || !name.trim()}>
        {t("common.save")}
      </Button>
    </form>
  );
}
