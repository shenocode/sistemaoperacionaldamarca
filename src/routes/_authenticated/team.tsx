import { useMemo, useRef, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  getMyEntitlements,
  isAdmin,
  listMyTeam,
  provisionTeamMember,
  removeTeamMember,
  resetTeamMemberPassword,
  resolvePostLoginPath,
  setTeamMemberClients,
  buildWhatsAppNotifyUrl,
  openWhatsAppInvitePlaceholder,
  navigateWhatsAppInvite,
} from "@/lib/api";
import { useEntitlements } from "@/hooks/use-entitlements";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { WhatsAppPhoneField } from "@/components/whatsapp-phone-field";
import { isValidWhatsAppLocal, splitWhatsAppDigits } from "@/lib/whatsapp-countries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/team")({
  beforeLoad: async () => {
    if (!(await isAdmin())) {
      const dest = await resolvePostLoginPath();
      if (dest.to === "/clients/$clientId/projects/$projectId/feed") {
        throw redirect({ to: dest.to, params: dest.params, search: dest.search });
      }
      throw redirect({ to: dest.to });
    }

    const entitlements = await getMyEntitlements();
    if (!entitlements.isTeamOwner && !entitlements.isMaster) {
      throw redirect({ to: "/dashboard" });
    }
  },
  head: () => ({
    meta: [
      { title: "Equipe — SOM" },
      { name: "description", content: "Convidar usuários e atribuir clientes." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { entitlements, loading: entitlementsLoading } = useEntitlements();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [draftClients, setDraftClients] = useState<Record<string, string[]>>({});
  const inviteTabRef = useRef<Window | null>(null);

  const canManage = entitlements.canManageTeam;

  const teamQuery = useQuery({
    queryKey: ["team", "me"],
    queryFn: listMyTeam,
    enabled: canManage,
  });

  const members = teamQuery.data?.members ?? [];
  const clients = teamQuery.data?.clients ?? [];
  const seatCount = teamQuery.data?.seatCount ?? 1;
  const maxUsers = teamQuery.data?.maxUsers ?? entitlements.maxUsers;

  const seatsLabel = useMemo(() => {
    if (maxUsers === null) return t("team.seatsUnlimited", { used: seatCount });
    return t("team.seats", { used: seatCount, max: maxUsers });
  }, [maxUsers, seatCount, t]);

  function clientSelection(memberId: string, fallback: string[]) {
    return draftClients[memberId] ?? fallback;
  }

  function toggleClient(memberId: string, fallback: string[], clientId: string, checked: boolean) {
    const current = new Set(clientSelection(memberId, fallback));
    if (checked) current.add(clientId);
    else current.delete(clientId);
    setDraftClients((prev) => ({ ...prev, [memberId]: [...current] }));
  }

  function buildInviteUrl(input: {
    whatsapp: string;
    email: string;
    password: string;
  }) {
    const link = `${window.location.origin}/auth`;
    const message = t("team.inviteWhatsAppMessage", {
      link,
      email: input.email,
      password: input.password,
    });
    return buildWhatsAppNotifyUrl(input.whatsapp, message);
  }

  const provisionMutation = useMutation({
    mutationFn: () =>
      provisionTeamMember({
        email: email.trim(),
        password: password.trim(),
        fullName: fullName.trim() || undefined,
        whatsapp: whatsapp.replace(/\D/g, ""),
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
      queryClient.invalidateQueries({ queryKey: ["team", "me"] });
      setFullName("");
      setEmail("");
      setPassword("");
      setWhatsapp("");
      toast.success(result.created ? t("team.created") : t("team.updated"));
      if (!opened) toast.message(t("team.whatsappBlocked"));
    },
    onError: (err: Error) => {
      inviteTabRef.current?.close();
      inviteTabRef.current = null;
      toast.error(err.message);
    },
  });

  const resetMutation = useMutation({
    mutationFn: (input: { memberUserId: string; password: string }) =>
      resetTeamMemberPassword(input),
    onSuccess: () => {
      setResettingUserId(null);
      setResetPassword("");
      toast.success(t("team.passwordUpdated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: (memberUserId: string) => removeTeamMember(memberUserId),
    onSuccess: (_data, memberUserId) => {
      queryClient.invalidateQueries({ queryKey: ["team", "me"] });
      setDraftClients((prev) => {
        const next = { ...prev };
        delete next[memberUserId];
        return next;
      });
      toast.success(t("team.removed"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const assignMutation = useMutation({
    mutationFn: (input: { memberUserId: string; clientIds: string[] }) =>
      setTeamMemberClients(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["team", "me"] });
      setDraftClients((prev) => {
        const next = { ...prev };
        delete next[variables.memberUserId];
        return next;
      });
      toast.success(t("team.clientsSaved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (entitlementsLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 md:p-8">
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 md:p-8">
        <PageHeader title={t("team.title")} description={t("team.description")} />
        <EmptyState title={t("team.lockedTitle")} description={t("team.lockedBody")} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 md:p-8">
      <PageHeader
        title={t("team.title")}
        description={t("team.description")}
        actions={<Badge variant="secondary">{seatsLabel}</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("team.formTitle")}</CardTitle>
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
            <div className="space-y-1.5">
              <Label htmlFor="team-name">{t("team.fullName")}</Label>
              <Input
                id="team-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="off"
                placeholder={t("team.fullNamePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-email">{t("team.email")}</Label>
              <Input
                id="team-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                placeholder="usuario@email.com"
              />
            </div>
            <WhatsAppPhoneField
              idPrefix="team"
              value={whatsapp}
              onChange={setWhatsapp}
              label={t("team.whatsapp")}
              countryLabel={t("team.whatsappCountry")}
              hint={t("team.whatsappHint")}
              required
            />
            <div className="space-y-1.5">
              <Label htmlFor="team-password">{t("team.password")}</Label>
              <PasswordInput
                id="team-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
              />
              <p className="text-xs text-muted-foreground">{t("team.passwordHint")}</p>
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
              {t("team.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">{t("team.listTitle")}</h2>
        {teamQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : teamQuery.isError ? (
          <p className="text-sm text-destructive">{t("team.loadError")}</p>
        ) : members.length === 0 ? (
          <EmptyState title={t("team.empty")} description={t("team.emptyHint")} />
        ) : (
          <ul className="divide-y rounded-md border">
            {members.map((member) => {
              const isResetting = resettingUserId === member.userId;
              const selected = clientSelection(member.userId, member.clientIds);
              const selectedSet = new Set(selected);
              const dirty =
                selected.length !== member.clientIds.length ||
                selected.some((id) => !member.clientIds.includes(id));

              return (
                <li key={member.userId} className="space-y-3 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {member.fullName || member.email}
                      </p>
                      {member.fullName ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {member.email}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {t("team.assignedCount", { count: member.clientIds.length })}
                      </Badge>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isResetting}
                        onClick={() => {
                          setResettingUserId(member.userId);
                          setResetPassword("");
                        }}
                      >
                        {t("team.resetPassword")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={removeMutation.isPending}
                        onClick={() => {
                          if (window.confirm(t("team.removeConfirm"))) {
                            removeMutation.mutate(member.userId);
                          }
                        }}
                      >
                        {t("team.remove")}
                      </Button>
                    </div>
                  </div>

                  {isResetting ? (
                    <form
                      className="space-y-3 border-t pt-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (resetPassword.trim().length < 6) return;
                        resetMutation.mutate({
                          memberUserId: member.userId,
                          password: resetPassword.trim(),
                        });
                      }}
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor={`team-reset-${member.userId}`}>
                          {t("team.newPassword")}
                        </Label>
                        <PasswordInput
                          id={`team-reset-${member.userId}`}
                          required
                          minLength={6}
                          autoFocus
                          value={resetPassword}
                          onChange={(e) => setResetPassword(e.target.value)}
                          autoComplete="new-password"
                          placeholder="••••••••"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={resetMutation.isPending}
                          onClick={() => {
                            setResettingUserId(null);
                            setResetPassword("");
                          }}
                        >
                          {t("common.cancel")}
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          disabled={
                            resetMutation.isPending || resetPassword.trim().length < 6
                          }
                        >
                          {t("team.confirmReset")}
                        </Button>
                      </div>
                    </form>
                  ) : null}

                  <div className="space-y-2 border-t pt-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t("team.assignClients")}
                    </p>
                    {clients.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {t("team.noClients")}
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {clients.map((client) => {
                          const checked = selectedSet.has(client.id);
                          return (
                            <li key={client.id} className="flex items-center gap-2">
                              <Checkbox
                                id={`team-${member.userId}-${client.id}`}
                                checked={checked}
                                onCheckedChange={(value) =>
                                  toggleClient(
                                    member.userId,
                                    member.clientIds,
                                    client.id,
                                    value === true,
                                  )
                                }
                              />
                              <Label
                                htmlFor={`team-${member.userId}-${client.id}`}
                                className="cursor-pointer text-sm font-normal"
                              >
                                {client.name}
                              </Label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      disabled={!dirty || assignMutation.isPending || clients.length === 0}
                      onClick={() =>
                        assignMutation.mutate({
                          memberUserId: member.userId,
                          clientIds: selected,
                        })
                      }
                    >
                      {t("team.saveClients")}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
