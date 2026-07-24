import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ClientContactFields } from "@/components/client-contact-fields";
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
  getClientPlatformLogin,
  provisionClientAccess,
  updateClient,
  type ClientContactInput,
  type ClientWithProjects,
} from "@/lib/api";

const emptyContactForm: ClientContactInput = {
  name: "",
  notes: "",
  email: "",
  phone: "",
  whatsapp: "",
  instagram: "",
  logo_url: "",
};

export function useClientSettingsDialog() {
  const [settingsClient, setSettingsClient] = useState<ClientWithProjects | null>(null);
  const [settingsForm, setSettingsForm] = useState<ClientContactInput>(emptyContactForm);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  async function openSettings(client: ClientWithProjects) {
    setSettingsClient(client);
    setSettingsForm({
      name: client.name,
      notes: client.notes ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      whatsapp: client.whatsapp ?? "",
      instagram: client.instagram ?? "",
      logo_url: client.logo_url ?? "",
    });
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
      const client = await updateClient(clientId, input);
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
            updateMutation.mutate({
              clientId: settingsClient.id,
              input: settingsForm,
              accessEmail: loginEmail,
              accessPassword: loginPassword,
              fullName: settingsForm.name.trim(),
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
