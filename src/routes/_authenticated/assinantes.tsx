import { useRef, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Settings2, Users } from "lucide-react";
import { isAdminMasterEmail } from "@/lib/admin-master";
import { ASSIGNABLE_PLANS, type AssignablePlan } from "@/lib/plan-entitlements";
import {
  isAdmin,
  listAssinantes,
  provisionGestorAccess,
  resolvePostLoginPath,
  setAssinanteStatus,
  setGestorPlan,
  buildWhatsAppNotifyUrl,
  openWhatsAppInvitePlaceholder,
  navigateWhatsAppInvite,
} from "@/lib/api";
import type { AssinanteListItem } from "@/lib/provision-gestor-access.functions";
import { isValidWhatsAppLocal, splitWhatsAppDigits } from "@/lib/whatsapp-countries";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { WhatsAppPhoneField } from "@/components/whatsapp-phone-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export const Route = createFileRoute("/_authenticated/assinantes")({
  beforeLoad: async () => {
    if (!(await isAdmin())) {
      const dest = await resolvePostLoginPath();
      if (dest.to === "/clients/$clientId/projects/$projectId/feed") {
        throw redirect({ to: dest.to, params: dest.params, search: dest.search });
      }
      throw redirect({ to: dest.to });
    }

    const { data } = await supabase.auth.getUser();
    if (!isAdminMasterEmail(data.user?.email)) {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "Assinantes — SOM" },
      { name: "description", content: "Gestão de assinantes e clientes relacionados." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AssinantesPage,
});

function AssinantesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [plan, setPlan] = useState<AssignablePlan>("courtesy");
  const [settingsAssinante, setSettingsAssinante] = useState<AssinanteListItem | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [expandedClients, setExpandedClients] = useState<string | null>(null);
  const inviteTabRef = useRef<Window | null>(null);

  const assinantesQuery = useQuery({
    queryKey: ["assinantes"],
    queryFn: listAssinantes,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["assinantes"] });
    queryClient.invalidateQueries({ queryKey: ["gestores"] });
  };

  function buildInviteUrl(input: {
    whatsapp: string;
    email: string;
    password: string;
  }) {
    const link = `${window.location.origin}/auth`;
    const message = t("subscribers.inviteWhatsAppMessage", {
      link,
      email: input.email,
      password: input.password,
    });
    return buildWhatsAppNotifyUrl(input.whatsapp, message);
  }

  const provisionMutation = useMutation({
    mutationFn: () =>
      provisionGestorAccess({
        email: email.trim(),
        password: password.trim(),
        fullName: fullName.trim() || undefined,
        whatsapp: whatsapp.replace(/\D/g, ""),
        plan,
      }),
    onSuccess: (result) => {
      const inviteEmail = email.trim();
      const invitePassword = password.trim();
      const inviteWhatsapp = whatsapp.replace(/\D/g, "");
      const url = buildInviteUrl({
        whatsapp: inviteWhatsapp,
        email: inviteEmail,
        password: invitePassword,
      });
      const opened = navigateWhatsAppInvite(inviteTabRef.current, url);
      inviteTabRef.current = null;
      invalidate();
      setFullName("");
      setEmail("");
      setPassword("");
      setWhatsapp("");
      setPlan("courtesy");
      toast.success(
        result.created ? t("subscribers.created") : t("subscribers.updated"),
      );
      if (!opened) toast.message(t("subscribers.whatsappBlocked"));
    },
    onError: (err: Error) => {
      inviteTabRef.current?.close();
      inviteTabRef.current = null;
      toast.error(err.message);
    },
  });

  const resetMutation = useMutation({
    mutationFn: (input: {
      email: string;
      fullName?: string;
      password: string;
      plan?: AssignablePlan;
    }) =>
      provisionGestorAccess({
        email: input.email,
        password: input.password,
        fullName: input.fullName,
        plan: input.plan,
      }),
    onSuccess: () => {
      invalidate();
      setResetPassword("");
      toast.success(t("subscribers.passwordUpdated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const planMutation = useMutation({
    mutationFn: (input: { userId: string; plan: AssignablePlan }) => setGestorPlan(input),
    onSuccess: () => {
      invalidate();
      toast.success(t("subscribers.planUpdated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const statusMutation = useMutation({
    mutationFn: (input: { userId: string; active: boolean }) => setAssinanteStatus(input),
    onSuccess: (_data, vars) => {
      invalidate();
      toast.success(
        vars.active ? t("subscribers.activated") : t("subscribers.deactivated"),
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const assinantes = assinantesQuery.data ?? [];

  const settingsFromQuery = settingsAssinante
    ? (assinantes.find((a) => a.userId === settingsAssinante.userId) ?? settingsAssinante)
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 md:p-8">
      <PageHeader
        title={t("subscribers.title")}
        description={t("subscribers.description")}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("subscribers.formTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!email.trim() || password.trim().length < 6) return;
              if (!isValidWhatsAppLocal(splitWhatsAppDigits(whatsapp).local)) return;
              inviteTabRef.current = openWhatsAppInvitePlaceholder();
              provisionMutation.mutate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="assinante-name">{t("subscribers.fullName")}</Label>
                <Input
                  id="assinante-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="off"
                  placeholder={t("subscribers.fullNamePlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="assinante-email">{t("subscribers.email")}</Label>
                <Input
                  id="assinante-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                  placeholder="gestor@email.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="assinante-password">{t("subscribers.password")}</Label>
                <PasswordInput
                  id="assinante-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="••••••••"
                />
                <p className="text-xs text-muted-foreground">{t("subscribers.passwordHint")}</p>
              </div>
              <WhatsAppPhoneField
                idPrefix="assinante"
                value={whatsapp}
                onChange={setWhatsapp}
                label={t("subscribers.whatsapp")}
                countryLabel={t("subscribers.whatsappCountry")}
                hint={t("subscribers.whatsappHint")}
                required
              />
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="assinante-plan">{t("subscribers.plan")}</Label>
                <Select value={plan} onValueChange={(value) => setPlan(value as AssignablePlan)}>
                  <SelectTrigger id="assinante-plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_PLANS.map((key) => (
                      <SelectItem key={key} value={key}>
                        {t(`subscribers.plans.${key}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{t("subscribers.planHint")}</p>
              </div>
            </div>
            <Button
              type="submit"
              disabled={
                provisionMutation.isPending ||
                !email.trim() ||
                password.trim().length < 6 ||
                !isValidWhatsAppLocal(splitWhatsAppDigits(whatsapp).local)
              }
            >
              {t("subscribers.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">{t("subscribers.listTitle")}</h2>
        {assinantesQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : assinantes.length === 0 ? (
          <EmptyState title={t("subscribers.empty")} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {assinantes.map((assinante) => {
              const clientsOpen = expandedClients === assinante.userId;
              const clientsLabel =
                assinante.maxClients == null
                  ? t("subscribers.clientsCountUnlimited", {
                      count: assinante.clientCount,
                    })
                  : t("subscribers.clientsCount", {
                      count: assinante.clientCount,
                      max: assinante.maxClients,
                    });

              return (
                <Card
                  key={assinante.userId}
                  className={!assinante.isActive ? "opacity-75" : undefined}
                >
                  <CardHeader className="space-y-3 pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">
                          {assinante.fullName || assinante.email}
                        </CardTitle>
                        {assinante.fullName ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {assinante.email}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                        <Badge variant={assinante.isMaster ? "default" : "secondary"}>
                          {assinante.isMaster
                            ? t("subscribers.roleAdministrator")
                            : t("subscribers.roleGestor")}
                        </Badge>
                        <Badge variant={assinante.isActive ? "outline" : "destructive"}>
                          {assinante.isActive
                            ? t("subscribers.statusActive")
                            : t("subscribers.statusInactive")}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      {assinante.isMaster ? (
                        <Badge variant="outline">{t("subscribers.plans.fullAccess")}</Badge>
                      ) : (
                        <Badge variant="outline">
                          {assinante.plan
                            ? t(`subscribers.plans.${assinante.plan}`)
                            : t("subscribers.noPlan")}
                        </Badge>
                      )}
                      {assinante.planSource ? (
                        <span className="text-xs text-muted-foreground">
                          {assinante.planSource === "stripe"
                            ? t("subscribers.sourceStripe")
                            : t("subscribers.sourceManual")}
                        </span>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSettingsAssinante(assinante);
                          setResetPassword("");
                        }}
                      >
                        <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                        {t("subscribers.settings")}
                      </Button>
                      {!assinante.isMaster ? (
                        <div className="flex items-center gap-2 rounded-md border px-2.5 py-1.5">
                          <Label
                            htmlFor={`status-${assinante.userId}`}
                            className="text-xs font-normal"
                          >
                            {assinante.isActive
                              ? t("subscribers.active")
                              : t("subscribers.inactive")}
                          </Label>
                          <Switch
                            id={`status-${assinante.userId}`}
                            checked={assinante.isActive}
                            disabled={statusMutation.isPending}
                            onCheckedChange={(checked) =>
                              statusMutation.mutate({
                                userId: assinante.userId,
                                active: checked,
                              })
                            }
                          />
                        </div>
                      ) : null}
                    </div>

                    <Collapsible
                      open={clientsOpen}
                      onOpenChange={(open) =>
                        setExpandedClients(open ? assinante.userId : null)
                      }
                    >
                      <CollapsibleTrigger asChild>
                        <Button type="button" variant="ghost" size="sm" className="w-full justify-between px-2">
                          <span className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5" />
                            {t("subscribers.clients")}
                            <span className="text-muted-foreground">({clientsLabel})</span>
                          </span>
                          {clientsOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-2">
                        {assinante.clients.length === 0 ? (
                          <p className="px-2 text-xs text-muted-foreground">
                            {t("subscribers.noClients")}
                          </p>
                        ) : (
                          <ul className="divide-y rounded-md border">
                            {assinante.clients.map((client) => (
                              <li key={client.id}>
                                <Link
                                  to="/clients/$clientId"
                                  params={{ clientId: client.id }}
                                  className="block px-3 py-2 text-sm hover:bg-muted/50"
                                >
                                  {client.name}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <Sheet
        open={Boolean(settingsFromQuery)}
        onOpenChange={(open) => {
          if (!open) {
            setSettingsAssinante(null);
            setResetPassword("");
          }
        }}
      >
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {settingsFromQuery ? (
            <>
              <SheetHeader>
                <SheetTitle>{t("subscribers.settingsTitle")}</SheetTitle>
                <SheetDescription>
                  {settingsFromQuery.fullName || settingsFromQuery.email}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-5">
                <div className="space-y-1.5">
                  <Label>{t("subscribers.fullName")}</Label>
                  <Input
                    value={settingsFromQuery.fullName ?? ""}
                    readOnly
                    disabled
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("subscribers.email")}</Label>
                  <Input value={settingsFromQuery.email} readOnly disabled />
                </div>

                {!settingsFromQuery.isMaster ? (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="settings-plan">{t("subscribers.plan")}</Label>
                      <Select
                        value={settingsFromQuery.plan ?? undefined}
                        onValueChange={(value) =>
                          planMutation.mutate({
                            userId: settingsFromQuery.userId,
                            plan: value as AssignablePlan,
                          })
                        }
                        disabled={planMutation.isPending}
                      >
                        <SelectTrigger id="settings-plan">
                          <SelectValue placeholder={t("subscribers.noPlan")} />
                        </SelectTrigger>
                        <SelectContent>
                          {ASSIGNABLE_PLANS.map((key) => (
                            <SelectItem key={key} value={key}>
                              {t(`subscribers.plans.${key}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <form
                      className="space-y-3 border-t pt-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (resetPassword.trim().length < 6) return;
                        resetMutation.mutate({
                          email: settingsFromQuery.email,
                          fullName: settingsFromQuery.fullName ?? undefined,
                          password: resetPassword.trim(),
                          plan: settingsFromQuery.plan ?? "courtesy",
                        });
                      }}
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor="settings-reset-password">
                          {t("subscribers.newPassword")}
                        </Label>
                        <PasswordInput
                          id="settings-reset-password"
                          required
                          minLength={6}
                          value={resetPassword}
                          onChange={(e) => setResetPassword(e.target.value)}
                          autoComplete="new-password"
                          placeholder="••••••••"
                        />
                        <p className="text-xs text-muted-foreground">
                          {t("subscribers.passwordHint")}
                        </p>
                      </div>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={
                          resetMutation.isPending || resetPassword.trim().length < 6
                        }
                      >
                        {t("subscribers.confirmReset")}
                      </Button>
                    </form>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("subscribers.masterHint")}
                  </p>
                )}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
