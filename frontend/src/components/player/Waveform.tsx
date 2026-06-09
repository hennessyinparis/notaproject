import { useCallback, useEffect, useRef } from 'react';

import { normalizeWaveformPeaks } from '../../utils/waveform';

interface Props {
  peaks: number[] | undefined;
  duration: number;
  position: number;
  onSeek: (sec: number) => void;
  height?: number;
}

function interpolatePeaks(peaks: number[], count: number): number[] {
  if (!Array.isArray(peaks) || peaks.length === 0) return Array.from({ length: count }, () => 0.3);
  if (peaks.length >= count) return peaks.slice(0, count);
  
  const result: number[] = [];
  const ratio = peaks.length / count;
  
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(i * ratio);
    const next = Math.min(idx + 1, peaks.length - 1);
    const frac = (i * ratio) - idx;
    result.push(peaks[idx] * (1 - frac) + peaks[next] * frac);
  }
  return result;
}

export function Waveform({ peaks: peaksProp, duration, position, onSeek, height = 48 }: Props) {
  const peaks = normalizeWaveformPeaks(peaksProp);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const displayRef = useRef(position);
  const targetRef = useRef(position);
  const drawParams = useRef({ peaks, duration, height });
  drawParams.current = { peaks, duration, height };

  const draw = useCallback((pos: number) => {
    const c = canvasRef.current;
    const container = containerRef.current;
    if (!c || !container) return;
    
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0) return;
    
    const dpr = window.devicePixelRatio || 1;
    c.width = rect.width * dpr;
    c.height = height * dpr;
    c.style.width = `${rect.width}px`;
    c.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = height;
    ctx.clearRect(0, 0, w, h);

    const barCount = Math.min(Math.floor(w / 3), 300);
    const barWidth = w / barCount;
    const gap = 1;

    const { peaks: p, duration: dur } = drawParams.current;
    const rawData =
      Array.isArray(p) && p.length > 0
        ? p
        : Array.from({ length: 200 }, (_, i) => 
      0.15 + Math.abs(Math.sin(i * 0.1)) * 0.5 + Math.abs(Math.sin(i * 0.05)) * 0.35
    );

    const data = interpolatePeaks(rawData, barCount);
    const playedRatio = dur > 0 ? pos / dur : 0;

    const getStyle = (prop: string) => {
      return getComputedStyle(document.documentElement).getPropertyValue(prop).trim();
    };

    const primaryColor = getStyle('--primary') || '#e91e8c';
    const mutedColor = getStyle('--text-muted') || '#a0a0b0';

    data.forEach((peak, i) => {
      const barH = Math.max(2, peak * h * 0.9);
      const x = i * barWidth;
      const y = (h - barH) / 2;
      const isPlayed = i / barCount < playedRatio;

      ctx.fillStyle = isPlayed ? primaryColor : mutedColor;
      ctx.globalAlpha = isPlayed ? 1 : 0.25;

      const barX = x + gap / 2;
      const barW = Math.max(0.5, barWidth - gap);
      
      if (ctx.roundRect) {
        ctx.beginPath();
        ctx.roundRect(barX, y, barW, barH, 1);
        ctx.fill();
      } else {
        ctx.fillRect(barX, y, barW, barH);
      }
    });

    ctx.globalAlpha = 1;
  }, [height]);

  useEffect(() => {
    targetRef.current = position;
  }, [position]);

  useEffect(() => {
    displayRef.current = position;
    draw(position);

    const loop = () => {
      const cur = displayRef.current;
      const tgt = targetRef.current;
      const diff = tgt - cur;

      if (Math.abs(diff) < 0.05) {
        displayRef.current = tgt;
        draw(tgt);
      } else {
        displayRef.current += diff * 0.15;
        draw(displayRef.current);
      }

      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  useEffect(() => {
    const handleResize = () => draw(displayRef.current);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  const seekFromClientX = (clientX: number) => {
    const container = containerRef.current;
    if (!container || duration <= 0) return;
    const rect = container.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    onSeek((x / rect.width) * duration);
  };

  const click = (e: React.MouseEvent<HTMLDivElement>) => seekFromClientX(e.clientX);

  const touch = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.touches.length > 0) seekFromClientX(e.touches[0].clientX);
  };

  return (
    <div
      ref={containerRef}
      onClick={click}
      onTouchStart={touch}
      onTouchMove={touch}
      className="w-full cursor-pointer rounded-lg touch-none"
      style={{ height }}
    >
      <canvas
        ref={canvasRef}
        aria-label="Волновая форма, нажмите для перемотки"
      />
    </div>
  );
}
