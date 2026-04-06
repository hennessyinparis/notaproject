import type { ReactNode } from 'react';

type PageShellProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
};

/**
 * Общая вёрстка внутренних страниц: заметный фон, заголовок, отступы.
 * Без этого блоки с var(--bg-surface) почти не отличимы от страницы в светлой теме.
 */
export function PageShell({ title, description, icon, actions, children }: PageShellProps) {
  return (
    <div className="relative pb-8 md:pb-12">
      <div
        className="pointer-events-none absolute -inset-x-4 -top-px h-40 rounded-b-3xl bg-gradient-to-b from-[var(--primary)]/[0.07] via-[var(--primary-light)] to-transparent dark:from-[var(--primary)]/15 dark:via-[var(--primary)]/5"
        aria-hidden
      />
      <div className="relative space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            {icon != null ? (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--bg-surface)] shadow-[var(--shadow-card)] ring-1 ring-[var(--border)] dark:bg-[var(--bg-elevated)]">
                {icon}
              </div>
            ) : null}
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--text-primary)] md:text-3xl">{title}</h1>
              {description ? <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[var(--text-muted)]">{description}</p> : null}
            </div>
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
        {children}
      </div>
    </div>
  );
}
