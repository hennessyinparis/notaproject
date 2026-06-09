import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Disc3, Music2, Upload as UploadIcon, X, Check, Lock } from 'lucide-react';
import { AlbumTracksEditor, type AlbumTrackRow } from '../components/upload/AlbumTracksEditor';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { api } from '../api/client';
import { Button } from '../components/common/Button';
import { CustomSelect } from '../components/ui/CustomSelect';
import { CopyrightAgreement } from '../components/legal/CopyrightAgreement';
import { GENRES } from '../constants/genres';
import { useAuthStore } from '../store/authStore';
import { isArtistPro } from '../utils/subscription';

type UploadMode = 'track' | 'album';

function fileBaseTitle(name: string): string {
  return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}

export function Upload() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const isPro = isArtistPro(user);
  const [mode, setMode] = useState<UploadMode>('track');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [albumTracks, setAlbumTracks] = useState<AlbumTrackRow[]>([]);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStep, setUploadStep] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedTrack, setUploadedTrack] = useState<{ id: number; title: string } | null>(null);
  const [uploadedAlbum, setUploadedAlbum] = useState<{ id: number; title: string; trackCount: number } | null>(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    genre: '',
    tags: [] as string[],
    is_public: true,
    is_downloadable: false,
    allow_comments: true,
  });

  const resetForm = () => {
    setAudioFile(null);
    setAlbumTracks([]);
    setCoverFile(null);
    setCoverPreview(null);
    setForm({
      title: '',
      description: '',
      genre: '',
      tags: [],
      is_public: true,
      is_downloadable: false,
      allow_comments: true,
    });
    setUploadProgress(0);
    setUploadStep('');
    setRightsConfirmed(false);
  };

  const onDropTrack = useCallback((files: File[]) => {
    setAudioFile(files[0] ?? null);
  }, []);

  const onDropAlbum = useCallback((files: File[]) => {
    setAlbumTracks((prev) => {
      const existing = new Set(prev.map((r) => `${r.file.name}-${r.file.size}`));
      const added = files
        .filter((f) => !existing.has(`${f.name}-${f.size}`))
        .map((file) => ({
          key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`,
          file,
          title: fileBaseTitle(file.name),
        }));
      return [...prev, ...added];
    });
  }, []);

  const trackDropzone = useDropzone({
    accept: { 'audio/*': ['.mp3', '.wav', '.flac', '.aac', '.ogg'] },
    maxSize: 500 * 1024 * 1024,
    onDrop: onDropTrack,
    multiple: false,
  });

  const albumDropzone = useDropzone({
    accept: { 'audio/*': ['.mp3', '.wav', '.flac', '.aac', '.ogg'] },
    maxSize: 500 * 1024 * 1024,
    onDrop: onDropAlbum,
    multiple: true,
  });

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const addTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim();
      if (val && !form.tags.includes(val) && form.tags.length < 10) {
        setForm((f) => ({ ...f, tags: [...f.tags, val] }));
        setTagInput('');
      }
    }
  };

  const uploadTrack = useMutation({
    mutationFn: async () => {
      if (!audioFile || !form.title) throw new Error('Файл и название обязательны');
      if (!rightsConfirmed) throw new Error('Подтвердите права на контент');
      setIsUploading(true);
      setUploadStep('Загрузка трека…');
      const fd = new FormData();
      fd.append('file', audioFile);
      if (coverFile) fd.append('cover', coverFile);
      fd.append('title', form.title);
      fd.append('description', form.description);
      fd.append('genre', form.genre);
      fd.append('tags', JSON.stringify(form.tags));
      fd.append('is_public', String(form.is_public));
      fd.append('is_downloadable', String(form.is_downloadable));
      fd.append('allow_comments', String(form.allow_comments));
      fd.append('rights_confirmed', 'true');

      const res = await api.post('/api/tracks', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => setUploadProgress(Math.round((e.loaded * 100) / (e.total || 1))),
      });
      return res.data;
    },
    onSuccess: (data) => {
      setUploadedTrack(data);
      queryClient.invalidateQueries({ queryKey: ['tracks'] });
      toast.success('Трек опубликован!');
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err?.response?.data?.detail || 'Ошибка загрузки');
    },
    onSettled: () => setIsUploading(false),
  });

  const uploadAlbum = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error('Укажите название альбома');
      if (albumTracks.length === 0) throw new Error('Добавьте хотя бы один трек');
      if (albumTracks.some((t) => !t.title.trim())) throw new Error('У каждого трека должно быть название');
      if (!rightsConfirmed) throw new Error('Подтвердите права на контент');

      setIsUploading(true);
      setUploadProgress(0);
      setUploadStep('Создание альбома…');

      const plRes = await api.post<{ id: number; title: string }>('/api/playlists', {
        title: form.title.trim(),
        description: form.description.trim() || null,
        is_public: form.is_public,
        is_album: true,
      });
      const playlistId = plRes.data.id;
      const total = albumTracks.length;

      for (let i = 0; i < total; i++) {
        const row = albumTracks[i];
        setUploadStep(`Загрузка ${i + 1} из ${total}: ${row.title}`);
        const fd = new FormData();
        fd.append('file', row.file);
        if (i === 0 && coverFile) fd.append('cover', coverFile);
        fd.append('title', row.title.trim());
        fd.append('description', form.description);
        fd.append('genre', form.genre);
        fd.append('tags', JSON.stringify(form.tags));
        fd.append('is_public', String(form.is_public));
        fd.append('is_downloadable', String(form.is_downloadable));
        fd.append('allow_comments', String(form.allow_comments));
        fd.append('rights_confirmed', 'true');

        const trackRes = await api.post<{ id: number }>('/api/tracks', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            const filePct = e.total ? e.loaded / e.total : 0;
            setUploadProgress(Math.round(((i + filePct) / total) * 100));
          },
        });
        await api.post(`/api/playlists/${playlistId}/tracks/${trackRes.data.id}`);
      }

      return { id: playlistId, title: plRes.data.title, trackCount: total };
    },
    onSuccess: (data) => {
      setUploadedAlbum(data);
      queryClient.invalidateQueries({ queryKey: ['tracks'] });
      queryClient.invalidateQueries({ queryKey: ['playlists'] });
      toast.success('Альбом опубликован!');
    },
    onError: (err: { response?: { data?: { detail?: string } }; message?: string }) => {
      toast.error(err?.response?.data?.detail || err?.message || 'Ошибка загрузки альбома');
    },
    onSettled: () => {
      setIsUploading(false);
      setUploadStep('');
    },
  });

  if (!isPro) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center justify-center py-20 text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--primary)]/10">
          <Lock className="h-10 w-10 text-[var(--primary)]" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Загрузка треков</h1>
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Загрузка и публикация музыки доступна только для подписчиков <strong>Артист Про</strong>.
          Оформите подписку, чтобы делиться своим творчеством с миллионами слушателей.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/subscriptions"
            className="rounded-xl bg-[var(--primary)] px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Оформить Артист Про
          </Link>
          <Link
            to="/"
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-6 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--primary)]/40"
          >
            На главную
          </Link>
        </div>
      </div>
    );
  }

  if (uploadedTrack) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center justify-center py-16 text-center">
        <div className="mb-6 rounded-full bg-green-100 p-4">
          <Check className="h-12 w-12 text-green-600" />
        </div>
        <h2 className="mb-2 text-2xl font-bold">Трек опубликован!</h2>
        <p className="mb-6 text-[var(--text-secondary)]">«{uploadedTrack.title}» теперь доступен всем</p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate(`/track/${uploadedTrack.id}`)}>
            Слушать
          </Button>
          <Button
            onClick={() => {
              setUploadedTrack(null);
              resetForm();
            }}
          >
            Загрузить ещё
          </Button>
        </div>
      </div>
    );
  }

  if (uploadedAlbum) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center justify-center py-16 text-center">
        <div className="mb-6 rounded-full bg-green-100 p-4">
          <Check className="h-12 w-12 text-green-600" />
        </div>
        <h2 className="mb-2 text-2xl font-bold">Альбом опубликован!</h2>
        <p className="mb-6 text-[var(--text-secondary)]">
          «{uploadedAlbum.title}» · {uploadedAlbum.trackCount} {uploadedAlbum.trackCount === 1 ? 'трек' : 'треков'}
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate(`/playlist/${uploadedAlbum.id}`)}>
            Открыть альбом
          </Button>
          <Button
            onClick={() => {
              setUploadedAlbum(null);
              resetForm();
            }}
          >
            Загрузить ещё
          </Button>
        </div>
      </div>
    );
  }

  const hasFiles = mode === 'track' ? !!audioFile : albumTracks.length > 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-3xl font-bold">{mode === 'track' ? 'Загрузить трек' : 'Загрузить альбом'}</h1>
        <div className="flex rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-1">
          <button
            type="button"
            onClick={() => {
              setMode('track');
              setAlbumTracks([]);
            }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              mode === 'track' ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
            }`}
          >
            <Music2 className="h-4 w-4" />
            Трек
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('album');
              setAudioFile(null);
            }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              mode === 'album' ? 'bg-[var(--primary)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]'
            }`}
          >
            <Disc3 className="h-4 w-4" />
            Альбом
          </button>
        </div>
      </div>

      {!hasFiles ? (
        <div
          {...(mode === 'track' ? trackDropzone.getRootProps() : albumDropzone.getRootProps())}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-20 text-center transition-all ${
            (mode === 'track' ? trackDropzone.isDragActive : albumDropzone.isDragActive)
              ? 'border-[var(--primary)] bg-[var(--primary-light)]'
              : 'border-[var(--border)] hover:border-[var(--primary)]'
          }`}
        >
          <input {...(mode === 'track' ? trackDropzone.getInputProps() : albumDropzone.getInputProps())} />
          <div className="mb-4 flex justify-center">
            {mode === 'track' ? (
              <UploadIcon className="h-16 w-16 text-[var(--text-muted)]" />
            ) : (
              <Disc3 className="h-16 w-16 text-[var(--text-muted)]" />
            )}
          </div>
          <h2 className="mb-2 text-xl font-semibold">
            {mode === 'track' ? 'Перетащи трек сюда' : 'Перетащи файлы альбома сюда'}
          </h2>
          <p className="mb-6 text-[var(--text-secondary)]">
            {mode === 'track' ? 'или нажми чтобы выбрать файл' : 'можно выбрать несколько треков сразу'}
          </p>
          <Button>Выбрать {mode === 'track' ? 'файл' : 'файлы'}</Button>
          <p className="mt-4 text-xs text-[var(--text-muted)]">MP3, WAV, FLAC, AAC · до 500 МБ на файл</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[220px_1fr]">
          <div>
            <label className="block cursor-pointer">
              <input type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
              <div className="relative aspect-square w-full overflow-hidden rounded-xl border-2 border-dashed border-[var(--border)] bg-[var(--bg-surface)]">
                {coverPreview ? (
                  <>
                    <img src={coverPreview} alt="" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                      <span className="text-white">Изменить</span>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-[var(--text-secondary)]">
                    <UploadIcon className="mb-2 h-8 w-8" />
                    <span className="text-sm">{mode === 'album' ? 'Обложка альбома' : 'Добавить обложку'}</span>
                    <span className="text-xs text-[var(--text-muted)]">JPG, PNG · до 10 МБ</span>
                  </div>
                )}
              </div>
            </label>
            {mode === 'track' && audioFile ? (
              <div className="mt-3 break-all text-xs text-[var(--text-muted)]">{audioFile.name}</div>
            ) : (
              <div className="mt-3 text-xs text-[var(--text-muted)]">{albumTracks.length} треков в альбоме</div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-2 block text-sm font-semibold">{mode === 'album' ? 'Название альбома *' : 'Название *'}</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3"
                placeholder={mode === 'album' ? 'Название альбома' : 'Название трека'}
              />
            </div>

            {mode === 'album' && (
              <AlbumTracksEditor
                tracks={albumTracks}
                onChange={setAlbumTracks}
                onAddFiles={onDropAlbum}
              />
            )}

            <div>
              <label className="mb-2 block text-sm font-semibold">Описание</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3"
                placeholder={mode === 'album' ? 'Опиши альбом…' : 'Опиши свой трек…'}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">Жанр</label>
              <CustomSelect
                value={form.genre}
                onChange={(v) => setForm((f) => ({ ...f, genre: v }))}
                options={[
                  { value: '', label: 'Выбрать жанр' },
                  ...GENRES.map((g) => ({ value: g, label: g })),
                ]}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">Теги</label>
              <div className="flex flex-wrap gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-2">
                {form.tags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 rounded-full bg-[var(--primary-light)] px-3 py-1 text-sm text-[var(--primary)]">
                    #{tag}
                    <button type="button" onClick={() => setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input placeholder="Добавить тег…" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={addTag} className="flex-1 border-none bg-transparent px-2 py-1 text-sm outline-none" />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <label className="flex cursor-pointer items-center justify-between">
                <div>
                  <div className="font-medium">{mode === 'album' ? 'Публичный альбом' : 'Публичный трек'}</div>
                  <div className="text-xs text-[var(--text-muted)]">Виден всем пользователям</div>
                </div>
                <div
                  onClick={() => setForm((f) => ({ ...f, is_public: !f.is_public }))}
                  className={`relative h-6 w-11 rounded-full transition-colors ${form.is_public ? 'bg-[var(--primary)]' : 'bg-[var(--bg-elevated)]'}`}
                >
                  <div className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.is_public ? 'translate-x-6' : 'translate-x-1'}`} />
                </div>
              </label>
            </div>

            <CopyrightAgreement
              variant="upload"
              acceptTerms={rightsConfirmed}
              acceptCopyright={rightsConfirmed}
              onAcceptTerms={setRightsConfirmed}
              onAcceptCopyright={setRightsConfirmed}
            />

            {isUploading && (
              <div>
                <div className="mb-2 flex justify-between text-sm">
                  <span>{uploadStep || 'Загрузка…'}</span>
                  <span className="font-semibold">{uploadProgress}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--bg-elevated)]">
                  <div className="h-full rounded-full bg-[var(--primary)] transition-all" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            <Button
              className="mt-2"
              loading={isUploading}
              disabled={
                !hasFiles ||
                !form.title.trim() ||
                !rightsConfirmed ||
                (mode === 'album' && albumTracks.length === 0)
              }
              onClick={() => (mode === 'track' ? uploadTrack.mutate() : uploadAlbum.mutate())}
            >
              {mode === 'album' ? 'Опубликовать альбом' : 'Опубликовать трек'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
