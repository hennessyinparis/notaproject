import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Flag, Gift, Heart, ListPlus, Share2, Repeat, Play, Eye, Music, Tag, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import { api } from '../api/client';
import { Button } from '../components/common/Button';
import { AddToPlaylistModal } from '../components/track/AddToPlaylistModal';
import { ReportModal } from '../components/report/ReportModal';
import { Comments } from '../components/track/Comments';
import { DonateModal } from '../components/artist/DonateModal';
import { Waveform } from '../components/player/Waveform';
import { SectionHeader } from '../components/common/SectionHeader';
import { TrackCard } from '../components/track/TrackCard';
import { useAuthStore } from '../store/authStore';
import { goToLogin } from '../utils/authNavigation';
import { usePlayerStore } from '../store/playerStore';
import type { Track } from '../types';
import { formatDuration, formatNumber } from '../utils/format';
import { normalizeWaveformPeaks } from '../utils/waveform';
import { stringToColor } from '../utils/color';
import { TrackPremiumActions } from '../components/track/TrackPremiumActions';

export function TrackPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const playTrack = usePlayerStore((s) => s.playTrack);
  const seek = usePlayerStore((s) => s.seek);
  const playerPosition = usePlayerStore((s) => s.position);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const repeatMode = usePlayerStore((s) => s.repeat);
  const setRepeat = usePlayerStore((s) => s.setRepeat);
  const accessToken = useAuthStore((s) => s.accessToken);
  const currentUser = useAuthStore((s) => s.user);

  const requireAuth = (action: () => void) => {
    if (!accessToken) {
      goToLogin(navigate);
      return;
    }
    action();
  };
  const [isLiked, setIsLiked] = useState(false);
  const [isReposted, setIsReposted] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [donateOpen, setDonateOpen] = useState(false);
  const [searchUser, setSearchUser] = useState('');

  const isCurrentTrack = currentTrack?.id === Number(id);
  const isRepeatOneActive = isCurrentTrack && repeatMode === 'one';

  const { data: track, isLoading } = useQuery({
    queryKey: ['track', id],
    queryFn: () => api.get<Track>(`/api/tracks/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const relatedQ = useQuery({
    queryKey: ['track-related', id],
    queryFn: () => api.get<Track[]>(`/api/tracks/${id}/related?limit=8`).then((r) => r.data),
    enabled: !!id,
  });

  const likeMutation = useMutation({
    mutationFn: async () => {
      const method = isLiked ? 'delete' : 'post';
      const res = await api[method](`/api/tracks/${id}/like`);
      return res.data;
    },
    onSuccess: (data) => {
      setIsLiked(data.liked);
      queryClient.setQueryData(['track', id], (old: Track | undefined) =>
        old ? { ...old, likes_count: data.likes_count } : old
      );
      toast.success(isLiked ? 'Лайк убран' : 'Лайк добавлен');
    },
    onError: () => toast.error('Ошибка'),
  });

  const repostMutation = useMutation({
    mutationFn: async () => {
      const method = isReposted ? 'delete' : 'post';
      const res = await api[method](`/api/tracks/${id}/repost`);
      return res.data;
    },
    onSuccess: (data) => {
      setIsReposted(data.reposted);
      queryClient.setQueryData(['track', id], (old: Track | undefined) =>
        old ? { ...old, reposts_count: data.reposts_count } : old
      );
      toast.success(isReposted ? 'Репост убран' : 'Трек репостнут');
    },
    onError: () => toast.error('Ошибка'),
  });

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success('Ссылка скопирована!');
  };

  const usersQ = useQuery({
    queryKey: ['share-users', searchUser],
    queryFn: () => api.get<{ users: Array<{ username: string; display_name: string; avatar_url: string | null }> }>(`/api/search?q=${encodeURIComponent(searchUser)}`).then((r) => r.data.users ?? []),
    enabled: showShareModal && searchUser.trim().length > 1,
  });

  const shareTrackTo = async (usernameTo: string) => {
    if (!track) return;
    await api.post(`/api/messages/${usernameTo}`, { text: '', track_id: track.id });
    toast.success('Трек отправлен');
    setShowShareModal(false);
  };

  const donateSummaryQ = useQuery({
    queryKey: ['donation-summary', track?.user?.username],
    queryFn: () =>
      api
        .get<{ accepts_donations: boolean }>(`/api/donations/artist/${track!.user!.username}/summary`)
        .then((r) => r.data),
    enabled: !!track?.user?.username && currentUser?.id !== track?.user?.id,
  });

  if (isLoading || !track) {
    return <div className="p-8">Загрузка…</div>;
  }

  const serverLiked = track.is_liked ?? false;
  const serverReposted = track.is_reposted ?? false;
  if (isLiked !== serverLiked) setIsLiked(serverLiked);
  if (isReposted !== serverReposted) setIsReposted(serverReposted);

  const base = import.meta.env.VITE_API_URL || '';
  const cover = track.cover_url ? `${base}${track.cover_url}` : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="relative aspect-square w-full max-w-md overflow-hidden rounded-2xl shadow-lg ring-1 ring-black/5 dark:ring-white/10">
          {cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <div
              className="h-full w-full"
              style={{ background: stringToColor(track.title) }}
            />
          )}
        </div>
        <div className="flex-1">
          <h1 className="font-display text-4xl font-bold tracking-tight text-[var(--text-primary)] md:text-5xl">{track.title}</h1>
          {track.user?.username ? (
            <Link
              to={`/artist/${track.user.username}`}
              className="mt-3 inline-block text-sm font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--primary)]"
            >
              {track.user.display_name}
            </Link>
          ) : (
            <span className="mt-3 inline-block text-sm font-medium text-[var(--text-muted)]">{track.user?.display_name}</span>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            <Button onClick={() => {
              try {
                if (isCurrentTrack) {
                  const s = usePlayerStore.getState();
                  s.toggle();
                } else {
                  playTrack(track);
                }
              } catch (e) {
                console.error('[TrackPage] playTrack error:', e);
              }
            }}>
              <Play className="mr-2 h-4 w-4" /> Играть
            </Button>
            <Button
              variant={isLiked ? 'primary' : 'secondary'}
              onClick={() => requireAuth(() => likeMutation.mutate())}
            >
              <Heart className={`mr-2 h-4 w-4 ${isLiked ? 'fill-current' : ''}`} /> {track.likes_count}
            </Button>
            <Button
              variant={isRepeatOneActive ? 'primary' : 'secondary'}
              onClick={() => {
                if (!isCurrentTrack) {
                  playTrack(track);
                  setRepeat('one');
                  return;
                }
                setRepeat(repeatMode === 'one' ? 'off' : 'one');
              }}
            >
              <Repeat className="mr-2 h-4 w-4" /> Повтор трека
            </Button>
            <Button
              variant={isReposted ? 'primary' : 'secondary'}
              onClick={() => requireAuth(() => repostMutation.mutate())}
            >
              Репост · {formatNumber(track.reposts_count || 0)}
            </Button>
            <Button variant="ghost" onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" /> Поделиться
            </Button>
            <Button variant="ghost" onClick={() => requireAuth(() => setShowShareModal(true))}>
              <MessageCircle className="mr-2 h-4 w-4" /> Отправить
            </Button>
            {donateSummaryQ.data?.accepts_donations && (
              <Button variant="ghost" onClick={() => setDonateOpen(true)}>
                <Gift className="mr-2 h-4 w-4" /> Донат
              </Button>
            )}
            {accessToken && !currentUser?.is_admin && (
              <Button variant="ghost" onClick={() => setReportOpen(true)}>
                <Flag className="mr-2 h-4 w-4" /> Пожаловаться
              </Button>
            )}
            <Button variant="secondary" onClick={() => requireAuth(() => setShowPlaylistModal(true))}>
              + В плейлист
            </Button>
            <Button variant="secondary" onClick={() => usePlayerStore.getState().addToQueue(track)}>
              <ListPlus className="mr-2 h-4 w-4" /> В очередь
            </Button>
          </div>
          <TrackPremiumActions track={track} className="mt-4" />
          <p className="mt-6 text-[var(--text-secondary)]">{track.description}</p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-[var(--text-muted)]">
            <span><Eye className="mr-1 inline h-4 w-4" /> {formatNumber(track.plays_count ?? 0)} прослушиваний</span>
            {track.genre && <span><Music className="mr-1 inline h-4 w-4" /> {track.genre}</span>}
          </div>
          {track.tags && track.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {track.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[var(--bg-elevated)] px-3 py-1 text-xs"
                >
                  <Tag className="mr-1 inline h-3 w-3" />#{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      <Waveform
        peaks={normalizeWaveformPeaks(track.waveform_data?.peaks)}
        duration={track.duration_seconds}
        position={isCurrentTrack ? playerPosition : 0}
        onSeek={isCurrentTrack ? seek : () => playTrack(track)}
      />
      <p className="text-xs text-[var(--text-muted)]">
        Длительность: {formatDuration(track.duration_seconds)}
        {track.bpm ? ` · BPM ${track.bpm}` : ''}
        {track.key_signature ? ` · ${track.key_signature}` : ''}
      </p>

      {(relatedQ.data?.length ?? 0) > 0 && (
        <section className="mt-8">
          <SectionHeader title="Похожие треки" />
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
            {relatedQ.data!.map((t) => (
              <div key={t.id} className="w-40 shrink-0 sm:w-44">
                <TrackCard track={t} queue={relatedQ.data} size="compact" />
              </div>
            ))}
          </div>
        </section>
      )}

      {track.allow_comments && (
        <div className="mt-8">
          <h3 className="mb-4 flex items-center gap-2 font-semibold">
            <MessageCircle className="h-5 w-5" />
            Комментарии ({track.comments_count})
          </h3>
          <Comments trackId={track.id} />
        </div>
      )}
      {showShareModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
          <div style={{ width: 420, maxWidth: '100%', background: 'var(--bg-surface)', borderRadius: 14, border: '1px solid var(--border)', padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Отправить трек</h3>
            <input
              placeholder="Найти пользователя..."
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              style={{ width: '100%', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
            />
            <div style={{ maxHeight: 260, overflowY: 'auto', marginTop: 12, display: 'grid', gap: 8 }}>
              {usersQ.data?.map((u) => (
                <button key={u.username} type="button" onClick={() => shareTrackTo(u.username)} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--border)', background: 'var(--bg-elevated)', borderRadius: 10, padding: 8, cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: 'var(--bg-surface)' }}>
                    {u.avatar_url && <img src={u.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>
                  {u.display_name}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setShowShareModal(false)} style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              Закрыть
            </button>
          </div>
        </div>
      )}
      <AddToPlaylistModal trackId={track.id} open={showPlaylistModal} onClose={() => setShowPlaylistModal(false)} />
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} reportType="track" targetId={track.id} targetLabel={track.title} />
      <DonateModal
        open={donateOpen}
        onClose={() => setDonateOpen(false)}
        artistUsername={track.user!.username}
        artistName={track.user!.display_name || track.user!.username}
      />
    </div>
  );
}
