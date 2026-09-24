import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { purchasesApi } from '../api/purchases';
import { stockApi } from '../api/stock';
import { useAuth } from '../auth/AuthContext';
import { canProcure } from '../auth/roles';
import { CartIcon, CheckIcon, ClipboardIcon, ProjectsIcon, TruckIcon, WalletIcon } from '../components/icons';
import { MovementModal } from '../components/MovementModal';
import { PurchaseModal } from '../components/PurchaseModal';
import { StatCard } from '../components/StatCard';
import { LoadError } from '../components/States';
import { useToast } from '../components/toast';
import { useItems } from '../data/ItemsContext';
import { movementsChanged, NONE, purchasesChanged, usePrices, useProjects, useSiteStock, useSuppliers } from '../data/queries';
import { useI18n } from '../i18n/LanguageContext';
import { formatUsd, formatUsdShort } from '../lib/format';
import { bestRecent, indexPrices, lastFrom, suggestSupplier } from '../lib/prices';
import type { LayoutContext } from '../layouts/AppLayout';
import type { MovementDraft, Project, PurchaseDraft, PurchaseInput, Shortage, SiteStock, StockMovementInput, Supplier } from '../types';

// How urgent a shortage is, from what the warehouse can cover:
//   urgent  → nothing in the warehouse, the site waits until we buy
//   partial → the warehouse can send some of it, the rest must be bought
//   covered → the warehouse has enough: nothing to buy, just send it (the "Ready to send" list)
type Level = 'urgent' | 'partial' | 'covered';
const levelOf = (s: Shortage): Level => (s.toBuy === 0 ? 'covered' : s.inWarehouse <= 0 ? 'urgent' : 'partial');
const LEVEL_BADGE: Record<'urgent' | 'partial', string> = { urgent: 'reject', partial: 'onhold' };
const coveredPct = (s: Shortage) => (s.needed > 0 ? Math.round((Math.min(s.inWarehouse, s.needed) / s.needed) * 100) : 100);

// One site's share of the covered items — sent together, like one truck.
interface SiteSend {
  projectId: number;
  projectName: string;
  lines: { itemId: number; name: string; unit: string; quantity: number }[];
  value: number;
}

// Covered items only: the warehouse has enough for every site, so sending one
// site's share never takes stock another site is counting on.
function groupBySite(covered: Shortage[]): SiteSend[] {
  const sites = new Map<number, SiteSend>();
  for (const s of covered) {
    for (const p of s.projects) {
      const site = sites.get(p.projectId) ?? { projectId: p.projectId, projectName: p.projectName, lines: [], value: 0 };
      site.lines.push({ itemId: s.itemId, name: s.name, unit: s.unit, quantity: p.stillNeeded });
      site.value += p.stillNeeded * s.price;
      sites.set(p.projectId, site);
    }
  }
  return [...sites.values()].sort((a, b) => b.value - a.value);
}

