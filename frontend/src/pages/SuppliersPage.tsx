import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { suppliersApi } from '../api/suppliers';
import { useAuth } from '../auth/AuthContext';
import { canProcure } from '../auth/roles';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EditIcon, PlusIcon, TrashIcon, TruckIcon } from '../components/icons';
import { LoadError, TableSkeleton } from '../components/States';
import { SupplierModal } from '../components/SupplierModal';
import { useToast } from '../components/toast';
import { NONE, suppliersChanged, useSuppliers } from '../data/queries';
import { useI18n } from '../i18n/LanguageContext';
import { formatDate } from '../lib/format';
import { SUPPLIER_STATUS_BADGE } from '../lib/suppliers';
import type { LayoutContext } from '../layouts/AppLayout';
import type { Supplier, SupplierInput } from '../types';

export function SuppliersPage() {
  const { search } = useOutletContext<LayoutContext>();
  const toast = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const manage = canProcure(user?.role); // managers + the Procurement Officer

  const { data, loading, error: loadError, refresh } = useSuppliers();
  const suppliers: Supplier[] = data ?? NONE;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Supplier | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) =>
      [s.name, s.code, s.contactPerson, s.phone, s.email].filter(Boolean).some((v) => v!.toLowerCase().includes(q)),
    );
  }, [suppliers, search]);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (s: Supplier) => { setEditing(s); setModalOpen(true); };

  const handleSave = async (data: SupplierInput) => {
    setSaving(true);
    try {
      if (editing) { await suppliersApi.update(editing.id, data); toast('success', t('supplier.updated')); }
      else { await suppliersApi.create(data); toast('success', t('supplier.added')); }
      setModalOpen(false);
      suppliersChanged();
    } catch (e) { toast('error', (e as Error).message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await suppliersApi.remove(deleting.id);
      toast('success', t('supplier.removed'));
      setDeleting(null);
      suppliersChanged();
    } catch (e) { toast('error', (e as Error).message); }
    finally { setDeleteBusy(false); }
  };

  return (
    <div>
      <div className="page-header with-actions">
        <div>
          <h1>{t('supplier.title')}</h1>
          <p>{t('supplier.sub')}</p>
        </div>
        {manage && (
          <button className="btn btn-primary" onClick={openCreate}>
            <PlusIcon /> {t('supplier.add')}
          </button>
        )}
      </div>

      <div className="panel rise">
        <div className="panel-head">
          <div>
            <h3>{t('supplier.all')}</h3>
            <div className="sub">
              {loading
                ? t('common.loading')
                : `${filtered.length === 1 ? t('supplier.countOne', { n: filtered.length }) : t('supplier.countMany', { n: filtered.length })}${search ? ' ' + t('common.found') : ''}`}
            </div>
          </div>
        </div>

        {loading && (
          <TableSkeleton />
        )}

        {!loading && loadError && (
          <LoadError icon={<TruckIcon />} title={t('supplier.couldntLoad')} error={loadError} onRetry={refresh} />
        )}

        {!loading && !loadError && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-illus"><TruckIcon /></div>
            <h4>{search ? t('common.noMatches') : t('supplier.noneTitle')}</h4>
            <p>{search ? t('common.differentSearch') : t('supplier.addFirst')}</p>
            {!search && manage && <button className="btn btn-primary" onClick={openCreate}><PlusIcon /> {t('supplier.add')}</button>}
          </div>
        )}

        {!loading && !loadError && filtered.length > 0 && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t('supplier.colName')}</th>
                  <th>{t('supplier.colCode')}</th>
                  <th>{t('supplier.colContact')}</th>
                  <th>{t('supplier.colStatus')}</th>
                  <th>{t('supplier.colCreated')}</th>
                  {manage && <th className="num">{t('supplier.colActions')}</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div>
                        <div className="name">{s.name}</div>
                        {s.email && <div className="email">{s.email}</div>}
                      </div>
                    </td>
                    <td><span className="cell-code">{s.code}</span></td>
                    <td>
                      <div>
                        <div className="name" style={{ fontWeight: 500 }}>{s.contactPerson || '—'}</div>
                        {s.phone && <div className="email" style={{ direction: 'ltr' }}>{s.phone}</div>}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${SUPPLIER_STATUS_BADGE[s.status] ?? 'inactive'}`}>
                        <span className="dot" />{t(`supplier.status.${s.status}`)}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{formatDate(s.createdAt)}</td>
                    {manage && (
                      <td>
                        <div className="row-actions">
                          <button className="act-btn" onClick={() => openEdit(s)} aria-label={t('common.edit')} data-tip={t('common.edit')}><EditIcon /></button>
                          <button className="act-btn danger" onClick={() => setDeleting(s)} aria-label={t('common.delete')} data-tip={t('common.delete')}><TrashIcon /></button>
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

      <SupplierModal
        open={modalOpen}
        initial={editing}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={!!deleting}
        title={t('supplier.deleteQ')}
        message={t('supplier.deleteMsg', { name: deleting?.name ?? '' })}
        busy={deleteBusy}
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
