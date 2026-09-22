import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/LanguageContext';
import { PROJECT_STATUSES } from '../lib/projects';
import type { Project, ProjectInput } from '../types';
import { XIcon } from './icons';

interface Props {
  open: boolean;
  initial: Project | null; // null = create
  saving: boolean;
  onClose: () => void;
  onSave: (data: ProjectInput) => void;
}

interface FormState {
  name: string;
  code: string;
  status: string;
  description: string;
}

const empty: FormState = { name: '', code: '', status: 'Active', description: '' };

export function ProjectModal({ open, initial, saving, onClose, onSave }: Props) {
  const { t } = useI18n();
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setError('');
      setForm(
        initial
          ? { name: initial.name, code: initial.code, status: initial.status, description: initial.description ?? '' }
          : empty,
      );
    }
  }, [open, initial]);

  if (!open) return null;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.name.trim()) return setError(t('projectModal.nameRequired'));
    if (!form.code.trim()) return setError(t('projectModal.codeRequired'));

    onSave({
      name: form.name.trim(),
      code: form.code.trim(),
      status: form.status,
      description: form.description.trim() || null,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3>{initial ? t('projectModal.editTitle') : t('projectModal.newTitle')}</h3>
            <p>{initial ? t('projectModal.editSub') : t('projectModal.newSub')}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}><XIcon /></button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>{t('projectModal.name')} <span className="req">*</span></label>
            <input className="input" autoFocus autoComplete="off" placeholder={t('projectModal.namePlaceholder')} value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>

          <div className="field-row">
            <div className="field">
              <label>{t('projectModal.code')} <span className="req">*</span></label>
              <input className="input" autoComplete="off" placeholder={t('projectModal.codePlaceholder')} value={form.code} onChange={(e) => set('code', e.target.value)} />
            </div>
            <div className="field">
              <label>{t('projectModal.status')}</label>
              <select className="select" value={form.status} onChange={(e) => set('status', e.target.value)}>
                {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{t(`project.status.${s}`)}</option>)}
              </select>
            </div>
          </div>

          <div className="field">
            <label>{t('projectModal.description')}</label>
            <textarea className="input" rows={3} placeholder={t('projectModal.descriptionPlaceholder')} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>

          {error && <div style={{ color: 'var(--rose)', fontSize: 13 }}>{error}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving && <span className="spinner" />}
            {initial ? t('common.saveChanges') : t('projectModal.create')}
          </button>
        </div>
      </div>
    </div>
  );
}
