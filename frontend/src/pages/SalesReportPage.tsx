import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { reportsApi } from '../api/reports';
import { useAuth } from '../auth/AuthContext';
import { canManage } from '../auth/roles';
import { BarList, type BarRow } from '../components/charts/BarList';
import { MonthlyChart } from '../components/charts/MonthlyChart';
import { ExportButton } from '../components/ExportButton';
import { BoxesIcon, ShieldIcon, SparkIcon, TrendingIcon, WalletIcon } from '../components/icons';
import { StatCard } from '../components/StatCard';
import { LoadError } from '../components/States';
import { useI18n } from '../i18n/LanguageContext';
import { useCached } from '../lib/cache';
import { formatUsd, formatUsdShort } from '../lib/format';
import { PERIODS, periodRange, type Period } from '../lib/reports';
import { sheet } from '../lib/xlsx';
import type { CustomerSales, ItemSales, SalesMonth, SalesReport } from '../types';

export function SalesReportPage() {
  const { t } = useI18n();
  const { user } = useAuth();

  // Profit needs what the material cost — managers only (the API enforces this too).
  if (!canManage(user?.role)) {
    return (
      <div className="empty-state" style={{ paddingTop: 100 }}>
        <div className="empty-illus"><ShieldIcon /></div>
        <h4>{t('costs.managersOnly')}</h4>
        <p>{t('salesReport.noPermission')}</p>
      </div>
    );
  }
  return <SalesReportView />;
}

// Profit as a share of revenue, e.g. "35.7%".
const pct = (n: number | null) => (n === null ? '—' : `${n.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`);
const margin = (profit: number, revenue: number) => (revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : null);

