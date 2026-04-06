import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

type AdminPageHeaderProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: ReactNode;
};

export function AdminPageHeader({ icon: Icon, title, description, actions }: AdminPageHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-gradient-to-br from-[var(--bg-surface)] via-[var(--bg-surface)] to-[var(--bg-elevated)] p-5 shadow-[var(--shadow-card)] ring-1 ring-black/[0.04] dark:ring-white/[0.06] md:p-6">
      <div
        className="pointer-events-none absolute -right-16 -top-24 h-48 w-48 rounded-full bg-[var(--primary)]/[0.08] blur-3xl"
        aria-hidden
      />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-[var(--primary-light)]/30 blur-3xl dark:bg-[var(--primary)]/10" aria-hidden />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)]/12 shadow-inner ring-1 ring-[var(--primary)]/20">
            <Icon className="h-7 w-7 text-[var(--primary)]" strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--text-primary)] md:text-3xl">
              {title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--text-muted)]">{description}</p>
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
