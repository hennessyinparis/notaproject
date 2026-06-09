import { Link } from 'react-router-dom';
import { LEGAL_LAST_UPDATED, termsSections } from '../../content/legalRu';

export function LegalTerms() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/help" className="text-sm font-medium text-[var(--primary)] hover:underline">
        ← Справка
      </Link>
      <h1 className="mt-4 font-display text-3xl font-bold text-[var(--text-primary)]">
        Пользовательское соглашение
      </h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">Обновлено: {LEGAL_LAST_UPDATED}</p>
      <div className="mt-8 space-y-6">
        {termsSections.map((s) => (
          <section key={s.title}>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{s.body}</p>
          </section>
        ))}
      </div>
      <p className="mt-10 text-sm text-[var(--text-muted)]">
        Также см.{' '}
        <Link to="/legal/copyright" className="font-semibold text-[var(--primary)] hover:underline">
          политику авторских прав
        </Link>
        .
      </p>
    </div>
  );
}
