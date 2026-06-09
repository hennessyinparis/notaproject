import { api } from '../api/client';
import { isPremiumListener } from './subscription';
import type { AuthUser } from '../types';
import type { Track } from '../types';

export function canDownloadTrack(user: AuthUser | null | undefined, track: Track): boolean {
  return isPremiumListener(user) && !!track.is_downloadable && !!track.is_public;
}

export async function downloadTrackFile(trackId: number, title: string): Promise<void> {
  const res = await api.get(`/api/tracks/${trackId}/download`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^\w\s-]/g, '_')}.mp3`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
