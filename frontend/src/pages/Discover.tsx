import { Link } from 'react-router-dom';

const moods = ['Энергично', 'Грустно', 'Романтично', 'Медитативно', 'Рабочее'];

export function Discover() {
  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Открытия</h1>
      <p className="mt-2 text-[var(--text-secondary)]">Подборки по настроению и жанрам.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {moods.map((m) => (
          <Link
            key={m}
            to={`/search?mood=${encodeURIComponent(m)}`}
            className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-6 font-semibold shadow-card transition hover:scale-[1.02]"
          >
            {m}
          </Link>
        ))}
      </div>
    </div>
  );
}
