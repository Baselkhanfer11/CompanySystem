import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { reportsApi } from '../api/reports';
import { useAuth } from '../auth/AuthContext';
import { canManage } from '../auth/roles';
import { BarList, type BarRow } from '../components/charts/BarList';
import { MonthlyChart } from '../components/charts/MonthlyChart';
import { BoxesIcon, ProjectsIcon, ReceiptIcon, ShieldIcon, WalletIcon } from '../components/icons';
import { ProjectCostModal } from '../components/ProjectCostModal';
import { StatCard } from '../components/StatCard';
import { useI18n } from '../i18n/LanguageContext';
import { formatUsd, formatUsdShort } from '../lib/format';
import { PERIODS, periodRange, type Period } from '../lib/reports';
import type { ProjectCostRow, ProjectCostsReport } from '../types';

export function CostsPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const allowed = canManage(user?.role);

  const [period, setPeriod] = useState<Period>('all');
  const range = useMemo(() => periodRange(period), [period]);

  const [report, setReport] = useState<ProjectCostsReport | null>(null);
  const [loading, setLoading] = useState(true); // first load only (skeletons)
  const [refreshing, setRefreshing] = useState(false); // later reloads keep the old view, faded
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [selected, setSelected] = useState<ProjectCostRow | null>(null);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    setRefreshing(true);
    setError('');
    reportsApi.projectCosts(range)
      .then((r) => { if (active) setReport(r); })
      .catch((e) => { if (active) setError((e as Error).message); })
      .finally(() => { if (active) { setLoading(false); setRefreshing(false); } });
    return () => { active = false; };
  }, [range, allowed, reloadKey]);

  // Financial data — managers only (the API enforces this too).
  if (!allowed) {
    return (
      <div className="empty-state" style={{ paddingTop: 100 }}>
        <div className="empty-illus"><ShieldIcon /></div>
        <h4>{t('costs.managersOnly')}</h4>
        <p>{t('costs.noPermission')}</p>
      </div>
    );
  }

  const periodLabel = t(`costs.period.${period}`);
  const purchasesLabel = (n: number) => (n === 1 ? t('purchase.countOne', { n }) : t('purchase.countMany', { n }));
  const shareOfTotal = (part: number) =>
    report && report.totalSpend > 0 ? t('costs.shareOfTotal', { p: Math.round((part / report.totalSpend) * 100) }) : undefined;

  // Projects biggest-first (from the API), then the General bucket, grayed out.
  const rows: BarRow[] = report
    ? report.projects.map((p) => ({
        key: p.projectId ?? 'general',
        label: p.name,
        sub: p.code ?? undefined,
        value: p.total,
        meta: purchasesLabel(p.purchaseCount),
        onClick: () => setSelected(p),
      }))
    : [];
  if (report && report.general.purchaseCount > 0) {
    rows.push({
      key: 'general',
      label: t('purchase.general'),
      sub: t('costs.generalHint'),
      value: report.general.total,
      meta: purchasesLabel(report.general.purchaseCount),
      muted: true,
      onClick: () => setSelected(report.general),
    });
  }

  const money = (n: number) => <span title={formatUsd(n)}>{formatUsdShort(n)}</span>;

  return (
    <div>
      <div className="page-header">
        <h1>{t('costs.title')}</h1>
        <p>{t('costs.sub')}</p>
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
              <div className="skeleton" style={{ width: 42, height: 42, borderRadius: 12, marginBottom: 16 }} />
              <div className="skeleton" style={{ height: 26, width: '60%', marginBottom: 10 }} />
              <div className="skeleton" style={{ height: 12, width: '40%' }} />
            </div>
          ))}
        </div>
      )}

      {!loading && !report && error && (
        <div className="empty-state">
          <div className="empty-illus" style={{ background: 'rgba(251,113,133,0.1)', borderColor: 'rgba(251,113,133,0.25)' }}>
            <WalletIcon style={{ color: 'var(--rose)' }} />
          </div>
          <h4>{t('costs.couldntLoad')}</h4>
          <p>{error}. {t('common.backendHint')}</p>
          <button className="btn btn-ghost" onClick={() => setReloadKey((k) => k + 1)}>{t('common.tryAgain')}</button>
        </div>
      )}

      {report && (
        <div className={`costs-body ${refreshing ? 'refreshing' : ''}`}>
          {error && <div className="inline-error">{error}</div>}

          <div className="stat-grid">
            <StatCard icon={<WalletIcon />} value={money(report.totalSpend)} label={t('costs.totalSpend')} color="#7c6cff" trend={periodLabel} delay={0} />
            <StatCard icon={<ProjectsIcon />} value={money(report.projectSpend)} label={t('costs.projectSpend')} color="#34d399" trend={shareOfTotal(report.projectSpend)} delay={70} />
            <StatCard icon={<BoxesIcon />} value={money(report.generalSpend)} label={t('costs.generalSpend')} color="#99a1b7" trend={shareOfTotal(report.generalSpend)} delay={140} />
            <StatCard icon={<ReceiptIcon />} value={report.purchaseCount} label={t('costs.purchases')} color="#fbbf24" trend={periodLabel} delay={210} />
          </div>

          {report.purchaseCount === 0 ? (
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
                  <BarList rows={rows} format={formatUsd} total={report.totalSpend} />
                </div>
              </div>

              <div className="panel rise" style={{ animationDelay: '80ms' }}>
                <div className="panel-head">
                  <div>
                    <h3>{t('costs.monthly')}</h3>
                    <div className="sub">{periodLabel}</div>
                  </div>
                </div>
                <div style={{ padding: '14px 18px 16px' }}>
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
