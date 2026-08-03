import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { WhatsAppPhoneField } from "@/components/whatsapp-phone-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { getMyProfile, updateMyProfile, updateOwnPassword } from "@/lib/api";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Meu Perfil — SOM" },
      { name: "description", content: "Edite seu nome, WhatsApp e senha de acesso." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const profileQuery = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile });

  useEffect(() => {
    if (!profileQuery.data) return;
    setFullName(profileQuery.data.full_name);
    setWhatsapp(profileQuery.data.whatsapp);
  }, [profileQuery.data]);

  const saveProfile = useMutation({
    mutationFn: () => updateMyProfile({ full_name: fullName, whatsapp }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success(t("profile.saved"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const savePassword = useMutation({
    mutationFn: () => updateOwnPassword(password),
    onSuccess: () => {
      setPassword("");
      setConfirmPassword("");
      toast.success(t("profile.passwordUpdated"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handlePasswordSubmit = () => {
    if (password !== confirmPassword) {
      toast.error(t("profile.passwordMismatch"));
      return;
    }
    savePassword.mutate();
  };

  return (
    <div className="space-y-8">
      <PageHeader title={t("profile.title")} description={t("profile.subtitle")} />

      <section className="max-w-xl space-y-4">
        <h2 className="text-sm font-semibold">{t("profile.dataSection")}</h2>
        <div className="space-y-2">
          <Label htmlFor="profile-email">{t("profile.email")}</Label>
          <Input id="profile-email" value={profileQuery.data?.email ?? ""} disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-name">{t("profile.fullName")}</Label>
          <Input
            id="profile-name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder={t("profile.fullNamePlaceholder")}
          />
        </div>
        <WhatsAppPhoneField
          idPrefix="profile"
          value={whatsapp}
          onChange={setWhatsapp}
          label={t("profile.whatsapp")}
          countryLabel={t("profile.whatsappCountry")}
        />
        <Button
          onClick={() => saveProfile.mutate()}
          disabled={saveProfile.isPending || profileQuery.isLoading}
        >
          {saveProfile.isPending ? t("common.saving") : t("common.save")}
        </Button>
      </section>

      <Separator className="max-w-xl" />

      <section className="max-w-xl space-y-4">
        <h2 className="text-sm font-semibold">{t("profile.passwordSection")}</h2>
        <div className="space-y-2">
          <Label htmlFor="profile-password">{t("profile.newPassword")}</Label>
          <Input
            id="profile-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-password-confirm">{t("profile.confirmPassword")}</Label>
          <Input
            id="profile-password-confirm"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>
        <Button
          onClick={handlePasswordSubmit}
          disabled={savePassword.isPending || password.length < 6}
        >
          {savePassword.isPending ? t("common.saving") : t("profile.updatePassword")}
        </Button>
      </section>
    </div>
  );
}
