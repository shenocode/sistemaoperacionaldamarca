import { useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ClientContactFields } from "@/components/client-contact-fields";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  isAdmin,
  listClients,
  resolvePostLoginPath,
  updateClient,
  type ClientContactInput,
} from "@/lib/api";

const emptyForm: ClientContactInput = {
  name: "",
  notes: "",
  email: "",
  phone: "",
  whatsapp: "",
  instagram: "",
};

export const Route = createFileRoute("/_authenticated/settings")({
  beforeLoad: async () => {
    if (await isAdmin()) {
      const dest = await resolvePostLoginPath();
      if (dest.to === "/clients/$clientId/projects/$projectId/content") {
        throw redirect({ to: dest.to, params: dest.params, search: dest.search });
      }
      throw redirect({ to: dest.to });
    }
  },
  head: () => ({
    meta: [
      { title: "Configurações — SOM" },
      { name: "description", content: "Revise e atualize seus dados de contato." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClientSettingsPage,
});

function ClientSettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [form, setForm] = useState<ClientContactInput>(emptyForm);

  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: listClients,
  });

  const clients = clientsQuery.data ?? [];

  useEffect(() => {
    if (clients.length === 0) {
      setSelectedClientId("");
      setForm(emptyForm);
      return;
    }
    setSelectedClientId((current) => {
      if (current && clients.some((client) => client.id === current)) return current;
      return clients[0].id;
    });
  }, [clients]);

  useEffect(() => {
    const client = clients.find((entry) => entry.id === selectedClientId);
    if (!client) {
      setForm(emptyForm);
      return;
    }
    setForm({
      name: client.name,
      notes: client.notes ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      whatsapp: client.whatsapp ?? "",
      instagram: client.instagram ?? "",
    });
  }, [clients, selectedClientId]);

  const saveMutation = useMutation({
    mutationFn: () => updateClient(selectedClientId, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success(t("clientSettings.updated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="mx-auto max-w-lg space-y-6 p-8">
      <PageHeader title={t("clientSettings.title")} description={t("clientSettings.subtitle")} />

      {clientsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : clients.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("clientSettings.empty")}</p>
      ) : (
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (!selectedClientId || !form.name.trim()) return;
            saveMutation.mutate();
          }}
        >
          {clients.length > 1 ? (
            <div className="space-y-1.5">
              <Label>{t("clientSettings.selectClient")}</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue />
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
          ) : null}

          <ClientContactFields form={form} onChange={setForm} nameRequired idPrefix="profile" />

          <Button type="submit" disabled={saveMutation.isPending || !form.name.trim()}>
            {t("common.save")}
          </Button>
        </form>
      )}
    </div>
  );
}
