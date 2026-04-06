import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload as UploadIcon, X, Check } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { api } from '../api/client';
import { Button } from '../components/common/Button';
import { GENRES } from '../constants/genres';

export function Upload() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedTrack, setUploadedTrack] = useState<{ id: number; title: string } | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    genre: '',
    tags: [] as string[],
    is_public: true,
    is_downloadable: false,
    allow_comments: true,
  });

  const onDrop = useCallback((files: File[]) => {
    const file = files[0];
    setAudioFile(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'audio/*': ['.mp3', '.wav', '.flac', '.aac', '.ogg'] },
    maxSize: 500 * 1024 * 1024,
    onDrop,
    multiple: false,
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
      const val = (e.target as HTMLInputElement).value.trim();
      if (val && !form.tags.includes(val) && form.tags.length < 10) {
        setForm((f) => ({ ...f, tags: [...f.tags, val] }));
        (e.target as HTMLInputElement).value = '';
      }
    }
  };

  const upload = useMutation({
    mutationFn: async () => {
      if (!audioFile || !form.title) throw new Error('Файл и название обязательны');
      setIsUploading(true);
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

      const res = await api.post('/api/tracks', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          const percent = Math.round((e.loaded * 100) / (e.total || 1));
          setUploadProgress(percent);
        },
      });
      return res.data;
    },
    onSuccess: (data) => {
      setUploadedTrack(data);
      queryClient.invalidateQueries({ queryKey: ['tracks'] });
      toast.success('Трек опубликован!');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Ошибка загрузки');
    },
    onSettled: () => setIsUploading(false),
  });

  if (uploadedTrack) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center justify-center py-16 text-center">
        <div className="mb-6 rounded-full bg-green-100 p-4">
          <Check className="h-12 w-12 text-green-600" />
        </div>
        <h2 className="mb-2 text-2xl font-bold">Трек опубликован!</h2>
        <p className="mb-6 text-[var(--text-secondary)]">"{uploadedTrack.title}" теперь доступен всем</p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => navigate(`/track/${uploadedTrack.id}`)}>
            Слушать
          </Button>
          <Button onClick={() => { setUploadedTrack(null); setAudioFile(null); setForm({ title: '', description: '', genre: '', tags: [], is_public: true, is_downloadable: false, allow_comments: true }); setCoverPreview(null); }}>
            Загрузить ещё
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-8 font-display text-3xl font-bold">Загрузить трек</h1>

      {!audioFile ? (
        <div
          {...getRootProps()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-20 text-center transition-all ${
            isDragActive ? 'border-[var(--primary)] bg-[var(--primary-light)]' : 'border-[var(--border)] hover:border-[var(--primary)]'
          }`}
        >
          <input {...getInputProps()} />
          <div className="mb-4 flex justify-center">
            <UploadIcon className="h-16 w-16 text-[var(--text-muted)]" />
          </div>
          <h2 className="mb-2 text-xl font-semibold">
            {isDragActive ? 'Отпусти файл здесь' : 'Перетащи трек сюда'}
          </h2>
          <p className="mb-6 text-[var(--text-secondary)]">или нажми чтобы выбрать файл</p>
          <Button>Выбрать файл</Button>
          <p className="mt-4 text-xs text-[var(--text-muted)]">MP3, WAV, FLAC, AAC · до 500 МБ</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[220px_1fr]">
          <div>
            <label className="cursor-pointer block">
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
                    <span className="text-sm">Добавить обложку</span>
                    <span className="text-xs text-[var(--text-muted)]">JPG, PNG · до 10 МБ</span>
                  </div>
                )}
              </div>
            </label>
            <div className="mt-3 break-all text-xs text-[var(--text-muted)]">{audioFile.name}</div>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-2 block text-sm font-semibold">Название *</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3"
                placeholder="Название трека"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">Описание</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 resize-none"
                placeholder="Опиши свой трек..."
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">Жанр</label>
              <select
                value={form.genre}
                onChange={(e) => setForm((f) => ({ ...f, genre: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3"
              >
                <option value="">Выбрать жанр</option>
                {GENRES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">Теги</label>
              <div className="flex flex-wrap gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-2">
                {form.tags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 rounded-full bg-[var(--primary-light)] px-3 py-1 text-sm text-[var(--primary)]">
                    #{tag}
                    <button onClick={() => setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }))} className="ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  placeholder="Добавить тег..."
                  onKeyDown={addTag}
                  className="flex-1 border-none bg-transparent px-2 py-1 text-sm outline-none"
                />
              </div>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Нажми Enter или запятую</p>
            </div>

            <div className="flex flex-col gap-3">
              <label className="flex cursor-pointer items-center justify-between">
                <div>
                  <div className="font-medium">Публичный трек</div>
                  <div className="text-xs text-[var(--text-muted)]">Виден всем пользователям</div>
                </div>
                <div
                  onClick={() => setForm((f) => ({ ...f, is_public: !f.is_public }))}
                  className={`relative h-6 w-11 rounded-full transition-colors ${form.is_public ? 'bg-[var(--primary)]' : 'bg-[var(--bg-elevated)]'}`}
                >
                  <div className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.is_public ? 'translate-x-6' : 'translate-x-1'}`} />
                </div>
              </label>
              <label className="flex cursor-pointer items-center justify-between">
                <div className="font-medium">Разрешить скачивание</div>
                <div
                  onClick={() => setForm((f) => ({ ...f, is_downloadable: !f.is_downloadable }))}
                  className={`relative h-6 w-11 rounded-full transition-colors ${form.is_downloadable ? 'bg-[var(--primary)]' : 'bg-[var(--bg-elevated)]'}`}
                >
                  <div className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.is_downloadable ? 'translate-x-6' : 'translate-x-1'}`} />
                </div>
              </label>
              <label className="flex cursor-pointer items-center justify-between">
                <div className="font-medium">Разрешить комментарии</div>
                <div
                  onClick={() => setForm((f) => ({ ...f, allow_comments: !f.allow_comments }))}
                  className={`relative h-6 w-11 rounded-full transition-colors ${form.allow_comments ? 'bg-[var(--primary)]' : 'bg-[var(--bg-elevated)]'}`}
                >
                  <div className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.allow_comments ? 'translate-x-6' : 'translate-x-1'}`} />
                </div>
              </label>
            </div>

            {isUploading && (
              <div>
                <div className="mb-2 flex justify-between text-sm">
                  <span>Загрузка...</span>
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
              disabled={!audioFile || !form.title}
              onClick={() => upload.mutate()}
            >
              Опубликовать трек
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
