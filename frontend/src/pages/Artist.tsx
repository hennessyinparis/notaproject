import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MapPin, MoreHorizontal, Pencil, Play } from 'lucide-react';
import toast from 'react-hot-toast';

import { api } from '../api/client';
import { Button } from '../components/common/Button';
import { SectionHeader } from '../components/common/SectionHeader';
import { TrackCard } from '../components/track/TrackCard';
import { TrackRow } from '../components/track/TrackRow';
import { useAuthStore } from '../store/authStore';
import { usePlayerStore } from '../store/playerStore';
import type { AuthUser, Track } from '../types';
import { formatNumber } from '../utils/format';
import { goToLogin } from '../utils/authNavigation';

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `linear-gradient(135deg, hsl(${hue}, 70%, 50%), hsl(${(hue + 40) % 360}, 80%, 30%))`;
}

function formatSubscriptionDate(dateStr: string | null) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Один активный план: приоритет артист Pro → Plus → Студент → Бесплатно */
function primarySubscriptionBadge(u: AuthUser): { label: string; className: string } {
  if (u.artist_subscription_type === 'pro') {
    return { label: 'Артист Pro', className: 'bg-purple-500/25 text-purple-100 ring-1 ring-purple-400/40' };
  }
  if (u.subscription_type === 'plus') {
    return { label: 'Нота Plus', className: 'bg-blue-500/25 text-blue-100 ring-1 ring-blue-400/40' };
  }
  if (u.subscription_type === 'student') {
    return { label: 'Студент', className: 'bg-emerald-500/25 text-emerald-100 ring-1 ring-emerald-400/40' };
  }
  return { label: 'Нота Бесплатно', className: 'bg-white/10 text-white/80 ring-1 ring-white/20' };
}

