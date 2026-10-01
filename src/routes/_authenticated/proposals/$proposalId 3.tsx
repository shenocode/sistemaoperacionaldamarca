import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Download, ImagePlus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { ProposalSectionsEditor } from "@/components/proposals/proposal-sections-editor";
import { DragHandle, useListReorder } from "@/components/proposals/reorderable";
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
import { Textarea } from "@/components/ui/textarea";
import {
  PROPOSAL_COVER_ACCEPT,
  getCommercialProposal,
  getMyProfile,
  hydrateProposalDraft,
  isAdmin,
  listClients,
  resolvePostLoginPath,
  updateCommercialProposal,
  uploadProposalCover,
  type CommercialTerms,
  type InvestmentItem,
  type ProposalDraftFields,
  type ProposalSection,
} from "@/lib/api";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/proposals/$proposalId 3")({
  beforeLoad: async () => {
    if (!(await isAdmin())) {
      const dest = await resolvePostLoginPath();
      if (dest.to === "/clients/$clientId/projects/$projectId/feed") {
        throw redirect({ to: dest.to, params: dest.params, search: dest.search });
      }
      throw redirect({ to: dest.to });
    }
  },
  head: () => ({
    meta: [
      { title: "Editar proposta — SOM" },
      { name: "description", content: "Edite a proposta comercial e gere o PDF." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProposalEditorPage,
});

function serializeDraft(
  clientId: string,
  draft: ProposalDraftFields,
): string {
  return JSON.stringify({ clientId, draft });
}

function ProposalEditorPage() {
  const { t } = useTranslation();
  const { proposalId } = Route.useParams();
  const queryClient = useQueryClient();
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [clientId, setClientId] = useState("");
  const [draft, setDraft] = useState<ProposalDraftFields | null>(null);
  const [baseline, setBaseline] = useState<string | null>(null);
  const [ignoreUnsaved, setIgnoreUnsaved] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const proposalQuery = useQuery({
    queryKey: ["commercial-proposal", proposalId],
    queryFn: () => getCommercialProposal(proposalId),
  });

  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: listClients,
  });

  const profileQuery = useQuery({
    queryKey: ["my-profile"],
    queryFn: getMyProfile,
  });

  useEffect(() => {
    const row = proposalQuery.data;
    if (!row) return;
    const hydrated = hydrateProposalDraft(row, row.clients?.name ?? "");
    setClientId(row.client_id);
    setDraft(hydrated);
    setBaseline(serializeDraft(row.client_id, hydrated));
    setIgnoreUnsaved(false);
  }, [proposalQuery.data]);

  const isDirty = useMemo(() => {
    if (!draft || !baseline || ignoreUnsaved) return false;
    return serializeDraft(clientId, draft) !== baseline;
  }, [baseline, clientId, draft, ignoreUnsaved]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft) throw new Error(t("proposals.loadError"));
      return updateCommercialProposal({
        proposalId,
        clientId,
        title: draft.title,
        subtitle: draft.subtitle,
        scopeSummary: draft.scope_summary,
        proposalMonth: draft.proposal_month,
        coverImageUrl: draft.cover_image_url,
        sections: draft.sections,
        investmentItems: draft.investment_items,
        commercialTerms: draft.commercial_terms,
        status: draft.status,
      });
    },
    onSuccess: (row) => {
      const hydrated = hydrateProposalDraft(
        row,
        clientsQuery.data?.find((c) => c.id === row.client_id)?.name ?? "",
      );
      setDraft(hydrated);
      setBaseline(serializeDraft(row.client_id, hydrated));
      setIgnoreUnsaved(true);
      queryClient.invalidateQueries({ queryKey: ["commercial-proposals"] });
      queryClient.invalidateQueries({ queryKey: ["commercial-proposal", proposalId] });
      toast.success(t("proposals.saved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  async function handleCoverSelected(file: File | undefined) {
    if (!file || !draft) return;
    setUploadingCover(true);
    try {
      const url = await uploadProposalCover({ proposalId, file });
      setDraft({ ...draft, cover_image_url: url });
      toast.success(t("proposals.coverUploaded"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("proposals.pdfError"));
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  }

  async function handleGeneratePdf() {
    if (!draft) return;
    setGeneratingPdf(true);
    try {
      if (isDirty) {
        await saveMutation.mutateAsync();
      }
      const [{ downloadProposalPdf }, profile] = await Promise.all([
        import("@/components/proposals/download-proposal-pdf"),
        profileQuery.data ? Promise.resolve(profileQuery.data) : getMyProfile(),
      ]);
      const clientName =
        clientsQuery.data?.find((c) => c.id === clientId)?.name ??
        proposalQuery.data?.clients?.name ??
        "Cliente";

      await downloadProposalPdf(
        {
          clientName,
          title: draft.title,
          subtitle: draft.subtitle,
          scopeSummary: draft.scope_summary,
          proposalMonth: draft.proposal_month,
          coverImageUrl: draft.cover_image_url,
          sections: draft.sections,
          investmentItems: draft.investment_items,
          commercialTerms: draft.commercial_terms,
          gestor: {
            fullName: profile.full_name,
            companyName: profile.company_name,
            email: profile.email,
            whatsapp: profile.whatsapp,
            website: profile.website,
            logoUrl: profile.logo_url,
          },
        },
        `proposta-${clientName.replace(/\s+/g, "-").toLowerCase()}.pdf`,
      );
      toast.success(t("proposals.pdfReady"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("proposals.pdfError"));
    } finally {
      setGeneratingPdf(false);
    }
  }

  function patchDraft(partial: Partial<ProposalDraftFields>) {
    if (!draft) return;
    setDraft({ ...draft, ...partial });
  }

  function patchTerms(partial: Partial<CommercialTerms>) {
    if (!draft) return;
    setDraft({
      ...draft,
      commercial_terms: { ...draft.commercial_terms, ...partial },
    });
  }

  function patchInvestment(items: InvestmentItem[]) {
    patchDraft({ investment_items: items });
  }

  function patchSections(sections: ProposalSection[]) {
    patchDraft({ sections });
  }

  if (proposalQuery.isLoading || !draft) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  if (proposalQuery.isError || !proposalQuery.data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <p className="text-sm text-destructive">
          {(proposalQuery.error as Error | null)?.message || t("proposals.loadError")}
        </p>
        <Button asChild variant="secondary">
          <Link to="/proposals">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {t("proposals.backToList")}
          </Link>
        </Button>
      </div>
    );
  }

  const clients = clientsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 md:p-8">
      <UnsavedChangesGuard isDirty={isDirty} />
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/proposals">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {t("proposals.backToList")}
          </Link>
        </Button>
      </div>

      <PageHeader
        title={proposalQuery.data.clients?.name ?? t("proposals.title")}
        description={t("proposals.subtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={saveMutation.isPending || !isDirty}
              onClick={() => saveMutation.mutate()}
            >
              {t("proposals.save")}
            </Button>
            <Button
              disabled={generatingPdf || saveMutation.isPending}
              onClick={() => void handleGeneratePdf()}
            >
              <Download className="mr-1.5 h-4 w-4" />
              {generatingPdf ? t("proposals.generatingPdf") : t("proposals.generatePdf")}
            </Button>
          </div>
        }
      />

      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label>{t("proposals.client")}</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger>
              <SelectValue placeholder={t("proposals.selectClient")} />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>{t("proposals.status")}</Label>
          <Select
            value={draft.status}
            onValueChange={(value: "draft" | "ready") => patchDraft({ status: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">{t("proposals.statusDraft")}</SelectItem>
              <SelectItem value="ready">{t("proposals.statusReady")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm font-medium">{t("proposals.cover")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("proposals.titleField")}</Label>
              <Input
                value={draft.title}
                onChange={(e) => patchDraft({ title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("proposals.month")}</Label>
              <Input
                value={draft.proposal_month}
                onChange={(e) => patchDraft({ proposal_month: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("proposals.subtitleField")}</Label>
            <Input
              value={draft.subtitle}
              onChange={(e) => patchDraft({ subtitle: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("proposals.scope")}</Label>
            <Textarea
              rows={3}
              value={draft.scope_summary}
              onChange={(e) => patchDraft({ scope_summary: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("proposals.coverImage")}</Label>
            {draft.cover_image_url ? (
              <img
                src={draft.cover_image_url}
                alt=""
                className="h-40 w-full rounded-md object-cover"
              />
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={uploadingCover}
                onClick={() => coverInputRef.current?.click()}
              >
                <ImagePlus className="mr-1.5 h-4 w-4" />
                {uploadingCover ? t("proposals.coverUploading") : t("proposals.coverUpload")}
              </Button>
              {draft.cover_image_url ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => patchDraft({ cover_image_url: null })}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  {t("proposals.coverRemove")}
                </Button>
              ) : null}
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept={PROPOSAL_COVER_ACCEPT}
              className="sr-only"
              onChange={(e) => void handleCoverSelected(e.target.files?.[0])}
            />
          </div>
        </div>

        <ProposalSectionsEditor sections={draft.sections} onChange={patchSections} />

        <InvestmentItemsEditor
          items={draft.investment_items}
          onChange={patchInvestment}
        />

        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm font-medium">{t("proposals.commercialTerms")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("proposals.validityDays")}</Label>
              <Input
                value={draft.commercial_terms.validityDays}
                onChange={(e) => patchTerms({ validityDays: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("proposals.payment")}</Label>
              <Input
                value={draft.commercial_terms.payment}
                onChange={(e) => patchTerms({ payment: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("proposals.termsNotes")}</Label>
            <Textarea
              rows={3}
              value={draft.commercial_terms.notes}
              onChange={(e) => patchTerms({ notes: e.target.value })}
            />
          </div>
          <NextStepsEditor
            steps={draft.commercial_terms.nextSteps}
            onChange={(nextSteps) => patchTerms({ nextSteps })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("proposals.clientSignLabel")}</Label>
              <Input
                value={draft.commercial_terms.clientSignLabel}
                onChange={(e) => patchTerms({ clientSignLabel: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("proposals.contractorSignLabel")}</Label>
              <Input
                value={draft.commercial_terms.contractorSignLabel}
                onChange={(e) => patchTerms({ contractorSignLabel: e.target.value })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InvestmentItemsEditor({
  items,
  onChange,
}: {
  items: InvestmentItem[];
  onChange: (items: InvestmentItem[]) => void;
}) {
  const { t } = useTranslation();
  const {
    dragIndex,
    dropIndex,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
  } = useListReorder(items, onChange);

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <p className="text-sm font-medium">{t("proposals.investment")}</p>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div
            key={item.id}
            className={cn(
              "grid gap-2 sm:grid-cols-[auto_1fr_1fr_1fr_auto]",
              dragIndex === idx && "opacity-50",
              dropIndex === idx &&
                dragIndex !== null &&
                dragIndex !== idx &&
                "border-t-2 border-t-primary",
            )}
            onDragOver={onDragOver(idx)}
            onDrop={onDrop(idx)}
          >
            <DragHandle
              index={idx}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              className="mt-2.5"
            />
            <Input
              placeholder={t("proposals.investmentFront")}
              value={item.front}
              onChange={(e) => {
                const next = [...items];
                next[idx] = { ...item, front: e.target.value };
                onChange(next);
              }}
            />
            <Input
              placeholder={t("proposals.investmentModel")}
              value={item.model}
              onChange={(e) => {
                const next = [...items];
                next[idx] = { ...item, model: e.target.value };
                onChange(next);
              }}
            />
            <Input
              placeholder={t("proposals.investmentAmount")}
              value={item.amount}
              onChange={(e) => {
                const next = [...items];
                next[idx] = { ...item, amount: e.target.value };
                onChange(next);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onChange(items.filter((i) => i.id !== item.id))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() =>
          onChange([
            ...items,
            {
              id: `inv-${crypto.randomUUID().slice(0, 8)}`,
              front: "",
              model: "",
              amount: "",
            },
          ])
        }
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        {t("proposals.addInvestmentRow")}
      </Button>
    </div>
  );
}

function NextStepsEditor({
  steps,
  onChange,
}: {
  steps: string[];
  onChange: (steps: string[]) => void;
}) {
  const { t } = useTranslation();
  const {
    dragIndex,
    dropIndex,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
  } = useListReorder(steps, onChange);

  return (
    <div className="space-y-2">
      <Label>{t("proposals.nextSteps")}</Label>
      {steps.map((step, idx) => (
        <div
          key={`step-${idx}`}
          className={cn(
            "flex items-center gap-2",
            dragIndex === idx && "opacity-50",
            dropIndex === idx &&
              dragIndex !== null &&
              dragIndex !== idx &&
              "border-t-2 border-t-primary",
          )}
          onDragOver={onDragOver(idx)}
          onDrop={onDrop(idx)}
        >
          <DragHandle index={idx} onDragStart={onDragStart} onDragEnd={onDragEnd} />
          <Input
            value={step}
            onChange={(e) => {
              const nextSteps = [...steps];
              nextSteps[idx] = e.target.value;
              onChange(nextSteps);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onChange(steps.filter((_, i) => i !== idx))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => onChange([...steps, ""])}
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        {t("proposals.addNextStep")}
      </Button>
    </div>
  );
}
