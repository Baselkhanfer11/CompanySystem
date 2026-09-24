import { useEffect, useState } from 'react';
import { purchasesApi } from '../api/purchases';
import { useI18n } from '../i18n/LanguageContext';
import { formatDate, formatDateTime, formatMoney, formatTimeAgo } from '../lib/format';
import type { PurchaseChange, PurchaseDetail } from '../types';
import { EditIcon, ReceiptIcon, XIcon } from './icons';

interface Props {
  open: boolean;
  purchaseId: number | null;
  onClose: () => void;
  onEdit?: (detail: PurchaseDetail) => void; // shown only when given (managers)
}

type T = (key: string, vars?: Record<string, string | number>) => string;

// "2026-09-10" → "10 Sep 2026", built from the parts so no timezone can shift the day.
const ymdLabel = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Wraps a value in Unicode "first strong isolate" marks. Without this, in Arabic
// two English values plus the arrow between them merge into one left-to-right
// run, and the arrow ends up pointing at the OLD value.
const iso = (s: string) => `⁨${s}⁩`;

// Turns one recorded change into a readable line, e.g. "Steel Bolt M8: 100 → 80 pcs".
function describeChange(c: PurchaseChange, t: T, arrow: string): string {
  const qty = (n?: number) => `${n ?? 0} ${c.unit ?? ''}`.trim();
  const change = (from: string, to: string) => `${iso(from)} ${arrow} ${iso(to)}`;

  switch (c.kind) {
    case 'LineAdded':
      return t('purchaseHistory.lineAdded', { item: c.item ?? '', qty: qty(c.toQty), price: formatMoney(c.toPrice ?? 0) });
    case 'LineRemoved':
      return t('purchaseHistory.lineRemoved', { item: c.item ?? '', qty: qty(c.fromQty), price: formatMoney(c.fromPrice ?? 0) });
    case 'LineChanged': {
      const parts: string[] = [];
      if (c.fromQty !== c.toQty) parts.push(change(qty(c.fromQty), qty(c.toQty)));
      if (c.fromPrice !== c.toPrice) parts.push(t('purchaseHistory.price', { change: change(formatMoney(c.fromPrice ?? 0), formatMoney(c.toPrice ?? 0)) }));
      return `${iso(c.item ?? '')}: ${parts.join(' · ')}`;
    }
    default: {
      if (c.field === 'notes') return t('purchaseHistory.notesChanged');
      const show = (v?: string | null) => {
        if (c.field === 'project') return v ?? t('purchase.general');
        if (c.field === 'date' && v) return ymdLabel(v);
        return v ?? '—';
      };
      const label = t(`purchaseHistory.field.${c.field}`);
      return `${label}: ${change(show(c.from), show(c.to))}`;
    }
  }
}

export function PurchaseDetailModal({ open, purchaseId, onClose, onEdit }: Props) {
  const { t, dir } = useI18n();
  const [detail, setDetail] = useState<PurchaseDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || purchaseId == null) return;
    let active = true;
    setLoading(true);
    setError('');
    setDetail(null);
    purchasesApi.getById(purchaseId)
      .then((d) => { if (active) setDetail(d); })
      .catch((e) => { if (active) setError((e as Error).message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, purchaseId]);

  if (!open) return null;

  // Arrows point the way the text reads: → in English, ← in Arabic.
  const arrow = dir === 'rtl' ? '←' : '→';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head with-close">
          <div>
            <h3>{t('purchaseDetail.title')}</h3>
            <p>{detail ? detail.supplierName : t('purchaseDetail.sub')}</p>
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
                <div><span className="k">{t('purchaseDetail.supplier')}</span><span className="v">{detail.supplierName}</span></div>
                <div><span className="k">{t('purchaseDetail.project')}</span><span className="v">{detail.projectName ?? t('purchase.general')}</span></div>
                <div><span className="k">{t('purchaseDetail.date')}</span><span className="v">{formatDate(detail.date)}</span></div>
                <div><span className="k">{t('purchaseDetail.invoiceNumber')}</span><span className="v">{detail.invoiceNumber ?? '—'}</span></div>
                <div><span className="k">{t('purchaseDetail.recordedBy')}</span><span className="v">{detail.createdByName}</span></div>
                {detail.lastEditedAt && (
                  <div>
                    <span className="k">{t('purchaseDetail.lastEdited')}</span>
                    <span className="v" title={formatDateTime(detail.lastEditedAt)}>
                      {detail.lastEditedByName} · {formatTimeAgo(detail.lastEditedAt, t)}
                    </span>
                  </div>
                )}
              </div>

              {detail.notes && <div className="tl-note" style={{ marginTop: 4 }}>“{detail.notes}”</div>}

              {/* Lines */}
              <div className="table-wrap" style={{ marginTop: 16 }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t('purchaseDetail.item')}</th>
                      <th className="num">{t('purchaseDetail.qty')}</th>
                      <th className="num">{t('purchaseDetail.unitPrice')}</th>
                      <th className="num">{t('purchaseDetail.lineTotal')}</th>
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
                        <td className="num">{formatMoney(li.unitPrice)}</td>
                        <td className="num" style={{ fontWeight: 600 }}>{formatMoney(li.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grand-total" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
                <span>{t('purchaseDetail.total')}</span>
                <strong>{formatMoney(detail.total)}</strong>
              </div>

              {/* History — who recorded it, then every edit (oldest first) */}
              <section>
                <h4 className="cost-section-title">{t('purchaseDetail.history')}</h4>
                <div className="timeline">
                  <div className="tl-item">
                    <span className="tl-dot neutral"><ReceiptIcon /></span>
                    <div className="tl-body">
                      <div className="tl-head">
                        <span className="tl-action">{t('purchaseHistory.recorded')}</span>
                        <span className="tl-time" title={formatDateTime(detail.createdAt)}>{formatTimeAgo(detail.createdAt, t)}</span>
                      </div>
                      <div className="tl-actor">{t('docTimeline.by', { name: detail.createdByName })}</div>
                    </div>
                  </div>

                  {detail.history.map((e) => (
                    <div key={e.id} className="tl-item">
                      <span className="tl-dot warn"><EditIcon /></span>
                      <div className="tl-body">
                        <div className="tl-head">
                          <span className="tl-action">{t('purchaseHistory.edited')}</span>
                          <span className="tl-time" title={formatDateTime(e.createdAt)}>{formatTimeAgo(e.createdAt, t)}</span>
                        </div>
                        <div className="tl-actor">{t('docTimeline.by', { name: e.actorName })}</div>
                        <ul className="change-list">
                          {e.changes.map((c, i) => <li key={i}>{describeChange(c, t, arrow)}</li>)}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {!loading && !error && !detail && (
            <div className="empty-state"><div className="empty-illus"><ReceiptIcon /></div></div>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>{t('common.close')}</button>
          {onEdit && detail && (
            <button className="btn btn-primary" onClick={() => onEdit(detail)}>
              <EditIcon /> {t('purchase.edit')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
