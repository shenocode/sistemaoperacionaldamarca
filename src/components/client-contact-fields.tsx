import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BrandKitFields } from "@/components/brand-kit-fields";
import { Separator } from "@/components/ui/separator";
import {
  CLIENT_LOGO_ACCEPT,
  uploadClientLogo,
  type ClientContactInput,
} from "@/lib/api";

export function ClientContactFields({
  form,
  onChange,
  nameRequired = false,
  autoFocusName = false,
  idPrefix = "client",
  clientId,
}: {
  form: ClientContactInput;
  onChange: (next: ClientContactInput) => void;
  nameRequired?: boolean;
  autoFocusName?: boolean;
  idPrefix?: string;
  /** When set, enables immediate logo upload to storage. */
  clientId?: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  function setField<K extends keyof ClientContactInput>(key: K, value: ClientContactInput[K]) {
    onChange({ ...form, [key]: value });
  }

  async function handleLogoSelected(file: File | undefined) {
    if (!file || !clientId) return;
    setUploading(true);
    try {
      const url = await uploadClientLogo(clientId, file);
      setField("logo_url", url);
      void queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success(t("clients.logoUploaded"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("clients.logoUploadError"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const logoUrl = form.logo_url?.trim() || null;
  const initials = (form.name.trim().slice(0, 1) || "?").toUpperCase();

  return (
    <div className="space-y-4">
      {clientId ? (
        <div className="space-y-2">
          <Label>{t("clients.logo")}</Label>
          <div className="flex items-center gap-3">
            <Avatar className="h-14 w-14">
              {logoUrl ? <AvatarImage src={logoUrl} alt={t("clients.logo")} /> : null}
              <AvatarFallback className="text-base font-medium">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                {uploading ? t("clients.logoUploading") : t("clients.logoUpload")}
              </Button>
              {logoUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={uploading}
                  onClick={() => setField("logo_url", "")}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  {t("clients.logoRemove")}
                </Button>
              ) : null}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={CLIENT_LOGO_ACCEPT}
              className="sr-only"
              aria-label={t("clients.logoUpload")}
              onChange={(e) => void handleLogoSelected(e.target.files?.[0])}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("clients.logoHint")}</p>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-name`}>{t("clients.name")}</Label>
        <Input
          id={`${idPrefix}-name`}
          value={form.name}
          onChange={(e) => setField("name", e.target.value)}
          required={nameRequired}
          autoFocus={autoFocusName}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-email`}>{t("clients.email")}</Label>
        <Input
          id={`${idPrefix}-email`}
          type="email"
          value={form.email ?? ""}
          onChange={(e) => setField("email", e.target.value)}
          placeholder="cliente@email.com"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-phone`}>{t("clients.phone")}</Label>
        <Input
          id={`${idPrefix}-phone`}
          type="tel"
          value={form.phone ?? ""}
          onChange={(e) => setField("phone", e.target.value)}
          placeholder="+55 11 99999-9999"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-whatsapp`}>{t("clients.whatsapp")}</Label>
        <Input
          id={`${idPrefix}-whatsapp`}
          type="tel"
          value={form.whatsapp ?? ""}
          onChange={(e) => setField("whatsapp", e.target.value)}
          placeholder="5511999999999"
        />
        <p className="text-xs text-muted-foreground">{t("clients.whatsappHint")}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-instagram`}>{t("clients.instagram")}</Label>
        <Input
          id={`${idPrefix}-instagram`}
          value={form.instagram ?? ""}
          onChange={(e) => setField("instagram", e.target.value)}
          placeholder="@cliente ou https://instagram.com/cliente"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-notes`}>{t("clients.notes")}</Label>
        <Textarea
          id={`${idPrefix}-notes`}
          value={form.notes ?? ""}
          onChange={(e) => setField("notes", e.target.value)}
          rows={3}
        />
      </div>

      <Separator />

      <BrandKitFields
        idPrefix={`${idPrefix}-brand`}
        value={{
          brand_colors: form.brand_colors ?? [],
          brand_fonts: form.brand_fonts ?? {},
        }}
        onChange={(kit) =>
          onChange({
            ...form,
            brand_colors: kit.brand_colors,
            brand_fonts: kit.brand_fonts,
          })
        }
      />
    </div>
  );
}
