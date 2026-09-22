import { useEffect, useState } from 'react';
import type { Employee, EmployeeInput } from '../types';
import { XIcon } from './icons';

interface Props {
  open: boolean;
  initial: Employee | null; // null = create mode
  saving: boolean;
  onClose: () => void;
  onSave: (data: EmployeeInput) => void;
}

const empty: EmployeeInput = { fullName: '', email: '', position: '', isActive: true };

export function EmployeeModal({ open, initial, saving, onClose, onSave }: Props) {
  const [form, setForm] = useState<EmployeeInput>(empty);
  const [error, setError] = useState('');

  // Reset the form whenever the modal opens (with the employee being edited, or blank).
  useEffect(() => {
    if (open) {
      setError('');
      setForm(
        initial
          ? {
              fullName: initial.fullName,
              email: initial.email ?? '',
              position: initial.position ?? '',
              isActive: initial.isActive,
            }
          : empty,
      );
    }
  }, [open, initial]);

  if (!open) return null;

  const set = <K extends keyof EmployeeInput>(k: K, v: EmployeeInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.fullName.trim()) {
      setError('Full name is required.');
      return;
    }
    onSave({ ...form, fullName: form.fullName.trim() });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3>{initial ? 'Edit employee' : 'New employee'}</h3>
            <p>{initial ? 'Update the details below.' : 'Add a new person to your company.'}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><XIcon /></button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>Full name <span className="req">*</span></label>
            <input
              className="input"
              autoFocus
              placeholder="e.g. Sara Ahmad"
              value={form.fullName}
              onChange={(e) => set('fullName', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label>Email</label>
              <input
                className="input"
                placeholder="name@company.com"
                value={form.email ?? ''}
                onChange={(e) => set('email', e.target.value)}
              />
            </div>
            <div className="field">
              <label>Position</label>
              <input
                className="input"
                placeholder="e.g. Warehouse Manager"
                value={form.position ?? ''}
                onChange={(e) => set('position', e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label>Status</label>
            <div
              className={`switch ${form.isActive ? 'on' : ''}`}
              onClick={() => set('isActive', !form.isActive)}
              style={{ cursor: 'pointer' }}
            >
              <div className="switch-track"><div className="knob" /></div>
              <span style={{ fontWeight: 500 }}>{form.isActive ? 'Active' : 'Inactive'}</span>
            </div>
          </div>

          {error && <div style={{ color: 'var(--rose)', fontSize: 13 }}>{error}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving && <span className="spinner" />}
            {initial ? 'Save changes' : 'Create employee'}
          </button>
        </div>
      </div>
    </div>
  );
}
