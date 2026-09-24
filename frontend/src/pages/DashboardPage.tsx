import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Avatar } from '../components/Avatar';
import {
  AlertIcon, BoxesIcon, CartIcon, CheckIcon, ClipboardIcon, ProjectsIcon, SwapIcon, UndoIcon, UsersIcon, WalletIcon,
} from '../components/icons';
import { StatCard } from '../components/StatCard';
import { useItems } from '../data/ItemsContext';
import { useDashboard } from '../data/queries';
import { useI18n } from '../i18n/LanguageContext';
import { formatDateTime, formatTimeAgo, formatUsd, formatUsdShort } from '../lib/format';
import { STATUS_BADGE_CLASS } from '../lib/projects';
import { isLowStock, isOutOfStock } from '../lib/stock';
import type { Activity } from '../types';

const ATTENTION_ROWS = 5;

// Keep names/values as their own direction inside a sentence (matters in Arabic).
const iso = (s: string) => `⁨${s}⁩`;

export function DashboardPage() {
  const { t } = useI18n();
  const { user } = useAuth();

  // One request for the dashboard; stock and shortages come from the shared
  // cache the bell already keeps up to date — no extra requests for those.
  const { items, shortages } = useItems();
  const { data, loading, error } = useDashboard();
  const seesCosts = data?.costThisMonth != null; // the server leaves money out for non-managers

  // ---- tiles ----
  const short = shortages.filter((s) => s.toBuy > 0);
  const toBuyTotal = short.reduce((sum, s) => sum + s.estimatedCost, 0);
  const out = items.filter((i) => isOutOfStock(i.quantity));
  const low = items.filter((i) => isLowStock(i.quantity));
  const onHold = data?.projects.filter((p) => p.status === 'OnHold').length ?? 0;
  const money = (n: number) => <span title={formatUsd(n)}>{formatUsdShort(n)}</span>;

  const costTrend = () => {
    const now = data?.costThisMonth ?? 0;
    const before = data?.costLastMonth ?? 0;
    if (before <= 0) return { text: t('dash.firstMonth'), up: false };
    const pct = Math.round(((now - before) / before) * 100);
    if (pct === 0) return { text: t('dash.vsLastSame'), up: false };
    return pct > 0 ? { text: t('dash.vsLastUp', { p: pct }), up: true } : { text: t('dash.vsLastDown', { p: -pct }), up: false };
  };

  // ---- needs attention: shortages first (worst first), then empty stock nobody plans for ----
  const shortIds = new Set(short.map((s) => s.itemId));
  const attention = [
    ...short.map((s) => ({ key: `s-${s.itemId}`, kind: 'short' as const, s })),
    ...out.filter((i) => !shortIds.has(i.id)).map((i) => ({ key: `o-${i.id}`, kind: 'out' as const, i })),
  ].slice(0, ATTENTION_ROWS);

  // ---- activity sentences ----
  const itemList = (names: string[]) =>
    names.length <= 2 ? names.join(', ') : t('dash.andMore', { list: names.slice(0, 2).join(', '), n: names.length - 2 });
  const describe = (a: Activity) => {
    const vars = { actor: iso(a.actorName), items: iso(itemList(a.items)), supplier: iso(a.supplierName ?? ''), site: iso(a.projectName ?? '') };
    if (a.kind === 'Purchase') return t(a.projectName ? 'dash.act.purchaseSite' : 'dash.act.purchaseWarehouse', vars);
    return t(`dash.act.${a.kind}`, vars);
  };
  const activityIcon = { Purchase: <CartIcon />, Issue: <SwapIcon />, Return: <UndoIcon /> };
  const activityTone = { Purchase: 'ok', Issue: 'info', Return: 'warn' };

  const firstName = user?.fullName?.split(' ')[0] ?? '';

  return (
    <div>
      {/* Hero banner */}
      <div
        className="card rise"
        style={{
          padding: '28px 32px', marginBottom: 24, position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(120deg, rgba(124,108,255,0.18), rgba(176,108,255,0.06) 60%, transparent)',
        }}
      >
        <div style={{ position: 'absolute', insetInlineEnd: -30, top: -30, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,108,255,0.35), transparent 70%)', filter: 'blur(20px)' }} />
        <div className="eyebrow">
          {firstName ? t('dash.welcomeName', { name: firstName }) : t('dash.welcome')}
        </div>
        <h1 style={{ fontSize: 'var(--fs-2xl)', marginTop: 8 }}>{t('dash.overview')}</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 6, maxWidth: 520 }}>{t('dash.overviewSub2')}</p>
      </div>

      {error && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="empty-state" style={{ padding: 32 }}>
            <h4>{t('dash.couldntLoad')}</h4>
            <p>{error}. {t('common.backendHint')}</p>
          </div>
        </div>
      )}

      {/* Tiles — money first for managers, the team for everyone else */}
      <div className="stat-grid">
        {seesCosts ? (
          <StatCard icon={<WalletIcon />} value={money(data!.costThisMonth!)} label={t('dash.costMonth')} color="#7c6cff" trend={costTrend().text} trendUp={costTrend().up} delay={0} />
        ) : (
          <StatCard icon={<UsersIcon />} value={loading ? '—' : data?.activeEmployees ?? '—'} label={t('dash.team')} color="#7c6cff" trend={data ? t('dash.teamOf', { n: data.employees }) : undefined} delay={0} />
        )}
        <StatCard icon={<ClipboardIcon />} value={money(toBuyTotal)} label={t('dash.toBuy')} color="#fb7185" trend={short.length ? t('dash.toBuyItems', { n: short.length }) : t('dash.toBuyNone')} delay={70} />
        <StatCard icon={<BoxesIcon />} value={out.length + low.length} label={t('dash.alerts')} color="#fbbf24" trend={out.length + low.length ? t('dash.alertsDetail', { out: out.length, low: low.length }) : t('dash.alertsNone')} delay={140} />
        <StatCard icon={<ProjectsIcon />} value={loading ? '—' : data?.activeProjects ?? '—'} label={t('dash.activeProjects')} color="#34d399" trend={onHold ? t('dash.onHold', { n: onHold }) : undefined} delay={210} />
      </div>

      {/* Project progress + needs attention */}
      <div className="dash-cols dash-row-gap">
        <div className="panel rise" style={{ animationDelay: '80ms' }}>
          <div className="panel-head">
            <div><h3>{t('dash.progress')}</h3><div className="sub">{t('dash.progressSub')}</div></div>
            <Link className="btn btn-ghost" to="/projects">{t('dash.viewAll')}</Link>
          </div>
          <div className="dash-list">
            {loading && <Skeletons />}
            {data && data.projects.length === 0 && <div className="dash-empty">{t('dash.noOpenProjects')}</div>}
            {data?.projects.map((p) => (
              <Link key={p.id} to="/projects" className="dash-item">
                <div className="grow">
                  <div className="dash-item-head">
                    <span className="name">{p.name}</span>
                    <span className="code">{p.code}</span>
                    <span className={`badge ${STATUS_BADGE_CLASS[p.status] ?? 'inactive'}`} style={{ marginInlineStart: 'auto' }}>
                      <span className="dot" />{t(`project.status.${p.status}`)}
                    </span>
                  </div>
                  {p.hasPlan ? (
                    <>
                      <div className="plan-progress-track dash-bar" role="progressbar" aria-valuenow={p.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.name} — ${p.progress}%`}>
                        <span style={{ width: `${Math.min(p.progress, 100)}%` }} />
                      </div>
                      <div className="meta">
                        <strong>{t('plan.progressOf', { p: p.progress })}</strong>
                        <span>{p.stillToSpend > 0 ? t('dash.stillToSpend', { amount: formatUsd(p.stillToSpend) }) : t('dash.planDone')}</span>
                      </div>
                    </>
                  ) : (
                    <div className="meta"><span style={{ color: 'var(--text-dim)' }}>{t('dash.noPlan')}</span></div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="panel rise" style={{ animationDelay: '140ms' }}>
          <div className="panel-head">
            <div><h3>{t('dash.attention')}</h3><div className="sub">{t('dash.attentionSub')}</div></div>
          </div>
          <div className="dash-list">
            {attention.length === 0 ? (
              <div className="dash-empty"><span className="act-ic ok"><CheckIcon /></span>{t('dash.allGood')}</div>
            ) : attention.map((a) => a.kind === 'short' ? (
              <Link key={a.key} to="/to-buy" className="dash-item">
                <span className="act-ic crit"><AlertIcon /></span>
                <div className="grow">
                  <div className="name">{a.s.name}</div>
                  <div className="meta">
                    <span>{a.s.projects.length === 1 ? t('dash.forProject', { project: a.s.projects[0].projectName }) : t('dash.forProjects', { n: a.s.projects.length })}</span>
                  </div>
                </div>
                <span className="dash-amount crit">{t('dash.buy', { n: `${a.s.toBuy} ${a.s.unit}`, amount: formatUsd(a.s.estimatedCost) })}</span>
              </Link>
            ) : (
              <Link key={a.key} to="/store" className="dash-item">
                <span className="act-ic warn"><BoxesIcon /></span>
                <div className="grow"><div className="name">{a.i.name}</div><div className="meta"><span>{a.i.code}</span></div></div>
                <span className="dash-amount warn">{t('dash.outOfStock')}</span>
              </Link>
            ))}
            {short.length > 0 && <Link to="/to-buy" className="dash-more">{t('dash.seeToBuy')} →</Link>}
          </div>
        </div>
      </div>

      {/* Recent activity + team */}
      <div className="dash-cols">
        <div className="panel rise" style={{ animationDelay: '200ms' }}>
          <div className="panel-head">
            <div><h3>{t('dash.activity')}</h3><div className="sub">{t('dash.activitySub')}</div></div>
          </div>
          <div className="dash-list">
            {loading && <Skeletons />}
            {data && data.activity.length === 0 && <div className="dash-empty">{t('dash.noActivity')}</div>}
            {data?.activity.map((a) => (
              <Link key={`${a.kind}-${a.id}`} to={a.kind === 'Purchase' ? '/purchases' : '/movements'} className="dash-item">
                <span className={`act-ic ${activityTone[a.kind]}`}>{activityIcon[a.kind]}</span>
                <div className="grow">
                  <div className="dash-sentence">{describe(a)}</div>
                  <div className="meta"><span title={formatDateTime(a.createdAt)}>{formatTimeAgo(a.createdAt, t)}</span></div>
                </div>
                <span className="dash-amount">{a.kind === 'Return' ? '−' : ''}{formatUsd(a.total)}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="panel rise" style={{ animationDelay: '260ms' }}>
          <div className="panel-head">
            <div><h3>{t('dash.recent')}</h3><div className="sub">{t('dash.recentSub')}</div></div>
            <Link className="btn btn-ghost" to="/employees">{t('dash.viewAll')}</Link>
          </div>
          <div className="dash-list">
            {loading && <Skeletons />}
            {data && data.recentEmployees.length === 0 && <div className="dash-empty">{t('dash.noEmployees')}</div>}
            {data?.recentEmployees.map((e) => (
              <div key={e.id} className="dash-item static">
                <Avatar name={e.fullName} size={34} />
                <div className="grow">
                  <div className="name">{e.fullName}</div>
                  <div className="meta"><span>{e.position || t('dash.noPosition')}</span></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Skeletons() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="dash-item static">
          <div className="skeleton" style={{ width: 34, height: 34, borderRadius: 10 }} />
          <div className="grow"><div className="skeleton" style={{ height: 13, width: '60%' }} /></div>
        </div>
      ))}
    </>
  );
}
