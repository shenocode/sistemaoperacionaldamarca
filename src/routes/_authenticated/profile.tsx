import { useEffect, useRef, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { UnsavedChangesGuard } from "@/components/unsaved-changes-guard";
import { WhatsAppPhoneField } from "@/components/whatsapp-phone-field";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Separator } from "@/components/ui/separator";
import { Link } from "@tanstack/react-router";
import {
  GESTOR_LOGO_ACCEPT,
  getMyProfile,
  isAdmin,
  resolvePostLoginPath,
  updateMyProfile,
  updateOwnPassword,
  uploadGestorLogo,
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

function serializeProfileForm(input: {
  fullName: string;
  whatsapp: string;
  companyName: string;
  website: string;
  logoUrl: string;
}) {
  return JSON.stringify({
    fullName: input.fullName.trim(),
    whatsapp: input.whatsapp.replace(/\D/g, ""),
    companyName: input.companyName.trim(),
    website: input.website.trim(),
    logoUrl: input.logoUrl.trim(),
  });
}

function GestorProfilePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [formBaseline, setFormBaseline] = useState<string | null>(null);
  const [ignoreUnsavedChanges, setIgnoreUnsavedChanges] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
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
    const nextCompany = profile.company_name?.trim() ?? "";
    const nextWebsite = profile.website?.trim() ?? "";
    const nextLogo = profile.logo_url?.trim() ?? "";
    setFullName(nextName);
    setWhatsapp(nextWhatsapp);
    setCompanyName(nextCompany);
    setWebsite(nextWebsite);
    setLogoUrl(nextLogo);
    setFormBaseline(
      serializeProfileForm({
        fullName: nextName,
        whatsapp: nextWhatsapp,
        companyName: nextCompany,
        website: nextWebsite,
        logoUrl: nextLogo,
      }),
    );
    setIgnoreUnsavedChanges(false);
    setProfileReady(true);
  }, [profileQuery.data]);

  const isDirty =
    Boolean(formBaseline) &&
    !ignoreUnsavedChanges &&
    serializeProfileForm({
      fullName,
      whatsapp,
      companyName,
      website,
      logoUrl,
    }) !== formBaseline;

  const saveMutation = useMutation({
    mutationFn: () =>
      updateMyProfile({
        fullName,
        whatsapp,
        companyName,
        website,
        logoUrl,
      }),
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

  async function handleLogoSelected(file: File | undefined) {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const url = await uploadGestorLogo(file);
      setLogoUrl(url);
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success(t("gestorProfile.logoUploaded"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("gestorProfile.logoUploadError"));
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const whatsappDigits = whatsapp.replace(/\D/g, "");
  const whatsappOk =
    !whatsappDigits || isValidWhatsAppLocal(splitWhatsAppDigits(whatsappDigits).local);
  const initials = (fullName.trim().slice(0, 1) || "?").toUpperCase();

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

          <div className="space-y-1.5">
            <Label htmlFor="gestor-profile-company">{t("gestorProfile.companyName")}</Label>
            <Input
              id="gestor-profile-company"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={t("gestorProfile.companyNamePlaceholder")}
              autoComplete="organization"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gestor-profile-website">{t("gestorProfile.website")}</Label>
            <Input
              id="gestor-profile-website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder={t("gestorProfile.websitePlaceholder")}
              autoComplete="url"
            />
          </div>

          <div className="space-y-2">
            <Label>{t("gestorProfile.logo")}</Label>
            <p className="text-xs text-muted-foreground">{t("gestorProfile.logoHint")}</p>
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14">
                {logoUrl ? <AvatarImage src={logoUrl} alt={t("gestorProfile.logo")} /> : null}
                <AvatarFallback className="text-base font-medium">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={uploadingLogo}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  {uploadingLogo ? t("gestorProfile.logoUploading") : t("gestorProfile.logoUpload")}
                </Button>
                {logoUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={uploadingLogo}
                    onClick={() => setLogoUrl("")}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    {t("gestorProfile.logoRemove")}
                  </Button>
                ) : null}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={GESTOR_LOGO_ACCEPT}
                className="sr-only"
                aria-label={t("gestorProfile.logoUpload")}
                onChange={(e) => void handleLogoSelected(e.target.files?.[0])}
              />
            </div>
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

          <Button
            type="submit"
            loading={saveMutation.isPending}
            loadingLabel={t("common.saving")}
            disabled={!whatsappOk || !isDirty}
          >
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

      <p className="text-sm text-muted-foreground">
        {t("gestorProfile.helpLinkPrefix")}{" "}
        <Link to="/help" className="font-medium text-foreground underline-offset-2 hover:underline">
          {t("nav.helpRequest")}
        </Link>
      </p>
    </div>
  );
}
