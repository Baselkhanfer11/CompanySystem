import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { usersApi } from '../api/users';
import { useAuth } from '../auth/AuthContext';
import { isAdmin } from '../auth/roles';
import { Avatar } from '../components/Avatar';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EditIcon, PlusIcon, ShieldIcon, TrashIcon } from '../components/icons';
import { RoleBadge } from '../components/RoleBadge';
import { UserModal } from '../components/UserModal';
import { useToast } from '../components/toast';
import type { LayoutContext } from '../layouts/AppLayout';
import type { CreateUserInput, UpdateUserInput, User } from '../types';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });

export function UsersPage() {
  const { search } = useOutletContext<LayoutContext>();
  const toast = useToast();
  const { user: me } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<User | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError('');
    usersApi.getAll().then(setUsers).catch((e) => setLoadError(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => [u.fullName, u.username, u.role].some((v) => v.toLowerCase().includes(q)));
  }, [users, search]);

  // Defensive: this page is admin-only (backend enforces it too).
  if (!isAdmin(me?.role)) {
    return (
      <div className="empty-state" style={{ paddingTop: 100 }}>
        <div className="empty-illus"><ShieldIcon /></div>
        <h4>Admins only</h4>
        <p>You don’t have permission to manage users.</p>
      </div>
    );
  }

  const handleCreate = async (data: CreateUserInput) => {
    setSaving(true);
    try {
      await usersApi.create(data);
      toast('success', 'User created');
      setModalOpen(false);
      load();
    } catch (e) { toast('error', (e as Error).message); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (id: number, data: UpdateUserInput) => {
    setSaving(true);
    try {
      await usersApi.update(id, data);
      toast('success', 'User updated');
      setModalOpen(false);
      load();
    } catch (e) { toast('error', (e as Error).message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await usersApi.remove(deleting.id);
      toast('success', 'User removed');
      setDeleting(null);
      load();
    } catch (e) { toast('error', (e as Error).message); }
    finally { setDeleteBusy(false); }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1>Users</h1>
          <p>Manage login accounts and their roles.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setModalOpen(true); }}>
          <PlusIcon /> Add user
        </button>
      </div>

      <div className="panel rise">
        <div className="panel-head">
          <div>
            <h3>All users</h3>
            <div className="sub">{loading ? 'Loading…' : `${filtered.length} account${filtered.length === 1 ? '' : 's'}`}</div>
          </div>
        </div>

        {loading && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div className="skeleton" style={{ width: 38, height: 38, borderRadius: 11 }} />
                <div className="skeleton" style={{ height: 14, flex: 1, maxWidth: 200 }} />
                <div className="skeleton" style={{ height: 22, width: 90, borderRadius: 20 }} />
              </div>
            ))}
          </div>
        )}

        {!loading && loadError && (
          <div className="empty-state">
            <div className="empty-illus" style={{ background: 'rgba(251,113,133,0.1)', borderColor: 'rgba(251,113,133,0.25)' }}>
              <ShieldIcon style={{ color: 'var(--rose)' }} />
            </div>
            <h4>Couldn’t load users</h4>
            <p>{loadError}</p>
            <button className="btn btn-ghost" onClick={load}>Try again</button>
          </div>
        )}

        {!loading && !loadError && filtered.length > 0 && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="cell-user">
                        <Avatar name={u.fullName} />
                        <div>
                          <div className="name">
                            {u.fullName}
                            {u.id === me?.id && <span className="soon-tag" style={{ marginLeft: 8 }}>You</span>}
                          </div>
                          <div className="email">@{u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td><RoleBadge role={u.role} /></td>
                    <td>
                      <span className={`badge ${u.isActive ? 'active' : 'inactive'}`}>
                        <span className="dot" />{u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{formatDate(u.createdAt)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="act-btn" onClick={() => { setEditing(u); setModalOpen(true); }} aria-label="Edit"><EditIcon /></button>
                        <button
                          className="act-btn danger"
                          onClick={() => setDeleting(u)}
                          disabled={u.id === me?.id}
                          style={u.id === me?.id ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}
                          aria-label="Delete"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <UserModal
        open={modalOpen}
        initial={editing}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Delete user?"
        message={`This will permanently remove ${deleting?.fullName}'s account.`}
        busy={deleteBusy}
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
