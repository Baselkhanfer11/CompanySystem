import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/LanguageContext';
import { formatBytes } from '../lib/documents';
import type { ApprovalDocument } from '../types';
import { FileIcon, XIcon } from './icons';

interface Props {
  open: boolean;
  doc: ApprovalDocument | null;
  saving: boolean;
  onClose: () => void;
  onSave: (form: FormData) => void;
}

export function ResubmitDocumentModal({ open, doc, saving, onClose, onSave }: Props) {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setFile(null);
      setError('');
      if (fileInput.current) fileInput.current.value = '';
    }
  }, [open]);

  if (!open) return null;

  const submit = () => {
    if (!file) return setError(t('docModal.fileRequired'));
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') return setError(t('docModal.fileType'));

    const form = new FormData();
    form.append('file', file);
    onSave(form);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head with-close">
          <div>
            <h3>{t('docReview.resubmitTitle')}</h3>
            <p>{t('docReview.resubmitSub', { title: doc?.title ?? '' })}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}><XIcon /></button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>{t('docModal.file')} <span className="req">*</span></label>
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <button type="button" className="file-drop" onClick={() => fileInput.current?.click()}>
              <FileIcon />
              {file
                ? <span><strong>{file.name}</strong><span className="file-size"> · {formatBytes(file.size)}</span></span>
                : <span>{t('docModal.choose')}</span>}
            </button>
            <div className="field-hint">{t('docModal.fileHint')}</div>
          </div>
          {error && <div className="form-error" role="alert">{error}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving && <span className="spinner" />}
            {t('docReview.resubmitAction')}
          </button>
        </div>
      </div>
    </div>
  );
}
