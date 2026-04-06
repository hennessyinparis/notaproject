import { Link, Outlet } from 'react-router-dom';
import { Music } from 'lucide-react';
import { GlobalPlayer } from './components/player/GlobalPlayer';
import { MobileBottomNav, Navbar } from './components/layout/Navbar';
import { usePlayerStore } from './store/playerStore';

function Footer() {
  return (
    <footer className="mt-8 border-t border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between">
          <div>
            <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold text-[var(--primary)]">
              <Music className="h-6 w-6" />
              Нота
            </Link>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Стриминг нового поколения для артистов и слушателей
            </p>
          </div>
          <div className="flex gap-12">
            <div>
              <h3 className="mb-2 text-sm font-semibold">Музыка</h3>
              <ul className="space-y-1 text-sm text-[var(--text-secondary)]">
                <li><Link to="/search" className="hover:text-[var(--primary)]">Найти треки</Link></li>
                <li><Link to="/upload" className="hover:text-[var(--primary)]">Загрузить</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">Артистам</h3>
              <ul className="space-y-1 text-sm text-[var(--text-secondary)]">
                <li><Link to="/studio" className="hover:text-[var(--primary)]">Студия</Link></li>
                <li><Link to="/subscriptions" className="hover:text-[var(--primary)]">Подписки</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-8 border-t border-[var(--border)] pt-6 text-center text-xs text-[var(--text-muted)]">
          Нота © 2024. Все права защищены.
        </div>
      </div>
    </footer>
  );
}

function App() {
  const hasPlayer = !!usePlayerStore((s) => s.currentTrack);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-base)]">
      <Navbar />
      <main className="mx-auto flex-1 w-full max-w-7xl px-4 pt-4 md:pb-10" style={{ paddingBottom: hasPlayer ? 88 : undefined }}>
        <Outlet />
      </main>
      <Footer />
      {hasPlayer && <div className="h-24" />}
      <MobileBottomNav />
      <GlobalPlayer />
    </div>
  );
}

export default App;
