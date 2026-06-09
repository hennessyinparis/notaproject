import { useState } from 'react';
import toast from 'react-hot-toast';

import { api } from '../../api/client';
import { Button } from '../common/Button';

type Props = {
  open: boolean;
  onClose: () => void;
  artistUsername: string;
  artistName: string;
};

export function DonateModal({ open, onClose, artistUsername, artistName }: Props) {
  const [amount, setAmount] = useState('100');
  const [message, setMessage] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const submit = async () => {
    const n = Number(amount);
    if (!n || n <= 0) {
      toast.error('Укажите сумму');
      return;
    }
    setLoading(true);
    try {
      await api.post(`/api/donations/${artistUsername}`, {
        amount_rub: n,
        message: message.trim() || undefined,
        is_anonymous: anonymous,
      });
      toast.success(`Донат отправлен артисту ${artistName}`);
      onClose();
      setMessage('');
      setAnonymous(false);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Не удалось отправить донат');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-bold">Поддержать {artistName}</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Донат доступен артистам с подпиской «Артист Про»</p>
        <label className="mt-4 block text-sm font-medium">Сумма, ₽</label>
        <input
          type="number"
          min={1}
          max={100000}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm"
        />
        <label className="mt-3 block text-sm font-medium">Сообщение (необязательно)</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={500}
          className="mt-1 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm"
        />
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
          />
          Отправить анонимно
        </label>
        <div className="mt-5 flex gap-2">
          <Button className="flex-1" onClick={() => void submit()} loading={loading}>
            Отправить
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
        </div>
      </div>
    </div>
  );
}
