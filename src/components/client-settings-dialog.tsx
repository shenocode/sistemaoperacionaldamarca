import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ClientContactFields,
  contactFormFromClient,
  toCanonicalContactInput,
} from "@/components/client-contact-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppRole } from "@/hooks/use-app-role";
import {
  getClientGestor,
  getClientPlatformLogin,
  listGestores,
  provisionClientAccess,
  reassignClientGestor,
  updateClient,
  type ClientContactInput,
  type ClientWithProjects,
} from "@/lib/api";
import { normalizeAppLocale } from "@/lib/i18n-content";

const emptyContactForm: ClientContactInput = {
  name: "",
  notes: "",
  email: "",
  phone: "",
  whatsapp: "",
  instagram: "",
  logo_url: "",
  i18n: {},
};

export function useClientSettingsDialog() {
  const { i18n } = useTranslation();
  const [settingsClient, setSettingsClient] = useState<ClientWithProjects | null>(null);
  const [settingsForm, setSettingsForm] = useState<ClientContactInput>(emptyContactForm);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  async function openSettings(client: ClientWithProjects) {
    const locale = normalizeAppLocale(i18n.resolvedLanguage ?? i18n.language);
    setSettingsClient(client);
    setSettingsForm(contactFormFromClient(client, locale));
    setLoginPassword("");
    setLoginEmail(client.email ?? "");
    try {
      const existingLogin = await getClientPlatformLogin(client.id);
      if (existingLogin) setLoginEmail(existingLogin);
    } catch {
      // Contact email fallback is fine if the RPC is not applied yet.
    }
  }

  function closeSettings() {
    setSettingsClient(null);
    setLoginPassword("");
  }

  return {
    settingsClient,
    settingsForm,
    setSettingsForm,
    loginEmail,
    setLoginEmail,
    loginPassword,
    setLoginPassword,
    openSettings,
    closeSettings,
  };
}

function MigrateGestorSection({
  clientId,
  currentCreatedBy,
}: {
  clientId: string;
  currentCreatedBy: string | null;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedGestorId, setSelectedGestorId] = useState(currentCreatedBy ?? "");

  const currentGestorQuery = useQuery({
    queryKey: ["client-gestor", clientId],
    queryFn: () => getClientGestor(clientId),
  });

  const gestoresQuery = useQuery({
    queryKey: ["gestores"],
    queryFn: listGestores,
  });

  const reassignMutation = useMutation({
    mutationFn: (newGestorUserId: string) =>
      reassignClientGestor({ clientId, newGestorUserId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["client-gestor", clientId] });
      toast.success(t("clients.migrateGestorSuccess"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const currentGestor = currentGestorQuery.data;
  const currentLabel = currentGestor
    ? currentGestor.fullName
      ? `${currentGestor.fullName} (${currentGestor.email})`
      : currentGestor.email
    : t("clients.currentGestorUnknown");

  const gestores = gestoresQuery.data ?? [];
  const effectiveCurrentId = currentGestor?.userId ?? currentCreatedBy;
  const canSubmit =
    Boolean(selectedGestorId) &&
    selectedGestorId !== effectiveCurrentId &&
    !reassignMutation.isPending;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">{t("clients.migrateGestor")}</p>
        <p className="text-xs text-muted-foreground">{t("clients.migrateGestorHint")}</p>
      </div>

      <div className="space-y-1.5">
        <Label>{t("clients.currentGestor")}</Label>
        <p className="text-sm text-muted-foreground">
          {currentGestorQuery.isLoading ? t("common.loading") : currentLabel}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="settings-migrate-gestor">{t("clients.newGestor")}</Label>
        <Select
          value={selectedGestorId || undefined}
          onValueChange={setSelectedGestorId}
          disabled={gestoresQuery.isLoading || reassignMutation.isPending}
        >
          <SelectTrigger id="settings-migrate-gestor">
            <SelectValue placeholder={t("clients.newGestorPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {gestores.map((gestor) => (
              <SelectItem key={gestor.userId} value={gestor.userId}>
                {gestor.fullName
                  ? `${gestor.fullName} (${gestor.email})`
                  : gestor.email}
                {gestor.isMaster ? ` — ${t("accessRelease.roleAdministrator")}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        type="button"
        variant="secondary"
        disabled={!canSubmit}
        onClick={() => {
          if (!selectedGestorId) return;
          if (selectedGestorId === effectiveCurrentId) {
            toast.message(t("clients.migrateGestorSame"));
            return;
          }
          reassignMutation.mutate(selectedGestorId);
        }}
      >
        {t("clients.migrateGestorSubmit")}
      </Button>
    </div>
  );
}

export function ClientSettingsDialog({
  settingsClient,
  settingsForm,
  setSettingsForm,
  loginEmail,
  setLoginEmail,
  loginPassword,
  setLoginPassword,
  closeSettings,
}: ReturnType<typeof useClientSettingsDialog>) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { isAdminMaster } = useAppRole();

  const updateMutation = useMutation({
    mutationFn: async ({
      clientId,
      input,
      accessEmail,
      accessPassword,
      fullName,
    }: {
      clientId: string;
      input: ClientContactInput;
      accessEmail: string;
      accessPassword: string;
      fullName: string;
    }) => {
      const client = await updateClient(clientId, toCanonicalContactInput(input));
      const email = accessEmail.trim();
      const password = accessPassword.trim();

      if (!password) {
        return { client, access: null as null | { created: boolean } };
      }

      if (!email) {
        throw new Error(t("clients.accessPasswordRequired"));
      }

      const access = await provisionClientAccess({
        clientId,
        email,
        password,
        fullName,
      });
      return { client, access };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      closeSettings();
      toast.success(t("clients.updated"));
      if (result.access?.created) {
        toast.success(t("clients.accessCreated"));
      } else if (result.access) {
        toast.success(t("clients.accessUpdated"));
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog
      open={Boolean(settingsClient)}
      onOpenChange={(open) => {
        if (!open) closeSettings();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("clients.settings")}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!settingsClient || !settingsForm.name.trim()) return;
            const canonical = toCanonicalContactInput(settingsForm);
            updateMutation.mutate({
              clientId: settingsClient.id,
              input: settingsForm,
              accessEmail: loginEmail,
              accessPassword: loginPassword,
              fullName: canonical.name.trim(),
            });
          }}
        >
          <ClientContactFields
            form={settingsForm}
            onChange={setSettingsForm}
            nameRequired
            idPrefix="settings-client"
            clientId={settingsClient?.id}
          />

          <Separator />

          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">{t("clients.platformAccess")}</p>
              <p className="text-xs text-muted-foreground">{t("clients.platformAccessHint")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-login-email">{t("clients.loginEmail")}</Label>
              <Input
                id="settings-login-email"
                type="email"
                autoComplete="off"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="cliente@email.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-login-password">{t("clients.loginPassword")}</Label>
              <Input
                id="settings-login-password"
                type="password"
                autoComplete="new-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                minLength={6}
                placeholder="••••••••"
              />
              <p className="text-xs text-muted-foreground">{t("clients.loginPasswordHint")}</p>
            </div>
          </div>

          {isAdminMaster && settingsClient ? (
            <>
              <Separator />
              <MigrateGestorSection
                key={settingsClient.id}
                clientId={settingsClient.id}
                currentCreatedBy={settingsClient.created_by}
              />
            </>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeSettings}>
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
  );
}
