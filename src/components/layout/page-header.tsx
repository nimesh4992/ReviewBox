import { ReactNode } from "react";

interface PageHeaderProps {
  /**
   * Optional grouping label, e.g. "Operations" or "Operations · Incidents".
   * Deliberately quiet: on a top-level screen it only restates the sidebar
   * item the user just clicked, so it must not compete with the title. It
   * earns its weight on detail screens, where it works as a breadcrumb.
   */
  eyebrow?: string;
  title: string;
  /** Omit on screens where the content below already explains itself. */
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--rb-border-1)] bg-surface px-4 py-5 md:px-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-1.5 text-rb-xs font-medium uppercase tracking-[0.08em] text-fg-3">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-rb-xl font-semibold tracking-[-0.01em] text-fg-1">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-rb-base text-fg-3">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
