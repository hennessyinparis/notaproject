import { clsx } from 'clsx';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ExternalLink, Flag, Gift, Heart, MapPin, MoreHorizontal, Pencil, Play, Repeat2, Shield, Sparkles, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { api } from '../api/client';
import { Button } from '../components/common/Button';
import { PageShell } from '../components/layout/PageShell';
import { SectionHeader } from '../components/common/SectionHeader';
import { HorizontalTrackShelf, HorizontalTrackShelfSlot } from '../components/track/HorizontalTrackShelf';
import { TrackCard } from '../components/track/TrackCard';
import { TRACK_ROW_GRID_WITH_PLAY_COUNT, TrackRow } from '../components/track/TrackRow';
import { TrackRowStack } from '../components/track/TrackRowStack';
import { DonateModal } from '../components/artist/DonateModal';
import { ReportModal } from '../components/report/ReportModal';
import { useAuthStore } from '../store/authStore';
import { usePlayerStore } from '../store/playerStore';
import { hasPaidSubscription as checkPaidSub } from '../utils/subscription';
import type { AuthUser, Track } from '../types';

type UserArtistStats = {
  monthly_listeners: number;
  total_plays: number;
  total_likes_received: number;
  total_reposts_received: number;
  public_tracks_count: number;
  followers_count: number;
  following_count: number;
};
import { formatNumber } from '../utils/format';
import { stringToColor } from '../utils/color';
import { useResolvedTheme } from '../hooks/useResolvedTheme';
import { goToLogin } from '../utils/authNavigation';

function formatSubscriptionDate(dateStr: string | null) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Один активный план: приоритет артист Pro → Plus → Студент → Бесплатно */
function primarySubscriptionBadge(u: AuthUser, heroDark: boolean): { label: string; className: string } {
  if (u.artist_subscription_type === 'pro') {
    return {
      label: 'Артист Pro',
      className: heroDark
        ? 'bg-purple-500/25 text-purple-100 ring-1 ring-purple-400/40'
        : 'bg-purple-500/15 text-purple-900 ring-1 ring-purple-600/30',
    };
  }
  if (u.subscription_type === 'plus') {
    return {
      label: 'Нота Plus',
      className: heroDark
        ? 'bg-blue-500/25 text-blue-100 ring-1 ring-blue-400/40'
        : 'bg-blue-500/15 text-blue-900 ring-1 ring-blue-600/30',
    };
  }
  if (u.subscription_type === 'student') {
    return {
      label: 'Студент',
      className: heroDark
        ? 'bg-emerald-500/25 text-emerald-100 ring-1 ring-emerald-400/40'
        : 'bg-emerald-500/15 text-emerald-900 ring-1 ring-emerald-600/30',
    };
  }
  return {
    label: 'Нота Бесплатно',
    className: heroDark ? 'bg-white/10 text-white/80 ring-1 ring-white/20' : 'bg-[var(--bg-base)] text-[var(--text-secondary)] ring-1 ring-[var(--border)]',
  };
}

