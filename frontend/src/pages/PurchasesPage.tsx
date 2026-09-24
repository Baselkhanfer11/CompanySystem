import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { projectsApi } from '../api/projects';
import { purchasesApi } from '../api/purchases';
import { suppliersApi } from '../api/suppliers';
import { useAuth } from '../auth/AuthContext';
import { canManage } from '../auth/roles';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PlusIcon, ReceiptIcon, SearchIcon, TrashIcon } from '../components/icons';
import { PurchaseDetailModal } from '../components/PurchaseDetailModal';
import { PurchaseModal } from '../components/PurchaseModal';
import { useToast } from '../components/toast';
import { useItems } from '../data/ItemsContext';
import { useI18n } from '../i18n/LanguageContext';
import { formatDate, formatMoney } from '../lib/format';
import type { LayoutContext } from '../layouts/AppLayout';
import type { Project, PurchaseInput, PurchaseListItem, Supplier } from '../types';

export function PurchasesPage() {
  const { search } = useOutletContext<LayoutContext>();
  const toast = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const manage = canManage(user?.role);
  const { items, refresh: refreshItems } = useItems();

  const [purchases, setPurchases] = useState<PurchaseListItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<PurchaseListItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError('');
    purchasesApi.getAll().then(setPurchases).catch((e) => setLoadError(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  // Reference data for the create modal (suppliers + projects; items come from context).
  useEffect(() => {
    suppliersApi.getAll().then(setSuppliers).catch(() => {});
    projectsApi.getAll().then(setProjects).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return purchases;
    return purchases.filter((p) =>
      [p.supplierName, p.projectName, p.invoiceNumber, p.createdByName].filter(Boolean).some((v) => v!.toLowerCase().includes(q)),
    );
  }, [purchases, search]);

  const handleCreate = async (data: PurchaseInput) => {
    setSaving(true);
    try {
      await purchasesApi.create(data);
      toast('success', t('purchase.recorded'));
      setModalOpen(false);
      load();
      refreshItems(); // stock changed — update the store & bell alerts
    } catch (e) { toast('error', (e as Error).message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await purchasesApi.remove(deleting.id);
      toast('success', t('purchase.removed'));
      setDeleting(null);
      load();
      refreshItems(); // stock reversed — update the store & bell alerts
    } catch (e) { toast('error', (e as Error).message); }
    finally { setDeleteBusy(false); }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1>{t('purchase.title')}</h1>
          <p>{t('purchase.sub')}</p>
        </div>
        {manage && (
          <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
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
            <button className="btn btn-ghost" onClick={load}>{t('common.tryAgain')}</button>
          </div>
        )}

        {!loading && !loadError && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-illus"><ReceiptIcon /></div>
            <h4>{search ? t('common.noMatches') : t('purchase.noneTitle')}</h4>
            <p>{search ? t('common.differentSearch') : t('purchase.addFirst')}</p>
            {!search && manage && <button className="btn btn-primary" onClick={() => setModalOpen(true)}><PlusIcon /> {t('purchase.add')}</button>}
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
                          <button className="act-btn danger" onClick={() => setDeleting(p)} aria-label={t('common.delete')} title={t('common.delete')}><TrashIcon /></button>
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
        suppliers={suppliers}
        projects={projects}
        items={items}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSave={handleCreate}
      />

      <PurchaseDetailModal
        open={viewing !== null}
        purchaseId={viewing}
        onClose={() => setViewing(null)}
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
