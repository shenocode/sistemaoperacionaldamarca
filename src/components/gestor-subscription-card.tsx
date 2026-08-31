import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { useEntitlements } from "@/hooks/use-entitlements";
import { supabase } from "@/integrations/supabase/client";
import { LegalDocLinks } from "@/components/legal-doc-links";
import { listClients, listMyTeam, startSubscriptionCheckout, changeSubscriptionPlan, openBillingPortal } from "@/lib/api";
import {
  allPaidPlans,
  entitlementsForPlan,
  nextPaidPlans,
  type PaidPlan,
} from "@/lib/plan-entitlements";

const FEATURE_KEYS = ["brandBriefing", "library", "presets", "designAi"] as const;

type FeatureKey = (typeof FEATURE_KEYS)[number];

function planNameKey(plan: string) {
  return `accessRelease.plans.${plan}`;
}

function UsageRow({ label, used, max }: { label: string; used: number; max: number | null }) {
  const { t } = useTranslation();
  const value =
    max === null
      ? t("gestorProfile.subscription.usageUnlimited", { used })
      : t("gestorProfile.subscription.usageCount", { used, max });
  const pct = max && max > 0 ? Math.min(100, (used / max) * 100) : null;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="shrink-0 text-muted-foreground">{value}</span>
      </div>
      {pct !== null ? <Progress value={pct} /> : null}
    </div>
  );
}

