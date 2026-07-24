import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { ClientCard } from "@/components/client-card";
import { ClientContactFields, toCanonicalContactInput } from "@/components/client-contact-fields";
import {
  ClientSettingsDialog,
  useClientSettingsDialog,
} from "@/components/client-settings-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
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
  type ClientContactInput,
} from "@/lib/api";

const emptyContactForm: ClientContactInput = {
  name: "",
  notes: "",
  email: "",
  phone: "",
  whatsapp: "",
  instagram: "",
  logo_url: "",
  brand_colors: [],
  brand_fonts: {},
  i18n: {},
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
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ClientContactInput>(emptyContactForm);
  const settingsDialog = useClientSettingsDialog();

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

  const filtered = (clientsQuery.data ?? []).filter((c) =>
    c.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 md:p-8">
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
          {filtered.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onOpenSettings={(c) => void settingsDialog.openSettings(c)}
            />
          ))}
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
              createMutation.mutate(toCanonicalContactInput(createForm));
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

      <ClientSettingsDialog {...settingsDialog} />
    </div>
  );
}
