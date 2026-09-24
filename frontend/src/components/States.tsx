import type { ReactNode } from 'react';
import { useI18n } from '../i18n/LanguageContext';

/** Grey placeholder rows shown inside a table panel while its list loads. */
export function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="table-skeleton" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i}>
          <div className="skeleton sk-avatar" />
          <div className="skeleton sk-line" />
          <div className="skeleton sk-pill" />
        </div>
      ))}
    </div>
  );
}

interface LoadErrorProps {
  icon: ReactNode; // the page's own icon, shown in red
  title: string; // e.g. "Couldn't load suppliers"
  error: string;
  onRetry: () => void;
  hint?: boolean; // add "Is the backend running?" (default: yes)
}

/** "Couldn't load …" with a Try again button — the same on every page. */
export function LoadError({ icon, title, error, onRetry, hint = true }: LoadErrorProps) {
  const { t } = useI18n();
  return (
    <div className="empty-state" role="alert">
      <div className="empty-illus danger">{icon}</div>
      <h4>{title}</h4>
      <p>{hint ? `${error}. ${t('common.backendHint')}` : error}</p>
      <button className="btn btn-ghost" onClick={onRetry}>{t('common.tryAgain')}</button>
    </div>
  );
}
