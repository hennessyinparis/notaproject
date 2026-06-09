import { Link } from 'react-router-dom';
import { LEGAL_LAST_UPDATED, copyrightSections } from '../../content/legalRu';

export function LegalCopyright() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/help" className="text-sm font-medium text-[var(--primary)] hover:underline">
        ← Справка
      </Link>
      <h1 className="mt-4 font-display text-3xl font-bold text-[var(--text-primary)]">
        Авторские права и ответственность
      </h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">Обновлено: {LEGAL_LAST_UPDATED}</p>
      <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-[var(--text-secondary)]">
        Платформа «Нота» — сервис размещения музыки. Мы не присваиваем себе авторство пользовательских
        загрузок. Ответственность за законность каждого трека, альбома и обложки несёт загрузивший
        пользователь.
      </p>
      <div className="mt-8 space-y-6">
        {copyrightSections.map((s) => (
          <section key={s.title}>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{s.body}</p>
          </section>
        ))}
      </div>
      <p className="mt-10 text-sm text-[var(--text-muted)]">
        <Link to="/legal/terms" className="font-semibold text-[var(--primary)] hover:underline">
          Пользовательское соглашение
        </Link>
      </p>
    </div>
  );
}
