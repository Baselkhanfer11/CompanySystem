import { useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useItems } from '../data/ItemsContext';
import { useNotifications } from '../data/NotificationsContext';
import { useI18n } from '../i18n/LanguageContext';
import { formatDateTime, formatTimeAgo } from '../lib/format';
import { isLowStock, isOutOfStock } from '../lib/stock';
import type { AppNotification } from '../types';
import { BellIcon, BoxesIcon, CheckIcon, ClipboardIcon, FileIcon, TrashIcon, UndoIcon } from './icons';

// Icon + colour tone per notification type.
const TYPE_META: Record<string, { icon: React.ReactNode; tone: string }> = {
  NeedsReview: { icon: <FileIcon />, tone: 'warn' },
  Approved: { icon: <CheckIcon />, tone: 'ok' },
  Returned: { icon: <UndoIcon />, tone: 'warn' },
  Rejected: { icon: <TrashIcon />, tone: 'crit' },
};

export function NotificationsBell() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { items, shortages, refresh: refreshItems } = useItems();
  const { notifications, unreadCount, markAllRead } = useNotifications();

  const [open, setOpen] = useState(false);
  // Which notifications were unread when the panel was opened — kept so they
  // stay highlighted for this viewing even after we mark them read.
  const [highlightIds, setHighlightIds] = useState<Set<number>>(new Set());
  // The panel renders through a portal (so the topbar's backdrop-filter can't
  // clip it), positioned under the bell button via these fixed coordinates.
  const btnRef = useRef<HTMLButtonElement>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});

  // Items projects are short of (the warehouse can't cover their plans) —
  // these say what's needed and for whom, so they replace the plain low alert.
  const shortByItem = new Map(shortages.filter((s) => s.toBuy > 0).map((s) => [s.itemId, s]));
  const shortLabel = (itemId: number, unit: string) => {
    const s = shortByItem.get(itemId)!;
    const n = `${s.toBuy} ${unit}`;
    return s.projects.length === 1
      ? t('notif.shortFor', { n, project: s.projects[0].projectName })
      : t('notif.shortForMany', { n, count: s.projects.length });
  };

  // Stock alerts: short for projects first, then out of / low stock (worst first).
  const stockAlerts = items
    .filter((i) => shortByItem.has(i.id) || isOutOfStock(i.quantity) || isLowStock(i.quantity))
    .sort((a, b) => Number(shortByItem.has(b.id)) - Number(shortByItem.has(a.id)) || a.quantity - b.quantity);

  // The bell badge = unread document notifications + stock items needing attention.
  const badge = unreadCount + stockAlerts.length;
  const isEmpty = notifications.length === 0 && stockAlerts.length === 0;

  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      if (next) {
        // Position the portal panel just under the bell, aligned to its edge
        // (right in LTR, left in RTL).
        const r = btnRef.current?.getBoundingClientRect();
        if (r) {
          const rtl = getComputedStyle(document.documentElement).direction === 'rtl';
          setPanelStyle({
            position: 'fixed',
            top: r.bottom + 12,
            insetInlineEnd: 'auto',
            ...(rtl ? { left: Math.max(8, r.left) } : { right: Math.max(8, window.innerWidth - r.right) }),
          });
        }
        setHighlightIds(new Set(notifications.filter((n) => !n.isRead).map((n) => n.id)));
        refreshItems();
        markAllRead(); // opening clears the unread badge (keeps highlight via snapshot)
      }
      return next;
    });
  };

  const openDocuments = () => { setOpen(false); navigate('/documents'); };
  const goToStore = () => { setOpen(false); navigate('/store'); };
  const goToBuy = () => { setOpen(false); navigate('/to-buy'); };

  const typeLabel = (n: AppNotification) => {
    switch (n.type) {
      case 'NeedsReview': return t('notif.doc.needsReview');
      case 'Approved': return t('notif.doc.approved');
      case 'Returned': return t('notif.doc.returned');
      case 'Rejected': return t('notif.doc.rejected');
      default: return n.type;
    }
  };

  return (
    <div className="notif">
      <button ref={btnRef} className="icon-btn" onClick={toggle} aria-label={t('notif.title')} title={t('notif.title')}>
        <BellIcon />
        {badge > 0 && <span className="notif-badge">{badge > 9 ? '9+' : badge}</span>}
      </button>

      {open && createPortal(
        <>
          <div className="notif-backdrop" onClick={() => setOpen(false)} />
          <div className="notif-panel rise" style={panelStyle}>
            <div className="notif-head">
              <h4>{t('notif.title')}</h4>
              {badge > 0 && <span className="notif-count">{badge}</span>}
            </div>

            {isEmpty ? (
              <div className="notif-empty">
                <div className="notif-empty-ic"><BellIcon /></div>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>{t('notif.empty')}</div>
                <div style={{ fontSize: 12.5, marginTop: 4 }}>{t('notif.emptySub')}</div>
              </div>
            ) : (
              <div className="notif-list">
                {/* Document approval notifications */}
                {notifications.map((n) => {
                  const meta = TYPE_META[n.type] ?? { icon: <FileIcon />, tone: 'warn' };
                  return (
                    <button key={`n-${n.id}`} className={`notif-item ${highlightIds.has(n.id) ? 'unread' : ''}`} onClick={openDocuments}>
                      <span className={`notif-ic ${meta.tone}`}>{meta.icon}</span>
                      <span className="notif-body">
                        <span className="notif-name">{n.title}</span>
                        <span className={`notif-sub ${meta.tone}`}>
                          {typeLabel(n)}{n.note ? ` — ${n.note}` : ''}
                        </span>
                      </span>
                      <span className="notif-code" title={formatDateTime(n.createdAt)}>{formatTimeAgo(n.createdAt, t)}</span>
                    </button>
                  );
                })}

                {/* Stock alerts: short for projects, out of stock, low */}
                {stockAlerts.map((i) => {
                  const short = shortByItem.has(i.id);
                  const out = isOutOfStock(i.quantity);
                  const tone = short || out ? 'crit' : 'warn';
                  return (
                    <button key={`s-${i.id}`} className="notif-item" onClick={short ? goToBuy : goToStore}>
                      <span className={`notif-ic ${tone}`}>{short ? <ClipboardIcon /> : <BoxesIcon />}</span>
                      <span className="notif-body">
                        <span className="notif-name">{i.name}</span>
                        <span className={`notif-sub ${tone}`}>
                          {short ? shortLabel(i.id, i.unit) : out ? t('notif.outOfStock') : t('notif.onlyLeft', { n: i.quantity, unit: i.unit })}
                        </span>
                      </span>
                      <span className="notif-code">{i.code}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
