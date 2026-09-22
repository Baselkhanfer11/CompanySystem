import { useEffect, useState } from 'react';
import { ROLES, roleLabel } from '../auth/roles';
import type { CreateUserInput, UpdateUserInput, User } from '../types';
import { XIcon } from './icons';

interface Props {
  open: boolean;
  initial: User | null; // null = create mode
  saving: boolean;
  onClose: () => void;
  onCreate: (data: CreateUserInput) => void;
  onUpdate: (id: number, data: UpdateUserInput) => void;
}

interface FormState {
  username: string;
  fullName: string;
  password: string;
  role: string;
  isActive: boolean;
}

const empty: FormState = {
  username: '', fullName: '', password: '', role: ROLES.Employee, isActive: true,
};

export function UserModal({ open, initial, saving, onClose, onCreate, onUpdate }: Props) {
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setError('');
      setForm(
        initial
          ? { username: initial.username, fullName: initial.fullName, password: '', role: initial.role, isActive: initial.isActive }
          : empty,
      );
    }
  }, [open, initial]);

  if (!open) return null;
  const isEdit = !!initial;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!isEdit && !form.username.trim()) return setError('Username is required.');
    if (!form.fullName.trim()) return setError('Full name is required.');
    if (!isEdit && !form.password) return setError('Password is required.');

    if (isEdit) {
      onUpdate(initial!.id, {
        fullName: form.fullName.trim(),
        role: form.role,
        isActive: form.isActive,
        newPassword: form.password ? form.password : null,
      });
    } else {
      onCreate({
        username: form.username.trim(),
        fullName: form.fullName.trim(),
        password: form.password,
        role: form.role,
        isActive: form.isActive,
      });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3>{isEdit ? 'Edit user' : 'New user'}</h3>
            <p>{isEdit ? 'Update this account.' : 'Create a login account with a role.'}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><XIcon /></button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>Username <span className="req">*</span></label>
            <input
              className="input"
              autoFocus={!isEdit}
              disabled={isEdit}
              placeholder="e.g. sara"
              value={form.username}
              onChange={(e) => set('username', e.target.value)}
              style={isEdit ? { opacity: 0.6 } : undefined}
            />
            {isEdit && <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>Username can’t be changed.</span>}
          </div>

          <div className="field">
            <label>Full name <span className="req">*</span></label>
            <input
              className="input"
              placeholder="e.g. Sara Ahmad"
              value={form.fullName}
              onChange={(e) => set('fullName', e.target.value)}
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label>Role</label>
              <select className="select" value={form.role} onChange={(e) => set('role', e.target.value)}>
                {Object.values(ROLES).map((r) => (
                  <option key={r} value={r}>{roleLabel(r)}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{isEdit ? 'New password' : 'Password'} {!isEdit && <span className="req">*</span>}</label>
              <input
                className="input"
                type="password"
                placeholder={isEdit ? 'Leave blank to keep' : '••••••••'}
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <label>Status</label>
            <div className={`switch ${form.isActive ? 'on' : ''}`} onClick={() => set('isActive', !form.isActive)} style={{ cursor: 'pointer' }}>
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
            {isEdit ? 'Save changes' : 'Create user'}
          </button>
        </div>
      </div>
    </div>
  );
}
