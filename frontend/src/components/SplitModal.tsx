import { useState } from 'react';
import { useI18n } from '../i18n/LanguageContext';
import { formatMoney } from '../lib/format';
import type { Shortage, StockMovementInput } from '../types';
import { CheckIcon, SplitIcon, XIcon } from './icons';

type Site = Shortage['projects'][number];

interface Props {
  shortage: Shortage | null; // an item several sites need, and the warehouse can't cover all of them
  saving: boolean;
  onClose: () => void;
  onSave: (data: StockMovementInput[]) => void; // one send per site, booked together
}

const today = () => new Date().toISOString().slice(0, 10);

// A fair first guess: the warehouse's stock shared in proportion to what each
// site still needs. Whole units only — the leftovers go to the biggest fractions.
function shareByNeed(available: number, sites: Site[]): number[] {
  const total = sites.reduce((sum, p) => sum + p.stillNeeded, 0);
  if (total <= available) return sites.map((p) => p.stillNeeded);
  const exact = sites.map((p) => (available * p.stillNeeded) / total);
  const qty = exact.map(Math.floor);
  let left = available - qty.reduce((a, b) => a + b, 0);
  const order = sites.map((_, i) => i)
    .sort((a, b) => (exact[b] - qty[b]) - (exact[a] - qty[a]) || sites[b].stillNeeded - sites[a].stillNeeded);
  for (const i of order) {
    if (left <= 0) break;
    qty[i]++;
    left--;
  }
  return qty;
}

// "Split": choose how much of a short item each site gets from the warehouse.
export function SplitModal({ shortage, ...rest }: Props) {
  if (!shortage) return null;
  return <SplitBody key={shortage.itemId} shortage={shortage} {...rest} />;
}

function SplitBody({ shortage: s, saving, onClose, onSave }: Omit<Props, 'shortage'> & { shortage: Shortage }) {
  const { t } = useI18n();
  const [qty, setQty] = useState(() => shareByNeed(s.inWarehouse, s.projects).map(String));
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const amount = (i: number) => Math.max(0, parseInt(qty[i]) || 0);
  const sending = s.projects.reduce((sum, _, i) => sum + amount(i), 0);
  const left = s.inWarehouse - sending;
  const needed = s.projects.reduce((sum, p) => sum + p.stillNeeded, 0);
  const u = (n: number) => `${n} ${s.unit}`;
  // A stat tile's value: the number big, the unit small (so it fits on a phone).
  const stat = (n: number) => <>{n} <span className="unit">{s.unit}</span></>;

  const setAll = (next: number[]) => { setQty(next.map(String)); setError(''); };
  const setOne = (i: number, value: string) => { setQty((q) => q.map((v, j) => (j === i ? value : v))); setError(''); };
  // Whatever is still in the warehouse goes to this site, up to what it needs.
  const fill = (i: number) => setOne(i, String(Math.min(s.projects[i].stillNeeded, amount(i) + Math.max(0, left))));

  const submit = () => {
    if (!date) return setError(t('movementModal.dateRequired'));
    const sends = s.projects.map((p, i) => ({ p, q: Number(qty[i] || 0) }));
    if (sends.some(({ q }) => !Number.isInteger(q) || q < 0)) return setError(t('movementModal.badQuantity'));
    const tooMuch = sends.find(({ p, q }) => q > p.stillNeeded);
    if (tooMuch) return setError(t('split.moreThanNeed', { site: tooMuch.p.projectName, n: u(tooMuch.p.stillNeeded) }));
    if (left < 0) return setError(t('split.over', { n: u(-left) }));
    if (sending === 0) return setError(t('split.nothing'));

    onSave(sends.filter(({ q }) => q > 0).map(({ p, q }) => ({
      type: 'Issue',
      projectId: p.projectId,
      date,
      notes: notes.trim() || null,
      items: [{ itemId: s.itemId, quantity: q }],
    })));
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head with-close">
          <div>
            <h3>{t('split.title', { item: s.name })}</h3>
            <p>{t('split.sub')}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}><XIcon /></button>
        </div>

        <div className="modal-body">
          <div className="mini-stats">
            <div>
              <span className="k">{t('split.inWarehouse')}</span>
              <span className="v">{stat(s.inWarehouse)}</span>
            </div>
            <div>
              <span className="k">{t('split.needed')}</span>
              <span className="v">{stat(needed)}</span>
            </div>
            <div>
              <span className="k">{t('split.left')}</span>
              <span className="v" style={{ color: left < 0 ? 'var(--rose)' : undefined }}>{stat(left)}</span>
            </div>
          </div>

          <div className="split-tools">
            <button className="btn btn-ghost btn-sm" onClick={() => setAll(shareByNeed(s.inWarehouse, s.projects))} title={t('split.shareHint')}>
              <SplitIcon /> {t('split.shareByNeed')}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setAll(s.projects.map(() => 0))}>{t('split.clear')}</button>
          </div>

          <div className="table-wrap">
            <table className="data split-table">
              <thead>
                <tr>
                  <th>{t('split.colSite')}</th>
                  <th className="num">{t('split.colSend')}</th>
                  <th className="num split-short">{t('split.colShort')}</th>
                </tr>
              </thead>
              <tbody>
                {s.projects.map((p, i) => {
                  const short = p.stillNeeded - amount(i);
                  const over = amount(i) > p.stillNeeded;
                  const shortText = short <= 0
                    ? <span className="split-covered"><CheckIcon /> {t('split.covered')}</span>
                    : <span style={{ color: 'var(--text-muted)' }}>{t('split.toBuy', { n: u(short) })}</span>;
                  return (
                    <tr key={p.projectId}>
                      <td>
                        <div className="name">{p.projectName}</div>
                        <div className="email">{t('split.needs', { n: u(p.stillNeeded) })}</div>
                        <div className="email split-short-sm">{shortText}</div>
                      </td>
                      <td className="num">
                        <div className="split-qty">
                          <input
                            className="input"
                            type="number"
                            min="0"
                            max={p.stillNeeded}
                            step="1"
                            value={qty[i]}
                            onChange={(e) => setOne(i, e.target.value)}
                            aria-label={t('split.qtyFor', { site: p.projectName })}
                            style={over ? { borderColor: 'var(--rose)' } : undefined}
                          />
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => fill(i)}
                            disabled={left <= 0 || amount(i) >= p.stillNeeded}
                            title={t('split.fillHint')}
                          >
                            {t('split.fill')}
                          </button>
                        </div>
                      </td>
                      <td className="num split-short">{shortText}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="field-hint" style={{ marginTop: 0 }}>{t('split.hint')}</div>

          <div className="field-row">
            <div className="field">
              <label>{t('movementModal.date')} <span className="req">*</span></label>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label>{t('movementModal.notes')}</label>
              <input className="input" placeholder={t('movementModal.notesPlaceholder')} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}
        </div>

        <div className="modal-foot" style={{ justifyContent: 'space-between' }}>
          <div className="grand-total">
            <span>{t('movementModal.value')}</span>
            <strong>{formatMoney(sending * s.price)}</strong>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-ghost" onClick={onClose} disabled={saving}>{t('common.cancel')}</button>
            <button className="btn btn-primary" onClick={submit} disabled={saving}>
              {saving && <span className="spinner" />}
              {t('split.confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
