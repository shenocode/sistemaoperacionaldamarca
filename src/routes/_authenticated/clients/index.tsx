import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR, enUS, es } from "date-fns/locale";
import { Plus, Search, Settings, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  buildWhatsAppNotifyUrl,
  createClient,
  listClients,
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

  function handlePublish(client: ClientWithProjects, projectName: string) {
    const message = t("clients.whatsappMessage", {
      client: client.name,
      project: projectName,
    });
    const url = buildWhatsAppNotifyUrl(client.whatsapp, message);
    if (!url) {
      toast.error(t("clients.whatsappMissing"));
      openSettings(client);
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
    toast.success(t("clients.whatsappOpened"));
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
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="shrink-0"
                              onClick={() => handlePublish(client, project.name)}
                            >
                              {t("clients.publish")}
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
            <ClientContactFields form={settingsForm} onChange={setSettingsForm} nameRequired />
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

function ClientContactFields({
  form,
  onChange,
  nameRequired = false,
  autoFocusName = false,
}: {
  form: ClientContactInput;
  onChange: (next: ClientContactInput) => void;
  nameRequired?: boolean;
  autoFocusName?: boolean;
}) {
  const { t } = useTranslation();

  function setField<K extends keyof ClientContactInput>(key: K, value: ClientContactInput[K]) {
    onChange({ ...form, [key]: value });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="client-name">{t("clients.name")}</Label>
        <Input
          id="client-name"
          value={form.name}
          onChange={(e) => setField("name", e.target.value)}
          required={nameRequired}
          autoFocus={autoFocusName}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="client-email">{t("clients.email")}</Label>
        <Input
          id="client-email"
          type="email"
          value={form.email ?? ""}
          onChange={(e) => setField("email", e.target.value)}
          placeholder="cliente@email.com"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="client-phone">{t("clients.phone")}</Label>
        <Input
          id="client-phone"
          type="tel"
          value={form.phone ?? ""}
          onChange={(e) => setField("phone", e.target.value)}
          placeholder="+55 11 99999-9999"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="client-whatsapp">{t("clients.whatsapp")}</Label>
        <Input
          id="client-whatsapp"
          type="tel"
          value={form.whatsapp ?? ""}
          onChange={(e) => setField("whatsapp", e.target.value)}
          placeholder="5511999999999"
        />
        <p className="text-xs text-muted-foreground">{t("clients.whatsappHint")}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="client-instagram">{t("clients.instagram")}</Label>
        <Input
          id="client-instagram"
          value={form.instagram ?? ""}
          onChange={(e) => setField("instagram", e.target.value)}
          placeholder="@cliente ou https://instagram.com/cliente"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="client-notes">{t("clients.notes")}</Label>
        <Textarea
          id="client-notes"
          value={form.notes ?? ""}
          onChange={(e) => setField("notes", e.target.value)}
          rows={3}
        />
      </div>
    </div>
  );
}
