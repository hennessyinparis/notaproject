import { api } from '../api/client';
import type { AudioAd } from '../types/ad';
import { isFreeListener } from './subscription';
import { useAuthStore } from '../store/authStore';

let cachedAds: AudioAd[] | null = null;

export function resetAdCache() {
  cachedAds = null;
}

export function nextAdThreshold(): number {
  return 4 + Math.floor(Math.random() * 2);
}

export async function fetchPlayableAds(): Promise<AudioAd[]> {
  if (cachedAds && cachedAds.length > 0) return cachedAds;
  try {
    const { data } = await api.get<AudioAd[]>('/api/ads/');
    cachedAds = data;
    return data;
  } catch {
    return [];
  }
}

export function pickRandomAd(ads: AudioAd[]): AudioAd | null {
  if (!ads.length) return null;
  return ads[Math.floor(Math.random() * ads.length)];
}

export function shouldShowAudioAds(): boolean {
  return isFreeListener(useAuthStore.getState().user);
}

export function adStreamUrl(adId: number): string {
  const base = import.meta.env.VITE_API_URL || '';
  return `${base}/api/ads/${adId}/stream`;
}