export function ArtistPage() {
  const { username } = useParams();
  const navigate = useNavigate();
  const accessToken = useAuthStore((s) => s.accessToken);
  const currentUser = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [showAllTracks, setShowAllTracks] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    display_name: '',
    bio: '',
    city: '',
    website: '',
  });

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
  };

  const totalPlays = tracksQ.data?.reduce((sum, t) => sum + (t.plays_count || 0), 0) || 0;
  const monthlyListeners = Math.floor(totalPlays / 30);
  const followersCount = followersQ.data?.count ?? 0;
  const planBadge = primarySubscriptionBadge(u);
  const expiresLabel = formatSubscriptionDate(u.subscription_expires_at);

  return (
    <div className="mx-auto max-w-5xl space-y-10 pb-8">
      {/* Шапка профиля: фон + вся информация об артисте */}
      <div className="relative overflow-hidden rounded-[20px]">
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

        <div className="relative px-5 pb-10 pt-8 text-white sm:px-8 sm:pb-12 sm:pt-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:gap-10">
            <div className="mx-auto shrink-0 lg:mx-0">
              <div
                className="h-36 w-36 overflow-hidden rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.45)] ring-2 ring-white/20 sm:h-[140px] sm:w-[140px]"
              >
                {avatar ? (
                  <img src={avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full" style={{ background: stringToColor(u.display_name) }} />
                )}
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                {u.is_verified && (
                  <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white/90 ring-1 ring-white/25">
                    Верифицирован
                  </span>
                )}
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${planBadge.className}`}>
                  {planBadge.label}
                </span>
                {isOwnProfile && expiresLabel && (
                  <span className="text-xs text-white/55">до {expiresLabel}</span>
                )}
                </div>
                <Link to="/subscriptions" className="text-xs text-white/80 hover:underline">Подписка</Link>
              </div>

              <div>
                <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-[2.75rem]">
                  {u.display_name}
                </h1>
                <p className="mt-1 text-[15px] text-white/70">@{u.username}</p>
              </div>

              {(u.bio || u.city || u.website) && (
                <div className="max-w-2xl space-y-3 text-[15px] leading-relaxed text-white/85">
                  {u.bio && <p className="whitespace-pre-wrap">{u.bio}</p>}
                  <div className="flex flex-col gap-2 text-sm text-white/70 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
                    {u.city && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 shrink-0 text-white/50" />
                        {u.city}
                      </span>
                    )}
                    {u.website && (
                      <a
                        href={u.website.startsWith('http') ? u.website : `https://${u.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[var(--primary)] underline-offset-2 hover:underline"
                      >
                        {u.website.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-white/70">
                <span>{formatNumber(followersCount)} подписчиков</span>
                <span>{formatNumber(tracksQ.data?.length ?? 0)} треков</span>
                {monthlyListeners > 0 && <span>{formatNumber(monthlyListeners)} слушателей в месяц</span>}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={!tracksQ.data?.length}
                  onClick={() => tracksQ.data?.[0] && playTrack(tracksQ.data[0], tracksQ.data)}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-[15px] font-bold text-black shadow-lg transition hover:bg-white/95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Play className="h-4 w-4" /> Играть
                </button>

                {meButtonsLoading ? (
                  <span className="inline-flex h-10 min-w-[200px] animate-pulse rounded-full bg-white/15" aria-hidden />
                ) : isOwnProfile ? (
                  <button
                    type="button"
                    onClick={startEditing}
                    className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/10 px-5 py-2.5 text-[15px] font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                  >
                    <Pencil className="h-4 w-4" />
                    Редактировать профиль
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleFollow}
                      className={`rounded-full border px-5 py-2.5 text-[15px] font-semibold transition ${
                        isFollowing
                          ? 'border-white/40 bg-white/15 text-white'
                          : 'border-white/60 bg-transparent text-white hover:bg-white/10'
                      }`}
                    >
                      {isFollowing ? 'Вы подписаны' : 'Подписаться'}
                    </button>
                    <Link to={`/messages/${u.username}`} className="rounded-full border border-white/40 bg-white/10 px-5 py-2.5 text-[15px] font-semibold text-white transition hover:bg-white/20">
                      Сообщение
                    </Link>
                  </>
                )}

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMoreOpen((v) => !v)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                    aria-label="Ещё"
                  >
                    <MoreHorizontal className="h-[18px] w-[18px]" />
                  </button>
                  {moreOpen && (
                    <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-48 rounded-xl border border-white/20 bg-black/70 p-2 backdrop-blur">
                      <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-white/10" onClick={() => {navigator.clipboard.writeText(window.location.href); toast.success('Ссылка скопирована'); setMoreOpen(false);}}>
                        Копировать ссылку
                      </button>
                      <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-white/10" onClick={() => {navigate('/subscriptions');}}>
                        Поддержать артиста
                      </button>
                      {!isOwnProfile && (
                        <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white hover:bg-white/10" onClick={() => {toast.success('Жалоба отправлена'); setMoreOpen(false);}}>
                          Пожаловаться
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {tracksQ.data && tracksQ.data.length > 0 ? (
        <>
          <section>
            <SectionHeader title="Популярные треки" />
            <div className="overflow-hidden rounded-[var(--radius-card)] bg-[var(--bg-surface)] shadow-[var(--shadow-card)]">
              {tracksQ.data.slice(0, showAllTracks ? undefined : 5).map((track, i) => (
                <TrackRow key={track.id} track={track} index={i} queue={tracksQ.data ?? []} />
              ))}
            </div>
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
                <div className="h-28 w-28 shrink-0 overflow-hidden rounded-lg shadow-[var(--shadow-card)] sm:h-[120px] sm:w-[120px]">
                  {tracksQ.data[0].cover_url ? (
                    <img src={`${base}${tracksQ.data[0].cover_url}`} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full" style={{ background: stringToColor(tracksQ.data[0].title) }} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Сингл</p>
                  <p className="mt-1 font-display text-xl font-bold text-[var(--text-primary)]">{tracksQ.data[0].title}</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {new Date(tracksQ.data[0].created_at).getFullYear()} · {u.display_name}
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
            <div className="hide-scrollbar flex gap-4 overflow-x-auto pb-2">
              {tracksQ.data.map((t) => (
                <div key={t.id} className="w-40 shrink-0">
                  <TrackCard track={t} queue={tracksQ.data} />
                </div>
              ))}
            </div>
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
