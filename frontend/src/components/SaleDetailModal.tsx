import { useCallback, useState, type ReactNode } from 'react';
import { useDialog } from '../lib/useDialog';
import { salesApi } from '../api/sales';
import { useMoney } from '../auth/useMoney';
import { salesChanged } from '../data/queries';
import { useI18n } from '../i18n/LanguageContext';
import { useCached } from '../lib/cache';
import { formatDay, formatDateTime, formatMoney, formatTimeAgo, formatUnitMoney, localDate, numberOrNaN } from '../lib/format';
import { PAYMENT_STATUS_BADGE, SALE_STATUS_BADGE } from '../lib/sales';
import type { SaleAction, SaleChange, SaleDetail } from '../types';
import { CheckIcon, EditIcon, PlusIcon, TrashIcon, TrendingIcon, TruckIcon, UndoIcon, WalletIcon, XIcon } from './icons';
import { useToast } from './toast';

interface Props {
  open: boolean;
  saleId: number | null;
  onClose: () => void;
  onEdit?: (detail: SaleDetail) => void; // shown only when given (managers), and only for an order
  managePayments?: boolean; // may add and remove payments (managers)
}

type T = (key: string, vars?: Record<string, string | number>) => string;

// Wraps a value in Unicode "first strong isolate" marks, so that in Arabic the
// arrow between two English values still points at the NEW value.
const iso = (s: string) => `⁨${s}⁩`;

// Turns one recorded change into a readable line.
function describeChange(c: SaleChange, t: T, arrow: string): string {
  const qty = (n?: number) => `${n ?? 0} ${c.unit ?? ''}`.trim();
  const change = (from: string, to: string) => `${iso(from)} ${arrow} ${iso(to)}`;

  switch (c.kind) {
    case 'LineAdded':
      return t('saleHistory.lineAdded', { item: c.item ?? '', qty: qty(c.toQty), price: formatMoney(c.toPrice) });
    case 'LineRemoved':
      return t('saleHistory.lineRemoved', { item: c.item ?? '', qty: qty(c.fromQty), price: formatMoney(c.fromPrice) });
    case 'LineChanged': {
      const parts: string[] = [];
      if (c.fromQty !== c.toQty) parts.push(change(qty(c.fromQty), qty(c.toQty)));
      if (c.fromPrice !== c.toPrice) parts.push(t('saleHistory.price', { change: change(formatMoney(c.fromPrice), formatMoney(c.toPrice)) }));
      return `${iso(c.item ?? '')}: ${parts.join(' · ')}`;
    }
    case 'Payment':
      return c.note ? `${formatMoney(c.amount)} · ${iso(c.note)}` : formatMoney(c.amount);
    default: {
      if (c.field === 'notes') return t('saleHistory.notesChanged');
      const show = (v?: string | null) => (c.field === 'date' && v ? formatDay(v) : v ?? '—');
      return `${t(`saleHistory.field.${c.field}`)}: ${change(show(c.from), show(c.to))}`;
    }
  }
}

// How each history entry looks: its label key, icon and colour.
const EVENT_LOOK: Record<SaleAction, { key: string; tone: string; icon: ReactNode }> = {
  Edited: { key: 'saleHistory.edited', tone: 'warn', icon: <EditIcon /> },
  Delivered: { key: 'saleHistory.delivered', tone: 'ok', icon: <TruckIcon /> },
  DeliveryUndone: { key: 'saleHistory.deliveryUndone', tone: 'warn', icon: <UndoIcon /> },
  Cancelled: { key: 'saleHistory.cancelled', tone: 'danger', icon: <XIcon /> },
  PaymentAdded: { key: 'saleHistory.paymentAdded', tone: 'ok', icon: <WalletIcon /> },
  PaymentRemoved: { key: 'saleHistory.paymentRemoved', tone: 'danger', icon: <TrashIcon /> },
};

// Rendered only while open. Shows the last copy at once (if there is one) and
// always re-checks the server, through the shared request cache.
export function SaleDetailModal(props: Props) {
  if (!props.open || props.saleId == null) return null;
  return <SaleDetailView key={props.saleId} {...props} saleId={props.saleId} />;
}

