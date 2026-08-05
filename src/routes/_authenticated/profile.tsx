import { useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { WhatsAppPhoneField } from "@/components/whatsapp-phone-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Separator } from "@/components/ui/separator";
import { HelpForm } from "@/components/help-form";
import {
  getMyProfile,
  isAdmin,
  resolvePostLoginPath,
  updateMyProfile,
  updateOwnPassword,
} from "@/lib/api";
import { isValidWhatsAppLocal, splitWhatsAppDigits } from "@/lib/whatsapp-countries";

export const Route = createFileRoute("/_authenticated/profile")({
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
      { title: "Meu Perfil — SOM" },
      { name: "description", content: "Atualize seus dados de acesso e contato." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GestorProfilePage,
});

function serializeProfileForm(fullName: string, whatsapp: string) {
  return JSON.stringify({ fullName: fullName.trim(), whatsapp: whatsapp.replace(/\D/g, "") });
}

function GestorProfilePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [formBaseline, setFormBaseline] = useState<string | null>(null);
  const [ignoreUnsavedChanges, setIgnoreUnsavedChanges] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const profileQuery = useQuery({
    queryKey: ["my-profile"],
    queryFn: getMyProfile,
  });

  useEffect(() => {
    const profile = profileQuery.data;
    if (!profile) return;
    const nextName = profile.full_name?.trim() ?? "";
    const nextWhatsapp = profile.whatsapp?.replace(/\D/g, "") ?? "";
    setFullName(nextName);
    setWhatsapp(nextWhatsapp);
    setFormBaseline(serializeProfileForm(nextName, nextWhatsapp));
    setIgnoreUnsavedChanges(false);
    setProfileReady(true);
  }, [profileQuery.data]);

  const isDirty =
    Boolean(formBaseline) &&
    !ignoreUnsavedChanges &&
    serializeProfileForm(fullName, whatsapp) !== formBaseline;

  const saveMutation = useMutation({
    mutationFn: () => updateMyProfile({ fullName, whatsapp }),
    onSuccess: () => {
      setIgnoreUnsavedChanges(true);
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success(t("gestorProfile.updated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const passwordMutation = useMutation({
    mutationFn: () => updateOwnPassword(newPassword),
    onSuccess: () => {
      setNewPassword("");
      setConfirmPassword("");
      toast.success(t("gestorProfile.passwordUpdated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const whatsappDigits = whatsapp.replace(/\D/g, "");
  const whatsappOk =
    !whatsappDigits || isValidWhatsAppLocal(splitWhatsAppDigits(whatsappDigits).local);

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6 sm:px-6 sm:py-8 md:p-8">
      <UnsavedChangesGuard isDirty={isDirty} />
      <PageHeader title={t("gestorProfile.title")} description={t("gestorProfile.subtitle")} />

      {profileQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : profileQuery.isError ? (
        <p className="text-sm text-destructive">
          {(profileQuery.error as Error).message || t("gestorProfile.loadError")}
        </p>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!whatsappOk) return;
            saveMutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="gestor-profile-email">{t("gestorProfile.email")}</Label>
            <Input
              id="gestor-profile-email"
              type="email"
              value={profileQuery.data?.email ?? ""}
              readOnly
              disabled
            />
            <p className="text-xs text-muted-foreground">{t("gestorProfile.emailHint")}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gestor-profile-name">{t("gestorProfile.fullName")}</Label>
            <Input
              id="gestor-profile-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t("gestorProfile.fullNamePlaceholder")}
              autoComplete="name"
            />
          </div>

          {profileReady ? (
            <WhatsAppPhoneField
              key={profileQuery.data?.id ?? "profile"}
              idPrefix="gestor-profile"
              value={whatsapp}
              onChange={setWhatsapp}
              label={t("gestorProfile.whatsapp")}
              countryLabel={t("gestorProfile.whatsappCountry")}
              hint={t("gestorProfile.whatsappHint")}
            />
          ) : null}

          {!whatsappOk ? (
            <p className="text-xs text-destructive">{t("gestorProfile.whatsappInvalid")}</p>
          ) : null}

          <Button type="submit" disabled={saveMutation.isPending || !whatsappOk || !isDirty}>
            {t("common.save")}
          </Button>
        </form>
      )}

      <Separator />

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (newPassword !== confirmPassword) {
            toast.error(t("gestorProfile.passwordMismatch"));
            return;
          }
          passwordMutation.mutate();
        }}
      >
        <div className="space-y-1">
          <p className="text-sm font-medium">{t("gestorProfile.passwordSection")}</p>
          <p className="text-xs text-muted-foreground">{t("gestorProfile.passwordHint")}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gestor-profile-new-password">{t("gestorProfile.newPassword")}</Label>
          <PasswordInput
            id="gestor-profile-new-password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gestor-profile-confirm-password">
            {t("gestorProfile.confirmPassword")}
          </Label>
          <PasswordInput
            id="gestor-profile-confirm-password"
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
          {t("gestorProfile.savePassword")}
        </Button>
      </form>

      <Separator />

      <HelpForm idPrefix="gestor-help" audience="gestor" />
    </div>
  );
}
