import { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--rb-border-1)] bg-[var(--rb-bg-surface)] px-4 py-4 md:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#0A84FF]">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-lg font-semibold text-[var(--rb-fg-1)]">{title}</h1>
        <p className="mt-0.5 max-w-3xl text-sm text-[var(--rb-fg-3)]">{description}</p>
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
