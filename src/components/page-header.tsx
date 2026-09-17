import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  leading,
  subtitle,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  leading?: ReactNode;
  subtitle?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        {leading}
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight break-words text-foreground sm:text-2xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 text-sm font-medium text-foreground">{subtitle}</p>
          ) : null}
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
