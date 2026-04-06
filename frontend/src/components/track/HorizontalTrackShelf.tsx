import type { ReactNode } from 'react';

type ShelfProps = {
  children: ReactNode;
  className?: string;
  /** Уже карточки и отступы — для блоков «Нравится» / «Репосты» */
  compact?: boolean;
  'aria-label'?: string;
};

/** Горизонтальный ряд карточек: только прокрутка и отступы, без «коробки» поверх контента. */
export function HorizontalTrackShelf({
  children,
  className = '',
  compact = false,
  'aria-label': ariaLabel,
}: ShelfProps) {
  return (
    <div
      className={[
        'hide-scrollbar -mx-1 flex snap-x snap-mandatory overflow-x-auto scroll-smooth px-1 pb-1 pt-0.5',
        compact ? 'gap-2.5 sm:gap-3' : 'gap-4 sm:gap-5',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      role="region"
      aria-label={ariaLabel ?? 'Горизонтальный список треков'}
      style={{ WebkitOverflowScrolling: 'touch' as const }}
    >
      {children}
    </div>
  );
}

export function HorizontalTrackShelfSlot({
  children,
  compact = false,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact ? 'w-[118px] shrink-0 snap-start sm:w-[132px]' : 'w-44 shrink-0 snap-start sm:w-[188px]'
      }
    >
      {children}
    </div>
  );
}
