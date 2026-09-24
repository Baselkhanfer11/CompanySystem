import { useCallback, useMemo } from 'react';
import { pricesApi } from '../api/prices';
import { usePrices } from '../data/queries';
import { useI18n } from '../i18n/LanguageContext';
import { useCached } from '../lib/cache';
import { formatDate, formatUsd } from '../lib/format';
import { bestRecent, indexPrices, isRecent, pctChange } from '../lib/prices';
import type { Item, PriceHistoryLine } from '../types';
import { TrendingIcon, XIcon } from './icons';

// "Price history" for one store item: what each supplier charged, who's the
// cheapest right now, and every past purchase.
export function PriceHistoryModal({ item, onClose }: { item: Item | null; onClose: () => void }) {
  if (!item) return null;
  return <PriceHistoryBody item={item} onClose={onClose} />;
}

function PriceHistoryBody({ item, onClose }: { item: Item; onClose: () => void }) {
  const { t } = useI18n();
  const prices = usePrices();
  // Re-checked every time it opens (maxAge 0), showing the last copy meanwhile.
  const fetchHistory = useCallback(() => pricesApi.itemHistory(item.id), [item.id]);
  const history = useCached(`priceHistory:${item.id}`, fetchHistory, 0);

  const idx = useMemo(() => indexPrices(prices.data ?? []), [prices.data]);
  const bySupplier = idx.get(item.id) ?? [];
  const best = bestRecent(idx, item.id);
  const lines: PriceHistoryLine[] = history.data ?? [];
  const last = lines[0];
  const spent = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const qty = lines.reduce((s, l) => s + l.quantity, 0);

  // Each purchase compared with the one before it from the same supplier.
  const changeOf = (i: number) => {
    const prev = lines.slice(i + 1).find((l) => l.supplierId === lines[i].supplierId);
    return prev ? pctChange(lines[i].unitPrice, prev.unitPrice) : 0;
  };

  const loading = prices.loading || history.loading;
  const error = prices.error || history.error;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head with-close">
          <div>
            <h3>{item.name}</h3>
            <p>{t('prices.title')} · {item.code} · {t('prices.storePrice', { price: formatUsd(item.price) })}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}><XIcon /></button>
        </div>

        <div className="modal-body">
          {loading && <div className="field-hint">{t('common.loading')}</div>}
          {!loading && error && <div className="form-error" role="alert">{error}</div>}

          {!loading && !error && lines.length === 0 && (
            <div className="empty-state" style={{ padding: '24px 12px' }}>
              <div className="empty-illus"><TrendingIcon /></div>
              <h4>{t('prices.none')}</h4>
              <p>{t('prices.noneSub')}</p>
            </div>
          )}

          {!loading && !error && lines.length > 0 && (
            <>
              <div className="mini-stats">
                <div>
                  <span className="k">{t('prices.lastPaid')}</span>
                  <span className="v">{formatUsd(last.unitPrice)}</span>
                  <span className="field-hint" style={{ marginTop: 0 }}>{last.supplierName} · {formatDate(last.date)}</span>
                </div>
                <div>
                  <span className="k">{t('prices.bestNow')}</span>
                  <span className="v" style={{ color: best ? 'var(--emerald)' : undefined }}>{best ? formatUsd(best.lastPrice) : '—'}</span>
                  <span className="field-hint" style={{ marginTop: 0 }}>{best ? best.supplierName : t('prices.noneRecent')}</span>
                </div>
                <div>
                  <span className="k">{t('prices.avgPaid')}</span>
                  <span className="v">{formatUsd(qty > 0 ? spent / qty : 0)}</span>
                  <span className="field-hint" style={{ marginTop: 0 }}>{t('prices.overPurchases', { n: lines.length })}</span>
                </div>
              </div>

              <div>
                <div className="cost-section-title">{t('prices.bySupplier')}</div>
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>{t('prices.colSupplier')}</th>
                        <th className="num">{t('prices.colLast')}</th>
                        <th className="num">{t('prices.colMin')}</th>
                        <th className="num">{t('prices.colAvg')}</th>
                        <th className="num">{t('prices.colBought')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bySupplier.map((p) => {
                        const stale = !isRecent(p);
                        return (
                          <tr key={p.supplierId} className={stale || !p.supplierActive ? 'price-row-old' : undefined}>
                            <td>
                              <div className="name">{p.supplierName}</div>
                              <div className="price-tags">
                                {best?.supplierId === p.supplierId && <span className="badge active"><span className="dot" />{t('prices.best')}</span>}
                                {!p.supplierActive && <span className="badge inactive">{t('common.inactive')}</span>}
                                {p.supplierActive && stale && <span className="email">{t('prices.old')}</span>}
                              </div>
                            </td>
                            <td className="num">
                              <strong>{formatUsd(p.lastPrice)}</strong>
                              <div className="email">{formatDate(p.lastDate)}</div>
                            </td>
                            <td className="num">{formatUsd(p.minPrice)}</td>
                            <td className="num">{formatUsd(p.avgPrice)}</td>
                            <td className="num" style={{ color: 'var(--text-muted)' }}>
                              {t('prices.boughtTimes', { n: p.timesBought, qty: `${p.totalQuantity} ${item.unit}` })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="field-hint">{t('prices.recentHint')}</div>
              </div>

              <div>
                <div className="cost-section-title">{t('prices.purchases')}</div>
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>{t('prices.colDate')}</th>
                        <th>{t('prices.colSupplier')}</th>
                        <th>{t('prices.colTo')}</th>
                        <th className="num">{t('prices.colQty')}</th>
                        <th className="num">{t('prices.colPrice')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((l, i) => {
                        const change = changeOf(i);
                        return (
                          <tr key={`${l.purchaseId}-${i}`}>
                            <td style={{ color: 'var(--text-muted)' }}>{formatDate(l.date)}</td>
                            <td>
                              <div className="name">{l.supplierName}</div>
                              {l.invoiceNumber && <div className="email">{l.invoiceNumber}</div>}
                            </td>
                            <td style={{ color: l.deliveredTo ? undefined : 'var(--text-muted)' }}>{l.deliveredTo ?? t('stock.warehouse')}</td>
                            <td className="num">{l.quantity} {item.unit}</td>
                            <td className="num">
                              <strong>{formatUsd(l.unitPrice)}</strong>
                              {change !== 0 && (
                                <div className={`price-change ${change > 0 ? 'up' : 'down'}`}>
                                  {change > 0 ? '↑' : '↓'} {Math.abs(change)}%
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
}
