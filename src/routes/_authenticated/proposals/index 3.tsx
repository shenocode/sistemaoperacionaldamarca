import { useState } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { FilePenLine, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  createCommercialProposal,
  deleteCommercialProposal,
  isAdmin,
  listClients,
  listCommercialProposals,
  resolvePostLoginPath,
} from "@/lib/api";

export const Route = createFileRoute("/_authenticated/proposals/index 3")({
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
      { title: "Propostas — SOM" },
      { name: "description", content: "Propostas comerciais com identidade SOM." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProposalsListPage,
});

function ProposalsListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [clientId, setClientId] = useState("");

  const proposalsQuery = useQuery({
    queryKey: ["commercial-proposals"],
    queryFn: listCommercialProposals,
  });

  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: listClients,
  });

  const createMutation = useMutation({
    mutationFn: () => createCommercialProposal({ clientId }),
    onSuccess: (proposal) => {
      queryClient.invalidateQueries({ queryKey: ["commercial-proposals"] });
      setCreateOpen(false);
      setClientId("");
      toast.success(t("proposals.created"));
      void navigate({
        to: "/proposals/$proposalId",
        params: { proposalId: proposal.id },
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCommercialProposal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["commercial-proposals"] });
      toast.success(t("proposals.deleted"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = (proposalsQuery.data ?? []).filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      (p.clients?.name ?? "").toLowerCase().includes(q) ||
      p.subtitle.toLowerCase().includes(q)
    );
  });

  const clients = clientsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 md:p-8">
      <PageHeader
        title={t("proposals.title")}
        description={t("proposals.subtitle")}
        actions={
          <Button
            onClick={() => setCreateOpen(true)}
            disabled={clientsQuery.isLoading || clients.length === 0}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            {t("proposals.new")}
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("proposals.search")}
        />
      </div>

      {proposalsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : proposalsQuery.isError ? (
        <p className="text-sm text-destructive">
          {(proposalsQuery.error as Error).message || t("proposals.loadError")}
        </p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FilePenLine}
          title={t("proposals.empty")}
          description={
            clients.length === 0 ? t("proposals.noClients") : t("proposals.emptyHint")
          }
          action={
            clients.length > 0 ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                {t("proposals.new")}
              </Button>
            ) : (
              <Button asChild>
                <Link to="/clients">{t("nav.clients")}</Link>
              </Button>
            )
          }
        />
      ) : (
        <ul className="divide-y rounded-xl border">
          {filtered.map((proposal) => (
            <li
              key={proposal.id}
              className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <Link
                  to="/proposals/$proposalId"
                  params={{ proposalId: proposal.id }}
                  className="font-medium text-foreground hover:underline"
                >
                  {proposal.clients?.name ?? t("proposals.client")} — {proposal.title}
                </Link>
                <p className="truncate text-sm text-muted-foreground">
                  {proposal.subtitle || proposal.scope_summary}
                </p>
                <p className="text-xs text-muted-foreground">
                  {proposal.status === "ready"
                    ? t("proposals.statusReady")
                    : t("proposals.statusDraft")}
                  {" · "}
                  {t("proposals.updated")}{" "}
                  {new Date(proposal.updated_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button asChild variant="secondary" size="sm">
                  <Link to="/proposals/$proposalId" params={{ proposalId: proposal.id }}>
                    {t("proposals.open")}
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (window.confirm(t("proposals.delete"))) {
                      deleteMutation.mutate(proposal.id);
                    }
                  }}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  {t("proposals.delete")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("proposals.new")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
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
          <DialogFooter>
            <Button
              onClick={() => {
                if (!clientId) {
                  toast.error(t("proposals.createError"));
                  return;
                }
                createMutation.mutate();
              }}
              disabled={createMutation.isPending || !clientId}
            >
              {t("proposals.new")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
