import { useEffect, useState } from 'react';
import { purchasesApi } from '../api/purchases';
import { useI18n } from '../i18n/LanguageContext';
import { formatDate, formatMoney } from '../lib/format';
import type { PurchaseDetail } from '../types';
import { ReceiptIcon, XIcon } from './icons';

interface Props {
  open: boolean;
  purchaseId: number | null;
  onClose: () => void;
}

export function PurchaseDetailModal({ open, purchaseId, onClose }: Props) {
  const { t } = useI18n();
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3>{t('purchaseDetail.title')}</h3>
            <p>{detail ? detail.supplierName : t('purchaseDetail.sub')}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}><XIcon /></button>
        </div>

        <div className="modal-body">
          {loading && <div className="notif-empty">{t('common.loading')}</div>}
          {!loading && error && <div style={{ color: 'var(--rose)', fontSize: 13 }}>{error}</div>}

          {!loading && !error && detail && (
            <>
              {/* Header facts */}
              <div className="detail-grid">
                <div><span className="k">{t('purchaseDetail.supplier')}</span><span className="v">{detail.supplierName}</span></div>
                <div><span className="k">{t('purchaseDetail.project')}</span><span className="v">{detail.projectName ?? t('purchase.general')}</span></div>
                <div><span className="k">{t('purchaseDetail.date')}</span><span className="v">{formatDate(detail.date)}</span></div>
                <div><span className="k">{t('purchaseDetail.invoiceNumber')}</span><span className="v">{detail.invoiceNumber ?? '—'}</span></div>
                <div><span className="k">{t('purchaseDetail.recordedBy')}</span><span className="v">{detail.createdByName}</span></div>
              </div>

              {detail.notes && <div className="tl-note" style={{ marginTop: 4 }}>“{detail.notes}”</div>}

              {/* Lines */}
              <div className="table-wrap" style={{ marginTop: 14 }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t('purchaseDetail.item')}</th>
                      <th style={{ textAlign: 'end' }}>{t('purchaseDetail.qty')}</th>
                      <th style={{ textAlign: 'end' }}>{t('purchaseDetail.unitPrice')}</th>
                      <th style={{ textAlign: 'end' }}>{t('purchaseDetail.lineTotal')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((li) => (
                      <tr key={li.id}>
                        <td>
                          <div className="name">{li.itemName}</div>
                          <div className="email">{li.itemCode}</div>
                        </td>
                        <td style={{ textAlign: 'end' }}>{li.quantity} {li.unit}</td>
                        <td style={{ textAlign: 'end' }}>{formatMoney(li.unitPrice)}</td>
                        <td style={{ textAlign: 'end', fontWeight: 600 }}>{formatMoney(li.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grand-total" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
                <span>{t('purchaseDetail.total')}</span>
                <strong>{formatMoney(detail.total)}</strong>
              </div>
            </>
          )}

          {!loading && !error && !detail && (
            <div className="empty-state"><div className="empty-illus"><ReceiptIcon /></div></div>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
}