function SaleDetailView({ saleId, onClose, onEdit, managePayments }: Props & { saleId: number }) {
  const dialog = useDialog(onClose);
  const { t, dir } = useI18n();
  const toast = useToast();
  const { prices } = useMoney(); // employees see no money
  const fetchDetail = useCallback(() => salesApi.getById(saleId), [saleId]);
  const { data: detail, loading, error, refresh } = useCached(`sale:${saleId}`, fetchDetail, 0);

  // Arrows point the way the text reads: → in English, ← in Arabic.
  const arrow = dir === 'rtl' ? '←' : '→';

  // ---- payments ----
  const [adding, setAdding] = useState(false);
  const [payDate, setPayDate] = useState(localDate());
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [payError, setPayError] = useState('');
  const [payBusy, setPayBusy] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const canPay = managePayments && detail && detail.status !== 'Cancelled' && (detail.remaining ?? 0) > 0;

  const addPayment = async () => {
    if (payBusy) return;
    const amount = numberOrNaN(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) return setPayError(t('saleDetail.badAmount'));
    if (!payDate) return setPayError(t('saleModal.dateRequired'));
    setPayBusy(true);
    setPayError('');
    try {
      await salesApi.addPayment(saleId, { date: payDate, amount, note: payNote.trim() || null });
      toast('success', t('saleDetail.paymentAdded'));
      setAdding(false);
      setPayAmount('');
      setPayNote('');
      salesChanged();
      refresh();
    } catch (e) { setPayError((e as Error).message); }
    finally { setPayBusy(false); }
  };

  const removePayment = async (paymentId: number) => {
    if (removingId !== null) return;
    setRemovingId(paymentId);
    try {
      await salesApi.removePayment(saleId, paymentId);
      toast('success', t('saleDetail.paymentRemoved'));
      salesChanged();
      refresh();
    } catch (e) { toast('error', (e as Error).message); }
    finally { setRemovingId(null); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" ref={dialog} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head with-close">
          <div>
            <h3>{t('saleDetail.title')}</h3>
            <p>{detail ? detail.customerName : t('saleDetail.sub')}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}><XIcon /></button>
        </div>

        <div className="modal-body">
          {loading && <div className="notif-empty">{t('common.loading')}</div>}
          {!loading && error && <div className="form-error" role="alert">{error}</div>}

          {!loading && !error && detail && (
            <>
              {/* Header facts */}
              <div className="detail-grid">
                <div><span className="k">{t('saleDetail.customer')}</span><span className="v">{detail.customerName}</span></div>
                <div><span className="k">{t('saleDetail.date')}</span><span className="v">{formatDay(detail.date)}</span></div>
                <div><span className="k">{t('saleDetail.reference')}</span><span className="v">{detail.reference ?? '—'}</span></div>
                <div>
                  <span className="k">{t('saleDetail.status')}</span>
                  <span className="v">
                    <span className={`badge ${SALE_STATUS_BADGE[detail.status] ?? 'inactive'}`}><span className="dot" />{t(`sale.status.${detail.status}`)}</span>
                  </span>
                </div>
                <div>
                  <span className="k">{t('saleDetail.payment')}</span>
                  <span className="v">
                    <span className={`badge ${PAYMENT_STATUS_BADGE[detail.paymentStatus] ?? 'inactive'}`}><span className="dot" />{t(`sale.payment.${detail.paymentStatus}`)}</span>
                  </span>
                </div>
                <div><span className="k">{t('saleDetail.recordedBy')}</span><span className="v">{detail.createdByName}</span></div>
                {detail.deliveredAt && (
                  <div>
                    <span className="k">{t('saleDetail.delivered')}</span>
                    <span className="v" title={formatDateTime(detail.deliveredAt)}>{detail.deliveredByName} · {formatTimeAgo(detail.deliveredAt, t)}</span>
                  </div>
                )}
                {detail.cancelledAt && (
                  <div>
                    <span className="k">{t('saleDetail.cancelled')}</span>
                    <span className="v" style={{ color: 'var(--rose)' }} title={formatDateTime(detail.cancelledAt)}>{detail.cancelledByName} · {formatTimeAgo(detail.cancelledAt, t)}</span>
                  </div>
                )}
              </div>

              {detail.notes && <div className="tl-note" style={{ marginTop: 4 }}>“{detail.notes}”</div>}

              {/* Lines */}
              <div className="table-wrap" style={{ marginTop: 16 }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t('saleDetail.item')}</th>
                      <th className="num">{t('saleDetail.qty')}</th>
                      {prices && <th className="num">{t('saleDetail.unitPrice')}</th>}
                      {prices && <th className="num">{t('saleDetail.lineTotal')}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((li) => (
                      <tr key={li.id}>
                        <td>
                          <div className="name">{li.itemName}</div>
                          <div className="email">{li.itemCode}</div>
                        </td>
                        <td className="num">{li.quantity} {li.unit}</td>
                        {prices && <td className="num">{formatUnitMoney(li.unitPrice)}</td>}
                        {prices && <td className="num" style={{ fontWeight: 600 }}>{formatMoney(li.lineTotal)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {prices && (
                <div className="grand-total" style={{ marginTop: 16, justifyContent: 'flex-end', gap: 24 }}>
                  <span>{t('saleDetail.total')} <strong>{formatMoney(detail.total)}</strong></span>
                  <span>{t('saleDetail.paid')} <strong>{formatMoney(detail.paid)}</strong></span>
                  <span>{t('saleDetail.remaining')} <strong style={{ color: (detail.remaining ?? 0) > 0 ? 'var(--amber)' : 'var(--emerald)' }}>{formatMoney(detail.remaining)}</strong></span>
                </div>
              )}

              {/* Payments */}
              {prices && (
                <section>
                  <h4 className="cost-section-title">{t('saleDetail.payments')}</h4>
                  {detail.payments.length === 0 && !adding && <div className="field-hint">{t('saleDetail.noPayments')}</div>}
                  {detail.payments.length > 0 && (
                    <div className="table-wrap">
                      <table className="data">
                        <thead>
                          <tr>
                            <th>{t('saleDetail.paymentDate')}</th>
                            <th className="num">{t('saleDetail.amount')}</th>
                            <th>{t('saleDetail.note')}</th>
                            <th>{t('saleDetail.colBy')}</th>
                            {managePayments && <th className="num" />}
                          </tr>
                        </thead>
                        <tbody>
                          {detail.payments.map((p) => (
                            <tr key={p.id}>
                              <td style={{ color: 'var(--text-muted)' }}>{formatDay(p.date)}</td>
                              <td className="num" style={{ fontWeight: 600 }}>{formatMoney(p.amount)}</td>
                              <td>{p.note ?? '—'}</td>
                              <td>{p.recordedByName}</td>
                              {managePayments && (
                                <td>
                                  <div className="row-actions">
                                    <button className="act-btn danger" onClick={() => removePayment(p.id)} disabled={removingId !== null} aria-label={t('saleDetail.removePayment')} data-tip={t('saleDetail.removePayment')}>
                                      {removingId === p.id ? <span className="spinner" /> : <TrashIcon />}
                                    </button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {canPay && !adding && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setAdding(true)} style={{ marginTop: 12 }}>
                      <PlusIcon /> {t('saleDetail.addPayment')}
                    </button>
                  )}
                  {canPay && adding && (
                    <div style={{ marginTop: 12 }}>
                      <div className="field-row">
                        <div className="field">
                          <label>{t('saleDetail.paymentDate')}</label>
                          <input className="input" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                        </div>
                        <div className="field">
                          <label>{t('saleDetail.amount')}</label>
                          <input className="input" type="number" min="0" step="0.01" autoFocus value={payAmount} placeholder={formatMoney(detail.remaining)} onChange={(e) => setPayAmount(e.target.value)} />
                        </div>
                      </div>
                      <div className="field">
                        <label>{t('saleDetail.note')}</label>
                        <input className="input" autoComplete="off" placeholder={t('saleDetail.notePlaceholder')} value={payNote} onChange={(e) => setPayNote(e.target.value)} />
                      </div>
                      {payError && <div className="form-error" role="alert">{payError}</div>}
                      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setAdding(false); setPayError(''); }} disabled={payBusy}>{t('common.cancel')}</button>
                        <button className="btn btn-primary btn-sm" onClick={addPayment} disabled={payBusy}>
                          {payBusy ? <span className="spinner" /> : <CheckIcon />} {t('saleDetail.add')}
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* History — recorded, then every step (oldest first) */}
              <section>
                <h4 className="cost-section-title">{t('saleDetail.history')}</h4>
                <div className="timeline">
                  <div className="tl-item">
                    <span className="tl-dot neutral"><TrendingIcon /></span>
                    <div className="tl-body">
                      <div className="tl-head">
                        <span className="tl-action">{t('saleHistory.recorded')}</span>
                        <span className="tl-time" title={formatDateTime(detail.createdAt)}>{formatTimeAgo(detail.createdAt, t)}</span>
                      </div>
                      <div className="tl-actor">{t('docTimeline.by', { name: detail.createdByName })}</div>
                    </div>
                  </div>

                  {detail.history.map((e) => {
                    const look = EVENT_LOOK[e.action] ?? EVENT_LOOK.Edited;
                    return (
                      <div key={e.id} className="tl-item">
                        <span className={`tl-dot ${look.tone}`}>{look.icon}</span>
                        <div className="tl-body">
                          <div className="tl-head">
                            <span className="tl-action">{t(look.key)}</span>
                            <span className="tl-time" title={formatDateTime(e.createdAt)}>{formatTimeAgo(e.createdAt, t)}</span>
                          </div>
                          <div className="tl-actor">{t('docTimeline.by', { name: e.actorName })}</div>
                          {prices && e.changes.length > 0 && (
                            <ul className="change-list">
                              {e.changes.map((c, i) => <li key={i}>{describeChange(c, t, arrow)}</li>)}
                            </ul>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}

          {!loading && !error && !detail && (
            <div className="empty-state"><div className="empty-illus"><TrendingIcon /></div></div>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>{t('common.close')}</button>
          {onEdit && detail && detail.status === 'Ordered' && (
            <button className="btn btn-primary" onClick={() => onEdit(detail)}>
              <EditIcon /> {t('sale.edit')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
