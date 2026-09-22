import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { employeesApi } from '../api/employees';
import { useAuth } from '../auth/AuthContext';
import { canManage, isAdmin } from '../auth/roles';
import { AccessModal } from '../components/AccessModal';
import { Avatar } from '../components/Avatar';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmployeeModal } from '../components/EmployeeModal';
import { EditIcon, KeyIcon, PlusIcon, TrashIcon, UsersIcon } from '../components/icons';
import { RoleBadge } from '../components/RoleBadge';
import { useToast } from '../components/toast';
import { useI18n } from '../i18n/LanguageContext';
import { formatDate } from '../lib/format';
import type { LayoutContext } from '../layouts/AppLayout';
import type { Employee, EmployeeInput, GrantAccessInput, UpdateAccessInput } from '../types';

export function EmployeesPage() {
  const { search } = useOutletContext<LayoutContext>();
  const toast = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const manage = canManage(user?.role); // add/edit/delete employees
  const admin = isAdmin(user?.role);     // manage login access

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Employee add/edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete employee
  const [deleting, setDeleting] = useState<Employee | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Access management
  const [accessEmployee, setAccessEmployee] = useState<Employee | null>(null);
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessSaving, setAccessSaving] = useState(false);
  const [revoking, setRevoking] = useState<Employee | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError('');
    employeesApi.getAll().then(setEmployees).catch((e) => setLoadError(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      [e.fullName, e.email, e.position].filter(Boolean).some((v) => v!.toLowerCase().includes(q)),
    );
  }, [employees, search]);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (e: Employee) => { setEditing(e); setModalOpen(true); };

  const handleSave = async (data: EmployeeInput) => {
    setSaving(true);
    try {
      if (editing) { await employeesApi.update(editing.id, data); toast('success', t('emp.updated')); }
      else { await employeesApi.create(data); toast('success', t('emp.added')); }
      setModalOpen(false);
      load();
    } catch (e) { toast('error', (e as Error).message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await employeesApi.remove(deleting.id);
      toast('success', t('emp.removed'));
      setDeleting(null);
      load();
    } catch (e) { toast('error', (e as Error).message); }
    finally { setDeleteBusy(false); }
  };

  const openAccess = (e: Employee) => { setAccessEmployee(e); setAccessOpen(true); };

  const handleGrant = async (employeeId: number, data: GrantAccessInput) => {
    setAccessSaving(true);
    try { await employeesApi.grantAccess(employeeId, data); toast('success', t('access.granted')); setAccessOpen(false); load(); }
    catch (e) { toast('error', (e as Error).message); }
    finally { setAccessSaving(false); }
  };

  const handleUpdateAccess = async (employeeId: number, data: UpdateAccessInput) => {
    setAccessSaving(true);
    try { await employeesApi.updateAccess(employeeId, data); toast('success', t('access.updated')); setAccessOpen(false); load(); }
    catch (e) { toast('error', (e as Error).message); }
    finally { setAccessSaving(false); }
  };

  const confirmRevoke = async () => {
    if (!revoking) return;
    setRevokeBusy(true);
    try { await employeesApi.revokeAccess(revoking.id); toast('success', t('access.revoked')); setRevoking(null); load(); }
    catch (e) { toast('error', (e as Error).message); }
    finally { setRevokeBusy(false); }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1>{t('emp.title')}</h1>
          <p>{t('emp.sub')}</p>
        </div>
        {manage && (
          <button className="btn btn-primary" onClick={openCreate}>
            <PlusIcon /> {t('emp.add')}
          </button>
        )}
      </div>

      <div className="panel rise">
        <div className="panel-head">
          <div>
            <h3>{t('emp.all')}</h3>
            <div className="sub">
              {loading
                ? t('common.loading')
                : `${filtered.length === 1 ? t('emp.countOne', { n: filtered.length }) : t('emp.countMany', { n: filtered.length })}${search ? ' ' + t('common.found') : ''}`}
            </div>
          </div>
        </div>

        {loading && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div className="skeleton" style={{ width: 38, height: 38, borderRadius: 11 }} />
                <div className="skeleton" style={{ height: 14, flex: 1, maxWidth: 220 }} />
                <div className="skeleton" style={{ height: 22, width: 80, borderRadius: 20 }} />
              </div>
            ))}
          </div>
        )}

        {!loading && loadError && (
          <div className="empty-state">
            <div className="empty-illus" style={{ background: 'rgba(251,113,133,0.1)', borderColor: 'rgba(251,113,133,0.25)' }}>
              <UsersIcon style={{ color: 'var(--rose)' }} />
            </div>
            <h4>{t('emp.couldntLoad')}</h4>
            <p>{loadError}. {t('common.backendHint')}</p>
            <button className="btn btn-ghost" onClick={load}>{t('common.tryAgain')}</button>
          </div>
        )}

        {!loading && !loadError && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-illus"><UsersIcon /></div>
            <h4>{search ? t('common.noMatches') : t('emp.noneTitle')}</h4>
            <p>{search ? t('common.differentSearch') : t('emp.addFirst')}</p>
            {!search && manage && <button className="btn btn-primary" onClick={openCreate}><PlusIcon /> {t('emp.add')}</button>}
          </div>
        )}

        {!loading && !loadError && filtered.length > 0 && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t('emp.colEmployee')}</th>
                  <th>{t('emp.colPosition')}</th>
                  <th>{t('emp.colStatus')}</th>
                  {admin && <th>{t('emp.colAccess')}</th>}
                  <th>{t('emp.colHired')}</th>
                  {manage && <th style={{ textAlign: 'end' }}>{t('emp.colActions')}</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <div className="cell-user">
                        <Avatar name={e.fullName} />
                        <div>
                          <div className="name">{e.fullName}</div>
                          <div className="email">{e.email || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td>{e.position || <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
                    <td>
                      <span className={`badge ${e.isActive ? 'active' : 'inactive'}`}>
                        <span className="dot" />{e.isActive ? t('common.active') : t('common.inactive')}
                      </span>
                    </td>
                    {admin && (
                      <td>
                        <button className="access-cell" onClick={() => openAccess(e)} title={t('emp.manageAccessTitle')}>
                          {e.access ? (
                            <span style={{ opacity: e.access.isActive ? 1 : 0.55 }}>
                              <RoleBadge role={e.access.role} />
                            </span>
                          ) : (
                            <span className="grant-hint"><KeyIcon /> {t('emp.grantAccess')}</span>
                          )}
                        </button>
                      </td>
                    )}
                    <td style={{ color: 'var(--text-muted)' }}>{formatDate(e.hireDate)}</td>
                    {manage && (
                      <td>
                        <div className="row-actions">
                          <button className="act-btn" onClick={() => openEdit(e)} aria-label={t('common.edit')}><EditIcon /></button>
                          <button className="act-btn danger" onClick={() => setDeleting(e)} aria-label={t('common.delete')}><TrashIcon /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <EmployeeModal
        open={modalOpen}
        initial={editing}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />

      <AccessModal
        open={accessOpen}
        employee={accessEmployee}
        saving={accessSaving}
        onClose={() => setAccessOpen(false)}
        onGrant={handleGrant}
        onUpdate={handleUpdateAccess}
        onRevoke={(emp) => { setAccessOpen(false); setRevoking(emp); }}
      />

      <ConfirmDialog
        open={!!deleting}
        title={t('emp.deleteQ')}
        message={t('emp.deleteMsg', {
          name: deleting?.fullName ?? '',
          login: deleting?.access ? t('emp.deleteLoginPart') : '',
        })}
        busy={deleteBusy}
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={!!revoking}
        title={t('emp.revokeQ')}
        message={t('emp.revokeMsg', { name: revoking?.fullName ?? '' })}
        busy={revokeBusy}
        onCancel={() => setRevoking(null)}
        onConfirm={confirmRevoke}
      />
    </div>
  );
}
