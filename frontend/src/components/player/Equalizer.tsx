import { motion } from 'framer-motion';
import { RotateCcw, X } from 'lucide-react';

import { useEqStore, EQ_PRESETS } from '../../store/eqStore';
import { usePlayerStore } from '../../store/playerStore';

interface Props {
  onClose: () => void;
}

export function Equalizer({ onClose }: Props) {
  const { enabled, bands, preset, setEnabled, setBandGain, setPreset, setupForHowl } = useEqStore();
  const howl = usePlayerStore((s) => s.howl);

  const toggleEnabled = () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    if (newEnabled && howl) {
      setupForHowl(howl);
    }
  };

  const resetToFlat = () => {
    setPreset('flat');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-full mb-2 right-0 w-80 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-lg md:right-0"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">Эквалайзер</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={resetToFlat}
            className="rounded-full p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
            title="Сбросить"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={toggleEnabled}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              enabled
                ? 'bg-[var(--primary)] text-white'
                : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
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

      <div className="mb-4 flex flex-wrap gap-1">
        {Object.keys(EQ_PRESETS).map((name) => (
          <button
            key={name}
            onClick={() => setPreset(name)}
            className={`rounded-full px-2 py-1 text-xs transition-colors ${
              preset === name
                ? 'bg-[var(--primary)] text-white'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--border)]'
            }`}
          >
            {name === 'flat' ? 'Плоский' :
             name === 'rock' ? 'Рок' :
             name === 'pop' ? 'Поп' :
             name === 'jazz' ? 'Джаз' :
             name === 'classical' ? 'Классика' :
             name === 'electronic' ? 'Электро' :
             name === 'bass_boost' ? 'Басы' :
             name === 'treble_boost' ? 'Высокие' :
             name === 'vocal' ? 'Вокал' : name}
          </button>
        ))}
      </div>

      <div className="flex justify-between gap-1">
        {bands.map((band, i) => (
          <div key={i} className="flex flex-col items-center">
            <span className="mb-1 text-[10px] text-[var(--text-muted)]">
              {band.label}
            </span>
            <div className="relative h-24 w-6 rounded-full bg-[var(--bg-elevated)]">
              <input
                type="range"
                min={-12}
                max={12}
                step={1}
                value={band.gain}
                onChange={(e) => setBandGain(i, Number(e.target.value))}
                className="absolute inset-0 h-24 w-6 cursor-pointer appearance-none bg-transparent [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:bg-[var(--primary)] [&::-webkit-slider-thumb]:shadow-md"
                style={{
                  writingMode: 'vertical-lr',
                  direction: 'rtl',
                }}
                disabled={!enabled}
              />
            </div>
            <span className="mt-1 text-[10px] text-[var(--text-muted)]">
              {band.gain > 0 ? '+' : ''}{band.gain}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
