import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import {
  ChipGroup,
  Field,
  SelectInput,
  SelectOption,
  TextArea,
  TextInput,
} from "@/components/site-briefing-fields";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  markSiteBriefingCompleted,
  updateSiteManagerNotes,
  upsertSiteBriefingForm,
  type ProjectSiteView,
} from "@/lib/api";
import {
  CTAS,
  DDIS,
  ESTILOS,
  OBJETIVOS,
  PRODUTOS_SERVICOS_HINT,
  SEGMENTOS,
  SITE_BRIEFING_STEPS,
  TONS,
  ctaPrincipal,
  emptySiteBriefingForm,
  estruturaSugerida,
  type SiteBriefingFormData,
} from "@/lib/site-briefing-form-data";
import { cn } from "@/lib/utils";

type SiteBriefingFormProps = {
  projectId: string;
  site: ProjectSiteView;
  canManage: boolean;
  onShare?: () => void;
  sharePending?: boolean;
};

export function SiteBriefingForm({
  projectId,
  site,
  canManage,
  onShare,
  sharePending,
}: SiteBriefingFormProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<SiteBriefingFormData>(
    () => site.formParsed ?? emptySiteBriefingForm,
  );
  const [managerNotes, setManagerNotes] = useState(site.manager_notes ?? "");

  useEffect(() => {
    setForm(site.formParsed ?? emptySiteBriefingForm);
    setManagerNotes(site.manager_notes ?? "");
  }, [site.project_id, site.updated_at, site.formParsed, site.manager_notes]);

  const set = <K extends keyof SiteBriefingFormData>(key: K, value: SiteBriefingFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const progresso = Math.round(((step + 1) / SITE_BRIEFING_STEPS.length) * 100);
  const estrutura = useMemo(() => estruturaSugerida(form.segmento), [form.segmento]);
  const podeAvancar = step !== 0 || (form.nome.trim() !== "" && form.segmento !== "");

  const saveFormMutation = useMutation({
    mutationFn: (next: SiteBriefingFormData) =>
      upsertSiteBriefingForm({ projectId, form: next }),
    onSuccess: (data) => {
      queryClient.setQueryData(["project-site", projectId], data);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const notesMutation = useMutation({
    mutationFn: (notes: string) =>
      updateSiteManagerNotes({ projectId, managerNotes: notes }),
    onSuccess: (data) => {
      queryClient.setQueryData(["project-site", projectId], data);
      toast.success(t("project.site.briefing.managerNotesSaved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      await upsertSiteBriefingForm({ projectId, form });
      return markSiteBriefingCompleted(projectId);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["project-site", projectId], data);
      toast.success(t("project.site.briefing.completed"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const persistForm = (next: SiteBriefingFormData = form) => {
    saveFormMutation.mutate(next);
  };

  const statusKey =
    site.briefing_status === "completed" ||
    site.briefing_status === "in_progress" ||
    site.briefing_status === "draft"
      ? site.briefing_status
      : "draft";

  const socialLabels = [
    ["instagram", "Instagram"],
    ["facebook", "Facebook"],
    ["linkedin", "LinkedIn"],
    ["tiktok", "TikTok"],
    ["youtube", "YouTube"],
    ["pinterest", "Pinterest"],
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {t("project.site.briefing.progress", {
              answered: site.answeredCount,
              total: site.totalCount,
            })}
            {" · "}
            {t(`project.site.briefing.status.${statusKey}`)}
            {saveFormMutation.isPending ? (
              <span className="ml-2 inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                {t("project.site.briefing.saving")}
              </span>
            ) : null}
          </p>
          <p className="text-sm text-muted-foreground">{t("project.site.briefing.hint")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && onShare ? (
            <Button type="button" variant="outline" onClick={onShare} disabled={sharePending}>
              <Share2 className="mr-2 h-4 w-4" aria-hidden="true" />
              {t("project.site.briefing.share")}
            </Button>
          ) : null}
          {canManage ? (
            <Button
              type="button"
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending || site.answeredCount === 0}
            >
              {completeMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              {t("project.site.briefing.markComplete")}
            </Button>
          ) : null}
        </div>
      </div>

      {canManage ? (
        <div className="space-y-2 rounded-lg border p-4">
          <Label htmlFor="manager-notes">{t("project.site.briefing.managerNotes")}</Label>
          <p className="text-xs text-muted-foreground">
            {t("project.site.briefing.managerNotesHint")}
          </p>
          <Textarea
            id="manager-notes"
            value={managerNotes}
            rows={4}
            placeholder={t("project.site.briefing.managerNotesPlaceholder")}
            onChange={(e) => setManagerNotes(e.target.value)}
            onBlur={() => {
              if ((site.manager_notes ?? "") !== managerNotes) {
                notesMutation.mutate(managerNotes);
              }
            }}
          />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <ol className="space-y-1">
            {SITE_BRIEFING_STEPS.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (i <= step) {
                      persistForm();
                      setStep(i);
                    }
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                    i === step ? "bg-muted" : "hover:bg-muted/60",
                    i > step && "cursor-default opacity-55",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
                      i < step
                        ? "bg-primary/12 text-primary"
                        : i === step
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-foreground">{s.title}</span>
                </button>
              </li>
            ))}
          </ol>
        </aside>

        <div className="rounded-xl border bg-card p-5 sm:p-6">
          <div className="mb-6">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-xl font-semibold">{SITE_BRIEFING_STEPS[step].title}</h2>
              <span className="text-xs text-muted-foreground">
                Etapa {step + 1} de {SITE_BRIEFING_STEPS.length}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{SITE_BRIEFING_STEPS[step].hint}</p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progresso}%` }}
              />
            </div>
          </div>

          <div className="space-y-5">
            {step === 0 && (
              <>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Nome da empresa">
                    <TextInput
                      value={form.nome}
                      onChange={(e) => set("nome", e.target.value)}
                      onBlur={() => persistForm()}
                      placeholder="Clínica Aurora Ltda."
                    />
                  </Field>
                  <Field label="Nome fantasia">
                    <TextInput
                      value={form.nomeFantasia}
                      onChange={(e) => set("nomeFantasia", e.target.value)}
                      onBlur={() => persistForm()}
                      placeholder="Aurora"
                    />
                  </Field>
                </div>
                <Field label="Segmento">
                  <SelectInput
                    value={form.segmento}
                    onChange={(value) => {
                      const next = { ...form, segmento: value };
                      setForm(next);
                      persistForm(next);
                    }}
                    placeholder="Selecione um segmento"
                  >
                    {SEGMENTOS.map((s) => (
                      <SelectOption key={s} value={s}>
                        {s}
                      </SelectOption>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Descrição do negócio" hint="Em poucas linhas, o que sua empresa faz.">
                  <TextArea
                    value={form.descricao}
                    onChange={(e) => set("descricao", e.target.value)}
                    onBlur={() => persistForm()}
                    placeholder="Atendimento psicológico online e presencial para adultos..."
                  />
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="História da empresa">
                    <TextArea
                      value={form.historia}
                      onChange={(e) => set("historia", e.target.value)}
                      onBlur={() => persistForm()}
                    />
                  </Field>
                  <Field label="Missão">
                    <TextArea
                      value={form.missao}
                      onChange={(e) => set("missao", e.target.value)}
                      onBlur={() => persistForm()}
                    />
                  </Field>
                  <Field label="Valores">
                    <TextArea
                      value={form.valores}
                      onChange={(e) => set("valores", e.target.value)}
                      onBlur={() => persistForm()}
                    />
                  </Field>
                  <Field label="Diferenciais">
                    <TextArea
                      value={form.diferenciais}
                      onChange={(e) => set("diferenciais", e.target.value)}
                      onBlur={() => persistForm()}
                    />
                  </Field>
                </div>
                <Field label="Produtos" hint={PRODUTOS_SERVICOS_HINT}>
                  <TextArea
                    rows={8}
                    value={form.produtos}
                    onChange={(e) => set("produtos", e.target.value)}
                    onBlur={() => persistForm()}
                  />
                </Field>
                <Field label="Serviços" hint={PRODUTOS_SERVICOS_HINT}>
                  <TextArea
                    rows={8}
                    value={form.servicos}
                    onChange={(e) => set("servicos", e.target.value)}
                    onBlur={() => persistForm()}
                  />
                </Field>
                <Field label="Público-alvo">
                  <TextInput
                    value={form.publicoAlvo}
                    onChange={(e) => set("publicoAlvo", e.target.value)}
                    onBlur={() => persistForm()}
                    placeholder="Adultos de 25 a 45 anos da região central"
                  />
                </Field>
                <div className="grid gap-5 sm:grid-cols-3">
                  <Field label="Cidade">
                    <TextInput
                      value={form.cidade}
                      onChange={(e) => set("cidade", e.target.value)}
                      onBlur={() => persistForm()}
                    />
                  </Field>
                  <Field label="Estado">
                    <TextInput
                      value={form.estado}
                      onChange={(e) => set("estado", e.target.value)}
                      onBlur={() => persistForm()}
                    />
                  </Field>
                  <Field label="País">
                    <TextInput
                      value={form.pais}
                      onChange={(e) => set("pais", e.target.value)}
                      onBlur={() => persistForm()}
                    />
                  </Field>
                </div>
                <Field label="Horário de funcionamento">
                  <TextInput
                    value={form.horario}
                    onChange={(e) => set("horario", e.target.value)}
                    onBlur={() => persistForm()}
                    placeholder="Seg a sex, 9h às 18h"
                  />
                </Field>
              </>
            )}

            {step === 1 && (
              <div className="rounded-xl bg-muted/50 p-5">
                <p className="text-sm leading-relaxed text-foreground">
                  Comece a preparar os arquivos do seu logo, fotos, vídeos e tudo o que se referir à
                  sua identidade de marca. Quando tiver tudo organizado numa pasta, enviaremos um
                  link para você compartilhar tudo conosco.
                </p>
              </div>
            )}

            {step === 2 && (
              <>
                <Field label="WhatsApp">
                  <div className="flex gap-2">
                    <SelectInput
                      value={form.ddi}
                      onChange={(value) => {
                        const next = { ...form, ddi: value };
                        setForm(next);
                        persistForm(next);
                      }}
                      className="w-32 shrink-0"
                    >
                      {DDIS.map((d) => (
                        <SelectOption key={d.code} value={d.code}>
                          {d.label}
                        </SelectOption>
                      ))}
                    </SelectInput>
                    <TextInput
                      value={form.whatsapp}
                      onChange={(e) => set("whatsapp", e.target.value)}
                      onBlur={() => persistForm()}
                      placeholder="11 91234-5678"
                    />
                  </div>
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Telefone">
                    <TextInput
                      value={form.telefone}
                      onChange={(e) => set("telefone", e.target.value)}
                      onBlur={() => persistForm()}
                    />
                  </Field>
                  <Field label="E-mail">
                    <TextInput
                      type="email"
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                      onBlur={() => persistForm()}
                    />
                  </Field>
                </div>
                <Field label="Endereço">
                  <TextInput
                    value={form.endereco}
                    onChange={(e) => set("endereco", e.target.value)}
                    onBlur={() => persistForm()}
                  />
                </Field>
                <Field label="Link do Google Maps">
                  <TextInput
                    value={form.maps}
                    onChange={(e) => set("maps", e.target.value)}
                    onBlur={() => persistForm()}
                  />
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  {socialLabels.map(([key, label]) => (
                    <Field key={key} label={label}>
                      <TextInput
                        value={form[key]}
                        onChange={(e) => set(key, e.target.value)}
                        onBlur={() => persistForm()}
                        placeholder="https://"
                      />
                    </Field>
                  ))}
                </div>
                <Field label="Vídeos" hint="YouTube, Reels, posts do Instagram ou Vimeo.">
                  <TextArea
                    value={form.videos.join("\n")}
                    onChange={(e) =>
                      set(
                        "videos",
                        e.target.value.split("\n").filter((v) => v.trim() !== ""),
                      )
                    }
                    onBlur={() => persistForm()}
                    placeholder={"https://youtube.com/watch?v=...\nhttps://instagram.com/reel/..."}
                  />
                </Field>
              </>
            )}

            {step === 3 && (
              <>
                <Field label="Estilo visual">
                  <ChipGroup
                    options={ESTILOS}
                    value={form.estilo}
                    onChange={(v) => {
                      const next = { ...form, estilo: v as string };
                      setForm(next);
                      persistForm(next);
                    }}
                  />
                </Field>
                <Field label="Tom da marca">
                  <ChipGroup
                    options={TONS}
                    value={form.tom}
                    onChange={(v) => {
                      const next = { ...form, tom: v as string };
                      setForm(next);
                      persistForm(next);
                    }}
                  />
                </Field>
              </>
            )}

            {step === 4 && (
              <>
                <Field label="Objetivo do site" hint="Selecione um ou mais.">
                  <ChipGroup
                    multi
                    options={OBJETIVOS}
                    value={form.objetivos}
                    onChange={(v) => {
                      const next = { ...form, objetivos: v as string[] };
                      setForm(next);
                      persistForm(next);
                    }}
                  />
                </Field>
                <Field label="Chamada principal (CTA)" hint="Selecione um ou mais.">
                  <ChipGroup
                    multi
                    options={CTAS}
                    value={form.ctas}
                    onChange={(v) => {
                      const next = { ...form, ctas: v as string[] };
                      setForm(next);
                      persistForm(next);
                    }}
                  />
                </Field>
              </>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <div className="rounded-xl bg-muted/50 p-5">
                  <p className="text-sm font-medium text-foreground">
                    Estrutura do site sugerida para o seu segmento.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {estrutura.map((s) => (
                      <span
                        key={s}
                        className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <dl className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["Empresa", form.nomeFantasia || form.nome || "—"],
                      ["Segmento", form.segmento || "—"],
                      ["Local", [form.cidade, form.estado].filter(Boolean).join(", ") || "—"],
                      ["WhatsApp", form.whatsapp ? `${form.ddi} ${form.whatsapp}` : "—"],
                      ["Estilo", form.estilo || "—"],
                      ["Tom", form.tom || "—"],
                      ["Objetivos", form.objetivos.join(", ") || "—"],
                      ["CTA", ctaPrincipal(form) || "—"],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="rounded-xl border px-4 py-3">
                      <dt className="text-xs text-muted-foreground">{k}</dt>
                      <dd className="mt-0.5 text-sm font-medium text-foreground">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>

          <div className="mt-8 flex items-center justify-between gap-3 border-t pt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                persistForm();
                setStep((s) => Math.max(0, s - 1));
              }}
              disabled={step === 0}
            >
              Voltar
            </Button>
            {step < SITE_BRIEFING_STEPS.length - 1 ? (
              <Button
                type="button"
                onClick={() => {
                  persistForm();
                  setStep((s) => s + 1);
                }}
                disabled={!podeAvancar}
              >
                Continuar
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending || !form.nome.trim() || !form.segmento}
              >
                {completeMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : null}
                Enviar briefing
              </Button>
            )}
          </div>
          {step === 0 && !podeAvancar ? (
            <p className="mt-3 text-right text-xs text-muted-foreground">
              Informe o nome da empresa e o segmento para continuar.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
