import { motion } from 'framer-motion';
import { BarChart3, Link2, Mic2, Radio, Sparkles, Upload, Waves } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { Button } from '../components/common/Button';
import { goToRegister } from '../utils/authNavigation';

const features = [
  {
    icon: Waves,
    title: 'Монетизация «Волна»',
    text: 'Слушатели поддерживают любимые треки — доход прозрачный, без скрытых комиссий в интерфейсе.',
  },
  {
    icon: BarChart3,
    title: 'Аналитика в Студии',
    text: 'Прослушивания, география и динамика — чтобы понимать, что заходит аудитории.',
  },
  {
    icon: Radio,
    title: 'Профиль как на стриминге',
    text: 'Обложки, био, треки в одном месте. Подписчики видят новые релизы в ленте.',
  },
  {
    icon: Mic2,
    title: 'Загрузка и контроль',
    text: 'Форматы, обложка, теги, видимость. Решай сам, что публично, а что нет.',
  },
];

export function ForArtists() {
  const navigate = useNavigate();

  return (
    <div className="space-y-20 pb-8">
      <section className="relative overflow-hidden rounded-card border border-[var(--border)] bg-gradient-to-br from-[var(--primary-light)] via-[var(--bg-surface)] to-[var(--bg-elevated)] p-10 md:p-14 dark:from-[#2a1020] dark:via-[var(--bg-surface)] dark:to-[var(--bg-elevated)]">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[var(--primary)]/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-[var(--secondary)]/10 blur-3xl" />
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative max-w-3xl">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-surface)]/80 px-3 py-1 text-xs font-semibold text-[var(--primary)] backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            Для авторов и продюсеров
          </p>
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-[var(--text-primary)] md:text-5xl">
            Твоя музыка — твои правила
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-[var(--text-secondary)]">
            Нота соединяет слушателей и артистов: глобальный плеер, лента подписок и честные инструменты роста — без
            лишней суеты в интерфейсе.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" onClick={() => goToRegister(navigate)}>
              Начать бесплатно
            </Button>
            <Link to="/upload">
              <Button size="lg" variant="secondary">
                <Upload className="mr-2 h-4 w-4" />
                Загрузить трек
              </Button>
            </Link>
            <Link to="/subscriptions">
              <Button size="lg" variant="ghost">
                Тарифы
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      <section>
        <h2 className="font-display text-2xl font-bold md:text-3xl">Почему артисты выбирают Ноту</h2>
        <p className="mt-2 max-w-2xl text-[var(--text-secondary)]">
          Всё необходимое для публикации и развития — в одном сервисе, с тем же визуальным языком, что и у слушателей.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {features.map(({ icon: Icon, title, text }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-card"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="rounded-card border border-[var(--border)] bg-[var(--bg-surface)] p-8 md:flex md:items-center md:justify-between md:gap-8">
        <div>
          <h2 className="font-display text-2xl font-bold">Готов к «Артист Про»?</h2>
          <p className="mt-2 max-w-xl text-[var(--text-secondary)]">
            Расширенная аналитика, приоритет в модерации и инструменты для тех, кто выпускает музыку регулярно.
          </p>
        </div>
        <div className="mt-6 flex shrink-0 flex-wrap gap-3 md:mt-0">
          <Link to="/subscriptions">
            <Button>Смотреть планы</Button>
          </Link>
          <Link to="/studio">
            <Button variant="secondary">
              <Link2 className="mr-2 h-4 w-4" />
              Открыть студию
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