function FeatureRow({ feature, included }: { feature: FeatureKey; included: boolean }) {
  const { t } = useTranslation();
  return (
    <li className="flex items-start gap-2 text-sm">
      {included ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-foreground" aria-hidden="true" />
      ) : (
        <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <span className={included ? undefined : "text-muted-foreground"}>
        {t(`gestorProfile.subscription.features.${feature}`)}
      </span>
    </li>
  );
}

export function GestorSubscriptionCard({ email }: { email?: string | null }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { entitlements, loading } = useEntitlements();
  const [checkoutPlan, setCheckoutPlan] = useState<PaidPlan | null>(null);
  const [upgradePlan, setUpgradePlan] = useState<PaidPlan | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const showUsage = entitlements.isTeamOwner && !entitlements.isMaster;
  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: listClients,
    enabled: showUsage,
  });
  const teamQuery = useQuery({
    queryKey: ["team", "me"],
    queryFn: listMyTeam,
    enabled: showUsage && entitlements.canManageTeam,
  });
  const membershipQuery = useQuery({
    queryKey: ["team", "membership", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_memberships")
        .select("owner_user_id")
        .eq("member_user_id", user!.id)
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled:
      Boolean(user?.id) &&
      !entitlements.isMaster &&
      !entitlements.isTeamOwner &&
      !entitlements.plan,
  });

  const isCollaborator =
    !entitlements.isMaster &&
    !entitlements.isTeamOwner &&
    (Boolean(entitlements.plan) || Boolean(membershipQuery.data?.owner_user_id));
  const isOwnerView = entitlements.isTeamOwner && !entitlements.isMaster;
  const canSubscribe = !entitlements.isMaster && !isCollaborator && !entitlements.plan;

  if (loading || membershipQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  const planLabel = entitlements.plan
    ? t(planNameKey(entitlements.plan))
    : entitlements.isMaster
      ? t("accessRelease.plans.fullAccess")
      : t("gestorProfile.subscription.noPlan");

  const clientUsed = clientsQuery.data?.length ?? 0;
  const userUsed = entitlements.canManageTeam ? (teamQuery.data?.seatCount ?? 1) : 1;
  const upgrades = isOwnerView ? nextPaidPlans(entitlements.plan) : [];
  const subscribePlans = canSubscribe ? allPaidPlans() : [];

  async function handleSubscribe(plan: PaidPlan) {
    setCheckoutPlan(plan);
    try {
      await startSubscriptionCheckout(plan, email?.trim() || undefined);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("gestorProfile.subscription.checkoutError"),
      );
      setCheckoutPlan(null);
    }
  }

  async function handleUpgrade(plan: PaidPlan) {
    setUpgradePlan(plan);
    try {
      await changeSubscriptionPlan(plan);
      toast.success(t("gestorProfile.subscription.upgradeSuccess", { plan: t(planNameKey(plan)) }));
      window.location.reload();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("gestorProfile.subscription.upgradeError"),
      );
      setUpgradePlan(null);
    }
  }

  async function handleManageBilling() {
    setPortalLoading(true);
    try {
      await openBillingPortal();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("gestorProfile.subscription.portalError"),
      );
      setPortalLoading(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">{t("gestorProfile.subscription.title")}</p>
        <p className="text-xs text-muted-foreground">{t("gestorProfile.subscription.subtitle")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {t("gestorProfile.subscription.currentPlan")}
        </span>
        <Badge variant={entitlements.plan || entitlements.isMaster ? "default" : "secondary"}>
          {planLabel}
        </Badge>
      </div>

      {entitlements.isMaster ? (
        <p className="text-sm text-muted-foreground">
          {t("gestorProfile.subscription.masterBody")}
        </p>
      ) : isCollaborator ? (
        <p className="text-sm text-muted-foreground">
          {entitlements.plan
            ? t("gestorProfile.subscription.collaboratorBody", { plan: planLabel })
            : t("gestorProfile.subscription.collaboratorNoPlan")}
        </p>
      ) : !entitlements.plan ? (
        <p className="text-sm text-muted-foreground">
          {t("gestorProfile.subscription.noPlanBody")}
        </p>
      ) : entitlements.plan === "courtesy" ? (
        <p className="text-sm text-muted-foreground">
          {t("gestorProfile.subscription.courtesyBody")}
        </p>
      ) : entitlements.plan === "agency" ? (
        <p className="text-sm text-muted-foreground">
          {t("gestorProfile.subscription.agencyMaxBody")}
        </p>
      ) : null}

      {showUsage ? (
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("gestorProfile.subscription.usageTitle")}
          </p>
          <UsageRow
            label={t("gestorProfile.subscription.clients")}
            used={clientUsed}
            max={entitlements.maxClients}
          />
          <UsageRow
            label={t("gestorProfile.subscription.users")}
            used={userUsed}
            max={entitlements.maxUsers}
          />
        </div>
      ) : null}

      {isOwnerView && entitlements.plan ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("gestorProfile.subscription.includedTitle")}
          </p>
          <ul className="space-y-1.5">
            {FEATURE_KEYS.map((feature) => (
              <FeatureRow
                key={feature}
                feature={feature}
                included={Boolean(entitlements[feature])}
              />
            ))}
          </ul>
        </div>
      ) : null}

      {subscribePlans.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("gestorProfile.subscription.subscribeTitle")}
          </p>
          <div className="space-y-2">
            {subscribePlans.map((plan) => (
              <PaidPlanRow
                key={plan}
                plan={plan}
                action={
                  <Button
                    type="button"
                    size="sm"
                    disabled={checkoutPlan !== null}
                    loading={checkoutPlan === plan}
                    loadingLabel={t("landing.pricingCtaLoading")}
                    onClick={() => void handleSubscribe(plan)}
                  >
                    {t("gestorProfile.subscription.subscribe", { plan: t(planNameKey(plan)) })}
                  </Button>
                }
              />
            ))}
          </div>
        </div>
      ) : null}

      {upgrades.length > 0 ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("gestorProfile.subscription.upgradesTitle")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("gestorProfile.subscription.upgradesHint")}
            </p>
          </div>
          <div className="space-y-2">
            {upgrades.map((plan) => (
              <PaidPlanRow
                key={plan}
                plan={plan}
                current={entitlements}
                action={
                  <Button
                    type="button"
                    size="sm"
                    disabled={upgradePlan !== null || checkoutPlan !== null}
                    loading={upgradePlan === plan}
                    loadingLabel={t("gestorProfile.subscription.upgrading")}
                    onClick={() => void handleUpgrade(plan)}
                  >
                    {t("gestorProfile.subscription.upgradeTo", {
                      plan: t(planNameKey(plan)),
                    })}
                  </Button>
                }
              />
            ))}
          </div>
        </div>
      ) : null}

      {isOwnerView &&
      entitlements.plan &&
      entitlements.plan !== "courtesy" ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={portalLoading}
          loading={portalLoading}
          loadingLabel={t("gestorProfile.subscription.openingPortal")}
          onClick={() => void handleManageBilling()}
        >
          {t("gestorProfile.subscription.manageBilling")}
        </Button>
      ) : null}

      {isOwnerView && entitlements.plan === "agency" ? (
        <Button asChild variant="secondary" size="sm">
          <Link to="/help" search={{ intent: "more" }}>
            {t("gestorProfile.subscription.requestMore")}
          </Link>
        </Button>
      ) : null}

      {isOwnerView && entitlements.plan === "courtesy" ? (
        <Button asChild size="sm">
          <Link to="/help" search={{ intent: "convert" }}>
            {t("gestorProfile.subscription.convertCourtesy")}
          </Link>
        </Button>
      ) : null}

      {!entitlements.isMaster && !isCollaborator ? (
        <p className="text-sm">
          <Link
            to="/"
            hash="planos"
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            {t("gestorProfile.subscription.seeAllPlans")}
          </Link>
        </p>
      ) : null}

      {(isOwnerView || canSubscribe) && !entitlements.isMaster ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("gestorProfile.subscription.billingFaqTitle")}
          </p>
          <dl className="space-y-2">
            {(["cancel", "late", "ai"] as const).map((item) => (
              <div key={item} className="space-y-0.5">
                <dt className="text-sm font-medium">
                  {t(`gestorProfile.subscription.billingFaq.${item}Q`)}
                </dt>
                <dd className="text-sm text-muted-foreground">
                  {t(`gestorProfile.subscription.billingFaq.${item}A`)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      <LegalDocLinks />
    </section>
  );
}

function PaidPlanRow({
  plan,
  action,
  current,
}: {
  plan: PaidPlan;
  action: ReactNode;
  current?: { [K in FeatureKey]: boolean };
}) {
  const { t } = useTranslation();
  const next = entitlementsForPlan(plan);
  const highlights = FEATURE_KEYS.filter((feature) => next[feature] && !current?.[feature]).map(
    (feature) => t(`gestorProfile.subscription.features.${feature}`),
  );

  return (
    <article className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium">
          {t(planNameKey(plan))}{" "}
          <span className="font-normal text-muted-foreground">
            R$ {t(`landing.plans.${plan}.price`)}
            {t("landing.pricingPeriod")}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">{t(`landing.plans.${plan}.desc`)}</p>
        <p className="text-xs text-muted-foreground">
          {t("gestorProfile.subscription.planLimits", {
            clients: next.maxClients ?? t("gestorProfile.subscription.unlimited"),
            users: next.maxUsers ?? t("gestorProfile.subscription.unlimited"),
          })}
          {highlights.length ? ` · ${highlights.join(" · ")}` : ""}
        </p>
      </div>
      <div className="shrink-0">{action}</div>
    </article>
  );
}
