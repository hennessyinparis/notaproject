import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, ChevronDown, Clock, ExternalLink, Eye, Flag, Loader2, MessageSquare, Music2, UserRound, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

import { api } from '../../api/client';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { admCard, admCardPad, admEmpty, admMain, admToolbar } from './adminStyles';

type TargetDetails = {
  title?: string;
  text?: string;
  username?: string;
  display_name?: string;
  avatar?: string | null;
  artist?: string;
  artist_display?: string;
  artist_avatar?: string | null;
  artist_url?: string;
  author?: string;
  author_display?: string;
  author_avatar?: string | null;
  author_url?: string;
  owner?: string;
  owner_display?: string;
  owner_avatar?: string | null;
  owner_url?: string;
  track_title?: string;
  url?: string;
  track_url?: string;
};

type AdminReportRow = {
  id: number;
  report_type: string;
  target_id: number;
  reason: string;
  description: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  reporter_id: number;
  reporter_username: string;
  reporter_display: string | null;
  reporter_avatar: string | null;
  target_details: TargetDetails | null;
  target_user_report_count: number;
  reporter_report_count: number;
};

const statusIcons: Record<string, typeof Clock> = {
  pending: Clock,
  reviewed: Eye,
  dismissed: XCircle,
  resolved: CheckCircle,
};

const statusColors: Record<string, string> = {
  pending: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-500/10',
  reviewed: 'text-blue-600 bg-blue-100 dark:bg-blue-500/10',
  dismissed: 'text-gray-500 bg-gray-100 dark:bg-gray-500/10',
  resolved: 'text-green-600 bg-green-100 dark:bg-green-500/10',
};

const statusLabels: Record<string, string> = {
  pending: 'Ожидает',
  reviewed: 'В работе',
  dismissed: 'Отклонена',
  resolved: 'Принята',
};

const typeLabels: Record<string, string> = {
  track: 'Трек',
  comment: 'Комментарий',
  user: 'Пользователь',
  playlist: 'Плейлист',
};

const reasonLabels: Record<string, string> = {
  copyright: 'Нарушение авторских прав',
  spam: 'Спам',
  abuse: 'Оскорбления',
  inappropriate: 'Неприемлемый контент',
  other: 'Другое',
};

const reasonColors: Record<string, string> = {
  copyright: 'bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400',
  spam: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400',
  abuse: 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  inappropriate: 'bg-pink-100 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400',
  other: 'bg-gray-100 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400',
};

const activeStatuses = ['pending', 'reviewed'];
const completedStatuses = ['resolved', 'dismissed'];

function avatarUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.startsWith('http')) return raw;
  const base = import.meta.env.VITE_API_URL || '';
  return `${base}${raw}`;
}

function Avatar({ url, name, size = 10 }: { url: string | null; name: string; size?: number }) {
  const s = size === 10 ? 'h-10 w-10' : 'h-9 w-9';
  const src = avatarUrl(url);
  if (src) {
    return (
      <div className={`${s} shrink-0 overflow-hidden rounded-full ring-1 ring-black/5 dark:ring-white/10`}>
        <img src={src} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div className={`${s} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--primary-light)] to-[var(--primary)]/20 text-sm font-bold text-[var(--primary)] ring-1 ring-black/5 dark:ring-white/10`}>
      {name[0]?.toUpperCase() || '?'}
    </div>
  );
}

function reportCountText(n: number): string {
  if (n === 1) return '1 жалоба';
  if (n >= 2 && n <= 4) return `${n} жалобы`;
  return `${n} жалоб`;
}

function TargetInfo({ report }: { report: AdminReportRow }) {
  const d = report.target_details;

  return (
    <div className="flex items-center gap-3 min-w-0 flex-1">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--primary-light)] to-[var(--primary)]/10 text-[var(--primary)] ring-1 ring-[var(--primary)]/20">
        {report.report_type === 'track' ? <Music2 className="h-5 w-5" /> :
         report.report_type === 'comment' ? <MessageSquare className="h-5 w-5" /> :
         report.report_type === 'user' ? <UserRound className="h-5 w-5" /> :
         <Flag className="h-5 w-5" />}
      </div>
      <div className="min-w-0 flex-1">
        {report.report_type === 'track' && d && (
          <div>
            <Link to={d.url || '#'} className="truncate text-sm font-semibold text-[var(--text-primary)] hover:underline">
              {d.title}
            </Link>
            {d.artist_display && <p className="text-xs text-[var(--text-muted)]">@{d.artist}</p>}
          </div>
        )}
        {report.report_type === 'comment' && d && (
          <div>
            <p className="truncate text-sm font-medium text-[var(--text-primary)]">«{d.text}»</p>
            <p className="text-xs text-[var(--text-muted)] truncate">
              {d.author_display || d.author} · {d.track_title && <Link to={d.track_url || '#'} className="hover:underline">{d.track_title}</Link>}
            </p>
          </div>
        )}
        {report.report_type === 'user' && d && (
          <div>
            <Link to={d.url || '#'} className="truncate text-sm font-semibold text-[var(--text-primary)] hover:underline">
              {d.display_name || d.username}
            </Link>
            <p className="text-xs text-[var(--text-muted)]">@{d.username}</p>
          </div>
        )}
        {report.report_type === 'playlist' && d && (
          <div>
            <Link to={d.url || '#'} className="truncate text-sm font-semibold text-[var(--text-primary)] hover:underline">
              {d.title}
            </Link>
            {d.owner && <p className="text-xs text-[var(--text-muted)]">@{d.owner}</p>}
          </div>
        )}
        {!d && (
          <p className="text-sm text-[var(--text-muted)]">Объект удалён (ID {report.target_id})</p>
        )}
      </div>
    </div>
  );
}

