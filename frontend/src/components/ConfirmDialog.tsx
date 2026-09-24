import type { ReactNode } from 'react';
import { useI18n } from '../i18n/LanguageContext';
import { TrashIcon } from './icons';

interface Props {
  open: boolean;
  title: string;
  message: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string; // what the button does, e.g. "Undo movement" (default: "Delete")
  icon?: ReactNode; // matches the action (default: a bin)
}

export function ConfirmDialog({ open, title, message, busy, onCancel, onConfirm, confirmLabel, icon }: Props) {
  const { t } = useI18n();
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-label={title}>
        <div className="modal-body" style={{ alignItems: 'center', textAlign: 'center', paddingTop: 32 }}>
          <div className="empty-illus danger confirm-illus">
            {icon ?? <TrashIcon />}
          </div>
          <div>
            <h3 style={{ fontSize: 'var(--fs-xl)', marginBottom: 8 }}>{title}</h3>
            <p style={{ color: 'var(--text-muted)' }}>{message}</p>
          </div>
        </div>
        <div className="modal-foot" style={{ justifyContent: 'center' }}>
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy} autoFocus>{t('common.cancel')}</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy && <span className="spinner" style={{ borderTopColor: 'var(--rose)' }} />}
            {confirmLabel ?? t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
