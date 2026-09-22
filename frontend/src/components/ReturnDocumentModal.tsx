import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/LanguageContext';
import type { ApprovalDocument } from '../types';
import { XIcon } from './icons';

interface Props {
  open: boolean;
  doc: ApprovalDocument | null;
  saving: boolean;
  onClose: () => void;
  onSave: (note: string) => void;
}

export function ReturnDocumentModal({ open, doc, saving, onClose, onSave }: Props) {
  const { t } = useI18n();
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setNote(''); setError(''); }
  }, [open]);

  if (!open) return null;

  const submit = () => {
    if (!note.trim()) return setError(t('docReview.noteRequired'));
    onSave(note.trim());
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3>{t('docReview.returnTitle')}</h3>
            <p>{t('docReview.returnSub', { title: doc?.title ?? '' })}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}><XIcon /></button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>{t('docReview.note')} <span className="req">*</span></label>
            <textarea className="input" rows={4} autoFocus placeholder={t('docReview.notePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="field-hint">{t('docReview.noteHint')}</div>
          </div>
          {error && <div style={{ color: 'var(--rose)', fontSize: 13 }}>{error}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving && <span className="spinner" />}
            {t('docReview.returnAction')}
          </button>
        </div>
      </div>
    </div>
  );
}
