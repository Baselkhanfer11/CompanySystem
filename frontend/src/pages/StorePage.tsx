import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { itemsApi } from '../api/items';
import { useAuth } from '../auth/AuthContext';
import { canProcure } from '../auth/roles';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { AlertIcon, BoxesIcon, EditIcon, MapPinIcon, PlusIcon, TrashIcon, TrendingIcon } from '../components/icons';
import { ItemLocationsModal } from '../components/ItemLocationsModal';
import { ItemModal } from '../components/ItemModal';
import { PriceHistoryModal } from '../components/PriceHistoryModal';
import { LoadError } from '../components/States';
import { useToast } from '../components/toast';
import { useItems } from '../data/ItemsContext';
import { itemsChanged, NONE, useSiteStock } from '../data/queries';
import { useI18n } from '../i18n/LanguageContext';
import { LOW_STOCK, isOutOfStock } from '../lib/stock';
import { formatPrice } from '../lib/units';
import type { LayoutContext } from '../layouts/AppLayout';
import type { Item, ItemInput, SiteStock } from '../types';

export function StorePage() {
  const { search } = useOutletContext<LayoutContext>();
  const toast = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const manage = canProcure(user?.role); // managers + the Procurement Officer

  // Items come from the shared cache (also feeds the notifications bell).
  const { items, shortages, loading, error: loadError, refresh, revalidate } = useItems();
  const shortByItem = useMemo(() => new Map(shortages.filter((s) => s.toBuy > 0).map((s) => [s.itemId, s])), [shortages]);

  // Show the cached items instantly; re-check the server if the copy is getting
  // old (e.g. another user changed stock) — without a loading flash.
  useEffect(() => { revalidate(); }, [revalidate]);

  // What's out on project sites (the card's quantity is what's in the warehouse).
  const siteStock: SiteStock[] = useSiteStock().data ?? NONE;
  const sitesByItem = useMemo(() => {
    const map = new Map<number, SiteStock[]>();
    for (const s of siteStock) map.set(s.itemId, [...(map.get(s.itemId) ?? []), s]);
    return map;
  }, [siteStock]);
  const [locating, setLocating] = useState<Item | null>(null);
  const [pricing, setPricing] = useState<Item | null>(null); // price history

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Item | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => [i.name, i.code, i.unit].some((v) => v.toLowerCase().includes(q)));
  }, [items, search]);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (i: Item) => { setEditing(i); setModalOpen(true); };

  const handleSave = async (data: ItemInput) => {
    setSaving(true);
    try {
      if (editing) { await itemsApi.update(editing.id, data); toast('success', t('store.updated')); }
      else { await itemsApi.create(data); toast('success', t('store.added')); }
      setModalOpen(false);
      itemsChanged();
    } catch (e) { toast('error', (e as Error).message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await itemsApi.remove(deleting.id);
      toast('success', t('store.removed'));
      setDeleting(null);
      itemsChanged();
    } catch (e) { toast('error', (e as Error).message); }
    finally { setDeleteBusy(false); }
  };

  return (
    <div>
      <div className="page-header with-actions">
        <div>
          <h1>{t('store.title')}</h1>
          <p>{t('store.sub')}</p>
        </div>
        {manage && <button className="btn btn-primary" onClick={openCreate}><PlusIcon /> {t('store.add')}</button>}
      </div>

      {loading && (
        <div className="item-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="item-card">
              <div className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-md)' }} />
              <div className="skeleton" style={{ height: 14, width: '70%', marginTop: 12 }} />
              <div className="skeleton" style={{ height: 12, width: '40%', marginTop: 8 }} />
            </div>
          ))}
        </div>
      )}

      {!loading && loadError && (
        <div className="panel"><LoadError icon={<BoxesIcon />} title={t('store.couldntLoad')} error={loadError} onRetry={refresh} /></div>
      )}

      {!loading && !loadError && filtered.length === 0 && (
        <div className="panel"><div className="empty-state">
          <div className="empty-illus"><BoxesIcon /></div>
          <h4>{search ? t('common.noMatches') : t('store.noneTitle')}</h4>
          <p>{search ? t('common.differentSearch') : t('store.addFirst')}</p>
          {!search && manage && <button className="btn btn-primary" onClick={openCreate}><PlusIcon /> {t('store.add')}</button>}
        </div></div>
      )}

      {!loading && !loadError && filtered.length > 0 && (
        <div className="item-grid">
          {filtered.map((i) => {
            const out = isOutOfStock(i.quantity);
            const low = !out && i.quantity <= LOW_STOCK;
            const short = shortByItem.get(i.id);
            const onSites = (sitesByItem.get(i.id) ?? []).reduce((sum, s) => sum + s.quantity, 0);
            return (
              <div key={i.id} className="item-card rise">
                <div className="item-logo">
                  {i.imageUrl ? <img src={i.imageUrl} alt={i.name} /> : <BoxesIcon />}
                  {manage && (
                    <div className="item-actions">
                      <button className="act-btn" onClick={() => openEdit(i)} aria-label={t('common.edit')} data-tip={t('common.edit')}><EditIcon /></button>
                      <button className="act-btn danger" onClick={() => setDeleting(i)} aria-label={t('common.delete')} data-tip={t('common.delete')}><TrashIcon /></button>
                    </div>
                  )}
                </div>
                <div className="item-name" title={i.name}>{i.name}</div>
                <div className="item-code">{i.code}</div>
                <div className="item-meta">
                  <span className={`qty-badge ${out ? 'out' : low ? 'low' : ''}`}>
                    {out ? t('store.out') : `${i.quantity} ${i.unit}${low ? ' · ' + t('store.low') : ''}`}
                  </span>
                  <button type="button" className="item-price" onClick={() => setPricing(i)} title={t('prices.open')} aria-label={`${formatPrice(i.price)} · ${t('prices.open')}`}>
                    <TrendingIcon /> {formatPrice(i.price)}
                  </button>
                </div>
                {short && (
                  <Link to="/to-buy" className="item-short">
                    <AlertIcon /> {t('store.short', { n: `${short.toBuy} ${i.unit}` })}
                  </Link>
                )}
                {onSites > 0 && (
                  <button type="button" className="item-sites" onClick={() => setLocating(i)} title={t('stock.where')}>
                    <MapPinIcon /> {t('stock.onSitesQty', { n: `${onSites} ${i.unit}` })}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <PriceHistoryModal item={pricing} onClose={() => setPricing(null)} />

      <ItemLocationsModal item={locating} sites={locating ? sitesByItem.get(locating.id) ?? [] : []} onClose={() => setLocating(null)} />

      <ItemModal open={modalOpen} initial={editing} saving={saving} onClose={() => setModalOpen(false)} onSave={handleSave} />

      <ConfirmDialog
        open={!!deleting}
        title={t('store.deleteQ')}
        message={t('store.deleteMsg', { name: deleting?.name ?? '' })}
        busy={deleteBusy}
        onCancel={() => setDeleting(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
