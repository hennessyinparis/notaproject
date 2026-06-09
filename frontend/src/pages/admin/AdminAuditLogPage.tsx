import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Loader2, Search, ChevronLeft, ChevronRight } from 'lucide-react';

import { api } from '../../api/client';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { Button } from '../../components/common/Button';
import { adminInputClass } from './adminTypes';
import { admCard, admCardPad, admEmpty, admMain, admToolbar } from './adminStyles';

type AuditLogRow = {
  id: number;
  user_id: number | null;
  username: string | null;
  action_type: string;
  entity_type: string | null;
  entity_id: number | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
};

const actionLabels: Record<string, string> = {
  login_success: 'Вход',
  login_failure: 'Ошибка входа',
  track_upload: 'Загрузка трека',
  track_delete: 'Удаление трека',
  comment_delete: 'Удаление комментария',
  report_resolve: 'Решение жалобы',
  user_block: 'Блокировка',
  user_unblock: 'Разблокировка',
  subscription_purchase: 'Покупка подписки',
};

function actionColor(action: string): string {
  if (action.includes('failure')) return 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400';
  if (action.includes('delete')) return 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400';
  if (action.includes('block')) return 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400';
  if (action.includes('upload')) return 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400';
  if (action.includes('purchase')) return 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400';
  if (action.includes('login_success')) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400';
  return 'bg-gray-100 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400';
}

export function AdminAuditLogPage() {
  const [actionType, setActionType] = useState('');
  const [userId, setUserId] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);

  const params = new URLSearchParams();
  if (actionType) params.append('action_type', actionType);
  if (userId) params.append('user_id', userId);
  if (ipAddress) params.append('ip_address', ipAddress);
  if (dateFrom) params.append('date_from', new Date(dateFrom).toISOString());
  if (dateTo) params.append('date_to', new Date(dateTo).toISOString());
  params.append('limit', String(limit));
  params.append('offset', String(offset));

  const query = useQuery({
    queryKey: ['admin-audit-logs', actionType, userId, ipAddress, dateFrom, dateTo, offset],
    queryFn: async () => {
      const res = await api.get<AuditLogRow[]>(`/api/admin/audit-logs?${params.toString()}`);
      return res.data;
    },
  });

  const logs = query.data ?? [];
  const hasNext = logs.length === limit;

  return (
    <div className={admMain}>
      <AdminPageHeader
        icon={ClipboardList}
        title="Аудит"
        description="Журнал действий пользователей и администраторов на платформе."
      />

      <div className={admToolbar}>
        <div className="min-w-0 flex-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Действие</label>
          <select
            className={`${adminInputClass} mt-1.5`}
            value={actionType}
            onChange={(e) => { setActionType(e.target.value); setOffset(0); }}
          >
            <option value="">Все</option>
            <option value="login_success">Вход</option>
            <option value="login_failure">Ошибка входа</option>
            <option value="track_upload">Загрузка трека</option>
            <option value="track_delete">Удаление трека</option>
            <option value="comment_delete">Удаление комментария</option>
            <option value="report_resolve">Решение жалобы</option>
            <option value="user_block">Блокировка</option>
            <option value="user_unblock">Разблокировка</option>
            <option value="subscription_purchase">Покупка подписки</option>
          </select>
        </div>
        <div className="min-w-0 flex-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">User ID</label>
          <input
            className={`${adminInputClass} mt-1.5`}
            type="number"
            value={userId}
            onChange={(e) => { setUserId(e.target.value); setOffset(0); }}
            placeholder="ID пользователя"
          />
        </div>
        <div className="min-w-0 flex-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">IP-адрес</label>
          <div className="relative mt-1.5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden />
            <input
              className={`${adminInputClass} pl-10`}
              value={ipAddress}
              onChange={(e) => { setIpAddress(e.target.value); setOffset(0); }}
              placeholder="192.168.1.1"
            />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">С</label>
          <input
            className={`${adminInputClass} mt-1.5`}
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setOffset(0); }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">По</label>
          <input
            className={`${adminInputClass} mt-1.5`}
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setOffset(0); }}
          />
        </div>
      </div>

      <div className={admCard}>
        <div className={admCardPad}>
          {query.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--text-muted)]" />
            </div>
          ) : logs.length === 0 ? (
            <div className={admEmpty}>Записей не найдено</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                    <th className="px-3 py-2 font-semibold">ID</th>
                    <th className="px-3 py-2 font-semibold">Время</th>
                    <th className="px-3 py-2 font-semibold">Пользователь</th>
                    <th className="px-3 py-2 font-semibold">Действие</th>
                    <th className="px-3 py-2 font-semibold">Объект</th>
                    <th className="px-3 py-2 font-semibold">Детали</th>
                    <th className="px-3 py-2 font-semibold">IP</th>
                    <th className="px-3 py-2 font-semibold">User-Agent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-[var(--bg-elevated)]/50 transition-colors">
                      <td className="px-3 py-2 text-[var(--text-muted)]">{log.id}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('ru')}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {log.user_id ? (
                          <span className="font-medium text-[var(--text-primary)]">
                            {log.username ?? `ID ${log.user_id}`}
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold ${actionColor(log.action_type)}`}>
                          {actionLabels[log.action_type] || log.action_type}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {log.entity_type ? (
                          <span className="text-[var(--text-secondary)]">
                            {log.entity_type} {log.entity_id}
                          </span>
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {log.details ? (
                          <pre className="max-w-xs overflow-x-auto rounded bg-[var(--bg-elevated)] px-2 py-1 text-[11px] text-[var(--text-secondary)]">
                            {JSON.stringify(log.details, null, 1)}
                          </pre>
                        ) : (
                          <span className="text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap font-mono text-[var(--text-muted)]">
                        {log.ip_address ?? '—'}
                      </td>
                      <td className="px-3 py-2 max-w-xs truncate text-[var(--text-muted)]" title={log.user_agent ?? undefined}>
                        {log.user_agent ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-3">
            <div className="text-xs text-[var(--text-muted)]">
              Записей: {logs.length}
              {offset > 0 ? ` (с ${offset})` : ''}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset((o) => Math.max(0, o - limit))}
              >
                <ChevronLeft className="h-4 w-4" />
                Назад
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!hasNext}
                onClick={() => setOffset((o) => o + limit)}
              >
                Вперёд
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
