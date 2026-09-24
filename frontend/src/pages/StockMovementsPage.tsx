import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { projectsApi } from '../api/projects';
import { stockApi } from '../api/stock';
import { useAuth } from '../auth/AuthContext';
import { canManage } from '../auth/roles';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SearchIcon, SwapIcon, UndoIcon } from '../components/icons';
import { MovementBadge } from '../components/MovementBadge';
import { MovementDetailModal } from '../components/MovementDetailModal';
import { MovementModal } from '../components/MovementModal';
import { useToast } from '../components/toast';
import { useItems } from '../data/ItemsContext';
import { useI18n } from '../i18n/LanguageContext';
import { formatDate, formatMoney } from '../lib/format';
import type { LayoutContext } from '../layouts/AppLayout';
import type { MovementType, Project, SiteStock, StockMovementInput, StockMovementListItem } from '../types';

export function StockMovementsPage() {
  const { search } = useOutletContext<LayoutContext>();
  const toast = useToast();
  const { t } = useI18n();
  const { user } = useAuth();
  const manage = canManage(user?.role);
  const { items, refresh: refreshItems } = useItems();

  const [movements, setMovements] = useState<StockMovementListItem[]>([]);
  const [siteStock, setSiteStock] = useState<SiteStock[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [modalType, setModalType] = useState<MovementType | null>(null); // null = closed
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const [undoing, setUndoing] = useState<StockMovementListItem | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError('');
    stockApi.movements().then(setMovements).catch((e) => setLoadError(e.message)).finally(() => setLoading(false));
  };
  const loadSiteStock = () => { stockApi.onSite().then(setSiteStock).catch(() => {}); };
  useEffect(load, []);
  useEffect(() => {
    loadSiteStock();
    projectsApi.getAll().then(setProjects).catch(() => {});
    refreshItems(); // make sure warehouse quantities are current
  }, [refreshItems]);

  // Stock changed — refresh everything that shows it (incl. the store & bell alerts).
  const afterChange = () => { load(); loadSiteStock(); refreshItems(); };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return movements;
    return movements.filter((m) =>
      [m.projectName, m.projectCode, m.createdByName, m.notes, ...m.itemNames].filter(Boolean).some((v) => v!.toLowerCase().includes(q)),
    );
  }, [movements, search]);

  const handleSave = async (data: StockMovementInput) => {
    setSaving(true);
    try {
      await stockApi.createMovement(data);
      toast('success', data.type === 'Issue' ? t('stock.sent') : t('stock.returned'));
      setModalType(null);
      afterChange();
    } catch (e) { toast('error', (e as Error).message); } // e.g. "not enough stock" — the modal stays open
    finally { setSaving(false); }
  };

  const handleUndo = async () => {
    if (!undoing) return;
    setUndoBusy(true);
    try {
      await stockApi.removeMovement(undoing.id);
      toast('success', t('stock.removed'));
      setUndoing(null);
      afterChange();
    } catch (e) { toast('error', (e as Error).message); }
    finally { setUndoBusy(false); }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1>{t('stock.title')}</h1>
          <p>{t('stock.sub')}</p>
        </div>
        {manage && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={() => setModalType('Return')}><UndoIcon /> {t('stock.return')}</button>
            <button className="btn btn-primary" onClick={() => setModalType('Issue')}><SwapIcon /> {t('stock.send')}</button>
          </div>
        )}
      </div>

      <div className="panel rise">
        <div className="panel-head">
          <div>
            <h3>{t('stock.all')}</h3>
            <div className="sub">
              {loading
                ? t('common.loading')
                : `${filtered.length === 1 ? t('stock.countOne', { n: filtered.length }) : t('stock.countMany', { n: filtered.length })}${search ? ' ' + t('common.found') : ''}`}
            </div>
          </div>
        </div>

        {loading && (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div className="skeleton" style={{ width: 38, height: 38, borderRadius: 11 }} />
                <div className="skeleton" style={{ height: 14, flex: 1, maxWidth: 220 }} />
                <div className="skeleton" style={{ height: 22, width: 80, borderRadius: 20 }} />
              </div>
            ))}
          </div>
        )}

        {!loading && loadError && (
          <div className="empty-state">
            <div className="empty-illus" style={{ background: 'rgba(251,113,133,0.1)', borderColor: 'rgba(251,113,133,0.25)' }}>
              <SwapIcon style={{ color: 'var(--rose)' }} />
            </div>
            <h4>{t('stock.couldntLoad')}</h4>
            <p>{loadError}. {t('common.backendHint')}</p>
            <button className="btn btn-ghost" onClick={load}>{t('common.tryAgain')}</button>
          </div>
        )}

        {!loading && !loadError && filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-illus"><SwapIcon /></div>
            <h4>{search ? t('common.noMatches') : t('stock.noneTitle')}</h4>
            <p>{search ? t('common.differentSearch') : t('stock.addFirst')}</p>
            {!search && manage && <button className="btn btn-primary" onClick={() => setModalType('Issue')}><SwapIcon /> {t('stock.send')}</button>}
          </div>
        )}

        {!loading && !loadError && filtered.length > 0 && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t('stock.colDate')}</th>
                  <th>{t('stock.colType')}</th>
                  <th>{t('stock.colSite')}</th>
                  <th>{t('stock.colItems')}</th>
                  <th style={{ textAlign: 'end' }}>{t('stock.colValue')}</th>
                  <th style={{ textAlign: 'end' }}>{t('stock.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id}>
                    <td style={{ color: 'var(--text-muted)' }}>{formatDate(m.date)}</td>
                    <td><MovementBadge type={m.type} /></td>
                    <td><div className="name">{m.projectName}</div><div className="email">{m.createdByName}</div></td>
                    <td className="cell-clip" title={m.itemNames.join(', ')}>{m.itemNames.join(', ')}</td>
                    <td style={{ textAlign: 'end', fontWeight: 600 }}>{formatMoney(m.total)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="act-btn" onClick={() => setViewing(m.id)} aria-label={t('stock.view')} title={t('stock.view')}><SearchIcon /></button>
                        {manage && (
                          <button className="act-btn danger" onClick={() => setUndoing(m)} aria-label={t('stock.undo')} title={t('stock.undo')}><UndoIcon /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <MovementModal
        open={modalType !== null}
        initialType={modalType ?? 'Issue'}
        projects={projects}
        items={items}
        siteStock={siteStock}
        saving={saving}
        onClose={() => setModalType(null)}
        onSave={handleSave}
      />

      <MovementDetailModal open={viewing !== null} movementId={viewing} onClose={() => setViewing(null)} />

      <ConfirmDialog
        open={!!undoing}
        title={t('stock.deleteQ')}
        message={t('stock.deleteMsg', { site: undoing?.projectName ?? '' })}
        busy={undoBusy}
        onCancel={() => setUndoing(null)}
        onConfirm={handleUndo}
      />
    </div>
  );
}
