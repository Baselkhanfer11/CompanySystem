import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { itemsApi } from '../api/items';
import { useAuth } from '../auth/AuthContext';
import { canManage } from '../auth/roles';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { BoxesIcon, EditIcon, PlusIcon, TrashIcon } from '../components/icons';
import { ItemModal } from '../components/ItemModal';
import { useToast } from '../components/toast';
import { useI18n } from '../i18n/LanguageContext';
import { LOW_STOCK } from '../lib/stock';
import { formatPrice } from '../lib/units';
import type { LayoutContext } from '../layouts/AppLayout';
import type { Item, ItemInput } from '../types';

export function StorePage() {
  const { search } = useOutletContext<LayoutContext>();
  const toast = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const manage = canManage(user?.role);

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Item | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError('');
    itemsApi.getAll().then(setItems).catch((e) => setLoadError(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, []);

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
      load();
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
      load();
    } catch (e) { toast('error', (e as Error).message); }
    finally { setDeleteBusy(false); }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
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
              <div className="skeleton" style={{ height: 120, borderRadius: 14 }} />
              <div className="skeleton" style={{ height: 14, width: '70%', marginTop: 14 }} />
              <div className="skeleton" style={{ height: 12, width: '40%', marginTop: 8 }} />
            </div>
          ))}
        </div>
      )}

      {!loading && loadError && (
        <div className="panel"><div className="empty-state">
          <div className="empty-illus" style={{ background: 'rgba(251,113,133,0.1)', borderColor: 'rgba(251,113,133,0.25)' }}>
            <BoxesIcon style={{ color: 'var(--rose)' }} />
          </div>
          <h4>{t('store.couldntLoad')}</h4>
          <p>{loadError}. {t('common.backendHint')}</p>
          <button className="btn btn-ghost" onClick={load}>{t('common.tryAgain')}</button>
        </div></div>
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
            const low = i.quantity <= LOW_STOCK;
            return (
              <div key={i.id} className="item-card rise">
                <div className="item-logo">
                  {i.imageUrl ? <img src={i.imageUrl} alt={i.name} /> : <BoxesIcon />}
                  {manage && (
                    <div className="item-actions">
                      <button className="act-btn" onClick={() => openEdit(i)} aria-label={t('common.edit')}><EditIcon /></button>
                      <button className="act-btn danger" onClick={() => setDeleting(i)} aria-label={t('common.delete')}><TrashIcon /></button>
                    </div>
                  )}
                </div>
                <div className="item-name" title={i.name}>{i.name}</div>
                <div className="item-code">{i.code}</div>
                <div className="item-meta">
                  <span className={`qty-badge ${low ? 'low' : ''}`}>
                    {i.quantity} {i.unit}{low ? ' · ' + t('store.low') : ''}
                  </span>
                  <span className="item-price">{formatPrice(i.price)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
