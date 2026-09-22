import { useEffect, useState } from 'react';
import { ROLES, roleLabel } from '../auth/roles';
import type { Employee, GrantAccessInput, UpdateAccessInput } from '../types';
import { KeyIcon, XIcon } from './icons';

interface Props {
  open: boolean;
  employee: Employee | null;
  saving: boolean;
  onClose: () => void;
  onGrant: (employeeId: number, data: GrantAccessInput) => void;
  onUpdate: (employeeId: number, data: UpdateAccessInput) => void;
  onRevoke: (employee: Employee) => void;
}

export function AccessModal({ open, employee, saving, onClose, onGrant, onUpdate, onRevoke }: Props) {
  const access = employee?.access ?? null;
  const isManage = !!access; // employee already has a login

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<string>(ROLES.Employee);
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && employee) {
      const a = employee.access ?? null;
      setError('');
      setUsername(a?.username ?? '');
      setPassword('');
      setRole(a?.role ?? ROLES.Employee);
      setIsActive(a?.isActive ?? true);
    }
  }, [open, employee]);

  if (!open || !employee) return null;

  const submit = () => {
    if (isManage) {
      onUpdate(employee.id, { role, isActive, newPassword: password ? password : null });
    } else {
      if (!username.trim()) return setError('Username is required.');
      if (!password) return setError('Password is required.');
      onGrant(employee.id, { username: username.trim(), password, role, isActive });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3>{isManage ? 'Manage access' : 'Grant access'}</h3>
            <p>{isManage ? `Login settings for ${employee.fullName}.` : `Create a login for ${employee.fullName}.`}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><XIcon /></button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>Username <span className="req">*</span></label>
            <input
              className="input"
              autoFocus={!isManage}
              disabled={isManage}
              placeholder="e.g. sara"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
              name="new-login-username"
              style={isManage ? { opacity: 0.6 } : undefined}
            />
            {isManage && <span style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>Username can’t be changed.</span>}
          </div>

          <div className="field-row">
            <div className="field">
              <label>Role</label>
              <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
                {Object.values(ROLES).map((r) => (
                  <option key={r} value={r}>{roleLabel(r)}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{isManage ? 'New password' : 'Password'} {!isManage && <span className="req">*</span>}</label>
              <input
                className="input"
                type="password"
                placeholder={isManage ? 'Leave blank to keep' : '••••••••'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                name="new-login-password"
              />
            </div>
          </div>

          <div className="field">
            <label>Access status</label>
            <div className={`switch ${isActive ? 'on' : ''}`} onClick={() => setIsActive((v) => !v)} style={{ cursor: 'pointer' }}>
              <div className="switch-track"><div className="knob" /></div>
              <span style={{ fontWeight: 500 }}>{isActive ? 'Can sign in' : 'Sign-in disabled'}</span>
            </div>
          </div>

          {error && <div style={{ color: 'var(--rose)', fontSize: 13 }}>{error}</div>}
        </div>

        <div className="modal-foot" style={{ justifyContent: isManage ? 'space-between' : 'flex-end' }}>
          {isManage && (
            <button className="btn btn-danger" onClick={() => onRevoke(employee)} disabled={saving}>
              Revoke access
            </button>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={submit} disabled={saving}>
              {saving && <span className="spinner" />}
              <KeyIcon />
              {isManage ? 'Save' : 'Grant access'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
