import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useItems } from '../data/ItemsContext';
import { useI18n } from '../i18n/LanguageContext';
import { isLowStock, isOutOfStock } from '../lib/stock';
import { BellIcon, BoxesIcon } from './icons';

export function NotificationsBell() {
  const { t } = useI18n();
  const navigate = useNavigate();
  // Reads the same shared items cache as the Store page — one request, always in sync.
  const { items, loading, refresh } = useItems();

  const [open, setOpen] = useState(false);

  // Only items that need attention, worst first (out of stock before low).
  const alerts = items
    .filter((i) => isOutOfStock(i.quantity) || isLowStock(i.quantity))
    .sort((a, b) => a.quantity - b.quantity);

  const toggle = () => {
    setOpen((o) => {
      if (!o) refresh(); // pull the latest stock when the panel opens (silent)
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
