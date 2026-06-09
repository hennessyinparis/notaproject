import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Pause, Play, Plus, Trash2, ImageIcon, Music, ExternalLink, Pencil } from 'lucide-react';
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { api } from '../../api/client';
import { Button } from '../../components/common/Button';
import type { AdAdmin } from '../../types/ad';
import { resetAdCache } from '../../utils/playerAds';
import { adminInputClass } from './adminTypes';
import { admCard, admCardPad, admEmpty, admMain, admRow } from './adminStyles';

const base = import.meta.env.VITE_API_URL || '';

function mediaSrc(url: string) {
  return url.startsWith('http') ? url : `${base}${url}`;
}

export function AdminAdsPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('https://');
  const [active, setActive] = useState(true);
  const coverRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [audioName, setAudioName] = useState('');
  const [previewId, setPreviewId] = useState<number | null>(null);
  const previewAudio = useRef<HTMLAudioElement | null>(null);

  const [editId, setEditId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editLink, setEditLink] = useState('');
  const editCoverRef = useRef<HTMLInputElement>(null);
  const editAudioRef = useRef<HTMLInputElement>(null);

  const adsQ = useQuery({
    queryKey: ['admin-ads'],
    queryFn: () => api.get<AdAdmin[]>('/api/admin/ads').then((r) => r.data),
  });

  const invalidate = async () => {
    resetAdCache();
    await qc.invalidateQueries({ queryKey: ['admin-ads'] });
    await qc.invalidateQueries({ queryKey: ['ads'] });
  };

  const createM = useMutation({
    mutationFn: async () => {
      const cover = coverRef.current?.files?.[0];
      const audio = audioRef.current?.files?.[0];
      if (!title.trim()) throw new Error('Укажите название');
      if (!link.trim()) throw new Error('Укажите ссылку');
      if (!cover) throw new Error('Загрузите обложку');
      if (!audio) throw new Error('Загрузите аудиофайл');
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('link', link.trim());
      fd.append('active', String(active));
      fd.append('cover', cover);
      fd.append('audio', audio);
      return api.post<AdAdmin>('/api/admin/ads', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: async () => {
      toast.success('Реклама добавлена');
      setTitle('');
      setLink('https://');
      setCoverPreview(null);
      setAudioName('');
      if (coverRef.current) coverRef.current.value = '';
      if (audioRef.current) audioRef.current.value = '';
      await invalidate();
    },
    onError: (e: Error & { response?: { data?: { detail?: string } } }) => {
      const d = e.response?.data?.detail;
      toast.error(typeof d === 'string' ? d : e.message || 'Не удалось создать');
    },
  });

  const toggleM = useMutation({
    mutationFn: (id: number) => api.patch<AdAdmin>(`/api/admin/ads/${id}/toggle`),
    onSuccess: async () => {
      toast.success('Статус изменён');
      await invalidate();
    },
    onError: () => toast.error('Ошибка'),
  });

  const deleteM = useMutation({
    mutationFn: (id: number) => api.delete(`/api/admin/ads/${id}`),
    onSuccess: async () => {
      toast.success('Удалено');
      await invalidate();
    },
    onError: () => toast.error('Не удалось удалить'),
  });

  const startEdit = (ad: AdAdmin) => {
    setEditId(ad.id);
    setEditTitle(ad.title);
    setEditLink(ad.link);
  };

  const updateM = useMutation({
    mutationFn: async (id: number) => {
      const fd = new FormData();
      if (editTitle.trim()) fd.append('title', editTitle.trim());
      if (editLink.trim()) fd.append('link', editLink.trim());
      const cover = editCoverRef.current?.files?.[0];
      const audio = editAudioRef.current?.files?.[0];
      if (cover) fd.append('cover', cover);
      if (audio) fd.append('audio', audio);
      return api.patch<AdAdmin>(`/api/admin/ads/${id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: async () => {
      toast.success('Реклама обновлена');
      setEditId(null);
      if (editCoverRef.current) editCoverRef.current.value = '';
      if (editAudioRef.current) editAudioRef.current.value = '';
      await invalidate();
    },
    onError: (e: Error & { response?: { data?: { detail?: string } } }) => {
      const d = e.response?.data?.detail;
      toast.error(typeof d === 'string' ? d : 'Ошибка обновления');
    },
  });

  const togglePreview = (ad: AdAdmin) => {
    if (!ad.audio_url) return;
    if (previewId === ad.id) {
      previewAudio.current?.pause();
      setPreviewId(null);
      return;
    }
    previewAudio.current?.pause();
    const el = new Audio(mediaSrc(ad.audio_url));
    previewAudio.current = el;
    void el.play();
    setPreviewId(ad.id);
    el.onended = () => setPreviewId(null);
  };

  const handleCoverChange = () => {
    const file = coverRef.current?.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setCoverPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setCoverPreview(null);
    }
  };

  const handleAudioChange = () => {
    const file = audioRef.current?.files?.[0];
    setAudioName(file ? file.name : '');
  };

  return (
    <div className={admMain}>
      <AdminPageHeader
        icon={Megaphone}
        title="Реклама"
        description="Аудиореклама между треками для бесплатных слушателей (каждые 4–5 треков)"
      />

      <div className={`${admCard} ${admCardPad}`}>
        <div className="flex items-center gap-3 border-b border-[var(--border)] pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--primary-light)] to-[var(--primary)]/10 text-[var(--primary)] ring-1 ring-[var(--primary)]/20">
            <Plus className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Новый рекламный ролик</h3>
            <p className="text-xs text-[var(--text-muted)]">Заполните поля и загрузите файлы</p>
          </div>
        </div>

        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Название</label>
            <input className={`${adminInputClass} mt-1.5`} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Нота Plus — первый месяц" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Ссылка (кнопка «Подробнее»)</label>
            <input className={`${adminInputClass} mt-1.5`} value={link} onChange={(e) => setLink(e.target.value)} />
          </div>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Обложка</label>
            <div className="mt-1.5">
              <label className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[var(--border)] px-4 py-4 transition-colors hover:border-[var(--primary)]/40 ${coverPreview ? 'bg-[var(--bg-elevated)]' : ''}`}>
                {coverPreview ? (
                  <img src={coverPreview} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-black/10" />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-elevated)] text-[var(--text-muted)] ring-1 ring-[var(--border)]">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{coverPreview ? 'Изменить обложку' : 'Выберите файл'}</p>
                  <p className="text-xs text-[var(--text-muted)]">PNG, JPG — рекомендуется 1200×1200</p>
                </div>
                <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
              </label>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Аудио (MP3, WAV, OGG)</label>
            <div className="mt-1.5">
              <label className={`flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[var(--border)] px-4 py-4 transition-colors hover:border-[var(--primary)]/40 ${audioName ? 'bg-[var(--bg-elevated)]' : ''}`}>
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-elevated)] text-[var(--text-muted)] ring-1 ring-[var(--border)]">
                  <Music className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{audioName || 'Выберите файл'}</p>
                  <p className="text-xs text-[var(--text-muted)]">MP3, WAV, OGG — до 20 МБ</p>
                </div>
                <input ref={audioRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioChange} />
              </label>
            </div>
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/50 px-4 py-3 text-sm text-[var(--text-secondary)]">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 rounded border-[var(--border)] accent-[var(--primary)]" />
          <span>Сразу активна (показывать в ротации)</span>
        </label>

        <Button type="button" className="mt-5 w-full sm:w-auto" disabled={createM.isPending} onClick={() => createM.mutate()}>
          {createM.isPending ? 'Загрузка…' : 'Добавить рекламу'}
        </Button>
      </div>

      <div className={`${admCard} ${admCardPad}`}>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/12 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">В ротации</h3>
              <p className="text-xs text-[var(--text-muted)]">
                {adsQ.data ? `${adsQ.data.length} роликов · ${adsQ.data.filter(a => a.active).length} активны` : 'Загрузка…'}
              </p>
            </div>
          </div>
        </div>

        {adsQ.isLoading ? (
          <div className="mt-6 space-y-3">
            {[1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-[var(--bg-elevated)]/80" />)}
          </div>
        ) : !adsQ.data?.length ? (
          <div className={admEmpty}>Пока нет рекламных роликов. Добавьте первый выше.</div>
        ) : (
          <div className="mt-4 space-y-3">
            {adsQ.data.map((ad) => (
              <div key={ad.id} className="rounded-xl border border-[var(--border)] overflow-hidden">
                <div className={`${admRow} gap-4 p-4`}>
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[var(--bg-elevated)] ring-1 ring-black/10">
                    {ad.image_url ? (
                      <img src={mediaSrc(ad.image_url)} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[var(--text-muted)]">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                    )}
                    <span className="absolute bottom-0 left-0 right-0 bg-amber-500 py-[2px] text-center text-[8px] font-bold uppercase tracking-wider text-black">
                      AD
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[var(--text-primary)]">{ad.title}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                      <ExternalLink className="h-3 w-3" />
                      <span className="truncate">{ad.link}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${ad.active ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-gray-500/10 text-gray-500'}`}>
                        {ad.active ? 'Активна' : 'Выключена'}
                      </span>
                      {ad.duration_seconds ? (
                        <span className="text-[10px] text-[var(--text-muted)]">{Math.round(ad.duration_seconds)} сек</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {ad.audio_url ? (
                      <Button type="button" variant="ghost" size="sm" onClick={() => togglePreview(ad)}
                        className={previewId === ad.id ? 'text-[var(--primary)]' : ''}>
                        {previewId === ad.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                    ) : null}
                    <Button type="button" variant="ghost" size="sm" onClick={() => (editId === ad.id ? setEditId(null) : startEdit(ad))}>
                      <Pencil className={`h-4 w-4 ${editId === ad.id ? 'text-[var(--primary)]' : ''}`} />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" disabled={toggleM.isPending} onClick={() => toggleM.mutate(ad.id)}>
                      {ad.active ? 'Выкл' : 'Вкл'}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" disabled={deleteM.isPending} onClick={() => { if (window.confirm(`Удалить «${ad.title}»?`)) deleteM.mutate(ad.id); }}>
                      <Trash2 className="h-4 w-4 text-[var(--error)]" />
                    </Button>
                  </div>
                </div>
                {editId === ad.id && (
                  <div className="border-t border-[var(--border)] bg-[var(--bg-elevated)]/50 p-4 space-y-3">
                    <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wide">Редактировать</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold text-[var(--text-muted)]">Название</label>
                        <input className={`${adminInputClass} mt-1`} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-[var(--text-muted)]">Ссылка</label>
                        <input className={`${adminInputClass} mt-1`} value={editLink} onChange={(e) => setEditLink(e.target.value)} />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold text-[var(--text-muted)]">Новая обложка (необязательно)</label>
                        <input ref={editCoverRef} type="file" accept="image/*" className="mt-1 block w-full text-xs text-[var(--text-secondary)]" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-[var(--text-muted)]">Новое аудио (необязательно)</label>
                        <input ref={editAudioRef} type="file" accept="audio/*" className="mt-1 block w-full text-xs text-[var(--text-secondary)]" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" disabled={updateM.isPending} onClick={() => updateM.mutate(ad.id)}>
                        {updateM.isPending ? 'Сохранение…' : 'Сохранить'}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setEditId(null)}>Отмена</Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
