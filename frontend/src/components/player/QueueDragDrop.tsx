import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { clsx } from 'clsx';
import { GripVertical, X } from 'lucide-react';

import { usePlayerStore } from '../../store/playerStore';
import type { Track } from '../../types';
import { stringToColor } from '../../utils/color';

function SortableQueueRow({
  track,
  index,
  isActive,
  base,
  onPlay,
  onRemove,
}: {
  track: Track;
  index: number;
  isActive: boolean;
  base: string;
  onPlay: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: track.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const artist = track.user?.display_name ?? track.user?.username ?? '';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={clsx(
        'group flex items-center gap-2 rounded-xl border px-2 py-2 transition',
        isActive
          ? 'border-[var(--primary)]/40 bg-[var(--primary-light)]'
          : 'border-transparent bg-[var(--bg-elevated)]/80 hover:border-[var(--border)]',
        isDragging && 'z-10 opacity-90 shadow-lg ring-2 ring-[var(--primary)]/30'
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface)] active:cursor-grabbing"
        aria-label="Перетащить"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="w-5 shrink-0 text-center text-xs tabular-nums text-[var(--text-muted)]">{index + 1}</span>
      <button type="button" onClick={onPlay} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-surface)]">
          {track.cover_url ? (
            <img src={`${base}${track.cover_url}`} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full" style={{ background: stringToColor(track.title ?? String(track.id)) }} />
          )}
        </div>
        <div className="min-w-0">
          <p className={clsx('truncate text-sm font-semibold', isActive ? 'text-[var(--primary)]' : 'text-[var(--text-primary)]')}>
            {track.title}
          </p>
          {artist ? <p className="truncate text-xs text-[var(--text-muted)]">{artist}</p> : null}
        </div>
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-lg p-1.5 text-[var(--text-muted)] opacity-0 transition hover:bg-[var(--bg-surface)] hover:text-[var(--error)] group-hover:opacity-100"
        aria-label="Убрать из очереди"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function QueueDragDrop() {
  const queue = usePlayerStore((s) => s.queue);
  const currentIndex = usePlayerStore((s) => s.currentIndex);
  const reorderQueue = usePlayerStore((s) => s.reorderQueue);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const base = import.meta.env.VITE_API_URL || '';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  if (!queue.length) return null;

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = queue.findIndex((t) => t.id === active.id);
    const to = queue.findIndex((t) => t.id === over.id);
    if (from >= 0 && to >= 0) reorderQueue(from, to);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={queue.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="scrollbar-themed max-h-52 space-y-1.5 overflow-y-auto pr-1">
          {queue.map((track, idx) => (
            <SortableQueueRow
              key={track.id}
              track={track}
              index={idx}
              isActive={idx === currentIndex}
              base={base}
              onPlay={() => playTrack(track, queue)}
              onRemove={() => removeFromQueue(idx)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
