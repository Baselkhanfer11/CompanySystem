import { useI18n } from '../i18n/LanguageContext';
import { formatMoney } from '../lib/format';
import type { Project, SiteStock } from '../types';
import { XIcon } from './icons';

interface Props {
  project: Project | null; // null = closed
  rows: SiteStock[]; // what's on this project's site
  onClose: () => void;
}

// What's on one project's site right now.
export function SiteStockModal({ project, rows, onClose }: Props) {
  const { t } = useI18n();
  if (!project) return null;

  const totalCost = rows.reduce((sum, r) => sum + r.value, 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head with-close">
          <div>
            <h3>{t('stock.siteOf', { name: project.name })}</h3>
            <p>{t('siteModal.sub')}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}><XIcon /></button>
        </div>

        <div className="modal-body">
          {rows.length === 0 ? (
            <div className="field-hint">{t('siteModal.empty')}</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t('purchaseDetail.item')}</th>
                    <th className="num">{t('purchaseDetail.qty')}</th>
                    <th className="num">{t('siteModal.cost')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.itemId}>
                      <td><div className="name">{r.itemName}</div><div className="email">{r.itemCode}</div></td>
                      <td className="num">{r.quantity} {r.unit}</td>
                      <td className="num">{formatMoney(r.value)}</td>
                    </tr>
                  ))}
                  <tr className="total-row">
                    <td>{t('stock.total')}</td>
                    <td />
                    <td className="num">{formatMoney(totalCost)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
}
