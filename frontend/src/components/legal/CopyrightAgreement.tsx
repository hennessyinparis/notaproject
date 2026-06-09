import { Link } from 'react-router-dom';

type Variant = 'register' | 'upload';

type Props = {
  variant: Variant;
  acceptTerms: boolean;
  acceptCopyright: boolean;
  onAcceptTerms: (v: boolean) => void;
  onAcceptCopyright: (v: boolean) => void;
};

export function CopyrightAgreement({
  variant,
  acceptTerms,
  acceptCopyright,
  onAcceptTerms,
  onAcceptCopyright,
}: Props) {
  if (variant === 'upload') {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/80 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          Авторские права
        </p>
        <label className="mt-3 flex cursor-pointer gap-3 text-sm leading-relaxed text-[var(--text-secondary)]">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)]"
            checked={acceptCopyright}
            onChange={(e) => onAcceptCopyright(e.target.checked)}
          />
          <span>
            Подтверждаю, что обладаю правами на загружаемый контент (или имею разрешение правообладателя),
            материал не нарушает закон и права третьих лиц, и я несу полную ответственность за публикацию.
            Ознакомлен(а) с{' '}
            <Link to="/legal/copyright" target="_blank" className="font-semibold text-[var(--primary)] hover:underline">
              политикой авторских прав
            </Link>
            .
          </span>
        </label>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Соглашения
      </p>
      <label className="flex cursor-pointer gap-3 text-sm leading-relaxed text-[var(--text-secondary)]">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)]"
          checked={acceptTerms}
          onChange={(e) => onAcceptTerms(e.target.checked)}
        />
        <span>
          Принимаю{' '}
          <Link to="/legal/terms" target="_blank" className="font-semibold text-[var(--primary)] hover:underline">
            пользовательское соглашение
          </Link>{' '}
          платформы «Нота».
        </span>
      </label>
      <label className="flex cursor-pointer gap-3 text-sm leading-relaxed text-[var(--text-secondary)]">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)]"
          checked={acceptCopyright}
          onChange={(e) => onAcceptCopyright(e.target.checked)}
        />
        <span>
          Понимаю, что каждый пользователь сам отвечает за свой контент, и согласен(на) с{' '}
          <Link to="/legal/copyright" target="_blank" className="font-semibold text-[var(--primary)] hover:underline">
            политикой авторских прав
          </Link>
          .
        </span>
      </label>
    </div>
  );
}
