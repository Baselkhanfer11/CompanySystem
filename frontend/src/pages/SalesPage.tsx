import { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { salesApi } from '../api/sales';
import { useAuth } from '../auth/AuthContext';
import { canProcure } from '../auth/roles';
import { useMoney } from '../auth/useMoney';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ExportButton } from '../components/ExportButton';
import { EditIcon, PlusIcon, SearchIcon, TrendingIcon, TruckIcon, UndoIcon, XIcon } from '../components/icons';
import { SaleDetailModal } from '../components/SaleDetailModal';
import { SaleModal } from '../components/SaleModal';
import { LoadError, TableSkeleton } from '../components/States';
import { useToast } from '../components/toast';
import { useItems } from '../data/ItemsContext';
import { NONE, salesChanged, useCustomers, useSales } from '../data/queries';
import { useI18n } from '../i18n/LanguageContext';
import { formatDay, formatMoney } from '../lib/format';
import { PAYMENT_STATUS_BADGE, SALE_STATUS_BADGE } from '../lib/sales';
import { sheet } from '../lib/xlsx';
import type { LayoutContext } from '../layouts/AppLayout';
import type { Customer, SaleDetail, SaleInput, SaleListItem } from '../types';

// A step in a sale's life that needs a "are you sure?".
type Step = { kind: 'deliver' | 'undo' | 'cancel'; sale: SaleListItem };