function SalesReportView() {
  const { t } = useI18n();
  const [period, setPeriod] = useState<Period>('year');
  const range = useMemo(() => periodRange(period), [period]);

  // Each period is cached on its own: the last copy shows at once, and it's always re-checked.
  const fetchReport = useCallback(() => reportsApi.sales(range), [range]);
  const sales = useCached(`salesReport:${range.from ?? ''}:${range.to ?? ''}`, fetchReport, 0);

  // A period not loaded yet keeps the last report on screen, faded, until it arrives.
  const [lastShown, setLastShown] = useState<SalesReport | null>(null);
  if (sales.data && sales.data !== lastShown) setLastShown(sales.data);
  const report = sales.data ?? lastShown;
  const error = sales.error;
  const loading = !report && !error;
  const refreshing = !sales.data && !error && !!lastShown;

  const periodLabel = t(`costs.period.${period}`);
  const money = (n: number) => <span title={formatUsd(n)}>{formatUsdShort(n)}</span>;
  const salesCount = (n: number) => (n === 1 ? t('sale.countOne', { n }) : t('sale.countMany', { n }));

  // Customers and items, most revenue first (from the API). Bars are revenue;
  // the profit sits next to the amount, the counts under the name (so a long
  // detail line never squeezes the name).
  const customerRows: BarRow[] = report
    ? report.byCustomer.map((c) => ({
        key: c.customerId,
        label: c.name,
        sub: [salesCount(c.saleCount), c.owed > 0 ? t('salesReport.owes', { amount: formatUsd(c.owed) }) : null].filter(Boolean).join(' · '),
        value: c.revenue,
        meta: t('salesReport.profitOf', { amount: formatUsd(c.profit) }),
      }))
    : [];
  const itemRows: BarRow[] = report
    ? report.byItem.map((i) => ({
        key: i.itemId,
        label: i.name,
        sub: `${i.code} · ${i.quantity.toLocaleString('en-US')} ${i.unit}`,
        value: i.revenue,
        meta: `${t('salesReport.profitOf', { amount: formatUsd(i.profit) })} (${pct(margin(i.profit, i.revenue))})`,
      }))
    : [];

  // The revenue chart reuses the month chart (one series: revenue).
  const revenueByMonth = report ? report.monthly.map((m) => ({ year: m.year, month: m.month, total: m.revenue })) : [];

  // The Excel file: per month, per customer and per item, with cost and profit.
  const monthName = (m: SalesMonth) => new Date(m.year, m.month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const exportSheets = () => !report ? [] : [
    sheet<SalesMonth>(t('salesReport.monthly'), [
      { header: t('xl.month'), value: monthName },
      { header: t('salesReport.revenue'), type: 'money', value: (m) => m.revenue },
      { header: t('salesReport.cost'), type: 'money', value: (m) => m.cost },
      { header: t('salesReport.profit'), type: 'money', value: (m) => m.profit },
    ], report.monthly),
    sheet<CustomerSales>(t('salesReport.byCustomer'), [
      { header: t('customer.colName'), value: (c) => c.name },
      { header: t('customer.colCode'), value: (c) => c.code },
      { header: t('customer.colSales'), type: 'number', value: (c) => c.saleCount },
      { header: t('salesReport.revenue'), type: 'money', value: (c) => c.revenue },
      { header: t('salesReport.profit'), type: 'money', value: (c) => c.profit },
      { header: t('sale.colOwed'), type: 'money', value: (c) => c.owed },
    ], report.byCustomer),
    sheet<ItemSales>(t('salesReport.byItem'), [
      { header: t('saleDetail.item'), value: (i) => i.name },
      { header: t('customer.colCode'), value: (i) => i.code },
      { header: t('xl.quantity'), type: 'number', value: (i) => i.quantity },
      { header: t('xl.unit'), value: (i) => i.unit },
      { header: t('salesReport.revenue'), type: 'money', value: (i) => i.revenue },
      { header: t('salesReport.cost'), type: 'money', value: (i) => i.cost },
      { header: t('salesReport.profit'), type: 'money', value: (i) => i.profit },
    ], report.byItem),
  ];

  return (
    <div>
      <div className="page-header with-actions">
        <div>
          <h1>{t('salesReport.title')}</h1>
          <p>{t('salesReport.sub')}</p>
        </div>
        <div className="page-actions">
          <ExportButton fileName={`sales-report-${period}`} sheets={exportSheets} disabled={!report || report.saleCount === 0} />
        </div>
      </div>

      {/* One filter row — it scopes every tile and chart below it. */}
      <div className="filter-row">
        <div className="seg" role="group" aria-label={t('costs.periodLabel')}>
          {PERIODS.map((p) => (
            <button key={p} type="button" className={`seg-btn ${period === p ? 'on' : ''}`} aria-pressed={period === p} onClick={() => setPeriod(p)}>
              {t(`costs.period.${p}`)}
            </button>
          ))}
        </div>
        {refreshing && <span className="spinner" aria-label={t('common.loading')} />}
      </div>

      {loading && (
        <div className="stat-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="stat-card">
              <div className="skeleton" style={{ width: 42, height: 42, borderRadius: 'var(--radius-md)', marginBottom: 16 }} />
              <div className="skeleton" style={{ height: 26, width: '60%', marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 12, width: '40%' }} />
            </div>
          ))}
        </div>
      )}

      {!loading && !report && error && (
        <LoadError icon={<SparkIcon />} title={t('salesReport.couldntLoad')} error={error} onRetry={() => void sales.refresh()} />
      )}

      {report && (
        <div className={`costs-body ${refreshing ? 'refreshing' : ''}`}>
          {error && <div className="inline-error">{error}</div>}

          <div className="stat-grid">
            <StatCard icon={<TrendingIcon />} value={money(report.revenue)} label={t('salesReport.revenue')} color="#7c6cff" trend={salesCount(report.saleCount)} delay={0} />
            <StatCard icon={<SparkIcon />} value={money(report.profit)} label={t('salesReport.profit')} color="#34d399" trend={t('salesReport.margin', { p: pct(report.marginPercent) })} delay={70} />
            <StatCard icon={<BoxesIcon />} value={money(report.cost)} label={t('salesReport.cost')} color="#99a1b7" trend={t('salesReport.costHint')} delay={140} />
            <StatCard icon={<WalletIcon />} value={money(report.collected)} label={t('salesReport.collected')} color="#38bdf8" trend={t('salesReport.collectedHint')} delay={210} />
          </div>

          {report.saleCount === 0 ? (
            <div className="panel rise">
              <div className="empty-state">
                <div className="empty-illus"><SparkIcon /></div>
                <h4>{t('salesReport.noneInPeriod')}</h4>
                <p>{t('salesReport.noneHint')}</p>
                <Link className="btn btn-primary" to="/sales">{t('salesReport.goSales')}</Link>
              </div>
            </div>
          ) : (
            <>
              <div className="costs-cols">
                <div className="panel rise">
                  <div className="panel-head">
                    <div>
                      <h3>{t('salesReport.byCustomer')}</h3>
                      <div className="sub">{t('salesReport.byCustomerSub')}</div>
                    </div>
                  </div>
                  <div style={{ padding: 10 }}>
                    <BarList rows={customerRows} format={formatUsd} total={report.revenue} />
                  </div>
                </div>

                <div className="panel rise" style={{ animationDelay: '80ms' }}>
                  <div className="panel-head">
                    <div>
                      <h3>{t('salesReport.monthly')}</h3>
                      <div className="sub">{periodLabel}</div>
                    </div>
                  </div>
                  <div style={{ padding: '16px 20px' }}>
                    <MonthlyChart data={revenueByMonth} />
                  </div>
                </div>
              </div>

              <div className="panel rise" style={{ marginTop: 'var(--sp-5)', animationDelay: '140ms' }}>
                <div className="panel-head">
                  <div>
                    <h3>{t('salesReport.byItem')}</h3>
                    <div className="sub">{t('salesReport.byItemSub')}</div>
                  </div>
                </div>
                <div style={{ padding: 10 }}>
                  <BarList rows={itemRows} format={formatUsd} total={report.revenue} />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
