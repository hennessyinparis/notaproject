import { useCallback, useEffect, useRef } from 'react';

interface Props {
  peaks: number[] | undefined;
  duration: number;
  position: number;
  onSeek: (sec: number) => void;
  height?: number;
}

function interpolatePeaks(peaks: number[], count: number): number[] {
  if (peaks.length === 0) return Array.from({ length: count }, () => 0.3);
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

export function Waveform({ peaks, duration, position, onSeek, height = 48 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const displayPositionRef = useRef(position);

  const draw = useCallback((animatedPosition: number) => {
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

    const rawData = peaks?.length ? peaks : Array.from({ length: 200 }, (_, i) => 
      0.15 + Math.abs(Math.sin(i * 0.1)) * 0.5 + Math.abs(Math.sin(i * 0.05)) * 0.35
    );

    const data = interpolatePeaks(rawData, barCount);
    const playedRatio = duration > 0 ? animatedPosition / duration : 0;

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
  }, [peaks, duration, height]);

  useEffect(() => {
    const targetPosition = position;
    const currentPosition = displayPositionRef.current;
    const diff = targetPosition - currentPosition;

    const animate = () => {
      const step = diff * 0.15;
      
      if (Math.abs(displayPositionRef.current - targetPosition) < 0.05) {
        displayPositionRef.current = targetPosition;
        draw(targetPosition);
        return;
      }

      displayPositionRef.current += step;
      draw(displayPositionRef.current);
      animRef.current = requestAnimationFrame(animate);
    };

    if (Math.abs(diff) > 0.01) {
      animRef.current = requestAnimationFrame(animate);
    } else {
      displayPositionRef.current = targetPosition;
      draw(targetPosition);
    }

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
      }
    };
  }, [position, draw]);

  useEffect(() => {
    draw(displayPositionRef.current);
    const handleResize = () => draw(displayPositionRef.current);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [draw]);

  const click = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container || duration <= 0) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    onSeek((x / rect.width) * duration);
  };

  return (
    <div
      ref={containerRef}
      onClick={click}
      className="w-full cursor-pointer rounded-lg"
      style={{ height }}
    >
      <canvas
        ref={canvasRef}
        aria-label="Волновая форма, клик для перемотки"
      />
    </div>
  );
}
