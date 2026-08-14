import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AdminAiSettingsPage } from "@/components/admin-ai-settings";
import {
  ClientContactFields,
  contactFormFromClient,
  toCanonicalContactInput,
} from "@/components/client-contact-fields";
import { ClientGestorContactCard } from "@/components/client-gestor-contact-card";
import { PageHeader } from "@/components/page-header";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Link } from "@tanstack/react-router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppRole } from "@/hooks/use-app-role";
import {
  listClients,
  updateClient,
  updateOwnPassword,
  type ClientContactInput,
} from "@/lib/api";
import { getLocalizedText, normalizeAppLocale } from "@/lib/i18n-content";

const emptyForm: ClientContactInput = {
  name: "",
  notes: "",
  email: "",
  phone: "",
  whatsapp: "",
  instagram: "",
  website: "",
  logo_url: "",
  i18n: {},
};

function serializeClientForm(form: ClientContactInput) {
  return JSON.stringify(form);
}

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Configurações — SOM" },
      { name: "description", content: "Configurações da conta e chaves de IA." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { isAdmin, loading } = useAppRole();

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6 sm:px-6 sm:py-8 md:p-8">
        <p className="text-sm text-muted-foreground">…</p>
      </div>
    );
  }

  if (isAdmin) {
    return <AdminAiSettingsPage />;
  }

  return <ClientSettingsPage />;
}

function ClientSettingsPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [form, setForm] = useState<ClientContactInput>(emptyForm);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formBaseline, setFormBaseline] = useState<string | null>(null);
  const [ignoreUnsavedChanges, setIgnoreUnsavedChanges] = useState(false);
  const uiLocale = normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language);

  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: listClients,
  });

  const clients = clientsQuery.data ?? [];

  useEffect(() => {
    if (clients.length === 0) {
      setSelectedClientId("");
      setForm(emptyForm);
      setFormBaseline(serializeClientForm(emptyForm));
      setIgnoreUnsavedChanges(false);
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
      setFormBaseline(serializeClientForm(emptyForm));
      setIgnoreUnsavedChanges(false);
      return;
    }
    const nextForm = contactFormFromClient(client, uiLocale);
    setForm(nextForm);
    setFormBaseline(serializeClientForm(nextForm));
    setIgnoreUnsavedChanges(false);
  }, [clients, selectedClientId, uiLocale]);

  const isDirty =
    Boolean(formBaseline) &&
    !ignoreUnsavedChanges &&
    serializeClientForm(form) !== formBaseline;

  const saveMutation = useMutation({
    mutationFn: () => updateClient(selectedClientId, toCanonicalContactInput(form)),
    onSuccess: () => {
      setIgnoreUnsavedChanges(true);
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success(t("clientSettings.updated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const passwordMutation = useMutation({
    mutationFn: () => updateOwnPassword(newPassword),
    onSuccess: () => {
      setNewPassword("");
      setConfirmPassword("");
      toast.success(t("clientSettings.passwordUpdated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6 sm:px-6 sm:py-8 md:p-8">
      <UnsavedChangesGuard isDirty={isDirty} />
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
                      {getLocalizedText(client.i18n, "name", client.name, uiLocale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <ClientContactFields
            form={form}
            onChange={setForm}
            nameRequired
            idPrefix="profile"
            clientId={selectedClientId || undefined}
          />

          <Button
            type="submit"
            loading={saveMutation.isPending}
            loadingLabel={t("common.saving")}
            disabled={!form.name.trim()}
          >
            {t("common.save")}
          </Button>
        </form>
      )}

      {selectedClientId ? (
        <>
          <Separator />
          <ClientGestorContactCard clientId={selectedClientId} />
        </>
      ) : null}

      <Separator />

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (newPassword !== confirmPassword) {
            toast.error(t("clientSettings.passwordMismatch"));
            return;
          }
          passwordMutation.mutate();
        }}
      >
        <div className="space-y-1">
          <p className="text-sm font-medium">{t("clientSettings.passwordSection")}</p>
          <p className="text-xs text-muted-foreground">{t("clientSettings.passwordHint")}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settings-new-password">{t("clientSettings.newPassword")}</Label>
          <PasswordInput
            id="settings-new-password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="settings-confirm-password">{t("clientSettings.confirmPassword")}</Label>
          <PasswordInput
            id="settings-confirm-password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        <Button
          type="submit"
          variant="secondary"
          disabled={passwordMutation.isPending || !newPassword.trim()}
        >
          {t("clientSettings.savePassword")}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        {t("clientSettings.helpLinkPrefix")}{" "}
        <Link to="/help" className="font-medium text-foreground underline-offset-2 hover:underline">
          {t("nav.helpRequest")}
        </Link>
      </p>
    </div>
  );
}
