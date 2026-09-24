import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { purchasesApi } from '../api/purchases';
import { useAuth } from '../auth/AuthContext';
import { canProcure } from '../auth/roles';
import { CartIcon, ClipboardIcon, ProjectsIcon, WalletIcon } from '../components/icons';
import { PurchaseModal } from '../components/PurchaseModal';
import { StatCard } from '../components/StatCard';
import { LoadError } from '../components/States';
import { useToast } from '../components/toast';
import { useItems } from '../data/ItemsContext';
import { NONE, purchasesChanged, useProjects, useSuppliers } from '../data/queries';
import { useI18n } from '../i18n/LanguageContext';
import { formatUsd, formatUsdShort } from '../lib/format';
import type { LayoutContext } from '../layouts/AppLayout';
import type { Project, PurchaseDraft, PurchaseInput, Shortage, Supplier } from '../types';

// How urgent a shortage is, from what the warehouse can cover:
//   urgent  → nothing in the warehouse, the site waits until we buy
//   partial → the warehouse can send some of it
//   covered → the warehouse has enough, nothing to buy
type Level = 'urgent' | 'partial' | 'covered';
const levelOf = (s: Shortage): Level => (s.toBuy === 0 ? 'covered' : s.inWarehouse <= 0 ? 'urgent' : 'partial');
const LEVEL_ORDER: Record<Level, number> = { urgent: 0, partial: 1, covered: 2 };
const LEVEL_BADGE: Record<Level, string> = { urgent: 'reject', partial: 'onhold', covered: 'active' };
const coveredPct = (s: Shortage) => (s.needed > 0 ? Math.round((Math.min(s.inWarehouse, s.needed) / s.needed) * 100) : 100);

