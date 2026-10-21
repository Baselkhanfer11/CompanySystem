import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { reportsApi } from '../api/reports';
import { useAuth } from '../auth/AuthContext';
import { canManage } from '../auth/roles';
import { BarList, type BarRow } from '../components/charts/BarList';
import { MonthlyChart } from '../components/charts/MonthlyChart';
import { BoxesIcon, ProjectsIcon, ReceiptIcon, ShieldIcon, SwapIcon, WalletIcon } from '../components/icons';
import { ExportButton } from '../components/ExportButton';
import { ProjectCostModal } from '../components/ProjectCostModal';
import { StatCard } from '../components/StatCard';
import { LoadError } from '../components/States';
import { useI18n } from '../i18n/LanguageContext';
import { useCached } from '../lib/cache';
import { formatUsd, formatUsdShort } from '../lib/format';
import { PERIODS, periodRange, type Period } from '../lib/reports';
import { sheet } from '../lib/xlsx';
import type { MonthlySpend, ProjectCostRow, ProjectCostsReport } from '../types';

export function CostsPage() {
  const { t } = useI18n();
  const { user } = useAuth();

  // Financial data — managers only (the API enforces this too).
  if (!canManage(user?.role)) {
    return (
      <div className="empty-state" style={{ paddingTop: 100 }}>
        <div className="empty-illus"><ShieldIcon /></div>
        <h4>{t('costs.managersOnly')}</h4>
        <p>{t('costs.noPermission')}</p>
      </div>
    );
  }
  return <CostsReport />;
}

