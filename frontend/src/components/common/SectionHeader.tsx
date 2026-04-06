import { clsx } from 'clsx';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type SectionHeaderProps = {
  title: string;
  href?: string;
  subtitle?: string;
  icon?: ReactNode;
  /** Компактный вид (меньше иконка и заголовок — для полок «Нравится» / «Репосты») */
  size?: 'default' | 'compact';
  /** Кнопка или ссылка справа (например «Все») */
  trailing?: ReactNode;
};

export function SectionHeader({ title, href, subtitle, icon, size = 'default', trailing }: SectionHeaderProps) {
  const compact = size === 'compact';

  return (
    <div className={compact ? 'mb-3 flex flex-col gap-0.5 sm:mb-4' : 'mb-4 flex flex-col gap-1 sm:mb-5'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          {icon ? (
            compact ? (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-elevated)] text-[var(--primary)] ring-1 ring-[var(--border)] [&_svg]:h-3.5 [&_svg]:w-3.5">
                {icon}
              </div>
            ) : (
              <div className="flex shrink-0">{icon}</div>
            )
          ) : null}
          <h2
            className={
              compact
                ? 'font-display text-base font-bold tracking-tight text-[var(--text-primary)] sm:text-lg'
                : 'font-display text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-[22px]'
            }
          >
            {title}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {trailing}
          {href ? (
            <Link to={href} className="text-sm font-semibold text-[var(--primary)] hover:underline">
              Все
            </Link>
          ) : null}
        </div>
      </div>
      {subtitle ? (
        <p
          className={clsx(
            compact ? 'max-w-2xl text-xs text-[var(--text-muted)]' : 'max-w-2xl text-sm text-[var(--text-muted)]',
            compact && icon && 'pl-10'
          )}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
