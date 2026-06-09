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
import { Disc3, GripVertical, Music2, Plus, X } from 'lucide-react';

export type AlbumTrackRow = {
  key: string;
  file: File;
  title: string;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function SortableTrackRow({
  row,
  index,
  onTitleChange,
  onRemove,
}: {
  row: AlbumTrackRow;
  index: number;
  onTitleChange: (title: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.key,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx(
        'group flex items-center gap-3 rounded-xl border p-3 transition',
        isDragging
          ? 'z-10 border-[var(--primary)]/50 bg-[var(--primary-light)] shadow-[var(--shadow-hover)]'
          : 'border-[var(--border)] bg-[var(--bg-base)] hover:border-[var(--primary)]/25'
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] active:cursor-grabbing"
        aria-label="Перетащить"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-light)] text-[var(--primary)]">
        <span className="font-display text-sm font-bold tabular-nums">{index + 1}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <input
          value={row.title}
          onChange={(e) => onTitleChange(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
          placeholder="Название трека"
        />
        <p className="truncate text-xs text-[var(--text-muted)]">
          <Music2 className="mr-1 inline h-3 w-3 opacity-70" aria-hidden />
          {row.file.name}
          <span className="mx-1.5 text-[var(--border)]">·</span>
          {formatFileSize(row.file.size)}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-lg p-2 text-[var(--text-muted)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--error)]"
        aria-label="Удалить"
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  );
}

type Props = {
  tracks: AlbumTrackRow[];
  onChange: (tracks: AlbumTrackRow[]) => void;
  onAddFiles: (files: File[]) => void;
};

export function AlbumTracksEditor({ tracks, onChange, onAddFiles }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = tracks.findIndex((t) => t.key === active.id);
    const to = tracks.findIndex((t) => t.key === over.id);
    if (from < 0 || to < 0) return;
    const next = [...tracks];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-card)] ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-gradient-to-r from-[var(--primary-light)] to-transparent px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--primary)]/15 text-[var(--primary)]">
            <Disc3 className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">Треклист альбома</h3>
            <p className="text-xs text-[var(--text-muted)]">{tracks.length} {tracks.length === 1 ? 'трек' : 'треков'} · перетащите для порядка</p>
          </div>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--primary)]/30 bg-[var(--primary-light)] px-3.5 py-2 text-sm font-semibold text-[var(--primary)] transition hover:bg-[var(--primary)]/15">
          <Plus className="h-4 w-4" />
          Добавить треки
          <input
            type="file"
            accept="audio/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) onAddFiles(files);
              e.target.value = '';
            }}
          />
        </label>
      </div>

      {tracks.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-[var(--text-muted)]">Добавьте аудиофайлы — они появятся здесь</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={tracks.map((t) => t.key)} strategy={verticalListSortingStrategy}>
            <ul className="scrollbar-themed max-h-[min(420px,50vh)] space-y-2 overflow-y-auto p-3 sm:p-4">
              {tracks.map((row, idx) => (
                <SortableTrackRow
                  key={row.key}
                  row={row}
                  index={idx}
                  onTitleChange={(title) =>
                    onChange(tracks.map((r) => (r.key === row.key ? { ...r, title } : r)))
                  }
                  onRemove={() => onChange(tracks.filter((r) => r.key !== row.key))}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}