export function ToBuyPage() {
  const { search } = useOutletContext<LayoutContext>();
  const { t } = useI18n();
  const { user } = useAuth();
  const manage = canProcure(user?.role); // managers + the Procurement Officer

  const toast = useToast();

  // The shortages list lives in the shared items cache (the bell uses it too).
  const { items, shortages, loading, error, refresh, revalidate } = useItems();
  useEffect(() => { revalidate(); }, [revalidate]); // re-check if the copy is getting old

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = q
      ? shortages.filter((s) => [s.name, s.code, ...s.projects.map((p) => p.projectName)].some((v) => v.toLowerCase().includes(q)))
      : shortages;
    // Urgent first, then partly covered, then covered — most expensive first within each.
    return [...rows].sort((a, b) => LEVEL_ORDER[levelOf(a)] - LEVEL_ORDER[levelOf(b)] || b.estimatedCost - a.estimatedCost);
  }, [shortages, search]);

  const toBuy = shortages.filter((s) => s.toBuy > 0);
  const totalCost = toBuy.reduce((sum, s) => sum + s.estimatedCost, 0);
  const projectsWaiting = new Set(shortages.flatMap((s) => s.projects.map((p) => p.projectId))).size;
  const urgentCount = shortages.filter((s) => levelOf(s) === 'urgent').length;

  // ---- "Buy it": open the purchase form already filled in ----
  const suppliers: Supplier[] = useSuppliers().data ?? NONE;
  const projects: Project[] = useProjects().data ?? NONE;
  const [draft, setDraft] = useState<PurchaseDraft | null>(null);
  const [saving, setSaving] = useState(false);

  // One project needs it and the warehouse has none → deliver straight to that
  // site. Otherwise buy into the warehouse and send it on from there.
  const deliverTo = (s: Shortage) => (s.projects.length === 1 && s.inWarehouse <= 0 ? s.projects[0] : null);
  const buyOne = (s: Shortage) =>
    setDraft({ projectId: deliverTo(s)?.projectId ?? null, lines: [{ itemId: s.itemId, quantity: s.toBuy, unitPrice: s.price }] });
  const buyAll = () =>
    setDraft({ projectId: null, lines: toBuy.map((s) => ({ itemId: s.itemId, quantity: s.toBuy, unitPrice: s.price })) });

  const handleSave = async (data: PurchaseInput) => {
    setSaving(true);
    try {
      await purchasesApi.create(data);
      toast('success', t('purchase.recorded'));
      setDraft(null);
      purchasesChanged(); // stock moved, so the list below updates itself
    } catch (e) { toast('error', (e as Error).message); } // the form stays open
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="page-header with-actions">
        <div>
          <h1>{t('toBuy.title')}</h1>
          <p>{t('toBuy.sub')}</p>
        </div>
        {manage && toBuy.length > 0 && (
          <div className="page-actions">
            <button className="btn btn-primary" onClick={buyAll} title={t('toBuy.buyAllHint')}>
              <CartIcon /> {t('toBuy.buyAll', { n: toBuy.length })}
            </button>
          </div>
        )}
      </div>

      {!loading && !error && shortages.length > 0 && (
        <div className="stat-grid">
          <StatCard icon={<WalletIcon />} value={<span title={formatUsd(totalCost)}>{formatUsdShort(totalCost)}</span>} label={t('toBuy.total')} color="#7c6cff" delay={0} />
          <StatCard icon={<ClipboardIcon />} value={toBuy.length} label={t('toBuy.itemsShort')} color="#fb7185" trend={urgentCount ? t('toBuy.urgentCount', { n: urgentCount }) : undefined} delay={70} />
          <StatCard icon={<ProjectsIcon />} value={projectsWaiting} label={t('toBuy.projectsShort')} color="#fbbf24" delay={140} />
        </div>
      )}

      <div className="panel rise">
        <div className="panel-head">
          <div>
            <h3>{t('toBuy.all')}</h3>
            <div className="sub">{loading ? t('common.loading') : t('toBuy.hint')}</div>
          </div>
          {filtered.length > 0 && (
            <div className="level-legend" aria-hidden="true">
              <span><i className="urgent" />{t('toBuy.urgent')}</span>
              <span><i className="partial" />{t('toBuy.partial')}</span>
              <span><i className="covered" />{t('toBuy.covered')}</span>
            </div>
          )}
        </div>

        {!loading && error && (
          <LoadError icon={<ClipboardIcon />} title={t('toBuy.couldntLoad')} error={error} onRetry={refresh} />
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
                  <th className="num">{t('toBuy.colWarehouse')}</th>
                  <th className="num">{t('toBuy.colToBuy')}</th>
                  <th className="num">{t('toBuy.colPrice')}</th>
                  <th className="num">{t('toBuy.colCost')}</th>
                  {manage && <th aria-label={t('toBuy.buy')} />}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const level = levelOf(s);
                  return (
                  <tr key={s.itemId} className={`tobuy-row ${level}`}>
                    <td><div className="name">{s.name}</div><div className="email">{s.code}</div></td>
                    <td>
                      <div className="need-chips">
                        {s.projects.map((p) => (
                          <span key={p.projectId} className="need-chip">{p.projectName} · {p.stillNeeded} {s.unit}</span>
                        ))}
                      </div>
                    </td>
                    <td className="num">
                      <div className="cover">
                        <span className="cover-text">{s.inWarehouse} {s.unit} · {t('toBuy.coveredPct', { p: coveredPct(s) })}</span>
                        <span className="cover-track" aria-hidden="true"><span style={{ width: `${coveredPct(s)}%` }} /></span>
                      </div>
                    </td>
                    <td className="num">
                      <div className="tobuy-qty">
                        {s.toBuy > 0 && <strong>{s.toBuy} {s.unit}</strong>}
                        <span className={`badge ${LEVEL_BADGE[level]}`}><span className="dot" />{t(`toBuy.${level}`)}</span>
                      </div>
                    </td>
                    <td className="num" style={{ color: 'var(--text-muted)' }}>{formatUsd(s.price)}</td>
                    <td className="num" style={{ fontWeight: 600 }}>{s.toBuy > 0 ? formatUsd(s.estimatedCost) : '—'}</td>
                    {manage && (
                      <td className="num">
                        {s.toBuy > 0 && (
                          <button
                            className={`btn btn-sm ${level === 'urgent' ? 'btn-primary' : 'btn-ghost'}`}
                            onClick={() => buyOne(s)}
                            title={deliverTo(s)
                              ? t('toBuy.buyToSite', { n: `${s.toBuy} ${s.unit}`, site: deliverTo(s)!.projectName })
                              : t('toBuy.buyToWarehouse', { n: `${s.toBuy} ${s.unit}` })}
                          >
                            <CartIcon /> {t('toBuy.buy')}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PurchaseModal
        open={draft !== null}
        initial={null}
        draft={draft}
        suppliers={suppliers}
        projects={projects}
        items={items}
        saving={saving}
        onClose={() => setDraft(null)}
        onSave={handleSave}
      />
    </div>
  );
}
