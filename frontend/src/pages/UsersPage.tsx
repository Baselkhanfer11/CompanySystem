import { useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { usersApi } from '../api/users';
import { useAuth } from '../auth/AuthContext';
import { isAdmin } from '../auth/roles';
import { Avatar } from '../components/Avatar';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ShieldIcon, TrashIcon } from '../components/icons';
import { RoleBadge } from '../components/RoleBadge';
import { useToast } from '../components/toast';
import { NONE, peopleChanged, useUsers } from '../data/queries';
import { useI18n } from '../i18n/LanguageContext';
import { formatDate } from '../lib/format';
import type { LayoutContext } from '../layouts/AppLayout';
import type { User } from '../types';

export function UsersPage() {
  const { search } = useOutletContext<LayoutContext>();
  const toast = useToast();
  const { t } = useI18n();
  const { user: me } = useAuth();

  const { data, loading, error: loadError, refresh } = useUsers();
  const users: User[] = data ?? NONE;
  const [deleting, setDeleting] = useState<User | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => [u.fullName, u.username, u.role].some((v) => v.toLowerCase().includes(q)));
  }, [users, search]);

  if (!isAdmin(me?.role)) {
    return (
      <div className="empty-state" style={{ paddingTop: 100 }}>
        <div className="empty-illus"><ShieldIcon /></div>
        <h4>{t('users.adminsOnly')}</h4>
        <p>{t('users.noPermission')}</p>
      </div>
    );
  }

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await usersApi.remove(deleting.id);
      toast('success', t('users.loginRemoved'));
      setDeleting(null);
      peopleChanged();
    } catch (e) { toast('error', (e as Error).message); }
    finally { setDeleteBusy(false); }
  };

  return (
    <div>
      <div className="page-header">
        <h1>{t('users.title')}</h1>
        <p>{t('users.sub1')}<Link to="/employees" style={{ color: 'var(--accent-2)' }}>{t('nav.employees')}</Link>{t('users.sub2')}</p>
      </div>

      <div className="panel rise">
        <div className="panel-head">
          <div>
            <h3>{t('users.all')}</h3>
            <div className="sub">{loading ? t('common.loading') : (filtered.length === 1 ? t('users.countOne', { n: filtered.length }) : t('users.countMany', { n: filtered.length }))}</div>
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
            <h4>{t('users.couldntLoad')}</h4>
            <p>{loadError}</p>
            <button className="btn btn-ghost" onClick={refresh}>{t('common.tryAgain')}</button>
          </div>
        )}

        {!loading && !loadError && filtered.length > 0 && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t('users.colUser')}</th>
                  <th>{t('users.colRole')}</th>
                  <th>{t('users.colStatus')}</th>
                  <th>{t('users.colType')}</th>
                  <th>{t('users.colCreated')}</th>
                  <th style={{ textAlign: 'end' }}>{t('users.colActions')}</th>
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
                            {u.id === me?.id && <span className="soon-tag" style={{ marginInlineStart: 8 }}>{t('common.you')}</span>}
                          </div>
                          <div className="email">@{u.username}</div>
                        </div>
                      </div>
                    </td>
                    <td><RoleBadge role={u.role} /></td>
                    <td>
                      <span className={`badge ${u.isActive ? 'active' : 'inactive'}`}>
                        <span className="dot" />{u.isActive ? t('common.active') : t('common.inactive')}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>
                      {u.employeeId ? t('users.staffLogin') : t('users.systemAccount')}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{formatDate(u.createdAt)}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="act-btn danger"
                          onClick={() => setDeleting(u)}
                          disabled={u.id === me?.id}
                          style={u.id === me?.id ? { opacity: 0.3, cursor: 'not-allowed' } : undefined}
                          aria-label={t('users.removeLogin')}
                          title={u.id === me?.id ? t('users.cantRemoveSelf') : t('users.removeLogin')}
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

      <ConfirmDialog
        open={!!deleting}
        title={t('users.removeQ')}
        message={t('users.removeMsg', { name: deleting?.fullName ?? '' })}
        busy={deleteBusy}
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
        confirmLabel={t('users.removeLogin')}
        icon={<ShieldIcon />}
      />
    </div>
  );
}