function CostsReport() {
  const { t } = useI18n();
  const [period, setPeriod] = useState<Period>('all');
  const range = useMemo(() => periodRange(period), [period]);

  // Each period is cached on its own: the last copy shows at once, and it's always re-checked.
  const fetchReport = useCallback(() => reportsApi.projectCosts(range), [range]);
  const costs = useCached(`costs:${range.from ?? ''}:${range.to ?? ''}`, fetchReport, 0);

  // Switching to a period not loaded yet keeps the last report on screen, faded,
  // until the new one arrives. (Remembered while rendering, React's way to follow
  // a changing value — no extra render pass.)
  const [lastShown, setLastShown] = useState<ProjectCostsReport | null>(null);
  if (costs.data && costs.data !== lastShown) setLastShown(costs.data);
  const report = costs.data ?? lastShown;
  const error = costs.error;
  const loading = !report && !error; // first load only (skeletons)
  const refreshing = !costs.data && !error && !!lastShown; // a new period on its way

  const [selected, setSelected] = useState<ProjectCostRow | null>(null);

  const periodLabel = t(`costs.period.${period}`);
  const purchasesLabel = (n: number) => (n === 1 ? t('purchase.countOne', { n }) : t('purchase.countMany', { n }));
  const movementsLabel = (n: number) => (n === 1 ? t('stock.countOne', { n }) : t('stock.countMany', { n }));
  // "3 purchases · 2 movements" — only the parts that aren't zero.
  const countsLabel = (r: ProjectCostRow) =>
    [r.purchaseCount > 0 && purchasesLabel(r.purchaseCount), r.movementCount > 0 && movementsLabel(r.movementCount)]
      .filter(Boolean).join(' · ') || undefined;

  // Projects, most expensive first (from the API).
  const rows: BarRow[] = report
    ? report.projects.map((p) => ({
        key: p.projectId ?? 'warehouse',
        label: p.name,
        sub: p.code ?? undefined,
        value: p.total,
        meta: countsLabel(p),
        onClick: () => setSelected(p),
      }))
    : [];

  // The warehouse isn't a project cost, so it sits apart (grayed out) and
  // isn't part of the project shares.
  const warehouseRow: BarRow | null = report && report.warehouse.purchaseCount > 0
    ? {
        key: 'warehouse',
        label: t('costs.viewWarehouse'),
        sub: t('costs.generalHint'),
        value: report.warehouse.total,
        meta: purchasesLabel(report.warehouse.purchaseCount),
        muted: true,
        onClick: () => setSelected(report.warehouse),
      }
    : null;

  // Both bar lists share one scale, so the warehouse bar is comparable.
  const scaleMax = Math.max(0, ...rows.map((r) => r.value), warehouseRow?.value ?? 0);

  const money = (n: number) => <span title={formatUsd(n)}>{formatUsdShort(n)}</span>;

  // The Excel file for the chosen period: costs per project (warehouse last), and per month.
  const exportSheets = () => !report ? [] : [
    sheet<ProjectCostRow>(t('costs.byProject'), [
      { header: t('project.colName'), value: (r) => (r.projectId === null ? t('costs.viewWarehouse') : r.name) },
      { header: t('project.colCode'), value: (r) => r.code },
      { header: t('project.colStatus'), value: (r) => (r.status ? t(`project.status.${r.status}`) : null) },
      { header: t('costDetail.total'), type: 'money', value: (r) => r.total },
      { header: t('xl.delivered'), type: 'money', value: (r) => r.delivered },
      { header: t('xl.fromWarehouse'), type: 'money', value: (r) => r.fromWarehouse },
      { header: t('xl.purchaseCount'), type: 'number', value: (r) => r.purchaseCount },
      { header: t('xl.movementCount'), type: 'number', value: (r) => r.movementCount },
    ], report.warehouse.purchaseCount > 0 ? [...report.projects, report.warehouse] : report.projects),
    sheet<MonthlySpend>(t('costs.monthly'), [
      { header: t('xl.month'), value: (m) => new Date(m.year, m.month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) },
      { header: t('costDetail.total'), type: 'money', value: (m) => m.total },
    ], report.monthly),
  ];

  return (
    <div>
      <div className="page-header with-actions">
        <div>
          <h1>{t('costs.title')}</h1>
          <p>{t('costs.sub')}</p>
        </div>
        <div className="page-actions">
          <ExportButton
            fileName={`costs-${period}`}
            sheets={exportSheets}
            disabled={!report || (report.purchaseCount === 0 && report.movementCount === 0)}
          />
        </div>
      </div>

      {/* One filter row — it scopes every tile and chart below it. */}
      <div className="filter-row">
        <div className="seg" role="group" aria-label={t('costs.periodLabel')}>
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              className={`seg-btn ${period === p ? 'on' : ''}`}
              aria-pressed={period === p}
              onClick={() => setPeriod(p)}
            >
              {t(`costs.period.${p}`)}
            </button>
          ))}
        </div>
        {refreshing && !loading && <span className="spinner" aria-label={t('common.loading')} />}
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
        <LoadError icon={<WalletIcon />} title={t('costs.couldntLoad')} error={error} onRetry={() => void costs.refresh()} />
      )}

      {report && (
        <div className={`costs-body ${refreshing ? 'refreshing' : ''}`}>
          {error && <div className="inline-error">{error}</div>}

          <div className="stat-grid">
            <StatCard icon={<ProjectsIcon />} value={money(report.projectCost)} label={t('costs.projectSpend')} color="#7c6cff" trend={periodLabel} delay={0} />
            <StatCard icon={<ReceiptIcon />} value={money(report.purchaseTotal)} label={t('costs.totalSpend')} color="#34d399" trend={purchasesLabel(report.purchaseCount)} delay={70} />
            <StatCard icon={<BoxesIcon />} value={money(report.warehousePurchases)} label={t('costs.generalSpend')} color="#99a1b7" trend={t('costs.generalHint')} delay={140} />
            <StatCard icon={<SwapIcon />} value={money(report.sentFromWarehouse)} label={t('costs.sentFromWarehouse')} color="#fbbf24" trend={t('costs.netOfReturns')} delay={210} />
          </div>

          {report.purchaseCount === 0 && report.movementCount === 0 ? (
            <div className="panel rise">
              <div className="empty-state">
                <div className="empty-illus"><WalletIcon /></div>
                <h4>{t('costs.noneInPeriod')}</h4>
                <p>{t('costs.noneHint')}</p>
                <Link className="btn btn-primary" to="/purchases">{t('costs.goPurchases')}</Link>
              </div>
            </div>
          ) : (
            <div className="costs-cols">
              <div className="panel rise">
                <div className="panel-head">
                  <div>
                    <h3>{t('costs.byProject')}</h3>
                    <div className="sub">{t('costs.byProjectSub')}</div>
                  </div>
                </div>
                <div style={{ padding: 10 }}>
                  <BarList rows={rows} format={formatUsd} total={report.projectCost} scaleMax={scaleMax} />
                  {warehouseRow && (
                    <div className="barlist-apart">
                      <BarList rows={[warehouseRow]} format={formatUsd} scaleMax={scaleMax} />
                    </div>
                  )}
                </div>
              </div>

              <div className="panel rise" style={{ animationDelay: '80ms' }}>
                <div className="panel-head">
                  <div>
                    <h3>{t('costs.monthly')}</h3>
                    <div className="sub">{periodLabel}</div>
                  </div>
                </div>
                <div style={{ padding: '16px 20px' }}>
                  <MonthlyChart data={report.monthly} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <ProjectCostModal
        open={!!selected}
        row={selected}
        range={range}
        periodLabel={periodLabel}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
