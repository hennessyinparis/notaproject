import { Howl, Howler } from 'howler';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface EqBand {
  freq: number;
  gain: number;
  label: string;
}

export const EQ_PRESETS: Record<string, number[]> = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  rock: [4, 3, -2, -1, 2, 4, 2, 1, 0, -1],
  pop: [1, 3, 5, 3, 1, 0, 0, 0, -1, -2],
  jazz: [3, 2, 1, 2, 3, 4, 3, 2, 1, 0],
  classical: [4, 3, 2, 1, 2, 3, 2, 1, 0, 0],
  electronic: [4, 5, 3, 0, -2, -4, -2, 0, 1, 2],
  bass_boost: [6, 4, 1, 0, 0, 0, 0, 0, 0, 0],
  treble_boost: [0, 0, 0, 1, 4, 6, 5, 4, 3, 2],
  vocal: [-2, -1, 3, 5, 3, -1, 0, 0, 0, 0],
};

export const EQ_BANDS: EqBand[] = [
  { freq: 60, gain: 0, label: '60' },
  { freq: 170, gain: 0, label: '170' },
  { freq: 310, gain: 0, label: '310' },
  { freq: 600, gain: 0, label: '600' },
  { freq: 1000, gain: 0, label: '1K' },
  { freq: 3000, gain: 0, label: '3K' },
  { freq: 6000, gain: 0, label: '6K' },
  { freq: 12000, gain: 0, label: '12K' },
  { freq: 14000, gain: 0, label: '14K' },
  { freq: 16000, gain: 0, label: '16K' },
];

interface EqState {
  enabled: boolean;
  bands: EqBand[];
  preset: string;
  filters: BiquadFilterNode[] | null;
  context: AudioContext | null;
  setEnabled: (v: boolean) => void;
  setBandGain: (index: number, gain: number) => void;
  setPreset: (name: string) => void;
  setupForHowl: (howl: Howl | null) => void;
  disconnect: () => void;
}

let eqFilters: BiquadFilterNode[] | null = null;
let eqContext: AudioContext | null = null;
let gainNode: GainNode | null = null;

function createEqFilters(context: AudioContext, bands: EqBand[]): BiquadFilterNode[] {
  return bands.map((band, i) => {
    const filter = context.createBiquadFilter();
    filter.type = i === 0 ? 'lowshelf' : i === bands.length - 1 ? 'highshelf' : 'peaking';
    filter.frequency.value = band.freq;
    filter.gain.value = band.gain;
    filter.Q.value = 1;
    return filter;
  });
}

export const useEqStore = create<EqState>()(
  persist(
    (set, get) => ({
      enabled: false,
      bands: EQ_BANDS.map(b => ({ ...b })),
      preset: 'flat',
      filters: null,
      context: null,

      setEnabled: (v) => {
        if (!v) {
          get().disconnect();
        }
        set({ enabled: v });
      },

      setBandGain: (index, gain) => {
        const bands = [...get().bands];
        bands[index] = { ...bands[index], gain };
        if (eqFilters && eqFilters[index]) {
          eqFilters[index].gain.value = gain;
        }
        set({ bands, preset: 'custom' });
      },

      setPreset: (name) => {
        const presetGains = EQ_PRESETS[name];
        if (!presetGains) return;
        const bands = EQ_BANDS.map((b, i) => ({
          ...b,
          gain: presetGains[i] || 0,
        }));
        if (eqFilters) {
          eqFilters.forEach((f, i) => {
            f.gain.value = bands[i].gain;
          });
        }
        set({ bands, preset: name });
      },

      setupForHowl: (howl) => {
        const state = get();
        if (!state.enabled || !howl) return;

        try {
          const ctx = Howler.ctx;
          if (!ctx) return;

          // Disconnect and clean up old filter chain before creating new one
          if (eqFilters) {
            for (const f of eqFilters) {
              try { f.disconnect(); } catch { /* already disconnected */ }
            }
          }

          const filters = createEqFilters(ctx, state.bands);

          for (let i = 0; i < filters.length - 1; i++) {
            filters[i].connect(filters[i + 1]);
          }
          filters[filters.length - 1].connect(ctx.destination);

          gainNode = Howler.masterGain;
          gainNode.disconnect();
          gainNode.connect(filters[0]);

          eqFilters = filters;
          eqContext = ctx;
          set({ filters: eqFilters, context: ctx });
        } catch (e) {
          console.error('EQ setup error:', e);
          try {
            gainNode = Howler.masterGain;
            gainNode.disconnect();
            gainNode.connect(Howler.ctx.destination);
          } catch { /* silent */ }
          eqFilters = null;
          eqContext = null;
          set({ enabled: false, filters: null, context: null });
        }
      },

      disconnect: () => {
        try {
          if (gainNode && eqFilters) {
            gainNode.disconnect();
            gainNode.connect(eqContext?.destination || Howler.ctx.destination);
          }
          eqFilters = null;
          gainNode = null;
          set({ filters: null, context: null });
        } catch (e) {
          console.error('EQ disconnect error:', e);
        }
      },
    }),
    {
      name: 'nota-eq',
      partialize: (state) => ({
        enabled: state.enabled,
        bands: state.bands,
        preset: state.preset,
      }),
    }
  )
);
