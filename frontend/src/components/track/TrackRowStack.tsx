import { clsx } from 'clsx';
import type { ReactNode } from 'react';

/** Единая обёртка для списков треков (как в библиотеке): бордер, скругление, тень. */
export function TrackRowStack({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        'overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-hover)] ring-1 ring-black/[0.04] dark:ring-white/[0.06]',
        className
      )}
    >
      {children}
    </div>
  );
}
