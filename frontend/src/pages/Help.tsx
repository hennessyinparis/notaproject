import { clsx } from 'clsx';
import { ChevronDown, HelpCircle, Mail, MessageCircle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { PageShell } from '../components/layout/PageShell';

type FaqItem = {
  q: string;
  a: string;
};

type FaqSection = {
  id: string;
  title: string;
  items: FaqItem[];
};

const FAQ: FaqSection[] = [
  {
    id: 'start',
    title: 'Начало работы',
    items: [
      {
        q: 'Что такое Нота?',
        a: 'Нота — музыкальный стриминг для слушателей и артистов: можно слушать треки, подписываться на авторов, собирать плейлисты и загружать свою музыку.',
      },
      {
        q: 'Нужна ли регистрация, чтобы слушать?',
        a: 'Просматривать каталог и искать треки можно без входа. Лайки, комментарии, лента подписок, сообщения и загрузка — после регистрации.',
      },
      {
        q: 'На каких устройствах работает?',
        a: 'Сейчас Нота — веб-приложение: откройте сайт в браузере на компьютере или телефоне. Плеер продолжает играть при переходе между страницами.',
      },
    ],
  },
  {
    id: 'account',
    title: 'Аккаунт и подписки',
    items: [
      {
        q: 'Какие тарифы есть?',
        a: 'Бесплатный — с рекламой и базовым качеством. Нота Plus — без рекламы и с офлайн-функциями. Нота Студент — Plus со скидкой. Артист Pro — для загрузки без лимитов и расширенной аналитики.',
      },
      {
        q: 'Как оформить подписку?',
        a: 'Откройте раздел «Подписки» в меню, выберите тариф и нажмите «Оформить». В демо-версии оплата имитируется сразу — подписка активируется на 30 дней.',
      },
      {
        q: 'Как отменить подписку?',
        a: 'В том же разделе «Подписки» нажмите «Отменить подписку». Тариф вернётся к бесплатному, активная подписка в системе будет деактивирована.',
      },
    ],
  },
  {
    id: 'feed',
    title: 'Лента и социальные функции',
    items: [
      {
        q: 'Что показывает лента?',
        a: 'В «Ленте» — новые публичные треки артистов, на которых вы подписаны. Если подписок нет, мы предложим артистов и покажем популярное.',
      },
      {
        q: 'Как подписаться на артиста?',
        a: 'Зайдите в профиль артиста и нажмите «Подписаться». Новые релизы появятся в ленте и в уведомлениях.',
      },
      {
        q: 'Можно ли писать артистам?',
        a: 'Да, в профиле есть «Сообщение» — откроется личный чат. Можно отправлять текст и делиться треками.',
      },
    ],
  },
  {
    id: 'artists',
    title: 'Для артистов',
    items: [
      {
        q: 'Как загрузить трек?',
        a: 'Войдите в аккаунт → «Загрузить». Перетащите MP3/WAV, добавьте название, обложку и жанр. Для альбома переключитесь на режим «Альбом» и загрузите несколько файлов.',
      },
      {
        q: 'Чем плейлист отличается от альбома?',
        a: 'Плейлист — подборка чужих или своих треков. Альбом — отдельный релиз: при загрузке создаётся альбом с обложкой и упорядоченным списком треков.',
      },
      {
        q: 'Где смотреть статистику?',
        a: 'Раздел «Студия» и «Аналитика» (для тарифа Артист Pro) — прослушивания, лайки и динамика по трекам.',
      },
    ],
  },
  {
    id: 'player',
    title: 'Плеер',
    items: [
      {
        q: 'Почему музыка не останавливается при переходе на другую страницу?',
        a: 'В Ноте глобальный плеер внизу экрана — он работает на всём сайте. Остановить можно кнопкой закрытия в плеере.',
      },
      {
        q: 'Как изменить порядок в очереди?',
        a: 'Нажмите иконку очереди в плеере и перетащите треки за ручку слева — порядок воспроизведения обновится.',
      },
      {
        q: 'Что такое волна на странице трека?',
        a: 'Это визуализация звука (waveform). По ней удобно перематывать. Для новых треков волна может подгружаться через несколько минут после загрузки.',
      },
    ],
  },
  {
    id: 'legal',
    title: 'Авторские права',
    items: [
      {
        q: 'Кто отвечает за загруженную музыку?',
        a: 'Каждый пользователь сам несёт ответственность за треки, альбомы и обложки, которые публикует. Платформа не проверяет каждую загрузку заранее.',
      },
      {
        q: 'Где прочитать условия?',
        a: 'Полный текст — в разделах «Пользовательское соглашение» и «Авторские права» (ссылки в подвале сайта и при регистрации).',
      },
      {
        q: 'Что делать правообладателю при нарушении?',
        a: 'Напишите на help@nota.stream с ссылкой на материал и подтверждением прав — мы рассмотрим жалобу и можем скрыть контент.',
      },
    ],
  },
  {
    id: 'tech',
    title: 'Проблемы и поддержка',
    items: [
      {
        q: 'Не загружается обложка или аватар',
        a: 'Используйте JPG или PNG до 10 МБ. Убедитесь, что бэкенд запущен (порт 8000) и в настройках указан правильный адрес API.',
      },
      {
        q: 'Пустая главная или лента',
        a: 'Проверьте, что запущены база данных и сервер. На главной показываются публичные треки; в ленте — только релизы ваших подписок.',
      },
      {
        q: 'Как связаться с поддержкой?',
        a: 'Напишите на help@nota.stream или в сообщения администратору @admin, если он указан в проекте. Мы ответим в течение 1–2 рабочих дней.',
      },
    ],
  },
];

function FaqAccordion({ item, open, onToggle }: { item: FaqItem; open: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-[var(--border)] last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 py-4 text-left transition hover:text-[var(--primary)]"
        aria-expanded={open}
      >
        <span className="font-semibold text-[var(--text-primary)]">{item.q}</span>
        <ChevronDown
          className={clsx('mt-0.5 h-5 w-5 shrink-0 text-[var(--text-muted)] transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open && <p className="pb-4 text-sm leading-relaxed text-[var(--text-secondary)]">{item.a}</p>}
    </div>
  );
}

export function Help() {
  const [openKey, setOpenKey] = useState<string | null>('start-0');

  return (
    <PageShell
      title="Помощь и ответы"
      description="Частые вопросы о Ноте — подписки, загрузка, лента и плеер"
      icon={<HelpCircle className="h-7 w-7 text-[var(--primary)]" strokeWidth={2} aria-hidden />}
    >
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            to="/subscriptions"
            className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)] transition hover:border-[var(--primary)]/30"
          >
            <p className="font-semibold text-[var(--text-primary)]">Тарифы и подписки</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Сравнение планов и оформление</p>
          </Link>
          <Link
            to="/for-artists"
            className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)] transition hover:border-[var(--primary)]/30"
          >
            <p className="font-semibold text-[var(--text-primary)]">Для артистов</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Загрузка, монетизация, студия</p>
          </Link>
          <Link
            to="/legal/copyright"
            className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)] transition hover:border-[var(--primary)]/30"
          >
            <p className="font-semibold text-[var(--text-primary)]">Авторские права</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Ответственность за контент</p>
          </Link>
          <Link
            to="/legal/terms"
            className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)] transition hover:border-[var(--primary)]/30"
          >
            <p className="font-semibold text-[var(--text-primary)]">Соглашение</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Правила использования сервиса</p>
          </Link>
        </div>

        {FAQ.map((section) => (
          <section key={section.id} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-card)]">
            <h2 className="border-b border-[var(--border)] bg-[var(--bg-elevated)]/50 px-5 py-3 font-display text-lg font-semibold text-[var(--text-primary)]">
              {section.title}
            </h2>
            <div className="px-5">
              {section.items.map((item, idx) => {
                const key = `${section.id}-${idx}`;
                return (
                  <FaqAccordion
                    key={key}
                    item={item}
                    open={openKey === key}
                    onToggle={() => setOpenKey((k) => (k === key ? null : key))}
                  />
                );
              })}
            </div>
          </section>
        ))}

        <div className="rounded-2xl border border-[var(--primary)]/25 bg-[var(--primary-light)] p-6 text-center">
          <MessageCircle className="mx-auto h-8 w-8 text-[var(--primary)]" aria-hidden />
          <h3 className="mt-3 font-display text-lg font-semibold text-[var(--text-primary)]">Не нашли ответ?</h3>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Напишите нам — поможем с аккаунтом, загрузкой или воспроизведением
          </p>
          <a
            href="mailto:help@nota.stream"
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white"
          >
            <Mail className="h-4 w-4" />
            help@nota.stream
          </a>
        </div>
      </div>
    </PageShell>
  );
}
