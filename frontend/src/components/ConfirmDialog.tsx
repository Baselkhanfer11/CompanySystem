import { useI18n } from '../i18n/LanguageContext';
import { TrashIcon } from './icons';

interface Props {
  open: boolean;
  title: string;
  message: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({ open, title, message, busy, onCancel, onConfirm }: Props) {
  const { t } = useI18n();
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-body" style={{ alignItems: 'center', textAlign: 'center', paddingTop: 30 }}>
          <div className="empty-illus" style={{ margin: 0, background: 'rgba(251,113,133,0.1)', borderColor: 'rgba(251,113,133,0.25)' }}>
            <TrashIcon style={{ color: 'var(--rose)' }} />
          </div>
          <div>
            <h3 style={{ fontSize: 18, marginBottom: 6 }}>{title}</h3>
            <p style={{ color: 'var(--text-muted)' }}>{message}</p>
          </div>
        </div>
        <div className="modal-foot" style={{ justifyContent: 'center' }}>
          <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>{t('common.cancel')}</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy && <span className="spinner" style={{ borderTopColor: 'var(--rose)' }} />}
            {t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
