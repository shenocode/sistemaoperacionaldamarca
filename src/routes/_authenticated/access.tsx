import { useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { isAdminMasterEmail } from "@/lib/admin-master";
import { ASSIGNABLE_PLANS, type AssignablePlan } from "@/lib/plan-entitlements";
import {
  isAdmin,
  listGestores,
  provisionGestorAccess,
  resolvePostLoginPath,
  setGestorPlan,
} from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/access")({
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
      { title: "Liberação de acessos — SOM" },
      { name: "description", content: "Liberar login e senha para gestores." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccessReleasePage,
});

function AccessReleasePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState<AssignablePlan>("courtesy");
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const gestoresQuery = useQuery({
    queryKey: ["gestores"],
    queryFn: listGestores,
  });

  const provisionMutation = useMutation({
    mutationFn: () =>
      provisionGestorAccess({
        email: email.trim(),
        password: password.trim(),
        fullName: fullName.trim() || undefined,
        plan,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["gestores"] });
      setFullName("");
      setEmail("");
      setPassword("");
      setPlan("courtesy");
      toast.success(
        result.created ? t("accessRelease.created") : t("accessRelease.updated"),
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetMutation = useMutation({
    mutationFn: (input: { email: string; fullName?: string; password: string; plan?: AssignablePlan }) =>
      provisionGestorAccess({
        email: input.email,
        password: input.password,
        fullName: input.fullName,
        plan: input.plan,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gestores"] });
      setResettingUserId(null);
      setResetPassword("");
      toast.success(t("accessRelease.passwordUpdated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const planMutation = useMutation({
    mutationFn: (input: { userId: string; plan: AssignablePlan }) => setGestorPlan(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gestores"] });
      toast.success(t("accessRelease.planUpdated"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const gestores = gestoresQuery.data ?? [];

  function openReset(userId: string) {
    setResettingUserId(userId);
    setResetPassword("");
  }

  function cancelReset() {
    setResettingUserId(null);
    setResetPassword("");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 md:p-8">
      <PageHeader
        title={t("accessRelease.title")}
        description={t("accessRelease.description")}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("accessRelease.formTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!email.trim() || password.trim().length < 6) return;
              provisionMutation.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="gestor-name">{t("accessRelease.fullName")}</Label>
              <Input
                id="gestor-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="off"
                placeholder={t("accessRelease.fullNamePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gestor-email">{t("accessRelease.email")}</Label>
              <Input
                id="gestor-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                placeholder="gestor@email.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gestor-password">{t("accessRelease.password")}</Label>
              <Input
                id="gestor-password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
              />
              <p className="text-xs text-muted-foreground">{t("accessRelease.passwordHint")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gestor-plan">{t("accessRelease.plan")}</Label>
              <Select value={plan} onValueChange={(value) => setPlan(value as AssignablePlan)}>
                <SelectTrigger id="gestor-plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNABLE_PLANS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {t(`accessRelease.plans.${key}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("accessRelease.planHint")}</p>
            </div>
            <Button
              type="submit"
              disabled={
                provisionMutation.isPending ||
                !email.trim() ||
                password.trim().length < 6
              }
            >
              {t("accessRelease.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">{t("accessRelease.listTitle")}</h2>
        {gestoresQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : gestores.length === 0 ? (
          <EmptyState title={t("accessRelease.empty")} />
        ) : (
          <ul className="divide-y rounded-md border">
            {gestores.map((gestor) => {
              const isResetting = resettingUserId === gestor.userId;

              return (
                <li key={gestor.userId} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {gestor.fullName || gestor.email}
                      </p>
                      {gestor.fullName ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {gestor.email}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={gestor.isMaster ? "default" : "secondary"}>
                        {gestor.isMaster
                          ? t("accessRelease.roleAdministrator")
                          : t("accessRelease.roleGestor")}
                      </Badge>
                      {gestor.isMaster ? (
                        <Badge variant="outline">{t("accessRelease.plans.fullAccess")}</Badge>
                      ) : (
                        <Select
                          value={gestor.plan ?? undefined}
                          onValueChange={(value) =>
                            planMutation.mutate({
                              userId: gestor.userId,
                              plan: value as AssignablePlan,
                            })
                          }
                          disabled={planMutation.isPending}
                        >
                          <SelectTrigger className="h-8 w-[11.5rem]">
                            <SelectValue placeholder={t("accessRelease.noPlan")} />
                          </SelectTrigger>
                          <SelectContent>
                            {ASSIGNABLE_PLANS.map((key) => (
                              <SelectItem key={key} value={key}>
                                {t(`accessRelease.plans.${key}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {!gestor.isMaster ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isResetting}
                          onClick={() => openReset(gestor.userId)}
                        >
                          {t("accessRelease.resetPassword")}
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {isResetting ? (
                    <form
                      className="mt-3 space-y-3 border-t pt-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (resetPassword.trim().length < 6) return;
                        resetMutation.mutate({
                          email: gestor.email,
                          fullName: gestor.fullName ?? undefined,
                          password: resetPassword.trim(),
                          plan: gestor.plan ?? "courtesy",
                        });
                      }}
                    >
                      <div className="space-y-1.5">
                        <Label htmlFor={`reset-password-${gestor.userId}`}>
                          {t("accessRelease.newPassword")}
                        </Label>
                        <Input
                          id={`reset-password-${gestor.userId}`}
                          type="password"
                          required
                          minLength={6}
                          autoFocus
                          value={resetPassword}
                          onChange={(e) => setResetPassword(e.target.value)}
                          autoComplete="new-password"
                          placeholder="••••••••"
                        />
                        <p className="text-xs text-muted-foreground">
                          {t("accessRelease.passwordHint")}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={resetMutation.isPending}
                          onClick={cancelReset}
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
                          {t("accessRelease.confirmReset")}
                        </Button>
                      </div>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
