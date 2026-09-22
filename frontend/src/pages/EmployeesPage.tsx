import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { employeesApi } from '../api/employees';
import { useAuth } from '../auth/AuthContext';
import { canManage } from '../auth/roles';
import { Avatar } from '../components/Avatar';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmployeeModal } from '../components/EmployeeModal';
import { EditIcon, PlusIcon, TrashIcon, UsersIcon } from '../components/icons';
import { useToast } from '../components/toast';
import type { LayoutContext } from '../layouts/AppLayout';
import type { Employee, EmployeeInput } from '../types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function EmployeesPage() {
  const { search } = useOutletContext<LayoutContext>();
  const toast = useToast();
  const { user } = useAuth();
  const manage = canManage(user?.role); // can this user add/edit/delete?

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<Employee | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError('');
    employeesApi
      .getAll()
      .then(setEmployees)
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
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
      if (editing) {
        await employeesApi.update(editing.id, data);
        toast('success', 'Employee updated');
      } else {
        await employeesApi.create(data);
        toast('success', 'Employee added');
      }
      setModalOpen(false);
      load();
    } catch (e) {
      toast('error', (e as Error).message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await employeesApi.remove(deleting.id);
      toast('success', 'Employee removed');
      setDeleting(null);
      load();
    } catch (e) {
      toast('error', (e as Error).message || 'Could not delete');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1>Employees</h1>
          <p>Manage the people in your company.</p>
        </div>
        {manage && (
          <button className="btn btn-primary" onClick={openCreate}>
            <PlusIcon /> Add employee
          </button>
        )}
      </div>

      <div className="panel rise">
        <div className="panel-head">
          <div>
            <h3>All employees</h3>
            <div className="sub">
              {loading ? 'Loading…' : `${filtered.length} ${filtered.length === 1 ? 'person' : 'people'}${search ? ' found' : ''}`}
            </div>
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div className="skeleton" style={{ width: 38, height: 38, borderRadius: 11 }} />
                <div className="skeleton" style={{ height: 14, flex: 1, maxWidth: 220 }} />
                <div className="skeleton" style={{ height: 14, width: 120 }} />
                <div className="skeleton" style={{ height: 22, width: 70, borderRadius: 20 }} />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && loadError && (
          <div className="empty-state">
            <div className="empty-illus" style={{ background: 'rgba(251,113,133,0.1)', borderColor: 'rgba(251,113,133,0.25)' }}>
              <UsersIcon style={{ color: 'var(--rose)' }} />
            </div>
            <h4>Couldn’t load employees</h4>
            <p>{loadError}. Make sure the backend API is running.</p>
            <button className="btn btn-ghost" onClick={load}>Try again</button>
          </div>
        )}

        {/* Empty */}
        {!loading && !loadError && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-illus"><UsersIcon /></div>
            <h4>{search ? 'No matches' : 'No employees yet'}</h4>
            <p>{search ? 'Try a different search term.' : 'Add your first employee to get started.'}</p>
            {!search && manage && <button className="btn btn-primary" onClick={openCreate}><PlusIcon /> Add employee</button>}
          </div>
        )}

        {/* Table */}
        {!loading && !loadError && filtered.length > 0 && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Position</th>
                  <th>Status</th>
                  <th>Hired</th>
                  {manage && <th style={{ textAlign: 'right' }}>Actions</th>}
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
                        <span className="dot" />{e.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{formatDate(e.hireDate)}</td>
                    {manage && (
                      <td>
                        <div className="row-actions">
                          <button className="act-btn" onClick={() => openEdit(e)} aria-label="Edit"><EditIcon /></button>
                          <button className="act-btn danger" onClick={() => setDeleting(e)} aria-label="Delete"><TrashIcon /></button>
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

      <ConfirmDialog
        open={!!deleting}
        title="Delete employee?"
        message={`This will permanently remove ${deleting?.fullName}.`}
        busy={deleteBusy}
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