export function SalesPage() {
  const { search } = useOutletContext<LayoutContext>();
  const toast = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const manage = canProcure(user?.role); // managers + the Procurement Officer
  const { prices } = useMoney(); // employees see no money
  const { items, revalidate } = useItems();

  const { data, loading, error: loadError, refresh } = useSales();
  const sales: SaleListItem[] = data ?? NONE;
  const customers: Customer[] = useCustomers().data ?? NONE;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SaleDetail | null>(null); // null = recording a new order
  const [editLoadingId, setEditLoadingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  const [stepBusy, setStepBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sales;
    return sales.filter((s) =>
      [s.customerName, s.reference, s.createdByName, t(`sale.status.${s.status}`)].filter(Boolean).some((v) => v!.toLowerCase().includes(q)),
    );
  }, [sales, search, t]);

  // The Excel file: the same sales as the table.
  const exportSheets = () => [sheet<SaleListItem>(t('sale.title'), [
    { header: t('sale.colDate'), type: 'day', value: (s) => s.date },
    { header: t('sale.colCustomer'), value: (s) => s.customerName },
    { header: t('sale.colReference'), value: (s) => s.reference },
    { header: t('sale.colStatus'), value: (s) => t(`sale.status.${s.status}`) },
    { header: t('sale.colPayment'), value: (s) => t(`sale.payment.${s.paymentStatus}`) },
    { header: t('sale.colLines'), type: 'number', value: (s) => s.lineCount },
    ...(prices ? [
      { header: t('sale.colTotal'), type: 'money' as const, value: (s: SaleListItem) => s.total },
      { header: t('sale.colPaid'), type: 'money' as const, value: (s: SaleListItem) => s.paid },
    ] : []),
    { header: t('xl.recordedBy'), value: (s) => s.createdByName },
  ], filtered)];

  const openCreate = () => { revalidate(); setEditing(null); setModalOpen(true); }; // fresh warehouse counts

  // Editing needs the full order (all lines), so load it first.
  const openEdit = async (id: number) => {
    setEditLoadingId(id);
    try { setEditing(await salesApi.getById(id)); revalidate(); setModalOpen(true); }
    catch (e) { toast('error', (e as Error).message); }
    finally { setEditLoadingId(null); }
  };

  const handleSave = async (input: SaleInput) => {
    setSaving(true);
    try {
      if (editing) { await salesApi.update(editing.id, input); toast('success', t('sale.updated')); }
      else { await salesApi.create(input); toast('success', t('sale.recorded')); }
      setModalOpen(false);
      setEditing(null);
      salesChanged();
    } catch (e) { toast('error', (e as Error).message); } // the modal stays open
    finally { setSaving(false); }
  };

  // Deliver, undo a delivery, or cancel — after the confirm box.
  const runStep = async () => {
    if (!step) return;
    setStepBusy(true);
    try {
      if (step.kind === 'deliver') { await salesApi.deliver(step.sale.id); toast('success', t('sale.delivered')); }
      else if (step.kind === 'undo') { await salesApi.undoDelivery(step.sale.id); toast('success', t('sale.undone')); }
      else { await salesApi.cancel(step.sale.id); toast('success', t('sale.cancelled')); }
      setStep(null);
      salesChanged(); // the list, and the warehouse stock a delivery moved
    } catch (e) { toast('error', (e as Error).message); } // e.g. "not enough stock"
    finally { setStepBusy(false); }
  };

  const stepText = {
    deliver: { title: t('sale.deliverQ'), message: t('sale.deliverMsg', { customer: step?.sale.customerName ?? '' }), label: t('sale.deliverConfirm'), icon: <TruckIcon /> },
    undo: { title: t('sale.undoQ'), message: t('sale.undoMsg', { customer: step?.sale.customerName ?? '' }), label: t('sale.undoConfirm'), icon: <UndoIcon /> },
    cancel: { title: t('sale.cancelQ'), message: t('sale.cancelMsg', { customer: step?.sale.customerName ?? '' }), label: t('sale.cancelConfirm'), icon: <XIcon /> },
  };

  return (
    <div>
      <div className="page-header with-actions">
        <div>
          <h1>{t('sale.title')}</h1>
          <p>{t('sale.sub')}</p>
        </div>
        <div className="page-actions">
          <ExportButton fileName="sales" sheets={exportSheets} disabled={loading || filtered.length === 0} />
          {manage && (
            <button className="btn btn-primary" onClick={openCreate}>
              <PlusIcon /> {t('sale.add')}
            </button>
          )}
        </div>
      </div>

      <div className="panel rise">
        <div className="panel-head">
          <div>
            <h3>{t('sale.all')}</h3>
            <div className="sub">
              {loading
                ? t('common.loading')
                : `${filtered.length === 1 ? t('sale.countOne', { n: filtered.length }) : t('sale.countMany', { n: filtered.length })}${search ? ' ' + t('common.found') : ''}`}
            </div>
          </div>
        </div>

        {loading && <TableSkeleton />}

        {!loading && loadError && (
          <LoadError icon={<TrendingIcon />} title={t('sale.couldntLoad')} error={loadError} onRetry={refresh} />
        )}

        {!loading && !loadError && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-illus"><TrendingIcon /></div>
            <h4>{search ? t('common.noMatches') : t('sale.noneTitle')}</h4>
            <p>{search ? t('common.differentSearch') : t('sale.addFirst')}</p>
            {!search && manage && <button className="btn btn-primary" onClick={openCreate}><PlusIcon /> {t('sale.add')}</button>}
          </div>
        )}

        {!loading && !loadError && filtered.length > 0 && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t('sale.colDate')}</th>
                  <th>{t('sale.colCustomer')}</th>
                  <th>{t('sale.colReference')}</th>
                  <th>{t('sale.colStatus')}</th>
                  <th style={{ textAlign: 'center' }}>{t('sale.colLines')}</th>
                  {prices && <th className="num">{t('sale.colTotal')}</th>}
                  <th className="num">{t('sale.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} style={s.status === 'Cancelled' ? { opacity: 0.6 } : undefined}>
                    <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDay(s.date)}</td>
                    <td><div className="name">{s.customerName}</div><div className="email">{s.createdByName}</div></td>
                    <td><span className="cell-code">{s.reference ?? '—'}</span></td>
                    <td>
                      {/* Where the order is, and (unless it was called off) how much is paid. */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        <span className={`badge ${SALE_STATUS_BADGE[s.status] ?? 'inactive'}`}><span className="dot" />{t(`sale.status.${s.status}`)}</span>
                        {s.status !== 'Cancelled' && (
                          <span className={`badge ${PAYMENT_STATUS_BADGE[s.paymentStatus] ?? 'inactive'}`}><span className="dot" />{t(`sale.payment.${s.paymentStatus}`)}</span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>{s.lineCount}</td>
                    {prices && (
                      <td className="num" style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600 }}>{formatMoney(s.total)}</div>
                        {(s.paid ?? 0) > 0 && <div className="email">{t('sale.paidAmount', { amount: formatMoney(s.paid) })}</div>}
                      </td>
                    )}
                    <td>
                      <div className="row-actions">
                        <button className="act-btn" onClick={() => setViewing(s.id)} aria-label={t('sale.view')} data-tip={t('sale.view')}><SearchIcon /></button>
                        {manage && s.status === 'Ordered' && (
                          <>
                            <button className="act-btn" onClick={() => openEdit(s.id)} disabled={editLoadingId === s.id} aria-label={t('sale.edit')} data-tip={t('sale.edit')}>
                              {editLoadingId === s.id ? <span className="spinner" /> : <EditIcon />}
                            </button>
                            <button className="act-btn success" onClick={() => setStep({ kind: 'deliver', sale: s })} aria-label={t('sale.deliver')} data-tip={t('sale.deliver')}><TruckIcon /></button>
                            <button className="act-btn danger" onClick={() => setStep({ kind: 'cancel', sale: s })} aria-label={t('sale.cancel')} data-tip={t('sale.cancel')}><XIcon /></button>
                          </>
                        )}
                        {manage && s.status === 'Delivered' && (s.paid ?? 0) === 0 && (
                          <button className="act-btn danger" onClick={() => setStep({ kind: 'undo', sale: s })} aria-label={t('sale.undo')} data-tip={t('sale.undo')}><UndoIcon /></button>
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

      <SaleModal
        open={modalOpen}
        initial={editing}
        customers={customers}
        items={items}
        saving={saving}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={handleSave}
      />

      <SaleDetailModal
        open={viewing !== null}
        saleId={viewing}
        onClose={() => setViewing(null)}
        onEdit={manage ? (d) => { setViewing(null); setEditing(d); setModalOpen(true); } : undefined}
        managePayments={manage}
      />

      <ConfirmDialog
        open={!!step}
        title={step ? stepText[step.kind].title : ''}
        message={step ? stepText[step.kind].message : ''}
        busy={stepBusy}
        onCancel={() => setStep(null)}
        onConfirm={runStep}
        confirmLabel={step ? stepText[step.kind].label : undefined}
        icon={step ? stepText[step.kind].icon : undefined}
      />
    </div>
  );
}
