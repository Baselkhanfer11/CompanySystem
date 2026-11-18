import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { customersApi } from '../api/customers';
import { useAuth } from '../auth/AuthContext';
import { canProcure } from '../auth/roles';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CustomerModal } from '../components/CustomerModal';
import { ExportButton } from '../components/ExportButton';
import { BriefcaseIcon, EditIcon, PlusIcon, TrashIcon } from '../components/icons';
import { LoadError, TableSkeleton } from '../components/States';
import { useToast } from '../components/toast';
import { customersChanged, NONE, useCustomers, useSales } from '../data/queries';
import { useI18n } from '../i18n/LanguageContext';
import { CUSTOMER_STATUS_BADGE } from '../lib/customers';
import { formatDate } from '../lib/format';
import { sheet } from '../lib/xlsx';
import type { LayoutContext } from '../layouts/AppLayout';
import type { Customer, CustomerInput } from '../types';

export function CustomersPage() {
  const { search } = useOutletContext<LayoutContext>();
  const toast = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const manage = canProcure(user?.role); // managers + the Procurement Officer

  const { data, loading, error: loadError, refresh } = useCustomers();
  const customers: Customer[] = data ?? NONE;

  // How many sales each customer has (from the sales list, already cached).
  const sales = useSales().data ?? NONE;
  const saleCount = useMemo(() => {
    const count = new Map<number, number>();
    for (const s of sales) if (s.status !== 'Cancelled') count.set(s.customerId, (count.get(s.customerId) ?? 0) + 1);
    return count;
  }, [sales]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      [c.name, c.code, c.contactPerson, c.phone, c.email].filter(Boolean).some((v) => v!.toLowerCase().includes(q)),
    );
  }, [customers, search]);

  // The Excel file: the same customers as the table, with every contact detail.
  const exportSheets = () => [sheet<Customer>(t('customer.title'), [
    { header: t('customer.colName'), value: (c) => c.name },
    { header: t('customer.colCode'), value: (c) => c.code },
    { header: t('xl.contactPerson'), value: (c) => c.contactPerson },
    { header: t('xl.phone'), value: (c) => c.phone },
    { header: t('xl.email'), value: (c) => c.email },
    { header: t('xl.address'), value: (c) => c.address },
    { header: t('customer.colStatus'), value: (c) => t(`customer.status.${c.status}`) },
    { header: t('customer.colSales'), type: 'number', value: (c) => saleCount.get(c.id) ?? 0 },
    { header: t('customer.colCreated'), type: 'date', value: (c) => c.createdAt },
    { header: t('xl.notes'), value: (c) => c.notes },
  ], filtered)];

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (c: Customer) => { setEditing(c); setModalOpen(true); };

  const handleSave = async (input: CustomerInput) => {
    setSaving(true);
    try {
      if (editing) { await customersApi.update(editing.id, input); toast('success', t('customer.updated')); }
      else { await customersApi.create(input); toast('success', t('customer.added')); }
      setModalOpen(false);
      customersChanged();
    } catch (e) { toast('error', (e as Error).message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await customersApi.remove(deleting.id);
      toast('success', t('customer.removed'));
      setDeleting(null);
      customersChanged();
    } catch (e) { toast('error', (e as Error).message); }
    finally { setDeleteBusy(false); }
  };

  return (
    <div>
      <div className="page-header with-actions">
        <div>
          <h1>{t('customer.title')}</h1>
          <p>{t('customer.sub')}</p>
        </div>
        <div className="page-actions">
          <ExportButton fileName="customers" sheets={exportSheets} disabled={loading || filtered.length === 0} />
          {manage && (
            <button className="btn btn-primary" onClick={openCreate}>
              <PlusIcon /> {t('customer.add')}
            </button>
          )}
        </div>
      </div>

      <div className="panel rise">
        <div className="panel-head">
          <div>
            <h3>{t('customer.all')}</h3>
            <div className="sub">
              {loading
                ? t('common.loading')
                : `${filtered.length === 1 ? t('customer.countOne', { n: filtered.length }) : t('customer.countMany', { n: filtered.length })}${search ? ' ' + t('common.found') : ''}`}
            </div>
          </div>
        </div>

        {loading && <TableSkeleton />}

        {!loading && loadError && (
          <LoadError icon={<BriefcaseIcon />} title={t('customer.couldntLoad')} error={loadError} onRetry={refresh} />
        )}

        {!loading && !loadError && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-illus"><BriefcaseIcon /></div>
            <h4>{search ? t('common.noMatches') : t('customer.noneTitle')}</h4>
            <p>{search ? t('common.differentSearch') : t('customer.addFirst')}</p>
            {!search && manage && <button className="btn btn-primary" onClick={openCreate}><PlusIcon /> {t('customer.add')}</button>}
          </div>
        )}

        {!loading && !loadError && filtered.length > 0 && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t('customer.colName')}</th>
                  <th>{t('customer.colCode')}</th>
                  <th>{t('customer.colContact')}</th>
                  <th>{t('customer.colStatus')}</th>
                  <th style={{ textAlign: 'center' }}>{t('customer.colSales')}</th>
                  <th>{t('customer.colCreated')}</th>
                  {manage && <th className="num">{t('customer.colActions')}</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div>
                        <div className="name">{c.name}</div>
                        {c.email && <div className="email">{c.email}</div>}
                      </div>
                    </td>
                    <td><span className="cell-code">{c.code}</span></td>
                    <td>
                      <div>
                        <div className="name" style={{ fontWeight: 500 }}>{c.contactPerson || '—'}</div>
                        {c.phone && <div className="email" style={{ direction: 'ltr' }}>{c.phone}</div>}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${CUSTOMER_STATUS_BADGE[c.status] ?? 'inactive'}`}>
                        <span className="dot" />{t(`customer.status.${c.status}`)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>{saleCount.get(c.id) ?? <span style={{ color: 'var(--text-dim)' }}>—</span>}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{formatDate(c.createdAt)}</td>
                    {manage && (
                      <td>
                        <div className="row-actions">
                          <button className="act-btn" onClick={() => openEdit(c)} aria-label={t('common.edit')} data-tip={t('common.edit')}><EditIcon /></button>
                          <button className="act-btn danger" onClick={() => setDeleting(c)} aria-label={t('common.delete')} data-tip={t('common.delete')}><TrashIcon /></button>
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

      <CustomerModal
        open={modalOpen}
        initial={editing}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={!!deleting}
        title={t('customer.deleteQ')}
        message={t('customer.deleteMsg', { name: deleting?.name ?? '' })}
        busy={deleteBusy}
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
