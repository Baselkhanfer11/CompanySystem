import { useState } from 'react';
import { useDialog } from '../lib/useDialog';
import { useI18n } from '../i18n/LanguageContext';
import { CUSTOMER_STATUSES } from '../lib/customers';
import type { Customer, CustomerInput } from '../types';
import { XIcon } from './icons';

interface Props {
  open: boolean;
  initial: Customer | null; // null = create
  saving: boolean;
  onClose: () => void;
  onSave: (data: CustomerInput) => void;
}

interface FormState {
  name: string;
  code: string;
  status: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

const empty: FormState = {
  name: '', code: '', status: 'Active',
  contactPerson: '', phone: '', email: '', address: '', notes: '',
};

// Rendered only while open, and fresh each time, so the form always starts
// from the record being edited (or blank).
export function CustomerModal(props: Props) {
  if (!props.open) return null;
  return <CustomerForm key={props.initial?.id ?? 'new'} {...props} />;
}

function CustomerForm({ initial, saving, onClose, onSave }: Props) {
  const dialog = useDialog(onClose);
  const { t } = useI18n();
  const [form, setForm] = useState<FormState>(() =>
    initial
      ? {
          name: initial.name,
          code: initial.code,
          status: initial.status,
          contactPerson: initial.contactPerson ?? '',
          phone: initial.phone ?? '',
          email: initial.email ?? '',
          address: initial.address ?? '',
          notes: initial.notes ?? '',
        }
      : empty,
  );
  const [error, setError] = useState('');

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (saving) return;
    if (!form.name.trim()) return setError(t('customerModal.nameRequired'));
    if (!form.code.trim()) return setError(t('customerModal.codeRequired'));

    onSave({
      name: form.name.trim(),
      code: form.code.trim(),
      status: form.status,
      contactPerson: form.contactPerson.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" ref={dialog} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head with-close">
          <div>
            <h3>{initial ? t('customerModal.editTitle') : t('customerModal.newTitle')}</h3>
            <p>{initial ? t('customerModal.editSub') : t('customerModal.newSub')}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}><XIcon /></button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>{t('customerModal.name')} <span className="req">*</span></label>
            <input className="input" autoFocus autoComplete="off" placeholder={t('customerModal.namePlaceholder')} value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>

          <div className="field-row">
            <div className="field">
              <label>{t('customerModal.code')} <span className="req">*</span></label>
              <input className="input" autoComplete="off" placeholder={t('customerModal.codePlaceholder')} value={form.code} onChange={(e) => set('code', e.target.value)} />
            </div>
            <div className="field">
              <label>{t('customerModal.status')}</label>
              <select className="select" value={form.status} onChange={(e) => set('status', e.target.value)}>
                {CUSTOMER_STATUSES.map((s) => <option key={s} value={s}>{t(`customer.status.${s}`)}</option>)}
              </select>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>{t('customerModal.contactPerson')}</label>
              <input className="input" autoComplete="off" placeholder={t('customerModal.contactPlaceholder')} value={form.contactPerson} onChange={(e) => set('contactPerson', e.target.value)} />
            </div>
            <div className="field">
              <label>{t('customerModal.phone')}</label>
              <input className="input" autoComplete="off" placeholder={t('customerModal.phonePlaceholder')} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>{t('customerModal.email')}</label>
            <input className="input" autoComplete="off" placeholder={t('customerModal.emailPlaceholder')} value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>

          <div className="field">
            <label>{t('customerModal.address')}</label>
            <input className="input" autoComplete="off" placeholder={t('customerModal.addressPlaceholder')} value={form.address} onChange={(e) => set('address', e.target.value)} />
          </div>

          <div className="field">
            <label>{t('customerModal.notes')}</label>
            <textarea className="input" rows={2} placeholder={t('customerModal.notesPlaceholder')} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving && <span className="spinner" />}
            {initial ? t('common.saveChanges') : t('customerModal.create')}
          </button>
        </div>
      </div>
    </div>
  );
}
