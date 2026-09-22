import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/LanguageContext';
import { formatBytes } from '../lib/documents';
import type { Project } from '../types';
import { FileIcon, XIcon } from './icons';

interface Props {
  open: boolean;
  projects: Project[];
  saving: boolean;
  onClose: () => void;
  onSave: (form: FormData) => void;
}

export function UploadDocumentModal({ open, projects, saving, onClose, onSave }: Props) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setError('');
      setTitle('');
      setProjectId(projects[0] ? String(projects[0].id) : '');
      setFile(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  }, [open, projects]);

  if (!open) return null;

  const submit = () => {
    if (!title.trim()) return setError(t('docModal.titleRequired'));
    if (!projectId) return setError(t('docModal.projectRequired'));
    if (!file) return setError(t('docModal.fileRequired'));
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') return setError(t('docModal.fileType'));

    const form = new FormData();
    form.append('title', title.trim());
    form.append('projectId', projectId);
    form.append('file', file);
    onSave(form);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3>{t('docModal.title')}</h3>
            <p>{t('docModal.sub')}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}><XIcon /></button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>{t('docModal.docTitle')} <span className="req">*</span></label>
            <input className="input" autoFocus autoComplete="off" placeholder={t('docModal.docTitlePlaceholder')} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="field">
            <label>{t('docModal.project')} <span className="req">*</span></label>
            {projects.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{t('docModal.noProjects')}</div>
            ) : (
              <select className="select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
              </select>
            )}
          </div>

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

          {error && <div style={{ color: 'var(--rose)', fontSize: 13 }}>{error}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving || projects.length === 0}>
            {saving && <span className="spinner" />}
            {t('docModal.upload')}
          </button>
        </div>
      </div>
    </div>
  );
}