export function ArtistPage() {
  const { username } = useParams();
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const currentUser = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();
  const heroDark = useResolvedTheme() === 'dark';

  const [editOpen, setEditOpen] = useState(false);
  const [showAllTracks, setShowAllTracks] = useState(false);
  const [showAllLiked, setShowAllLiked] = useState(false);
  const [showAllReposted, setShowAllReposted] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const [moreMenuPos, setMoreMenuPos] = useState({ top: 0, left: 0, width: 200 });
  const [followersModalOpen, setFollowersModalOpen] = useState(false);
  const [followingModalOpen, setFollowingModalOpen] = useState(false);
  const [donateOpen, setDonateOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    display_name: '',
    bio: '',
    city: '',
    website: '',
  });
  const [reportOpen, setReportOpen] = useState(false);

  const userQ = useQuery({
    queryKey: ['user', username],
    queryFn: () => api.get<AuthUser>(`/api/users/${username}`).then((r) => r.data),
    enabled: !!username,
  });

  const tracksQ = useQuery({
    queryKey: ['user-tracks', username],
    queryFn: () => api.get<Track[]>(`/api/users/${username}/tracks`).then((r) => r.data),
    enabled: !!username,
  });

  const followersQ = useQuery({
    queryKey: ['user-followers-count', username],
    queryFn: () => api.get<{ count: number }>(`/api/users/${username}/followers/count`).then((r) => r.data),
    enabled: !!username,
  });

  const followingCountQ = useQuery({
    queryKey: ['user-following-count', username],
    queryFn: () => api.get<{ count: number }>(`/api/users/${username}/following/count`).then((r) => r.data),
    enabled: !!username,
  });

  const followersListQ = useQuery({
    queryKey: ['user-followers-list', username],
    queryFn: () => api.get<AuthUser[]>(`/api/users/${username}/followers`).then((r) => r.data),
    enabled: !!username && followersModalOpen,
  });

  const followingListQ = useQuery({
    queryKey: ['user-following-list', username],
    queryFn: () => api.get<AuthUser[]>(`/api/users/${username}/following`).then((r) => r.data),
    enabled: !!username && followingModalOpen,
  });

  const donateSummaryQ = useQuery({
    queryKey: ['donation-summary', username],
    queryFn: () =>
      api
        .get<{ accepts_donations: boolean }>(`/api/donations/artist/${username}/summary`)
        .then((r) => r.data),
    enabled: !!username,
  });

  const statsQ = useQuery({
    queryKey: ['user-artist-stats', username],
    queryFn: () => api.get<UserArtistStats>(`/api/users/${username}/stats`).then((r) => r.data),
    enabled: !!username,
  });

  const likedByUserQ = useQuery({
    queryKey: ['user-liked-tracks', username],
    queryFn: () => api.get<Track[]>(`/api/users/${username}/liked-tracks?limit=40`).then((r) => r.data),
    enabled: !!username,
  });

  const repostedByUserQ = useQuery({
    queryKey: ['user-reposted-tracks', username],
    queryFn: () => api.get<Track[]>(`/api/users/${username}/reposted-tracks?limit=40`).then((r) => r.data),
    enabled: !!username,
  });

  const meQuery = useQuery({
    queryKey: ['me', accessToken],
    queryFn: async () => {
      const { data } = await api.get<AuthUser>('/api/users/me');
      setUser(data);
      return data;
    },
    enabled: !!accessToken,
  });

  const effectiveUser = meQuery.data ?? currentUser;
  const isOwnProfile =
    !!username &&
    !!effectiveUser &&
    effectiveUser.username.toLowerCase() === username.toLowerCase();
  const meButtonsLoading = !!accessToken && meQuery.isLoading && !effectiveUser;

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.patch('/api/users/me', editForm);
      return res.data;
    },
    onSuccess: (data) => {
      setUser(data);
      queryClient.setQueryData(['user', username], data);
      setEditOpen(false);
      toast.success('Профиль сохранён');
    },
    onError: () => toast.error('Ошибка сохранения'),
  });

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/api/users/me/avatar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: (data) => {
      setUser(data);
      queryClient.setQueryData(['user', username], data);
      toast.success('Аватар обновлён');
    },
    onError: () => toast.error('Ошибка загрузки'),
  });

  const playTrack = usePlayerStore((s) => s.playTrack);

  useEffect(() => {
    if (!username) return;
    if (!effectiveUser || effectiveUser.username.toLowerCase() === username.toLowerCase()) {
      setIsFollowing(false);
      return;
    }
    api
      .get<{ is_following: boolean }>(`/api/users/${username}/is-following`)
      .then((r) => setIsFollowing(r.data.is_following))
      .catch(() => setIsFollowing(false));
  }, [effectiveUser, username]);

  const updateMoreMenuPos = () => {
    const r = moreBtnRef.current?.getBoundingClientRect();
    if (!r) return;
    const w = 200;
    const left = Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8);
    setMoreMenuPos({ top: r.bottom + 8, left, width: w });
  };

  useLayoutEffect(() => {
    if (moreOpen) updateMoreMenuPos();
  }, [moreOpen]);

  useEffect(() => {
    if (!moreOpen) return;
    const onScroll = () => updateMoreMenuPos();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (moreBtnRef.current?.contains(t)) return;
      const el = document.getElementById('artist-more-menu');
      if (el?.contains(t)) return;
      setMoreOpen(false);
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    document.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('mousedown', onDown);
    };
  }, [moreOpen]);

  const startEditing = () => {
    const u = userQ.data;
    if (u) {
      setEditForm({
        display_name: u.display_name || '',
        bio: u.bio || '',
        city: u.city || '',
        website: u.website || '',
      });
      setEditOpen(true);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      avatarMutation.mutate(file);
    }
  };

  if (userQ.isLoading) return <div className="p-8 text-[var(--text-secondary)]">Загрузка…</div>;
  if (userQ.isError)
    return (
      <div className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-8">
        <p className="text-[var(--error)]">Не удалось загрузить профиль.</p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Проверь, что backend запущен и пользователь существует.</p>
      </div>
    );
  const u = userQ.data;
  if (u?.is_admin && effectiveUser?.username.toLowerCase() === username?.toLowerCase()) {
    return (
      <PageShell title="Администратор" description="Профиль администратора">
        <div className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--primary-light)] text-[var(--primary)]">
            <Shield className="h-10 w-10" />
          </div>
          <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">Администратор</h1>
          <Link to="/admin/dashboard" className="mt-4 inline-block rounded-xl bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-white">
            Перейти в админ-панель
          </Link>
        </div>
      </PageShell>
    );
  }
  if (!u)
    return (
      <div className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-8">
        <p className="text-[var(--text-secondary)]">Пользователь не найден.</p>
      </div>
    );

  const base = import.meta.env.VITE_API_URL || '';
  const avatar = u.avatar_url ? `${base}${u.avatar_url}` : null;

  const handleFollow = async () => {
    if (!username) return;
    if (!accessToken) {
      goToLogin(navigate);
      return;
    }
    if (isFollowing) {
      await api.delete(`/api/users/${username}/follow`);
      setIsFollowing(false);
      toast.success('Вы отписались');
    } else {
      await api.post(`/api/users/${username}/follow`);
      setIsFollowing(true);
      toast.success('Вы подписались!');
    }
    queryClient.invalidateQueries({ queryKey: ['user', username] });
    void queryClient.invalidateQueries({ queryKey: ['user-followers-count', username] });
    void queryClient.invalidateQueries({ queryKey: ['user-following-count', username] });
    void queryClient.invalidateQueries({ queryKey: ['user-followers-list', username] });
    void queryClient.invalidateQueries({ queryKey: ['user-following-list', username] });
    if (effectiveUser && effectiveUser.username.toLowerCase() !== username?.toLowerCase()) {
      void queryClient.invalidateQueries({ queryKey: ['user-following-count', effectiveUser.username] });
      void queryClient.invalidateQueries({ queryKey: ['user-following-list', effectiveUser.username] });
    }
  };

  const stats = statsQ.data;
  const followersCount = statsQ.data?.followers_count ?? followersQ.data?.count ?? 0;
  const followingCount = statsQ.data?.following_count ?? followingCountQ.data?.count ?? 0;
  const planBadge = primarySubscriptionBadge(u, heroDark);
  const expiresLabel = formatSubscriptionDate(u.subscription_expires_at ?? null);
  const hasPaidSubscription = checkPaidSub(u);
  const showSubscriptionAside = hasPaidSubscription;

  const statBox = clsx(
    'flex min-h-[4.75rem] flex-col justify-center rounded-xl px-3 py-2.5 text-sm sm:px-4',
    heroDark
      ? 'bg-white/[0.08] ring-1 ring-white/15 backdrop-blur-sm'
      : 'border border-[var(--border)] bg-[var(--bg-elevated)]'
  );
  const statBtn = clsx(
    statBox,
    'text-left transition',
    heroDark ? 'hover:bg-white/[0.12]' : 'hover:bg-[var(--bg-base)]'
  );
  const statNumCls = clsx(
    'text-lg font-bold tabular-nums leading-none sm:text-xl',
    heroDark ? 'text-white' : 'text-[var(--text-primary)]'
  );
  const statLabCls = clsx(
    'mt-1.5 text-[10px] font-semibold uppercase tracking-wider',
    heroDark ? 'text-white/55' : 'text-[var(--text-muted)]'
  );

  const profileShelfCap = 6;
  const likedList = likedByUserQ.data ?? [];
  const repostedList = repostedByUserQ.data ?? [];
  const hasLikesShelf = likedList.length > 0;
  const hasRepostsShelf = repostedList.length > 0;

  const moreMenuPortal =
    moreOpen &&
    createPortal(
      <div
        id="artist-more-menu"
        className={clsx(
          'rounded-xl border py-1.5 shadow-2xl backdrop-blur-md',
          heroDark
            ? 'border-white/20 bg-black/90'
            : 'border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-card)]'
        )}
        style={{
          position: 'fixed',
          top: moreMenuPos.top,
          left: moreMenuPos.left,
          width: moreMenuPos.width,
          zIndex: 10050,
        }}
      >
        <button
          type="button"
          className={clsx(
            'block w-full px-3 py-2.5 text-left text-sm transition',
            heroDark ? 'text-white hover:bg-white/10' : 'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
          )}
          onClick={() => {
            void navigator.clipboard.writeText(window.location.href);
            toast.success('Ссылка скопирована');
            setMoreOpen(false);
          }}
        >
          Копировать ссылку
        </button>
        <button
          type="button"
          className={clsx(
            'block w-full px-3 py-2.5 text-left text-sm transition',
            heroDark ? 'text-white hover:bg-white/10' : 'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
          )}
          onClick={() => {
            navigate('/subscriptions');
            setMoreOpen(false);
          }}
        >
          Поддержать артиста
        </button>
        {!isOwnProfile && (
          <button
            type="button"
            className={clsx(
              'block w-full px-3 py-2.5 text-left text-sm transition',
              heroDark ? 'text-white hover:bg-white/10' : 'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
            )}
            onClick={() => {
              setMoreOpen(false);
              setReportOpen(true);
            }}
          >
            <span className="flex items-center gap-2">
              <Flag className="h-4 w-4 text-red-400" />
              Пожаловаться
            </span>
          </button>
        )}
      </div>,
      document.body
    );

  return (
    <div className="mx-auto max-w-5xl space-y-10 pb-8">
      {moreMenuPortal}
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} reportType="user" targetId={u.id} targetLabel={u.display_name || u.username} />
      <DonateModal
        open={donateOpen}
        onClose={() => setDonateOpen(false)}
        artistUsername={u.username}
        artistName={u.display_name || u.username}
      />
      {/* Шапка профиля: тёмная — блюр; светлая — карточка с переменными темы */}
      <div
        className={clsx(
          'relative overflow-hidden rounded-[20px]',
          !heroDark && 'border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-card)]'
        )}
      >
        {heroDark && (
          <div className="absolute inset-0 overflow-hidden rounded-[20px]">
            <div
              className="absolute inset-0 scale-110"
              style={{
                background: avatar ? undefined : stringToColor(u.display_name),
                backgroundImage: avatar ? `url(${avatar})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(44px) brightness(0.55)',
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/55 to-black/80" />
          </div>
        )}

        <div
          className={clsx(
            'relative z-[1] overflow-visible px-5 pb-10 pt-8 sm:px-8 sm:pb-12 sm:pt-10',
            heroDark ? 'text-white' : 'text-[var(--text-primary)]'
          )}
        >
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
            <div className="flex min-w-0 flex-1 flex-col gap-6 sm:gap-7">
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
                <div className="relative shrink-0">
                  <div
                    className={clsx(
                      'h-36 w-36 overflow-hidden rounded-full sm:h-[148px] sm:w-[148px]',
                      heroDark
                        ? 'shadow-[0_16px_48px_rgba(0,0,0,0.5)] ring-4 ring-white/10'
                        : 'shadow-lg ring-4 ring-black/[0.08]'
                    )}
                  >
                    {avatar ? (
                      <img src={avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full" style={{ background: stringToColor(u.display_name) }} />
                    )}
                  </div>
                </div>

                <div className="flex min-w-0 flex-1 flex-col items-center gap-4 text-center sm:items-start sm:text-left">
                  <div className="flex flex-col items-center gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
                    <h1 className="max-w-full font-display text-3xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl lg:text-[2.75rem]">
                      {u.display_name}
                    </h1>
                    {u.is_verified && (
                      <span
                        className={clsx(
                          'inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1',
                          heroDark
                            ? 'bg-emerald-400/20 text-emerald-100 ring-emerald-300/40'
                            : 'bg-emerald-500/15 text-emerald-800 ring-emerald-600/25'
                        )}
                      >
                        ✓ Верифицирован
                      </span>
                    )}
                  </div>

                  {(u.city || u.website) && (
                    <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                      {u.city && (
                        <span
                          className={clsx(
                            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 backdrop-blur-sm',
                            heroDark
                              ? 'bg-white/[0.12] text-white/95 ring-white/20'
                              : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] ring-[var(--border)]'
                          )}
                        >
                          <MapPin
                            className={clsx('h-3.5 w-3.5 shrink-0', heroDark ? 'text-white/55' : 'text-[var(--text-muted)]')}
                            aria-hidden
                          />
                          {u.city}
                        </span>
                      )}
                      {u.website && (
                        <a
                          href={u.website.startsWith('http') ? u.website : `https://${u.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={clsx(
                            'inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 backdrop-blur-sm transition',
                            heroDark
                              ? 'bg-white/[0.12] text-white/95 ring-white/20 hover:bg-white/[0.18]'
                              : 'bg-[var(--bg-elevated)] text-[var(--text-primary)] ring-[var(--border)] hover:bg-[var(--bg-base)]'
                          )}
                        >
                          <ExternalLink
                            className={clsx('h-3.5 w-3.5 shrink-0', heroDark ? 'text-white/55' : 'text-[var(--text-muted)]')}
                            aria-hidden
                          />
                          <span className="truncate">{u.website.replace(/^https?:\/\//, '')}</span>
                        </a>
                      )}
                    </div>
                  )}

                  {statsQ.isSuccess && stats != null && (
                    <p
                      className={clsx(
                        'text-center text-[15px] font-medium sm:text-left',
                        heroDark ? 'text-white/90' : 'text-[var(--text-primary)]'
                      )}
                    >
                      <span className="text-lg font-bold tabular-nums sm:text-xl">
                        {formatNumber(stats.monthly_listeners)}
                      </span>{' '}
                      <span className={clsx('font-normal', heroDark ? 'text-white/65' : 'text-[var(--text-muted)]')}>
                        слушателей за месяц
                      </span>
                    </p>
                  )}

                  {u.bio && (
                    <p
                      className={clsx(
                        'max-w-2xl text-[15px] leading-relaxed [text-wrap:pretty]',
                        heroDark ? 'text-white/80' : 'text-[var(--text-secondary)]'
                      )}
                    >
                      {u.bio}
                    </p>
                  )}

                  <div className="grid w-full max-w-xl grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                    <button type="button" className={statBtn} onClick={() => setFollowersModalOpen(true)}>
                      <span className={statNumCls}>{formatNumber(followersCount)}</span>
                      <span className={statLabCls}>подписчиков</span>
                    </button>
                    <button type="button" className={statBtn} onClick={() => setFollowingModalOpen(true)}>
                      <span className={statNumCls}>{formatNumber(followingCount)}</span>
                      <span className={statLabCls}>подписок</span>
                    </button>
                    <div className={clsx(statBox, 'col-span-2 sm:col-span-1')}>
                      <span className={statNumCls}>{formatNumber(stats?.public_tracks_count ?? tracksQ.data?.length ?? 0)}</span>
                      <span className={statLabCls}>релизов</span>
                    </div>
                  </div>

                  <div className="flex w-full flex-wrap items-center justify-center gap-2 pt-1 sm:justify-start sm:gap-3 [&>a]:flex [&>button]:flex">
                    <button
                      type="button"
                      disabled={!tracksQ.data?.length}
                      onClick={() => tracksQ.data?.[0] && playTrack(tracksQ.data[0], tracksQ.data)}
                      className={clsx(
                        'inline-flex h-11 min-h-11 min-w-[8rem] shrink-0 items-center justify-center gap-2 rounded-full px-6 text-sm font-bold leading-none transition disabled:cursor-not-allowed disabled:opacity-40 sm:text-[15px]',
                        heroDark
                          ? 'bg-white text-neutral-900 shadow-lg shadow-black/20 hover:bg-white/95'
                          : 'bg-[var(--primary)] text-white shadow-md hover:opacity-95'
                      )}
                    >
                      <Play className="h-4 w-4 shrink-0" />
                      Играть
                    </button>

                    {meButtonsLoading ? (
                      <span
                        className={clsx(
                          'inline-flex h-11 min-h-11 min-w-[200px] shrink-0 animate-pulse items-center self-center rounded-full',
                          heroDark ? 'bg-white/15' : 'bg-[var(--bg-elevated)]'
                        )}
                        aria-hidden
                      />
                    ) : isOwnProfile ? (
                      <button
                        type="button"
                        onClick={startEditing}
                        className={clsx(
                          'inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold transition sm:text-[15px]',
                          heroDark
                            ? 'border border-white/45 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20'
                            : 'border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--bg-base)]'
                        )}
                      >
                        <Pencil className="h-4 w-4 shrink-0" />
                        Редактировать профиль
                      </button>
                    ) : effectiveUser?.is_admin ? null : (
                      <>
                        <button
                          type="button"
                          onClick={handleFollow}
                          className={clsx(
                            'inline-flex h-11 min-h-11 shrink-0 items-center justify-center rounded-full border px-5 text-sm font-semibold leading-none transition sm:text-[15px]',
                            isFollowing
                              ? heroDark
                                ? 'border-white/35 bg-white/12 text-white hover:bg-white/15'
                                : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--bg-base)]'
                              : heroDark
                                ? 'border-white/55 bg-white/5 text-white hover:bg-white/12'
                                : 'border-[var(--primary)] bg-transparent text-[var(--primary)] hover:bg-[var(--primary)]/10'
                          )}
                        >
                          {isFollowing ? 'Вы подписаны' : 'Подписаться'}
                        </button>
                        <Link
                          to={`/messages/${u.username}`}
                          className={clsx(
                            'inline-flex h-11 min-h-11 shrink-0 items-center justify-center rounded-full border px-5 text-sm font-semibold leading-none transition sm:text-[15px]',
                            heroDark
                              ? 'border-white/35 bg-white/10 text-white hover:bg-white/18'
                              : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--bg-base)]'
                          )}
                        >
                          Сообщение
                        </Link>
                        {donateSummaryQ.data?.accepts_donations && (
                          <button
                            type="button"
                            onClick={() => setDonateOpen(true)}
                            className={clsx(
                              'inline-flex h-11 min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold leading-none transition sm:text-[15px]',
                              heroDark
                                ? 'border-amber-400/50 bg-amber-500/20 text-white hover:bg-amber-500/30'
                                : 'border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300'
                            )}
                          >
                            <Gift className="h-4 w-4 shrink-0" />
                            Донат
                          </button>
                        )}
                      </>
                    )}

                    <button
                      ref={moreBtnRef}
                      type="button"
                      onClick={() => {
                        if (!moreOpen) updateMoreMenuPos();
                        setMoreOpen((v) => !v);
                      }}
                      className={clsx(
                        'inline-flex h-11 min-h-11 w-11 shrink-0 items-center justify-center rounded-full border p-0 leading-none transition',
                        heroDark
                          ? 'border-white/20 bg-white/10 text-white hover:bg-white/20'
                          : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--bg-base)]'
                      )}
                      aria-label="Ещё"
                      aria-expanded={moreOpen}
                    >
                      <MoreHorizontal className="h-[18px] w-[18px]" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {showSubscriptionAside && (
              <aside className="w-full shrink-0 lg:mx-0 lg:w-[min(100%,280px)] lg:pt-1">
                <div
                  className={clsx(
                    'flex flex-col gap-4 rounded-2xl p-5 sm:p-6',
                    heroDark
                      ? 'border border-white/15 bg-gradient-to-br from-white/[0.12] to-white/[0.04] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] backdrop-blur-xl'
                      : 'border border-[var(--border)] bg-[var(--bg-elevated)] shadow-[var(--shadow-card)]'
                  )}
                >
                  <div
                    className={clsx(
                      'flex items-center gap-2.5 border-b pb-3',
                      heroDark ? 'border-white/10' : 'border-[var(--border)]'
                    )}
                  >
                    <Sparkles
                      className={clsx('h-4 w-4 shrink-0', heroDark ? 'text-white/45' : 'text-[var(--text-muted)]')}
                      aria-hidden
                    />
                    <span
                      className={clsx(
                        'text-[11px] font-bold uppercase tracking-[0.2em]',
                        heroDark ? 'text-white/50' : 'text-[var(--text-muted)]'
                      )}
                    >
                      Подписка
                    </span>
                  </div>
                  <div className="flex flex-col gap-3">
                    <span className={`inline-flex w-fit rounded-full px-3 py-1.5 text-xs font-semibold ${planBadge.className}`}>
                      {planBadge.label}
                    </span>
                    {isOwnProfile && expiresLabel && (
                      <p className={clsx('text-sm leading-snug', heroDark ? 'text-white/70' : 'text-[var(--text-secondary)]')}>
                        Активна до{' '}
                        <span className={clsx('font-medium', heroDark ? 'text-white/90' : 'text-[var(--text-primary)]')}>
                          {expiresLabel}
                        </span>
                      </p>
                    )}
                    {isOwnProfile && (
                      <Link
                        to="/subscriptions"
                        className={clsx(
                          'inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition sm:w-auto sm:justify-start',
                          heroDark
                            ? 'bg-white/[0.12] text-white ring-1 ring-white/20 hover:bg-white/[0.18]'
                            : 'bg-[var(--primary)] text-white hover:opacity-95'
                        )}
                      >
                        Управлять подпиской
                      </Link>
                    )}
                  </div>
                </div>
              </aside>
            )}
          </div>
        </div>
      </div>

      {tracksQ.data && tracksQ.data.length > 0 ? (
        <>
          <section>
            <SectionHeader title="Популярные треки" />
            <div
              className="mb-2 hidden items-end gap-x-2 border-b border-[var(--border)] pb-2 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] sm:grid sm:text-[11px]"
              style={{ gridTemplateColumns: TRACK_ROW_GRID_WITH_PLAY_COUNT }}
              aria-hidden
            >
              <span />
              <span />
              <span className="min-w-0 pb-0.5 text-left leading-tight">Трек</span>
              <span className="min-w-0 pb-0.5 text-center leading-tight" title="Действия">
                {' '}
              </span>
              <span className="min-w-0 whitespace-nowrap pb-0.5 text-right leading-tight" title="Прослушивания">
                Прослушивания
              </span>
              <span className="min-w-0 whitespace-nowrap pb-0.5 text-right leading-tight" title="Длительность">
                Время
              </span>
              <span />
            </div>
            <TrackRowStack>
              {tracksQ.data.slice(0, showAllTracks ? undefined : 5).map((track, i) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={i}
                  queue={tracksQ.data ?? []}
                  showPlayCount
                />
              ))}
            </TrackRowStack>
            {tracksQ.data.length > 5 && (
              <button
                type="button"
                onClick={() => setShowAllTracks(!showAllTracks)}
                className="mt-3 text-sm font-medium text-[var(--primary)] hover:underline"
              >
                {showAllTracks ? 'Скрыть' : `Показать все ${tracksQ.data.length}`}
              </button>
            )}
          </section>

          {tracksQ.data[0] && (
            <section>
              <SectionHeader title="Последний релиз" />
              <div className="flex flex-col gap-5 rounded-[var(--radius-card)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-card)] sm:flex-row sm:items-center">
                <Link
                  to={`/track/${tracksQ.data[0].id}`}
                  className="h-28 w-28 shrink-0 overflow-hidden rounded-lg shadow-[var(--shadow-card)] sm:h-[120px] sm:w-[120px]"
                >
                  {tracksQ.data[0].cover_url ? (
                    <img src={`${base}${tracksQ.data[0].cover_url}`} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full" style={{ background: stringToColor(tracksQ.data[0].title) }} />
                  )}
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Сингл</p>
                  <Link
                    to={`/track/${tracksQ.data[0].id}`}
                    className="mt-1 block font-display text-xl font-bold text-[var(--text-primary)] hover:text-[var(--primary)]"
                  >
                    {tracksQ.data[0].title}
                  </Link>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {tracksQ.data[0].created_at ? new Date(tracksQ.data[0].created_at).getFullYear() : '—'} ·{' '}
                    <Link to={`/artist/${u.username}`} className="hover:text-[var(--primary)] hover:underline">
                      {u.display_name}
                    </Link>
                  </p>
                  <button
                    type="button"
                    onClick={() => playTrack(tracksQ.data[0], tracksQ.data)}
                    className="mt-4 rounded-full bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-95"
                  >
                    Слушать
                  </button>
                </div>
              </div>
            </section>
          )}

          <section>
            <SectionHeader title="Все треки" />
            <HorizontalTrackShelf aria-label="Все треки артиста">
              {tracksQ.data.map((t) => (
                <HorizontalTrackShelfSlot key={t.id}>
                  <TrackCard track={t} queue={tracksQ.data} />
                </HorizontalTrackShelfSlot>
              ))}
            </HorizontalTrackShelf>
          </section>

        </>
      ) : (
        <section className="rounded-card border border-dashed border-[var(--border)] bg-[var(--bg-surface)] p-10 text-center">
          <p className="text-[var(--text-secondary)]">У этого артиста пока нет опубликованных треков.</p>
          {isOwnProfile && (
            <Link to="/upload" className="mt-4 inline-block font-semibold text-[var(--primary)] hover:underline">
              Загрузить трек
            </Link>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)] ring-1 ring-black/[0.03] dark:ring-white/[0.05] sm:p-6">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-0 lg:divide-x lg:divide-[var(--border)]">
          <div className="min-w-0 lg:pr-6">
            <SectionHeader
              size="compact"
              title="Нравится"
              subtitle={`Треки, которые нравятся ${u.display_name}`}
              icon={<Heart className="h-4 w-4 text-[var(--primary)]" aria-hidden />}
              trailing={
                hasLikesShelf && likedList.length > profileShelfCap ? (
                  <button
                    type="button"
                    onClick={() => setShowAllLiked((v) => !v)}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--primary)] ring-1 ring-[var(--primary)]/30 transition hover:bg-[var(--primary)]/10"
                  >
                    {showAllLiked ? 'Свернуть' : `Все (${likedList.length})`}
                  </button>
                ) : undefined
              }
            />
            {likedByUserQ.isLoading ? (
              <div className="flex gap-3 overflow-hidden pt-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-[7.5rem] w-[5.5rem] shrink-0 animate-pulse rounded-xl bg-[var(--bg-elevated)]" />
                ))}
              </div>
            ) : hasLikesShelf ? (
              <HorizontalTrackShelf compact aria-label="Понравившиеся треки">
                {(showAllLiked ? likedList : likedList.slice(0, profileShelfCap)).map((t) => (
                  <HorizontalTrackShelfSlot key={t.id} compact>
                    <TrackCard size="compact" track={t} queue={likedList} />
                  </HorizontalTrackShelfSlot>
                ))}
              </HorizontalTrackShelf>
            ) : (
              <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-elevated)]/50 px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                Пока нет лайкнутых треков в профиле
              </p>
            )}
          </div>
          <div className="min-w-0 lg:pl-6">
            <SectionHeader
              size="compact"
              title="Репосты"
              subtitle={`То, чем ${u.display_name} делится в ленте`}
              icon={<Repeat2 className="h-4 w-4 text-[var(--primary)]" aria-hidden />}
              trailing={
                hasRepostsShelf && repostedList.length > profileShelfCap ? (
                  <button
                    type="button"
                    onClick={() => setShowAllReposted((v) => !v)}
                    className="rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--primary)] ring-1 ring-[var(--primary)]/30 transition hover:bg-[var(--primary)]/10"
                  >
                    {showAllReposted ? 'Свернуть' : `Все (${repostedList.length})`}
                  </button>
                ) : undefined
              }
            />
            {repostedByUserQ.isLoading ? (
              <div className="flex gap-3 overflow-hidden pt-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-[7.5rem] w-[5.5rem] shrink-0 animate-pulse rounded-xl bg-[var(--bg-elevated)]" />
                ))}
              </div>
            ) : hasRepostsShelf ? (
              <HorizontalTrackShelf compact aria-label="Репосты">
                {(showAllReposted ? repostedList : repostedList.slice(0, profileShelfCap)).map((t) => (
                  <HorizontalTrackShelfSlot key={t.id} compact>
                    <TrackCard size="compact" track={t} queue={repostedList} />
                  </HorizontalTrackShelfSlot>
                ))}
              </HorizontalTrackShelf>
            ) : (
              <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-elevated)]/50 px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                Пока нет репостов — поделитесь треком из ленты или со страницы трека
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-card)] ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
        <div className="relative bg-gradient-to-b from-[var(--bg-elevated)]/40 to-transparent px-5 py-8 sm:px-10 sm:py-10">
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start sm:gap-10">
            <div className="shrink-0">
              <div
                className="h-[168px] w-[168px] overflow-hidden rounded-[22%] shadow-[0_24px_60px_rgba(0,0,0,0.2)] ring-1 ring-black/[0.08] dark:shadow-[0_24px_60px_rgba(0,0,0,0.45)] dark:ring-white/[0.12] sm:h-[200px] sm:w-[200px]"
                aria-hidden
              >
                {avatar ? (
                  <img src={avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full" style={{ background: stringToColor(u.display_name) }} />
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">Об артисте</p>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
                {u.display_name}
              </h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">@{u.username}</p>

              {!u.bio &&
                (isOwnProfile ? (
                  <p className="mt-5 text-sm text-[var(--text-muted)]">
                    Добавьте описание в настройках профиля — оно отображается в шапке страницы.
                  </p>
                ) : (
                  <p className="mt-5 text-sm text-[var(--text-muted)]">Нет публичного описания.</p>
                ))}

              {(u.city || u.website) && (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  {u.city && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)]/80 px-3 py-1.5 text-sm text-[var(--text-primary)]">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden />
                      {u.city}
                    </span>
                  )}
                  {u.website && (
                    <a
                      href={u.website.startsWith('http') ? u.website : `https://${u.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)]/80 px-3 py-1.5 text-sm font-medium text-[var(--primary)] transition hover:bg-[var(--bg-base)]"
                    >
                      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{u.website.replace(/^https?:\/\//, '')}</span>
                    </a>
                  )}
                </div>
              )}

              {statsQ.isLoading ? (
                <div className="mt-8 h-14 w-full max-w-md animate-pulse rounded-xl bg-[var(--bg-elevated)] sm:mx-0 mx-auto" />
              ) : stats ? (
                <dl className="mt-8 flex flex-wrap justify-center gap-x-10 gap-y-5 border-t border-[var(--border)] pt-8 sm:justify-start">
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Слушателей за месяц
                    </dt>
                    <dd className="mt-1 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
                      {formatNumber(stats.monthly_listeners)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      Прослушиваний
                    </dt>
                    <dd className="mt-1 text-2xl font-bold tabular-nums text-[var(--text-primary)]">
                      {formatNumber(stats.total_plays)}
                    </dd>
                  </div>
                </dl>
              ) : null}

              <p className="mt-6 text-xs text-[var(--text-muted)]">
                На платформе с{' '}
                <span className="font-medium text-[var(--text-secondary)]">
                  {u.created_at ? new Date(u.created_at).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) : '—'}
                </span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {followersModalOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setFollowersModalOpen(false)}
        >
          <div
            className="flex max-h-[min(480px,80vh)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">Подписчики</h3>
              <button
                type="button"
                className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
                aria-label="Закрыть"
                onClick={() => setFollowersModalOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-2">
              {followersListQ.isLoading && <p className="p-4 text-sm text-[var(--text-muted)]">Загрузка…</p>}
              {!followersListQ.isLoading && (followersListQ.data?.length ?? 0) === 0 && (
                <p className="p-4 text-sm text-[var(--text-muted)]">Пока нет подписчиков.</p>
              )}
              {followersListQ.data?.map((person) => (
                <Link
                  key={person.id}
                  to={`/artist/${person.username}`}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-[var(--bg-elevated)]"
                  onClick={() => setFollowersModalOpen(false)}
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                    {person.avatar_url ? (
                      <img src={`${base}${person.avatar_url}`} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full" style={{ background: stringToColor(person.display_name) }} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[var(--text-primary)]">{person.display_name}</p>
                    <p className="truncate text-sm text-[var(--text-muted)]">@{person.username}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {followingModalOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setFollowingModalOpen(false)}
        >
          <div
            className="flex max-h-[min(480px,80vh)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <h3 className="font-display text-lg font-bold text-[var(--text-primary)]">Подписки</h3>
              <button
                type="button"
                className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
                aria-label="Закрыть"
                onClick={() => setFollowingModalOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-2">
              {followingListQ.isLoading && <p className="p-4 text-sm text-[var(--text-muted)]">Загрузка…</p>}
              {!followingListQ.isLoading && (followingListQ.data?.length ?? 0) === 0 && (
                <p className="p-4 text-sm text-[var(--text-muted)]">Пока ни на кого не подписан.</p>
              )}
              {followingListQ.data?.map((person) => (
                <Link
                  key={person.id}
                  to={`/artist/${person.username}`}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-[var(--bg-elevated)]"
                  onClick={() => setFollowingModalOpen(false)}
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[var(--bg-elevated)]">
                    {person.avatar_url ? (
                      <img src={`${base}${person.avatar_url}`} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full" style={{ background: stringToColor(person.display_name) }} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[var(--text-primary)]">{person.display_name}</p>
                    <p className="truncate text-sm text-[var(--text-muted)]">@{person.username}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {editOpen && isOwnProfile && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setEditOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl font-bold text-[var(--text-primary)]">Редактирование профиля</h2>

            <div className="mt-6 flex items-start gap-4">
              <label className="cursor-pointer shrink-0">
                <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                <div className="relative h-24 w-24 overflow-hidden rounded-full ring-2 ring-[var(--border)]">
                  {avatar ? (
                    <img src={avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="gradient-fallback flex h-full w-full items-center justify-center" />
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                    <span className="text-xs text-white">Фото</span>
                  </div>
                </div>
              </label>
              <div>
                <p className="font-semibold text-[var(--text-primary)]">@{u.username}</p>
                <p className="text-sm text-[var(--text-muted)]">Нажми на аватар, чтобы сменить</p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Отображаемое имя</label>
                <input
                  type="text"
                  value={editForm.display_name}
                  onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">О себе</label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  rows={4}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Город</label>
                <input
                  type="text"
                  value={editForm.city}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Веб-сайт</label>
                <input
                  type="url"
                  value={editForm.website}
                  onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-2.5 text-[var(--text-primary)] outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  placeholder="https://"
                />
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button onClick={() => updateMutation.mutate()} loading={updateMutation.isPending}>
                Сохранить
              </Button>
              <Button variant="secondary" onClick={() => setEditOpen(false)}>
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
