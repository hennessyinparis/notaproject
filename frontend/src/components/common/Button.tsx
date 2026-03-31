import { clsx } from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  disabled,
  children,
  ...rest
}: Props) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={clsx(
        'relative inline-flex items-center justify-center font-semibold rounded-xl transition-all',
        'active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none',
        size === 'sm' && 'px-3 py-1.5 text-sm',
        size === 'md' && 'px-5 py-2.5 text-[15px]',
        size === 'lg' && 'px-7 py-3 text-base',
        variant === 'primary' &&
          'bg-[var(--primary)] text-white shadow-lg shadow-[var(--primary)]/25 hover:bg-[var(--primary-hover)]',
        variant === 'secondary' &&
          'bg-[var(--primary-light)] text-[var(--primary)] hover:brightness-95 dark:hover:brightness-110',
        variant === 'ghost' && 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]',
        variant === 'danger' && 'bg-[var(--error)] text-white hover:opacity-90',
        className
      )}
      {...rest}
    >
      {loading ? <span className="opacity-80">…</span> : children}
    </button>
  );
}
