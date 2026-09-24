import { useMemo } from 'react';
import { useItems } from '../data/ItemsContext';
import { usePrices } from '../data/queries';
import { useI18n } from '../i18n/LanguageContext';
import { formatDate, formatUsd } from '../lib/format';
import { bestRecent, indexPrices, isRecent } from '../lib/prices';
import type { Supplier } from '../types';
import { XIcon } from './icons';

// "What we buy from this supplier": item by item, their last and average
// price — and whether someone else is cheaper right now.
export function SupplierPricesModal({ supplier, onClose }: { supplier: Supplier | null; onClose: () => void }) {
  const { t } = useI18n();
  const prices = usePrices();
  const { items } = useItems();
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const idx = useMemo(() => indexPrices(prices.data ?? []), [prices.data]);

  if (!supplier) return null;
  const rows = (prices.data ?? [])
    .filter((p) => p.supplierId === supplier.id)
    .sort((a, b) => (b.lastDate > a.lastDate ? 1 : -1));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head with-close">
          <div>
            <h3>{t('prices.supplierTitle', { name: supplier.name })}</h3>
            <p>{t('prices.supplierSub')}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}><XIcon /></button>
        </div>

        <div className="modal-body">
          {prices.loading && <div className="field-hint">{t('common.loading')}</div>}
          {prices.error && <div className="form-error" role="alert">{prices.error}</div>}
          {!prices.loading && !prices.error && rows.length === 0 && <div className="field-hint">{t('prices.noItems')}</div>}

          {rows.length > 0 && (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t('prices.colItem')}</th>
                    <th className="num">{t('prices.colLast')}</th>
                    <th className="num">{t('prices.colAvg')}</th>
                    <th className="num">{t('prices.colBought')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const item = itemsById.get(p.itemId);
                    const best = bestRecent(idx, p.itemId);
                    const cheaper = best && best.supplierId !== p.supplierId && best.lastPrice < p.lastPrice ? best : null;
                    return (
                      <tr key={p.itemId} className={isRecent(p) ? undefined : 'price-row-old'}>
                        <td>
                          <div className="name">{item?.name ?? `#${p.itemId}`}</div>
                          <div className="price-tags">
                            {best?.supplierId === p.supplierId && <span className="badge active"><span className="dot" />{t('prices.best')}</span>}
                            {cheaper && <span className="price-change warn">{t('prices.cheaperAt', { supplier: cheaper.supplierName, price: formatUsd(cheaper.lastPrice) })}</span>}
                            {!isRecent(p) && <span className="email">{t('prices.old')}</span>}
                          </div>
                        </td>
                        <td className="num">
                          <strong>{formatUsd(p.lastPrice)}</strong>
                          <div className="email">{formatDate(p.lastDate)}</div>
                        </td>
                        <td className="num">{formatUsd(p.avgPrice)}</td>
                        <td className="num" style={{ color: 'var(--text-muted)' }}>
                          {t('prices.boughtTimes', { n: p.timesBought, qty: `${p.totalQuantity} ${item?.unit ?? ''}`.trim() })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
}
