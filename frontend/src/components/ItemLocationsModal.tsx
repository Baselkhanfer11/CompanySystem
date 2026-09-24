import { useI18n } from '../i18n/LanguageContext';
import type { Item, SiteStock } from '../types';
import { XIcon } from './icons';

interface Props {
  item: Item | null; // null = closed
  sites: SiteStock[]; // this item's site rows
  onClose: () => void;
}

// "Where is it?" — one item's stock: the warehouse, then each site.
export function ItemLocationsModal({ item, sites, onClose }: Props) {
  const { t } = useI18n();
  if (!item) return null;

  const total = item.quantity + sites.reduce((sum, s) => sum + s.quantity, 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head with-close">
          <div>
            <h3>{item.name}</h3>
            <p>{t('stock.where')} · {item.code}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}><XIcon /></button>
        </div>

        <div className="modal-body">
          <div className="table-wrap">
            <table className="data">
              <tbody>
                <tr>
                  <td><div className="name">{t('stock.warehouse')}</div></td>
                  <td className="num">{item.quantity} {item.unit}</td>
                </tr>
                {sites.map((s) => (
                  <tr key={s.projectId}>
                    <td><div className="name">{t('stock.siteOf', { name: s.projectName })}</div><div className="email">{s.projectCode}</div></td>
                    <td className="num">{s.quantity} {item.unit}</td>
                  </tr>
                ))}
                <tr className="total-row">
                  <td>{t('stock.total')}</td>
                  <td className="num">{total} {item.unit}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
}
