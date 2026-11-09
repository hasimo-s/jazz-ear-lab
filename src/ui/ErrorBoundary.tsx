import { Component, type ReactNode } from 'react';
import { t } from '../i18n';

/** 予期しないエラーで白い画面にならないよう、再読み込みの導線を出す */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[ui] uncaught error', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-lg font-bold">{t('error.title')}</p>
        <p className="text-sm text-ink-300">{t('error.body')}</p>
        <button type="button" className="min-h-12 rounded-xl bg-brass-500 px-6 font-bold text-ink-950" onClick={() => window.location.reload()}>
          {t('error.reload')}
        </button>
        <p className="break-all text-xs text-ink-500">{this.state.error.message}</p>
      </div>
    );
  }
}
