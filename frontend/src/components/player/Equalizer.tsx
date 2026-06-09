import { RotateCcw, X, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useEqStore, EQ_PRESETS } from '../../store/eqStore';
import { usePlayerStore } from '../../store/playerStore';
import { useAuthStore } from '../../store/authStore';
import { hasPaidSubscription } from '../../utils/subscription';

interface Props {
  onClose: () => void;
}

const PRESET_LABELS: Record<string, string> = {
  flat: 'Плоский',
  rock: 'Рок',
  pop: 'Поп',
  jazz: 'Джаз',
  classical: 'Классика',
  electronic: 'Электро',
  bass_boost: 'Басы',
  treble_boost: 'Высокие',
  vocal: 'Вокал',
};

export function Equalizer({ onClose }: Props) {
  const { enabled, bands, preset, setEnabled, setBandGain, setPreset, setupForHowl } = useEqStore();
  const howl = usePlayerStore((s) => s.howl);
  const user = useAuthStore((s) => s.user);
  const isPaid = hasPaidSubscription(user);

  const toggleEnabled = () => {
    if (!isPaid) return;
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    if (newEnabled && howl) {
      setupForHowl(howl);
    }
  };

  const resetToFlat = () => setPreset('flat');

  if (!isPaid) {
    return (
      <div className="absolute bottom-full right-0 mb-2 w-72 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-[var(--text-primary)]">Эквалайзер</h3>
          <button onClick={onClose} className="rounded-full p-1 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary)]/10">
            <Lock className="h-6 w-6 text-[var(--primary)]" />
          </div>
          <div>
            <p className="font-semibold text-[var(--text-primary)]">Требуется подписка</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Эквалайзер доступен для подписчиков Нота Плюс и Артист Про</p>
          </div>
          <Link
            to="/subscriptions"
            onClick={onClose}
            className="mt-1 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Оформить подписку
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute bottom-full right-0 mb-2 w-[340px] rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-[var(--text-primary)]">Эквалайзер</h3>
        <div className="flex items-center gap-1.5">
          <button
            onClick={resetToFlat}
            className="rounded-full p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            title="Сбросить"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={toggleEnabled}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              enabled
                ? 'bg-[var(--primary)] text-white shadow-sm'
                : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {enabled ? 'Вкл' : 'Выкл'}
          </button>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Presets */}
      <div className="mb-4 flex flex-wrap gap-1">
        {Object.keys(EQ_PRESETS).map((name) => (
          <button
            key={name}
            onClick={() => { if (enabled) setPreset(name); }}
            disabled={!enabled}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors disabled:opacity-40 ${
              preset === name
                ? 'bg-[var(--primary)] text-white'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--border)]'
            }`}
          >
            {PRESET_LABELS[name] ?? name}
          </button>
        ))}
      </div>

      {/* Bands — vertical sliders via CSS transform */}
      <div className="flex items-end justify-between gap-1 px-1">
        {bands.map((band, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className="text-[9px] font-medium tabular-nums text-[var(--text-muted)]">
              {band.gain > 0 ? '+' : ''}{band.gain}
            </span>

            {/* Vertical slider container: h=100px, w=20px */}
            <div
              className="relative flex items-center justify-center overflow-visible"
              style={{ height: 100, width: 20 }}
            >
              {/* Track background */}
              <div className="pointer-events-none absolute left-1/2 top-0 h-full w-1 -translate-x-1/2 rounded-full bg-[var(--bg-elevated)]" />
              {/* Zero line */}
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-px w-3 -translate-x-1/2 -translate-y-1/2 bg-[var(--border)]" />
              {/* Filled portion above/below zero */}
              {band.gain !== 0 && (
                <div
                  className="pointer-events-none absolute left-1/2 w-1 -translate-x-1/2 rounded-full bg-[var(--primary)]"
                  style={{
                    height: `${Math.abs(band.gain) / 12 * 50}%`,
                    top: band.gain > 0 ? `${50 - (band.gain / 12 * 50)}%` : '50%',
                  }}
                />
              )}
              {/* Actual input, rotated -90° so it runs bottom→top */}
              <input
                type="range"
                min={-12}
                max={12}
                step={1}
                value={band.gain}
                onChange={(e) => setBandGain(i, Number(e.target.value))}
                disabled={!enabled}
                aria-label={`EQ ${band.label}`}
                className="absolute cursor-pointer accent-[var(--primary)] disabled:cursor-not-allowed"
                style={{
                  width: 100,
                  height: 20,
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%) rotate(-90deg)',
                  opacity: enabled ? 1 : 0.4,
                }}
              />
            </div>

            <span className="text-[9px] text-[var(--text-muted)]">{band.label}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex justify-between text-[9px] text-[var(--text-muted)]">
        <span>−12 дБ</span>
        <span>0 дБ</span>
        <span>+12 дБ</span>
      </div>
    </div>
  );
}
