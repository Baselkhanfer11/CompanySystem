import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { itemsApi } from '../api/items';
import { useI18n } from '../i18n/LanguageContext';
import { isLowStock, isOutOfStock } from '../lib/stock';
import type { Item } from '../types';
import { BellIcon, BoxesIcon } from './icons';

export function NotificationsBell() {
  const { t } = useI18n();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  // Only items that need attention, worst first (out of stock before low).
  const alerts = items
    .filter((i) => isOutOfStock(i.quantity) || isLowStock(i.quantity))
    .sort((a, b) => a.quantity - b.quantity);

  const load = () => {
    setLoading(true);
    itemsApi.getAll().then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  };

  // Fetch once for the badge count, then refresh each time the panel opens.
  useEffect(load, []);
  const toggle = () => {
    setOpen((o) => {
      if (!o) load();
      return !o;
    });
  };

  const goToStore = () => {
    setOpen(false);
    navigate('/store');
  };

  return (
    <div className="notif">
      <button className="icon-btn" onClick={toggle} aria-label={t('notif.title')} title={t('notif.title')}>
        <BellIcon />
        {alerts.length > 0 && <span className="notif-badge">{alerts.length > 9 ? '9+' : alerts.length}</span>}
      </button>

      {open && (
        <>
          <div className="notif-backdrop" onClick={() => setOpen(false)} />
          <div className="notif-panel rise">
            <div className="notif-head">
              <h4>{t('notif.title')}</h4>
              {alerts.length > 0 && <span className="notif-count">{alerts.length}</span>}
            </div>

            {loading ? (
              <div className="notif-empty">{t('notif.loading')}</div>
            ) : alerts.length === 0 ? (
              <div className="notif-empty">
                <div className="notif-empty-ic"><BoxesIcon /></div>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{t('notif.empty')}</div>
                <div style={{ fontSize: 12.5, marginTop: 4 }}>{t('notif.emptySub')}</div>
              </div>
            ) : (
              <div className="notif-list">
                {alerts.map((i) => {
                  const out = isOutOfStock(i.quantity);
                  return (
                    <button key={i.id} className="notif-item" onClick={goToStore}>
                      <span className={`notif-ic ${out ? 'crit' : 'warn'}`}><BoxesIcon /></span>
                      <span className="notif-body">
                        <span className="notif-name">{i.name}</span>
                        <span className={`notif-sub ${out ? 'crit' : 'warn'}`}>
                          {out ? t('notif.outOfStock') : t('notif.onlyLeft', { n: i.quantity, unit: i.unit })}
                        </span>
                      </span>
                      <span className="notif-code">{i.code}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {alerts.length > 0 && (
              <button className="notif-foot" onClick={goToStore}>{t('notif.viewStore')}</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
