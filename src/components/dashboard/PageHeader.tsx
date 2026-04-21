import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  breadcrumb,
  action,
}: {
  title: string;
  description?: string;
  breadcrumb?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="border-b border-border bg-card px-8 py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          {breadcrumb && (
            <p className="mb-2 text-sm text-muted-foreground">{breadcrumb}</p>
          )}
          <h1 className="font-display text-3xl font-semibold text-foreground">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}

export function StatCard({
  icon,
  iconBg,
  label,
  value,
  valueColor = "text-[var(--gold)]",
}: {
  icon: ReactNode;
  iconBg: string;
  label: string;
  value: string | number;
  valueColor?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>
          {icon}
        </div>
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <div className={`font-display text-4xl font-semibold ${valueColor}`}>{value}</div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-6">{description}</p>
      {action}
    </div>
  );
}
