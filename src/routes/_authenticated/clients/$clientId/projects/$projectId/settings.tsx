import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { LocalizedTextInput, LocalizedTextarea } from "@/components/localized-text-field";
import { ProjectCategoriesField } from "@/components/project-categories-field";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  canAccessClient,
  canManageClient,
  getPrimaryProjectCategory,
  getProject,
  updateProject,
  type ProjectCategory,
} from "@/lib/api";
import { useEntitlements } from "@/hooks/use-entitlements";
import { useAppRole } from "@/hooks/use-app-role";
import {
  buildLocalizedFieldFromSource,
  ensureFieldsTranslated,
  getCanonicalText,
  getLocalizedPresetList,
  getLocalizedText,
  normalizeAppLocale,
  parseRowI18n,
  setLocalizedField,
  setLocalizedPresetList,
  translateTextField,
  type LocalizedField,
  type RowI18n,
} from "@/lib/i18n-content";

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
          className="min-w-0 flex-1"
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
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          onClick={addItem}
          disabled={!draft.trim()}
        >
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

async function translatePresetList(items: string[]): Promise<LocalizedField[]> {
  return Promise.all(
    items.map(async (text) => {
      try {
        return await translateTextField({ text });
      } catch {
        return buildLocalizedFieldFromSource(text, "pt-BR");
      }
    }),
  );
}

function ProjectSettingsPage() {
  const { clientId, projectId } = Route.useParams();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const { isClient } = useAppRole();
  const { entitlements } = useEntitlements();
  const presetsAllowed = isClient || entitlements.presets;
  const uiLocale = normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language);
  const [rowI18n, setRowI18n] = useState<RowI18n>({});
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("active");
  const [category, setCategory] = useState<ProjectCategory | null>(null);
  const [ctaPresets, setCtaPresets] = useState<string[]>([]);
  const [hashtagPresets, setHashtagPresets] = useState<string[]>([]);
  const [formBaseline, setFormBaseline] = useState<string | null>(null);
  const [ignoreUnsavedChanges, setIgnoreUnsavedChanges] = useState(false);

  const projectQuery = useQuery({
    queryKey: ["projects", "detail", projectId],
    queryFn: () => getProject(projectId),
  });

  const accessQuery = useQuery({
    queryKey: ["can-access", clientId],
    queryFn: () => canAccessClient(clientId),
  });

  const manageQuery = useQuery({
    queryKey: ["can-manage", clientId],
    queryFn: () => canManageClient(clientId),
  });

  const canManage = Boolean(manageQuery.data);

  useEffect(() => {
    if (!projectQuery.data) return;
    const nextI18n = parseRowI18n(projectQuery.data.i18n);
    const nextName = getLocalizedText(nextI18n, "name", projectQuery.data.name, uiLocale);
    const nextDescription = getLocalizedText(
      nextI18n,
      "description",
      projectQuery.data.description ?? "",
      uiLocale,
    );
    const nextStatus = projectQuery.data.status;
    const nextCategory = getPrimaryProjectCategory(projectQuery.data.categories);
    const nextCta = getLocalizedPresetList(
      nextI18n,
      "cta_presets",
      projectQuery.data.cta_presets ?? [],
      uiLocale,
    );
    const nextHashtags = getLocalizedPresetList(
      nextI18n,
      "hashtag_presets",
      projectQuery.data.hashtag_presets ?? [],
      uiLocale,
    );
    setRowI18n(nextI18n);
    setName(nextName);
    setDescription(nextDescription);
    setStatus(nextStatus);
    setCategory(nextCategory);
    setCtaPresets(nextCta);
    setHashtagPresets(nextHashtags);
    setFormBaseline(
      JSON.stringify({
        name: nextName,
        description: nextDescription,
        status: nextStatus,
        category: nextCategory,
        ctaPresets: nextCta,
        hashtagPresets: nextHashtags,
        i18n: nextI18n,
      }),
    );
    setIgnoreUnsavedChanges(false);
  }, [projectQuery.data, uiLocale]);

  const formSnapshot = JSON.stringify({
    name,
    description,
    status,
    category,
    ctaPresets,
    hashtagPresets,
    i18n: rowI18n,
  });
  const isDirty = Boolean(formBaseline) && !ignoreUnsavedChanges && formSnapshot !== formBaseline;

  const saveMutation = useMutation({
    mutationFn: async () => {
      let nextI18n = rowI18n;
      if (canManage) {
        nextI18n = await ensureFieldsTranslated(nextI18n, {
          name,
          description,
        });
      }
      const shouldSavePresets = presetsAllowed;
      const [ctaBlocks, hashtagBlocks] = shouldSavePresets
        ? await Promise.all([
            translatePresetList(ctaPresets),
            translatePresetList(hashtagPresets),
          ])
        : [[], []];
      if (shouldSavePresets) {
        nextI18n = setLocalizedPresetList(nextI18n, "cta_presets", ctaBlocks);
        nextI18n = setLocalizedPresetList(nextI18n, "hashtag_presets", hashtagBlocks);
      }

      const canonicalCta = ctaBlocks.map(
        (block, index) => block.values[block.source] ?? ctaPresets[index] ?? "",
      );
      const canonicalHashtags = hashtagBlocks.map(
        (block, index) => block.values[block.source] ?? hashtagPresets[index] ?? "",
      );

      return updateProject(projectId, {
        name: canManage
          ? getCanonicalText(nextI18n, "name", name)
          : (projectQuery.data?.name ?? name),
        description: canManage
          ? getCanonicalText(nextI18n, "description", description)
          : (projectQuery.data?.description ?? ""),
        ...(canManage
          ? { status, categories: category ? [category] : ["instagram"] }
          : {}),
        ...(shouldSavePresets
          ? {
              ctaPresets: canonicalCta,
              hashtagPresets: canonicalHashtags,
            }
          : {}),
        i18n: nextI18n,
      });
    },
    onSuccess: () => {
      setIgnoreUnsavedChanges(true);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(t("common.saved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (accessQuery.isLoading || manageQuery.isLoading || projectQuery.isLoading) {
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
    <>
      <UnsavedChangesGuard isDirty={isDirty} />
      <form
        className="max-w-lg space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          saveMutation.mutate();
        }}
      >
      {canManage ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="settings-name">{t("clients.projectName")}</Label>
            <LocalizedTextInput
              id="settings-name"
              field="name"
              i18n={rowI18n}
              fallback={name}
              onI18nCommit={(payload) => {
                setRowI18n((prev) => setLocalizedField(prev, payload.field, payload.block));
                setName(payload.display);
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="settings-description">{t("clients.projectDescription")}</Label>
            <LocalizedTextarea
              id="settings-description"
              field="description"
              i18n={rowI18n}
              fallback={description}
              rows={4}
              onI18nCommit={(payload) => {
                setRowI18n((prev) => setLocalizedField(prev, payload.field, payload.block));
                setDescription(payload.display);
              }}
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
          <ProjectCategoriesField value={category} onChange={setCategory} required />
        </>
      ) : null}

      {presetsAllowed ? (
      <div className={canManage ? "space-y-4 border-t pt-4" : "space-y-4"}>
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
      ) : canManage ? (
        <p className="border-t pt-4 text-sm text-muted-foreground">
          {t("accessRelease.featureLocked")}
        </p>
      ) : null}

      <Button
        type="submit"
        loading={saveMutation.isPending}
        loadingLabel={t("common.saving")}
        disabled={canManage && !name.trim()}
      >
        {t("common.save")}
      </Button>
    </form>
    </>
  );
}
