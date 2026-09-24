import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { purchasesApi } from '../api/purchases';
import { useAuth } from '../auth/AuthContext';
import { canProcure } from '../auth/roles';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EditIcon, PlusIcon, ReceiptIcon, SearchIcon, TrashIcon } from '../components/icons';
import { PurchaseDetailModal } from '../components/PurchaseDetailModal';
import { PurchaseModal } from '../components/PurchaseModal';
import { useToast } from '../components/toast';
import { useItems } from '../data/ItemsContext';
import { NONE, purchasesChanged, useProjects, usePurchases, useSuppliers } from '../data/queries';
import { useI18n } from '../i18n/LanguageContext';
import { formatDate, formatMoney } from '../lib/format';
import type { LayoutContext } from '../layouts/AppLayout';
import type { Project, PurchaseDetail, PurchaseInput, PurchaseListItem, Supplier } from '../types';

export function PurchasesPage() {
  const { search } = useOutletContext<LayoutContext>();
  const toast = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const manage = canProcure(user?.role); // managers + the Procurement Officer
  const { items } = useItems();

  const { data, loading, error: loadError, refresh } = usePurchases();
  const purchases: PurchaseListItem[] = data ?? NONE;
  // Reference data for the purchase form (items come from the shared items cache).
  const suppliers: Supplier[] = useSuppliers().data ?? NONE;
  const projects: Project[] = useProjects().data ?? NONE;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseDetail | null>(null); // null = recording a new one
  const [editLoadingId, setEditLoadingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<PurchaseListItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);



  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return purchases;
    return purchases.filter((p) =>
      [p.supplierName, p.projectName, p.invoiceNumber, p.createdByName].filter(Boolean).some((v) => v!.toLowerCase().includes(q)),
    );
  }, [purchases, search]);

  const openCreate = () => { setEditing(null); setModalOpen(true); };

  // Editing needs the full invoice (all lines), so load it first.
  const openEdit = async (id: number) => {
    setEditLoadingId(id);
    try { setEditing(await purchasesApi.getById(id)); setModalOpen(true); }
    catch (e) { toast('error', (e as Error).message); }
    finally { setEditLoadingId(null); }
  };

  const handleSave = async (data: PurchaseInput) => {
    setSaving(true);
    try {
      if (editing) { await purchasesApi.update(editing.id, data); toast('success', t('purchase.updated')); }
      else { await purchasesApi.create(data); toast('success', t('purchase.recorded')); }
      setModalOpen(false);
      setEditing(null);
      purchasesChanged(); // the list, and the stock it moved (store, sites, bell alerts)
    } catch (e) { toast('error', (e as Error).message); } // e.g. "not enough stock" — the modal stays open
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await purchasesApi.remove(deleting.id);
      toast('success', t('purchase.removed'));
      setDeleting(null);
      purchasesChanged(); // the list, and the stock it moved back
    } catch (e) { toast('error', (e as Error).message); }
    finally { setDeleteBusy(false); }
  };

  return (
    <div>
      <div className="page-header with-actions">
        <div>
          <h1>{t('purchase.title')}</h1>
          <p>{t('purchase.sub')}</p>
        </div>
        {manage && (
          <button className="btn btn-primary" onClick={openCreate}>
            <PlusIcon /> {t('purchase.add')}
          </button>
        )}
      </div>

      <div className="panel rise">
        <div className="panel-head">
          <div>
            <h3>{t('purchase.all')}</h3>
            <div className="sub">
              {loading
                ? t('common.loading')
                : `${filtered.length === 1 ? t('purchase.countOne', { n: filtered.length }) : t('purchase.countMany', { n: filtered.length })}${search ? ' ' + t('common.found') : ''}`}
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
              <ReceiptIcon style={{ color: 'var(--rose)' }} />
            </div>
            <h4>{t('purchase.couldntLoad')}</h4>
            <p>{loadError}. {t('common.backendHint')}</p>
            <button className="btn btn-ghost" onClick={refresh}>{t('common.tryAgain')}</button>
          </div>
        )}

        {!loading && !loadError && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-illus"><ReceiptIcon /></div>
            <h4>{search ? t('common.noMatches') : t('purchase.noneTitle')}</h4>
            <p>{search ? t('common.differentSearch') : t('purchase.addFirst')}</p>
            {!search && manage && <button className="btn btn-primary" onClick={openCreate}><PlusIcon /> {t('purchase.add')}</button>}
          </div>
        )}

        {!loading && !loadError && filtered.length > 0 && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t('purchase.colDate')}</th>
                  <th>{t('purchase.colSupplier')}</th>
                  <th>{t('purchase.colProject')}</th>
                  <th>{t('purchase.colInvoice')}</th>
                  <th style={{ textAlign: 'center' }}>{t('purchase.colLines')}</th>
                  <th style={{ textAlign: 'end' }}>{t('purchase.colTotal')}</th>
                  <th style={{ textAlign: 'end' }}>{t('purchase.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td style={{ color: 'var(--text-muted)' }}>{formatDate(p.date)}</td>
                    <td><div className="name">{p.supplierName}</div><div className="email">{p.createdByName}</div></td>
                    <td>{p.projectName ?? <span style={{ color: 'var(--text-dim)' }}>{t('purchase.general')}</span>}</td>
                    <td><span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--text-muted)' }}>{p.invoiceNumber ?? '—'}</span></td>
                    <td style={{ textAlign: 'center' }}>{p.lineCount}</td>
                    <td style={{ textAlign: 'end', fontWeight: 600 }}>{formatMoney(p.total)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="act-btn" onClick={() => setViewing(p.id)} aria-label={t('purchase.view')} title={t('purchase.view')}><SearchIcon /></button>
                        {manage && (
                          <>
                            <button className="act-btn" onClick={() => openEdit(p.id)} disabled={editLoadingId === p.id} aria-label={t('purchase.edit')} title={t('purchase.edit')}>
                              {editLoadingId === p.id ? <span className="spinner" /> : <EditIcon />}
                            </button>
                            <button className="act-btn danger" onClick={() => setDeleting(p)} aria-label={t('common.delete')} title={t('common.delete')}><TrashIcon /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PurchaseModal
        open={modalOpen}
        initial={editing}
        suppliers={suppliers}
        projects={projects}
        items={items}
        saving={saving}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={handleSave}
      />

      <PurchaseDetailModal
        open={viewing !== null}
        purchaseId={viewing}
        onClose={() => setViewing(null)}
        onEdit={manage ? (d) => { setViewing(null); setEditing(d); setModalOpen(true); } : undefined}
      />

      <ConfirmDialog
        open={!!deleting}
        title={t('purchase.deleteQ')}
        message={t('purchase.deleteMsg', { supplier: deleting?.supplierName ?? '' })}
        busy={deleteBusy}
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
