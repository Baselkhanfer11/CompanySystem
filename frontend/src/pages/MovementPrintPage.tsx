import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { stockApi } from '../api/stock';
import { CubeIcon, PrinterIcon } from '../components/icons';
import { useI18n } from '../i18n/LanguageContext';
import { formatDate, formatDateTime, formatMoney } from '../lib/format';
import { movementNumber } from '../lib/stock';
import type { StockMovementDetail } from '../types';
import './print.css';

// A stock movement as a paper record (A4): delivery note for a send, return note
// for a return, with signature boxes. Opens in its own tab, without the sidebar.
export function MovementPrintPage() {
  const { t } = useI18n();
  const id = Number(useParams().id);
  const autoPrint = useSearchParams()[0].get('print') === '1';

  const [detail, setDetail] = useState<StockMovementDetail | null>(null);
  const [error, setError] = useState('');
  const [showPrices, setShowPrices] = useState(true);

  useEffect(() => {
    let active = true;
    stockApi.getMovement(id)
      .then((d) => { if (active) setDetail(d); })
      .catch((e) => { if (active) setError((e as Error).message); });
    return () => { active = false; };
  }, [id]);

  // The tab title is also the suggested file name when saving as PDF.
  useEffect(() => {
    if (!detail) return;
    const before = document.title;
    document.title = `${t(`print.${detail.type}`)} ${movementNumber(detail.id)}`;
    return () => { document.title = before; };
  }, [detail, t]);

  useEffect(() => {
    if (!detail || !autoPrint) return;
    const timer = setTimeout(() => window.print(), 300); // let fonts and layout settle first
    return () => clearTimeout(timer);
  }, [detail, autoPrint]);

  if (error || !detail) {
    return (
      <div className="pr-screen">
        <div className="pr-sheet pr-message">{error ? <><h2>{t('print.couldntLoad')}</h2><p>{error}</p></> : t('common.loading')}</div>
      </div>
    );
  }

  const issue = detail.type === 'Issue';
  const site = `${detail.projectName} (${detail.projectCode})`;
  const warehouse = t('print.warehouse');
  const signers = issue
    ? [t('print.issuedBy'), t('print.receivedBySite')]
    : [t('print.returnedBy'), t('print.receivedByWarehouse')];

  return (
    <div className="pr-screen">
      <div className="pr-toolbar">
        <Link to="/movements" className="btn btn-ghost">{t('print.back')}</Link>
        <label className="pr-check">
          <input type="checkbox" checked={showPrices} onChange={(e) => setShowPrices(e.target.checked)} />
          {t('print.showPrices')}
        </label>
        <button type="button" className="btn btn-primary" onClick={() => window.print()} title={t('print.hint')}>
          <PrinterIcon /> {t('print.button')}
        </button>
      </div>

      <article className="pr-sheet">
        <header className="pr-head">
          <div className="pr-brand"><span className="pr-logo"><CubeIcon /></span>CompanySystem</div>
          <div className="pr-title">
            <h1>{t(`print.${detail.type}`)}</h1>
            <div className="pr-number">{t('print.no')} <b>{movementNumber(detail.id)}</b></div>
          </div>
        </header>

        <dl className="pr-facts">
          <div><dt>{t('print.date')}</dt><dd>{formatDate(detail.date)}</dd></div>
          <div><dt>{t('print.from')}</dt><dd>{issue ? warehouse : site}</dd></div>
          <div><dt>{t('print.to')}</dt><dd>{issue ? site : warehouse}</dd></div>
          <div><dt>{t('print.recordedBy')}</dt><dd>{detail.createdByName}</dd></div>
        </dl>

        <table className="pr-table">
          <thead>
            <tr>
              <th className="pr-n">#</th>
              <th>{t('print.item')}</th>
              <th>{t('print.code')}</th>
              <th className="pr-num">{t('print.qty')}</th>
              <th>{t('print.unit')}</th>
              {showPrices && <th className="pr-num">{t('print.unitCost')}</th>}
              {showPrices && <th className="pr-num">{t('print.value')}</th>}
            </tr>
          </thead>
          <tbody>
            {detail.lines.map((l, i) => (
              <tr key={l.id}>
                <td className="pr-n">{i + 1}</td>
                <td>{l.itemName}</td>
                <td className="pr-code">{l.itemCode}</td>
                <td className="pr-num"><b>{l.quantity}</b></td>
                <td>{l.unit}</td>
                {showPrices && <td className="pr-num">{formatMoney(l.unitCost)}</td>}
                {showPrices && <td className="pr-num">{formatMoney(l.lineTotal)}</td>}
              </tr>
            ))}
          </tbody>
          {showPrices && (
            <tfoot>
              <tr>
                <td colSpan={6}>{t('print.total')}</td>
                <td className="pr-num">{formatMoney(detail.total)}</td>
              </tr>
            </tfoot>
          )}
        </table>

        {detail.notes && (
          <section className="pr-notes">
            <h3>{t('print.notes')}</h3>
            <p>{detail.notes}</p>
          </section>
        )}

        <section className="pr-signs">
          {signers.map((who) => (
            <div key={who} className="pr-sign">
              <h3>{who}</h3>
              <div className="pr-line"><span>{t('print.name')}</span></div>
              <div className="pr-line"><span>{t('print.signature')}</span></div>
              <div className="pr-line"><span>{t('print.date')}</span></div>
            </div>
          ))}
        </section>

        <footer className="pr-foot">
          <span>{t('print.printedOn', { date: formatDateTime(new Date().toISOString()) })}</span>
          <span>{movementNumber(detail.id)}</span>
        </footer>
      </article>
    </div>
  );
}