export function ToBuyPage() {
  const { search } = useOutletContext<LayoutContext>();
  const { t } = useI18n();
  const { user } = useAuth();
  const manage = canProcure(user?.role); // managers + the Procurement Officer

  const toast = useToast();

  // The shortages list lives in the shared items cache (the bell uses it too).
  const { items, shortages, loading, error, refresh, revalidate } = useItems();
  useEffect(() => { revalidate(); }, [revalidate]); // re-check if the copy is getting old

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? shortages.filter((s) => [s.name, s.code, ...s.projects.map((p) => p.projectName)].some((v) => v.toLowerCase().includes(q)))
      : shortages;
  }, [shortages, search]);

  // Urgent first, then partly covered — most expensive first within each.
  const shopping = useMemo(
    () => matches.filter((s) => s.toBuy > 0)
      .sort((a, b) => Number(levelOf(b) === 'urgent') - Number(levelOf(a) === 'urgent') || b.estimatedCost - a.estimatedCost),
    [matches],
  );
  const ready = useMemo(() => groupBySite(matches.filter((s) => s.toBuy === 0)), [matches]);

  const toBuy = shortages.filter((s) => s.toBuy > 0);
  const readyCount = shortages.length - toBuy.length;
  const totalCost = toBuy.reduce((sum, s) => sum + s.estimatedCost, 0);
  const projectsWaiting = new Set(shortages.flatMap((s) => s.projects.map((p) => p.projectId))).size;
  const urgentCount = toBuy.filter((s) => levelOf(s) === 'urgent').length;

  const suppliers: Supplier[] = useSuppliers().data ?? NONE;
  const projects: Project[] = useProjects().data ?? NONE;
  const siteStock: SiteStock[] = useSiteStock().data ?? NONE;
  const [saving, setSaving] = useState(false);

  // ---- "Buy": open the purchase form already filled in ----
  const [draft, setDraft] = useState<PurchaseDraft | null>(null);
  const prices = usePrices().data ?? NONE;
  const priceIdx = useMemo(() => indexPrices(prices), [prices]);

  // One project needs it and the warehouse has none → deliver straight to that
  // site. Otherwise buy into the warehouse and send it on from there.
  const deliverTo = (s: Shortage) => (s.projects.length === 1 && s.inWarehouse <= 0 ? s.projects[0] : null);
  // The supplier is the cheapest recent one, at what they charged last time
  // (the item's list price when we've never bought it from them).
  const buyOne = (s: Shortage) => {
    const best = bestRecent(priceIdx, s.itemId);
    setDraft({
      projectId: deliverTo(s)?.projectId ?? null,
      supplierId: best?.supplierId ?? null,
      lines: [{ itemId: s.itemId, quantity: s.toBuy, unitPrice: best?.lastPrice ?? s.price }],
    });
  };
  // One purchase for everything: the supplier that makes the whole purchase cheapest.
  const buyAll = () => {
    const supplierId = suggestSupplier(priceIdx, toBuy.map((s) => ({ itemId: s.itemId, quantity: s.toBuy, listPrice: s.price })));
    setDraft({
      projectId: null,
      supplierId,
      lines: toBuy.map((s) => ({
        itemId: s.itemId,
        quantity: s.toBuy,
        unitPrice: (supplierId && lastFrom(priceIdx, s.itemId, supplierId)?.lastPrice) || s.price,
      })),
    });
  };

  const handleBuy = async (data: PurchaseInput) => {
    setSaving(true);
    try {
      await purchasesApi.create(data);
      toast('success', t('purchase.recorded'));
      setDraft(null);
      purchasesChanged(); // stock moved, so the lists below update themselves
    } catch (e) { toast('error', (e as Error).message); } // the form stays open
    finally { setSaving(false); }
  };

  // ---- "Send": open the stock movement form already filled in ----
  const [sending, setSending] = useState<MovementDraft | null>(null);
  const sendSite = (site: SiteSend) =>
    setSending({ projectId: site.projectId, lines: site.lines.map((l) => ({ itemId: l.itemId, quantity: l.quantity })) });

  const handleSend = async (data: StockMovementInput) => {
    setSaving(true);
    try {
      await stockApi.createMovement(data);
      toast('success', data.type === 'Issue' ? t('stock.sent') : t('stock.returned'));
      setSending(null);
      movementsChanged(); // the site now has it, so its row leaves the list
    } catch (e) { toast('error', (e as Error).message); }
    finally { setSaving(false); }
  };

  const ok = !loading && !error;

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

      {ok && shortages.length > 0 && (
        <div className="stat-grid">
          <StatCard icon={<WalletIcon />} value={<span title={formatUsd(totalCost)}>{formatUsdShort(totalCost)}</span>} label={t('toBuy.total')} color="#7c6cff" delay={0} />
          <StatCard icon={<ClipboardIcon />} value={toBuy.length} label={t('toBuy.itemsShort')} color="#fb7185" trend={urgentCount ? t('toBuy.urgentCount', { n: urgentCount }) : undefined} delay={70} />
          <StatCard icon={<TruckIcon />} value={readyCount} label={t('toBuy.readyShort')} color="#34d399" delay={140} />
          <StatCard icon={<ProjectsIcon />} value={projectsWaiting} label={t('toBuy.projectsShort')} color="#fbbf24" delay={210} />
        </div>
      )}

      {/* ---- What must be bought ---- */}
      <div className="panel rise">
        <div className="panel-head">
          <div>
            <h3>{t('toBuy.all')}</h3>
            <div className="sub">{loading ? t('common.loading') : t('toBuy.hint')}</div>
          </div>
          {shopping.length > 0 && (
            <div className="level-legend" aria-hidden="true">
              <span><i className="urgent" />{t('toBuy.urgent')}</span>
              <span><i className="partial" />{t('toBuy.partial')}</span>
            </div>
          )}
        </div>

        {!loading && error && (
          <LoadError icon={<ClipboardIcon />} title={t('toBuy.couldntLoad')} error={error} onRetry={refresh} />
        )}

        {ok && matches.length === 0 && (
          <div className="empty-state">
            <div className="empty-illus"><ClipboardIcon /></div>
            <h4>{search ? t('common.noMatches') : t('toBuy.noneTitle')}</h4>
            <p>{search ? t('common.differentSearch') : t('toBuy.noneSub')}</p>
            {!search && <Link className="btn btn-ghost" to="/projects">{t('toBuy.goProjects')}</Link>}
          </div>
        )}

        {/* Something is short, but the warehouse covers all of it. */}
        {ok && matches.length > 0 && shopping.length === 0 && (
          <div className="dash-empty tobuy-none"><CheckIcon /> {t('toBuy.nothingToBuy')}</div>
        )}

        {ok && shopping.length > 0 && (
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
                {shopping.map((s) => {
                  const level = levelOf(s) as 'urgent' | 'partial';
                  const best = bestRecent(priceIdx, s.itemId); // cheapest recent supplier
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
                        <strong>{s.toBuy} {s.unit}</strong>
                        <span className={`badge ${LEVEL_BADGE[level]}`}><span className="dot" />{t(`toBuy.${level}`)}</span>
                      </div>
                    </td>
                    <td className="num" style={{ color: 'var(--text-muted)' }}>
                      {formatUsd(s.price)}
                      {best && <div className="email">{t('toBuy.bestAt', { price: formatUsd(best.lastPrice), supplier: best.supplierName })}</div>}
                    </td>
                    <td className="num" style={{ fontWeight: 600 }}>{formatUsd(s.estimatedCost)}</td>
                    {manage && (
                      <td className="num">
                        <button
                          className={`btn btn-sm ${level === 'urgent' ? 'btn-primary' : 'btn-ghost'}`}
                          onClick={() => buyOne(s)}
                          title={deliverTo(s)
                            ? t('toBuy.buyToSite', { n: `${s.toBuy} ${s.unit}`, site: deliverTo(s)!.projectName })
                            : t('toBuy.buyToWarehouse', { n: `${s.toBuy} ${s.unit}` })}
                        >
                          <CartIcon /> {t('toBuy.buy')}
                        </button>
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

      {/* ---- What the warehouse already has: just send it ---- */}
      {ok && ready.length > 0 && (
        <div className="panel rise tobuy-ready" style={{ animationDelay: '80ms' }}>
          <div className="panel-head">
            <div>
              <h3>{t('toBuy.readyTitle')}</h3>
              <div className="sub">{t('toBuy.readySub')}</div>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t('toBuy.colSite')}</th>
                  <th>{t('toBuy.colSend')}</th>
                  <th className="num">{t('toBuy.colValue')}</th>
                  {manage && <th aria-label={t('toBuy.send')} />}
                </tr>
              </thead>
              <tbody>
                {ready.map((site) => (
                  <tr key={site.projectId} className="tobuy-row covered">
                    <td><div className="name">{site.projectName}</div></td>
                    <td>
                      <div className="need-chips">
                        {site.lines.map((l) => (
                          <span key={l.itemId} className="need-chip">{l.name} · {l.quantity} {l.unit}</span>
                        ))}
                      </div>
                    </td>
                    <td className="num" style={{ fontWeight: 600 }}>{formatUsd(site.value)}</td>
                    {manage && (
                      <td className="num">
                        <button className="btn btn-sm btn-ghost" onClick={() => sendSite(site)} title={t('toBuy.sendHint', { site: site.projectName })}>
                          <TruckIcon /> {t('toBuy.send')}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PurchaseModal
        open={draft !== null}
        initial={null}
        draft={draft}
        suppliers={suppliers}
        projects={projects}
        items={items}
        saving={saving}
        onClose={() => setDraft(null)}
        onSave={handleBuy}
      />

      <MovementModal
        open={sending !== null}
        initialType="Issue"
        draft={sending}
        projects={projects}
        items={items}
        siteStock={siteStock}
        saving={saving}
        onClose={() => setSending(null)}
        onSave={handleSend}
      />
    </div>
  );
}