export function AdminReportsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'active' | 'completed'>('active');
  const [typeFilter, setTypeFilter] = useState('');
  const [selected, setSelected] = useState<AdminReportRow | null>(null);
  const [notesMap, setNotesMap] = useState<Record<number, string>>({});

  const listQ = useQuery({
    queryKey: ['admin-reports', typeFilter],
    queryFn: () =>
      api
        .get<AdminReportRow[]>('/api/admin/reports', {
          params: { report_type: typeFilter || undefined, limit: 200 },
        })
        .then((r) => r.data),
  });

  const updateM = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { status?: string; admin_notes?: string } }) =>
      api.patch(`/api/admin/reports/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-reports'] });
      toast.success('Статус обновлён');
    },
    onError: () => toast.error('Ошибка обновления'),
  });

  const allReports = listQ.data ?? [];
  const activeReports = useMemo(() => allReports.filter((r) => activeStatuses.includes(r.status)), [allReports]);
  const completedReports = useMemo(() => allReports.filter((r) => completedStatuses.includes(r.status)), [allReports]);
  const visibleReports = tab === 'active' ? activeReports : completedReports;

  const tabClass = (name: string) =>
    `rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
      tab === name
        ? 'bg-[var(--primary)]/14 text-[var(--primary)] ring-1 ring-[var(--primary)]/25'
        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
    }`;

  return (
    <div className={admMain}>
      <AdminPageHeader
        icon={Flag}
        title="Жалобы"
        description="Модерация контента: жалобы пользователей на треки, комментарии и профили"
      />

      <div className={`${admToolbar} flex-wrap`}>
        <div className="flex gap-2">
          <button type="button" className={tabClass('active')} onClick={() => setTab('active')}>
            Активные ({activeReports.length})
          </button>
          <button type="button" className={tabClass('completed')} onClick={() => setTab('completed')}>
            Завершённые ({completedReports.length})
          </button>
        </div>
        <div className="min-w-[160px]">
          <CustomSelect
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              { value: '', label: 'Все типы' },
              { value: 'track', label: 'Трек' },
              { value: 'comment', label: 'Комментарий' },
              { value: 'user', label: 'Пользователь' },
              { value: 'playlist', label: 'Плейлист' },
            ]}
          />
        </div>
      </div>

      <div className={admCard}>
        <div className={admCardPad}>
          {listQ.isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[var(--text-muted)]" /></div>
          ) : visibleReports.length === 0 ? (
            <div className={admEmpty}>Нет жалоб {tab === 'active' ? 'в обработке' : 'завершённых'}</div>
          ) : (
            <div className="space-y-2">
              {visibleReports.map((report) => {
                const StatusIcon = statusIcons[report.status] || Clock;
                const ReasonColor = reasonColors[report.reason] || '';
                const isOpen = selected?.id === report.id;
                const d = report.target_details;

                let targetName = 'Неизвестно';
                let targetAvatar: string | null = null;
                let targetUrl = '';
                if (report.report_type === 'track' && d) {
                  targetName = d.artist_display || d.artist || 'Неизвестно';
                  targetAvatar = d.artist_avatar ?? null;
                  targetUrl = d.artist_url || '';
                } else if (report.report_type === 'comment' && d) {
                  targetName = d.author_display || d.author || 'Неизвестно';
                  targetAvatar = d.author_avatar ?? null;
                  targetUrl = d.author_url || '';
                } else if (report.report_type === 'user' && d) {
                  targetName = d.display_name || d.username || 'Неизвестно';
                  targetAvatar = d.avatar ?? null;
                  targetUrl = d.url || '';
                } else if (report.report_type === 'playlist' && d) {
                  targetName = d.owner_display || d.owner || 'Неизвестно';
                  targetAvatar = d.owner_avatar ?? null;
                  targetUrl = d.owner_url || '';
                }

                return (
                  <div key={report.id} className={`
                    rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/40
                    transition-all duration-200
                    ${isOpen ? 'border-[var(--primary)]/40 ring-1 ring-[var(--primary)]/20' : 'hover:border-[var(--primary)]/25 hover:bg-[var(--bg-elevated)]/80'}
                  `}>
                    <button type="button" onClick={() => setSelected(isOpen ? null : report)} className="flex w-full items-center gap-3 p-3 text-left">
                      <TargetInfo report={report} />
                      <div className="flex shrink-0 items-center gap-2 ml-auto">
                        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${statusColors[report.status]}`}>
                          {statusLabels[report.status]}
                        </span>
                        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${ReasonColor}`}>
                          {reasonLabels[report.reason] || report.reason}
                        </span>
                        <ChevronDown className={`h-4 w-4 text-[var(--text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-[var(--border)] px-3 pb-3 pt-4 space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/50 p-4">
                            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-yellow-500" />
                              Жалобу отправил
                            </p>
                            <div className="flex items-center gap-3">
                              <Avatar url={report.reporter_avatar} name={report.reporter_display || report.reporter_username} />
                              <div>
                                <Link to={`/artist/${report.reporter_username}`} className="text-sm font-semibold text-[var(--text-primary)] hover:underline">
                                  {report.reporter_display || report.reporter_username}
                                </Link>
                                <p className="text-xs text-[var(--text-muted)]">@{report.reporter_username}</p>
                              </div>
                            </div>
                            <div className="mt-2 text-[11px] text-[var(--text-muted)]">
                              {new Date(report.created_at).toLocaleString('ru')}
                            </div>
                            <div className="mt-2">
                              <span className="rounded-md bg-yellow-500/10 px-2 py-0.5 text-[11px] font-semibold text-yellow-600 dark:text-yellow-400">
                                {reportCountText(report.reporter_report_count)} всего
                              </span>
                            </div>
                          </div>

                          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/50 p-4">
                            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                              <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-red-500" />
                              На кого пожаловались
                            </p>
                            <div className="flex items-center gap-3">
                              <Avatar url={targetAvatar} name={targetName} />
                              <div>
                                {targetUrl ? (
                                  <Link to={targetUrl} className="text-sm font-semibold text-[var(--text-primary)] hover:underline">
                                    {targetName}
                                  </Link>
                                ) : (
                                  <p className="text-sm font-semibold text-[var(--text-primary)]">{targetName}</p>
                                )}
                                <p className="text-xs text-[var(--text-muted)]">
                                  {typeLabels[report.report_type]}
                                  {report.report_type !== 'user' && d?.title && <> · {d.title}</>}
                                  {report.report_type === 'user' && d?.username && <> · @{d.username}</>}
                                </p>
                              </div>
                            </div>
                            <div className="mt-2">
                              <span className="rounded-md bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-600 dark:text-red-400">
                                {reportCountText(report.target_user_report_count)} всего
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/50 p-4">
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${ReasonColor}`}>
                              {reasonLabels[report.reason] || report.reason}
                            </span>
                            <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${statusColors[report.status]}`}>
                              <StatusIcon className="mr-1 inline h-3 w-3" />
                              {statusLabels[report.status]}
                            </span>
                          </div>
                          {report.description ? (
                            <p className="text-sm text-[var(--text-secondary)]">{report.description}</p>
                          ) : (
                            <p className="text-sm italic text-[var(--text-muted)]">Нет подробностей</p>
                          )}
                        </div>

                        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/50 p-3 space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Заметка администратора</p>
                          <textarea
                            rows={2}
                            className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                            placeholder="Добавьте внутреннюю заметку…"
                            value={notesMap[report.id] ?? (report.admin_notes || '')}
                            onChange={(e) => setNotesMap((m) => ({ ...m, [report.id]: e.target.value }))}
                          />
                          <button
                            type="button"
                            onClick={() => updateM.mutate({ id: report.id, data: { admin_notes: notesMap[report.id] ?? report.admin_notes ?? '' } })}
                            className="text-xs font-semibold text-[var(--primary)] hover:underline"
                          >
                            Сохранить заметку
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                          {report.target_details?.url && (
                            <Link to={report.target_details.url} target="_blank" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--bg-elevated)]">
                              <ExternalLink className="h-3.5 w-3.5" />
                              Открыть {typeLabels[report.report_type]?.toLowerCase() || 'объект'}
                            </Link>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {report.status !== 'resolved' && (
                              <button type="button" onClick={() => updateM.mutate({ id: report.id, data: { status: 'resolved', admin_notes: notesMap[report.id] ?? report.admin_notes ?? undefined } })}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-green-500/10 px-3 py-2 text-xs font-semibold text-green-600 dark:text-green-400 hover:bg-green-500/20 transition">
                                <CheckCircle className="h-3.5 w-3.5" />
                                Принято
                              </button>
                            )}
                            {report.status !== 'dismissed' && (
                              <button type="button" onClick={() => updateM.mutate({ id: report.id, data: { status: 'dismissed', admin_notes: notesMap[report.id] ?? report.admin_notes ?? undefined } })}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-gray-500/10 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-500/20 transition">
                                <XCircle className="h-3.5 w-3.5" />
                                Отклонить
                              </button>
                            )}
                            {report.status !== 'reviewed' && (
                              <button type="button" onClick={() => updateM.mutate({ id: report.id, data: { status: 'reviewed' } })}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition">
                                <Eye className="h-3.5 w-3.5" />
                                В работу
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
