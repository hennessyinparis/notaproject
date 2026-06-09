import { useMutation } from '@tanstack/react-query';
import { Flag, Loader2, X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';

import { api } from '../../api/client';

const reasons = [
  { value: 'copyright', label: 'Нарушение авторских прав' },
  { value: 'spam', label: 'Спам' },
  { value: 'abuse', label: 'Оскорбления / токсичность' },
  { value: 'inappropriate', label: 'Неприемлемый контент' },
  { value: 'other', label: 'Другое' },
];

type ReportType = 'track' | 'comment' | 'user' | 'playlist';

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  reportType: ReportType;
  targetId: number;
  /** Отображаемое имя цели для контекста */
  targetLabel?: string;
}

export function ReportModal({ open, onClose, reportType, targetId, targetLabel }: ReportModalProps) {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');

  const createM = useMutation({
    mutationFn: (data: { report_type: string; target_id: number; reason: string; description?: string }) =>
      api.post('/api/reports', data).then((r) => r.data),
    onSuccess: () => {
      toast.success('Жалоба отправлена');
      setReason('');
      setDescription('');
      onClose();
    },
    onError: (e: any) => {
      if (e?.response?.status === 409) {
        toast.error('Вы уже отправляли жалобу на этот объект');
      } else if (e?.response?.data?.detail) {
        toast.error(`Ошибка: ${e.response.data.detail}`);
      } else {
        toast.error(`Ошибка ${e?.response?.status || 'сети'}`);
      }
    },
  });

  const canSubmit = !!reason;

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
              <Flag className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-[var(--text-primary)]">Пожаловаться</h2>
              {targetLabel && (
                <p className="text-xs text-[var(--text-muted)] truncate max-w-[280px]">{targetLabel}</p>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          {reasons.map((r) => (
            <label
              key={r.value}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                reason === r.value
                  ? 'border-red-400/50 bg-red-500/5'
                  : 'border-[var(--border)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              <input
                type="radio"
                name="reason"
                value={r.value}
                checked={reason === r.value}
                onChange={(e) => setReason(e.target.value)}
                className="h-4 w-4 accent-red-500"
              />
              <span className="text-sm text-[var(--text-primary)]">{r.label}</span>
            </label>
          ))}

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Подробности (необязательно)"
            maxLength={2000}
            rows={3}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-400/20"
          />
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={!canSubmit || createM.isPending}
            onClick={() => createM.mutate({ report_type: reportType, target_id: targetId, reason, description: description || undefined })}
            className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
          >
            {createM.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Отправить жалобу
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
