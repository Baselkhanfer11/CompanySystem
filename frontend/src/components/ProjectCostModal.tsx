import { useEffect, useState } from 'react';
import { reportsApi, type DateRange } from '../api/reports';
import { useI18n } from '../i18n/LanguageContext';
import { formatDate, formatUsd } from '../lib/format';
import type { ProjectCostDetail, ProjectCostRow } from '../types';
import { BarList } from './charts/BarList';
import { MonthlyChart } from './charts/MonthlyChart';
import { XIcon } from './icons';

interface Props {
  open: boolean;
  row: ProjectCostRow | null; // the project (or General bucket) that was clicked
  range: DateRange;
  periodLabel: string;
  onClose: () => void;
}

export function ProjectCostModal({ open, row, range, periodLabel, onClose }: Props) {
  const { t } = useI18n();
  const [detail, setDetail] = useState<ProjectCostDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !row) return;
    let active = true;
    setLoading(true);
    setError('');
    setDetail(null);
    reportsApi.projectCostDetail(row.projectId, range)
      .then((d) => { if (active) setDetail(d); })
      .catch((e) => { if (active) setError((e as Error).message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open, row, range]);

  if (!open || !row) return null;

  const isGeneral = row.projectId === null;
  const title = isGeneral ? t('purchase.general') : row.name;
  const purchasesLabel = (n: number) => (n === 1 ? t('purchase.countOne', { n }) : t('purchase.countMany', { n }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3>{title}</h3>
            <p>{[isGeneral ? t('costs.generalHint') : row.code, periodLabel].filter(Boolean).join(' · ')}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}><XIcon /></button>
        </div>

        <div className="modal-body">
          {loading && <div className="notif-empty">{t('common.loading')}</div>}
          {!loading && error && <div style={{ color: 'var(--rose)', fontSize: 13 }}>{error}</div>}

          {!loading && !error && detail && (
            <>
              <div className="mini-stats">
                <div><span className="k">{t('costDetail.total')}</span><span className="v">{formatUsd(detail.total)}</span></div>
                <div><span className="k">{t('costDetail.purchases')}</span><span className="v">{detail.purchaseCount}</span></div>
                <div><span className="k">{t('costDetail.suppliers')}</span><span className="v">{detail.bySupplier.length}</span></div>
              </div>

              {detail.total === 0 ? (
                <div className="chart-empty">{t('costs.noneInPeriod')}</div>
              ) : (
                <>
                  <section>
                    <h4 className="cost-section-title">{t('costs.monthly')}</h4>
                    <MonthlyChart data={detail.monthly} height={140} maxLabels={6} />
                  </section>

                  <section>
                    <h4 className="cost-section-title">{t('costDetail.bySupplier')}</h4>
                    <BarList
                      rows={detail.bySupplier.map((s) => ({
                        key: s.supplierId,
                        label: s.name,
                        value: s.total,
                        meta: purchasesLabel(s.purchaseCount),
                      }))}
                      format={formatUsd}
                      total={detail.total}
                    />
                  </section>

                  <section>
                    <h4 className="cost-section-title">{t('costDetail.topItems')}</h4>
                    <div className="table-wrap">
                      <table className="data num-cols">
                        <thead>
                          <tr>
                            <th>{t('purchaseDetail.item')}</th>
                            <th style={{ textAlign: 'end' }}>{t('purchaseDetail.qty')}</th>
                            <th style={{ textAlign: 'end' }}>{t('costDetail.spent')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.byItem.map((i) => (
                            <tr key={i.itemId}>
                              <td><div className="name">{i.name}</div><div className="email">{i.code}</div></td>
                              <td style={{ textAlign: 'end' }}>{i.quantity} {i.unit}</td>
                              <td style={{ textAlign: 'end', fontWeight: 600 }}>{formatUsd(i.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section>
                    <h4 className="cost-section-title">{t('costDetail.recent')}</h4>
                    <div className="table-wrap">
                      <table className="data num-cols">
                        <thead>
                          <tr>
                            <th>{t('purchase.colDate')}</th>
                            <th>{t('purchase.colSupplier')}</th>
                            <th>{t('purchase.colInvoice')}</th>
                            <th style={{ textAlign: 'end' }}>{t('purchase.colTotal')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.recent.map((p) => (
                            <tr key={p.id}>
                              <td style={{ color: 'var(--text-muted)' }}>{formatDate(p.date)}</td>
                              <td>{p.supplierName}</td>
                              <td><span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--text-muted)' }}>{p.invoiceNumber ?? '—'}</span></td>
                              <td style={{ textAlign: 'end', fontWeight: 600 }}>{formatUsd(p.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}
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
