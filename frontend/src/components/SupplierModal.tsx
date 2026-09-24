import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/LanguageContext';
import { SUPPLIER_STATUSES } from '../lib/suppliers';
import type { Supplier, SupplierInput } from '../types';
import { XIcon } from './icons';

interface Props {
  open: boolean;
  initial: Supplier | null; // null = create
  saving: boolean;
  onClose: () => void;
  onSave: (data: SupplierInput) => void;
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

export function SupplierModal({ open, initial, saving, onClose, onSave }: Props) {
  const { t } = useI18n();
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setError('');
      setForm(
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
    }
  }, [open, initial]);

  if (!open) return null;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.name.trim()) return setError(t('supplierModal.nameRequired'));
    if (!form.code.trim()) return setError(t('supplierModal.codeRequired'));

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
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head with-close">
          <div>
            <h3>{initial ? t('supplierModal.editTitle') : t('supplierModal.newTitle')}</h3>
            <p>{initial ? t('supplierModal.editSub') : t('supplierModal.newSub')}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}><XIcon /></button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>{t('supplierModal.name')} <span className="req">*</span></label>
            <input className="input" autoFocus autoComplete="off" placeholder={t('supplierModal.namePlaceholder')} value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>

          <div className="field-row">
            <div className="field">
              <label>{t('supplierModal.code')} <span className="req">*</span></label>
              <input className="input" autoComplete="off" placeholder={t('supplierModal.codePlaceholder')} value={form.code} onChange={(e) => set('code', e.target.value)} />
            </div>
            <div className="field">
              <label>{t('supplierModal.status')}</label>
              <select className="select" value={form.status} onChange={(e) => set('status', e.target.value)}>
                {SUPPLIER_STATUSES.map((s) => <option key={s} value={s}>{t(`supplier.status.${s}`)}</option>)}
              </select>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>{t('supplierModal.contactPerson')}</label>
              <input className="input" autoComplete="off" placeholder={t('supplierModal.contactPlaceholder')} value={form.contactPerson} onChange={(e) => set('contactPerson', e.target.value)} />
            </div>
            <div className="field">
              <label>{t('supplierModal.phone')}</label>
              <input className="input" autoComplete="off" placeholder={t('supplierModal.phonePlaceholder')} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>{t('supplierModal.email')}</label>
            <input className="input" autoComplete="off" placeholder={t('supplierModal.emailPlaceholder')} value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>

          <div className="field">
            <label>{t('supplierModal.address')}</label>
            <input className="input" autoComplete="off" placeholder={t('supplierModal.addressPlaceholder')} value={form.address} onChange={(e) => set('address', e.target.value)} />
          </div>

          <div className="field">
            <label>{t('supplierModal.notes')}</label>
            <textarea className="input" rows={2} placeholder={t('supplierModal.notesPlaceholder')} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>{t('common.cancel')}</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving && <span className="spinner" />}
            {initial ? t('common.saveChanges') : t('supplierModal.create')}
          </button>
        </div>
      </div>
    </div>
  );
}
