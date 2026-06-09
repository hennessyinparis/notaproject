import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode; fallbackTitle?: string };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto max-w-lg rounded-2xl border-2 border-[var(--error)] bg-[var(--bg-elevated)] p-8 text-center shadow-[var(--shadow-card)]">
          <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
            {this.props.fallbackTitle ?? 'Что-то пошло не так'}
          </h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Обновите страницу. Если ошибка повторяется — напишите в поддержку.
          </p>
          {this.state.error?.message ? (
            <pre className="mt-4 max-h-48 overflow-auto rounded-lg bg-[var(--bg-surface)] p-3 text-left text-xs text-[var(--error)]">
              {this.state.error.message}
            </pre>
          ) : null}
          <button
            type="button"
            className="mt-4 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white"
            onClick={() => window.location.reload()}
          >
            Обновить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
