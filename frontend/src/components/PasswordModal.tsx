import { useState, type FormEvent } from 'react';
import { authApi } from '../api/auth';
import { useI18n } from '../i18n/LanguageContext';
import { KeyIcon, XIcon } from './icons';
import { useToast } from './toast';

const MIN_PASSWORD = 8; // same rule as the API (AuthController)

// Change your own password. Rendered only while open, so it always starts empty.
export function PasswordModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!current) return setError(t('pw.currentRequired'));
    if (next.length < MIN_PASSWORD) return setError(t('pw.tooShort', { n: MIN_PASSWORD }));
    if (next !== again) return setError(t('pw.mismatch'));
    if (next === current) return setError(t('pw.sameAsOld'));
    setError('');
    setSaving(true);
    try {
      await authApi.changePassword(current, next);
      toast('success', t('pw.saved'));
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="modal-head with-close">
          <div>
            <h3>{t('pw.title')}</h3>
            <p>{t('pw.sub')}</p>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('common.close')}><XIcon /></button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>{t('pw.current')} <span className="req">*</span></label>
            <input className="input" type="password" autoFocus autoComplete="current-password"
              value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="field-row">
            <div className="field">
              <label>{t('pw.new')} <span className="req">*</span></label>
              <input className="input" type="password" autoComplete="new-password"
                value={next} onChange={(e) => setNext(e.target.value)} />
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-dim)' }}>{t('pw.hint', { n: MIN_PASSWORD })}</span>
            </div>
            <div className="field">
              <label>{t('pw.confirm')} <span className="req">*</span></label>
              <input className="input" type="password" autoComplete="new-password"
                value={again} onChange={(e) => setAgain(e.target.value)} />
            </div>
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>{t('common.cancel')}</button>
          <button className="btn btn-primary" disabled={saving}>
            {saving && <span className="spinner" />}
            <KeyIcon />
            {t('common.save')}
          </button>
        </div>
      </form>
    </div>
  );
}
