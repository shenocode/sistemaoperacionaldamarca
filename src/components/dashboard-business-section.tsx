import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Inbox, UserPlus, Users, Wallet } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { getDashboardBusinessStats } from "@/lib/api";
import { formatMrrBrl } from "@/lib/dashboard-metrics";
import type { AssignablePlan } from "@/lib/plan-entitlements";

function formatMonthLabel(monthKey: string, locale: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m) return monthKey;
  return new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(y, m - 1, 1));
}

export function DashboardBusinessSection() {
  const { t, i18n } = useTranslation();
  const statsQuery = useQuery({
    queryKey: ["dashboard", "business-stats"],
    queryFn: getDashboardBusinessStats,
  });

  const stats = statsQuery.data;
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "pt-BR";

  const growthConfig = useMemo<ChartConfig>(
    () => ({
      subscribers: {
        label: t("dashboard.chartSubscribers"),
        color: "var(--primary)",
      },
      leads: {
        label: t("dashboard.chartLeads"),
        color: "var(--chart-2)",
      },
    }),
    [t],
  );

  const planConfig = useMemo<ChartConfig>(
    () => ({
      count: {
        label: t("dashboard.chartCount"),
        color: "var(--primary)",
      },
    }),
    [t],
  );

  const growthData = useMemo(
    () =>
      (stats?.monthlySeries ?? []).map((point) => ({
        ...point,
        label: formatMonthLabel(point.month, locale),
      })),
    [stats?.monthlySeries, locale],
  );

  const planLabel = (plan: AssignablePlan) => {
    if (plan === "courtesy") return t("dashboard.planCourtesy");
    return t(`landing.plans.${plan}.name`);
  };

  const planData = useMemo(
    () =>
      (stats?.planMix ?? []).map((item) => ({
        plan: item.plan,
        label: planLabel(item.plan),
        count: item.count,
      })),
    // planLabel depends on t; stats?.planMix is the data driver
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stats?.planMix, t],
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t("dashboard.activeSubscribers")}
          value={stats?.activeSubscribers ?? "—"}
          icon={UserPlus}
        />
        <StatCard
          label={t("dashboard.estimatedMrr")}
          value={stats ? formatMrrBrl(stats.estimatedMrr) : "—"}
          icon={Wallet}
        />
        <StatCard
          label={t("dashboard.leadsThisMonth")}
          value={stats?.leadsThisMonth ?? "—"}
          icon={Inbox}
        />
        <StatCard
          label={t("nav.clients")}
          value={stats?.totalClients ?? "—"}
          icon={Users}
        />
      </div>
      {stats ? (
        <p className="text-xs text-muted-foreground">{t("dashboard.mrrHint")}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.growthChart")}</CardTitle>
            <CardDescription>{t("dashboard.growthChartHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={growthConfig} className="aspect-auto h-[260px] w-full">
              <LineChart data={growthData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Line
                  type="monotone"
                  dataKey="subscribers"
                  stroke="var(--color-subscribers)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="leads"
                  stroke="var(--color-leads)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader>
            <CardTitle className="text-base">{t("dashboard.planMix")}</CardTitle>
            <CardDescription>{t("dashboard.planMixHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={planConfig} className="aspect-auto h-[260px] w-full">
              <BarChart data={planData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
