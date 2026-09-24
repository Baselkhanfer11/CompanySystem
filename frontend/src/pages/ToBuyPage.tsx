import { useEffect, useMemo } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { canProcure } from '../auth/roles';
import { CartIcon, ClipboardIcon, ProjectsIcon, WalletIcon } from '../components/icons';
import { StatCard } from '../components/StatCard';
import { useItems } from '../data/ItemsContext';
import { useI18n } from '../i18n/LanguageContext';
import { formatUsd, formatUsdShort } from '../lib/format';
import type { LayoutContext } from '../layouts/AppLayout';

export function ToBuyPage() {
  const { search } = useOutletContext<LayoutContext>();
  const { t } = useI18n();
  const { user } = useAuth();
  const manage = canProcure(user?.role); // managers + the Procurement Officer

  // The shortages list lives in the shared items cache (the bell uses it too).
  const { shortages, loading, error, refresh } = useItems();
  useEffect(() => { refresh(); }, [refresh]); // always show the latest on each visit

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return shortages;
    return shortages.filter((s) =>
      [s.name, s.code, ...s.projects.map((p) => p.projectName)].some((v) => v.toLowerCase().includes(q)),
    );
  }, [shortages, search]);

  const toBuy = shortages.filter((s) => s.toBuy > 0);
  const totalCost = toBuy.reduce((sum, s) => sum + s.estimatedCost, 0);
  const projectsWaiting = new Set(shortages.flatMap((s) => s.projects.map((p) => p.projectId))).size;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1>{t('toBuy.title')}</h1>
          <p>{t('toBuy.sub')}</p>
        </div>
        {manage && toBuy.length > 0 && (
          <Link className="btn btn-primary" to="/purchases"><CartIcon /> {t('purchase.add')}</Link>
        )}
      </div>

      {!loading && !error && shortages.length > 0 && (
        <div className="stat-grid">
          <StatCard icon={<WalletIcon />} value={<span title={formatUsd(totalCost)}>{formatUsdShort(totalCost)}</span>} label={t('toBuy.total')} color="#7c6cff" delay={0} />
          <StatCard icon={<ClipboardIcon />} value={toBuy.length} label={t('toBuy.itemsShort')} color="#fb7185" delay={70} />
          <StatCard icon={<ProjectsIcon />} value={projectsWaiting} label={t('toBuy.projectsShort')} color="#fbbf24" delay={140} />
        </div>
      )}

      <div className="panel rise">
        <div className="panel-head">
          <div>
            <h3>{t('toBuy.all')}</h3>
            <div className="sub">{loading ? t('common.loading') : t('toBuy.hint')}</div>
          </div>
        </div>

        {!loading && error && (
          <div className="empty-state">
            <div className="empty-illus" style={{ background: 'rgba(251,113,133,0.1)', borderColor: 'rgba(251,113,133,0.25)' }}>
              <ClipboardIcon style={{ color: 'var(--rose)' }} />
            </div>
            <h4>{t('toBuy.couldntLoad')}</h4>
            <p>{error}. {t('common.backendHint')}</p>
            <button className="btn btn-ghost" onClick={refresh}>{t('common.tryAgain')}</button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-illus"><ClipboardIcon /></div>
            <h4>{search ? t('common.noMatches') : t('toBuy.noneTitle')}</h4>
            <p>{search ? t('common.differentSearch') : t('toBuy.noneSub')}</p>
            {!search && <Link className="btn btn-ghost" to="/projects">{t('toBuy.goProjects')}</Link>}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t('toBuy.colItem')}</th>
                  <th>{t('toBuy.colNeeded')}</th>
                  <th style={{ textAlign: 'end' }}>{t('toBuy.colWarehouse')}</th>
                  <th style={{ textAlign: 'end' }}>{t('toBuy.colToBuy')}</th>
                  <th style={{ textAlign: 'end' }}>{t('toBuy.colPrice')}</th>
                  <th style={{ textAlign: 'end' }}>{t('toBuy.colCost')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.itemId}>
                    <td><div className="name">{s.name}</div><div className="email">{s.code}</div></td>
                    <td>
                      <div className="need-chips">
                        {s.projects.map((p) => (
                          <span key={p.projectId} className="need-chip">{p.projectName} · {p.stillNeeded} {s.unit}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ textAlign: 'end', color: 'var(--text-muted)' }}>{s.inWarehouse} {s.unit}</td>
                    <td style={{ textAlign: 'end' }}>
                      {s.toBuy > 0
                        ? <strong>{s.toBuy} {s.unit}</strong>
                        : <span className="badge active"><span className="dot" />{t('toBuy.covered')}</span>}
                    </td>
                    <td style={{ textAlign: 'end', color: 'var(--text-muted)' }}>{formatUsd(s.price)}</td>
                    <td style={{ textAlign: 'end', fontWeight: 600 }}>{s.toBuy > 0 ? formatUsd(s.estimatedCost) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
