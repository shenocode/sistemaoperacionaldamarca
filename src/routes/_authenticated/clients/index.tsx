import { useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";
import { Plus, Search, Settings, Users } from "lucide-react";
import { toast } from "sonner";
import { ClientContactFields } from "@/components/client-contact-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createClient,
  isAdmin,
  listClients,
  resolvePostLoginPath,
  updateClient,
  type ClientContactInput,
  type ClientWithProjects,
} from "@/lib/api";
import type { LanguageCode } from "@/i18n";

const dateLocales = { "pt-BR": ptBR, "en-US": enUS, "es-ES": es };

const emptyContactForm: ClientContactInput = {
  name: "",
  notes: "",
  email: "",
  phone: "",
  whatsapp: "",
  instagram: "",
};

export const Route = createFileRoute("/_authenticated/clients/")({
  beforeLoad: async () => {
    if (!(await isAdmin())) {
      const dest = await resolvePostLoginPath();
      if (dest.to === "/clients/$clientId/projects/$projectId/content") {
        throw redirect({ to: dest.to, params: dest.params, search: dest.search });
      }
      throw redirect({ to: dest.to });
    }
  },
  head: () => ({
    meta: [
      { title: "Clientes — SOM" },
      { name: "description", content: "Gerencie seus clientes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClientsPage,
});

function ClientsPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ClientContactInput>(emptyContactForm);
  const [settingsClient, setSettingsClient] = useState<ClientWithProjects | null>(null);
  const [settingsForm, setSettingsForm] = useState<ClientContactInput>(emptyContactForm);

  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: listClients,
  });

  const createMutation = useMutation({
    mutationFn: createClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setCreateOpen(false);
      setCreateForm(emptyContactForm);
      toast.success(t("clients.created"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ clientId, input }: { clientId: string; input: ClientContactInput }) =>
      updateClient(clientId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setSettingsClient(null);
      toast.success(t("clients.updated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = (clientsQuery.data ?? []).filter((c) =>
    c.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const locale = dateLocales[(i18n.language as LanguageCode) ?? "pt-BR"] ?? ptBR;

  function openSettings(client: ClientWithProjects) {
    setSettingsClient(client);
    setSettingsForm({
      name: client.name,
      notes: client.notes ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      whatsapp: client.whatsapp ?? "",
      instagram: client.instagram ?? "",
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-8">
      <PageHeader
        title={t("clients.title")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("clients.new")}
          </Button>
        }
      />
      <div className="relative max-w-sm">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("clients.search")}
          aria-label={t("clients.search")}
          className="pl-9"
        />
      </div>

      {clientsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title={t("clients.empty")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((client) => {
            const lastUpdateLabel = client.last_update_at
              ? format(new Date(client.last_update_at), "dd/MM/yyyy", { locale })
              : null;

            return (
              <Card key={client.id} className="relative rounded-xl transition-colors hover:bg-muted/40">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-start justify-between gap-3 pr-8">
                    <div className="min-w-0 space-y-1">
                      <Link
                        to="/clients/$clientId"
                        params={{ clientId: client.id }}
                        className="block font-medium tracking-tight hover:underline"
                      >
                        {client.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(client.created_at), {
                          addSuffix: true,
                          locale,
                        })}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-3 top-3 h-8 w-8 text-muted-foreground"
                      aria-label={t("clients.settings")}
                      onClick={() => openSettings(client)}
                    >
                      <Settings className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {t("clients.lastUpdates")}
                      {lastUpdateLabel ? ` (${lastUpdateLabel})` : ""}
                    </p>

                    {client.projects.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t("clients.noProjects")}</p>
                    ) : (
                      <ul className="space-y-2">
                        {client.projects.map((project) => (
                          <li
                            key={project.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2"
                          >
                            <span className="truncate text-sm">{project.name}</span>
                            <Button asChild size="sm" variant="secondary" className="shrink-0">
                              <Link
                                to="/clients/$clientId/projects/$projectId/calendar"
                                params={{ clientId: client.id, projectId: project.id }}
                              >
                                {t("clients.access")}
                              </Link>
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("clients.new")}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!createForm.name.trim()) return;
              createMutation.mutate(createForm);
            }}
          >
            <ClientContactFields
              form={createForm}
              onChange={setCreateForm}
              nameRequired
              autoFocusName
              idPrefix="create-client"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={createMutation.isPending || !createForm.name.trim()}>
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(settingsClient)}
        onOpenChange={(open) => {
          if (!open) setSettingsClient(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("clients.settings")}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!settingsClient || !settingsForm.name.trim()) return;
              updateMutation.mutate({ clientId: settingsClient.id, input: settingsForm });
            }}
          >
            <ClientContactFields
              form={settingsForm}
              onChange={setSettingsForm}
              nameRequired
              idPrefix="settings-client"
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSettingsClient(null)}>
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending || !settingsForm.name.trim()}
              >
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
