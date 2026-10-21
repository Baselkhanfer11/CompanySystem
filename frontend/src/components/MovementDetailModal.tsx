import { useCallback } from 'react';
import { stockApi } from '../api/stock';
import { useMoney } from '../auth/useMoney';
import { useI18n } from '../i18n/LanguageContext';
import { useCached } from '../lib/cache';
import { formatDate, formatDateTime, formatMoney, formatTimeAgo } from '../lib/format';
import { movementPrintUrl } from '../lib/stock';
import { PrinterIcon, SwapIcon, XIcon } from './icons';
import { MovementBadge } from './MovementBadge';

interface Props {
  open: boolean;
  movementId: number | null;
  onClose: () => void;
}

// Rendered only while open. Shows the last copy at once (if there is one) and
// always re-checks the server, through the shared request cache.
export function MovementDetailModal(props: Props) {
  if (!props.open || props.movementId == null) return null;
  return <MovementDetailView key={props.movementId} {...props} movementId={props.movementId} />;
}

function MovementDetailView({ movementId, onClose }: Props & { movementId: number }) {
  const { t } = useI18n();
  const { costs } = useMoney(); // what a movement was worth: managers only
  const fetchDetail = useCallback(() => stockApi.getMovement(movementId), [movementId]);
  const { data: detail, loading, error } = useCached(`movement:${movementId}`, fetchDetail, 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head with-close">
          <div>
            <h3>{detail ? t(detail.type === 'Issue' ? 'movementModal.sendTitle' : 'movementModal.returnTitle') : t('stock.title')}</h3>
            <p>{detail ? t('stock.siteOf', { name: detail.projectName }) : ''}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}><XIcon /></button>
        </div>

        <div className="modal-body">
          {loading && <div className="notif-empty">{t('common.loading')}</div>}
          {!loading && error && <div className="form-error" role="alert">{error}</div>}

          {!loading && !error && detail && (
            <>
              <div className="detail-grid">
                <div><span className="k">{t('stock.colType')}</span><span className="v"><MovementBadge type={detail.type} /></span></div>
                <div><span className="k">{t('movementDetail.site')}</span><span className="v">{detail.projectName} · {detail.projectCode}</span></div>
                <div><span className="k">{t('purchaseDetail.date')}</span><span className="v">{formatDate(detail.date)}</span></div>
                <div>
                  <span className="k">{t('purchaseDetail.recordedBy')}</span>
                  <span className="v" title={formatDateTime(detail.createdAt)}>{detail.createdByName} · {formatTimeAgo(detail.createdAt, t)}</span>
                </div>
              </div>

              {detail.notes && <div className="tl-note" style={{ marginTop: 4 }}>“{detail.notes}”</div>}

              <div className="table-wrap" style={{ marginTop: 16 }}>
                <table className="data">
                  <thead>
                    <tr>
                      <th>{t('purchaseDetail.item')}</th>
                      <th className="num">{t('purchaseDetail.qty')}</th>
                      {costs && <th className="num">{t('movementDetail.unitCost')}</th>}
                      {costs && <th className="num">{t('purchaseDetail.lineTotal')}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.lines.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <div className="name">{l.itemName}</div>
                          <div className="email">{l.itemCode}</div>
                        </td>
                        <td className="num">{l.quantity} {l.unit}</td>
                        {costs && <td className="num">{formatMoney(l.unitCost)}</td>}
                        {costs && <td className="num" style={{ fontWeight: 600 }}>{formatMoney(l.lineTotal)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {costs && (
                <div className="grand-total" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
                  <span>{t('purchaseDetail.total')}</span>
                  <strong>{formatMoney(detail.total)}</strong>
                </div>
              )}
            </>
          )}

          {!loading && !error && !detail && (
            <div className="empty-state"><div className="empty-illus"><SwapIcon /></div></div>
          )}
        </div>

        <div className="modal-foot">
          {detail && (
            <a className="btn btn-ghost" href={movementPrintUrl(detail.id)} target="_blank" rel="noopener" title={t('print.hint')}>
              <PrinterIcon /> {t('print.button')}
            </a>
          )}
          <button className="btn btn-ghost" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
}
