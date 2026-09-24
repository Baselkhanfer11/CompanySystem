import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n/LanguageContext';
import { formatMoney } from '../lib/format';
import type { Item, MovementDraft, MovementType, Project, SiteStock, StockMovementInput } from '../types';
import { PlusIcon, TrashIcon, XIcon } from './icons';

interface Props {
  open: boolean;
  initialType: MovementType; // which button opened it (the user can still switch)
  draft?: MovementDraft | null; // a send that starts pre-filled (e.g. from the to-buy list)
  projects: Project[];
  items: Item[]; // warehouse stock is item.quantity
  siteStock: SiteStock[]; // what's on each site
  saving: boolean;
  onClose: () => void;
  onSave: (data: StockMovementInput) => void;
}

interface LineState {
  key: number; // stable React key
  itemId: string;
  quantity: string;
}

const today = () => new Date().toISOString().slice(0, 10);

let keySeq = 1;
const blankLine = (): LineState => ({ key: keySeq++, itemId: '', quantity: '1' });

export function MovementModal({ open, initialType, draft, projects, items, siteStock, saving, onClose, onSave }: Props) {
  const { t } = useI18n();
  const [type, setType] = useState<MovementType>(initialType);
  const [projectId, setProjectId] = useState('');
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineState[]>([blankLine()]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setType(draft ? 'Issue' : initialType);
    setProjectId(draft ? String(draft.projectId) : '');
    setDate(today());
    setNotes('');
    setLines(draft?.lines.length
      ? draft.lines.map((l) => ({ key: keySeq++, itemId: String(l.itemId), quantity: String(l.quantity) }))
      : [blankLine()]);
    setError('');
  }, [open, initialType, draft]);

  const isIssue = type === 'Issue';
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  // What's on the chosen site, by item.
  const onSite = useMemo(
    () => new Map(siteStock.filter((s) => String(s.projectId) === projectId && s.quantity > 0).map((s) => [s.itemId, s])),
    [siteStock, projectId],
  );

  // Where the material comes FROM decides what's available and what it's worth.
  const available = (itemId: number) => (isIssue ? itemsById.get(itemId)?.quantity ?? 0 : onSite.get(itemId)?.quantity ?? 0);
  const unitValue = (itemId: number) => {
    if (isIssue) return itemsById.get(itemId)?.price ?? 0;
    const s = onSite.get(itemId);
    return s && s.quantity > 0 ? s.value / s.quantity : 0; // average cost on the site
  };

  // Sending: any item. Returning: only what's on that site.
  const choices = isIssue ? items : items.filter((i) => onSite.has(i.id));

  const lineValue = (l: LineState) => (l.itemId ? (parseInt(l.quantity) || 0) * unitValue(Number(l.itemId)) : 0);
  const total = lines.reduce((sum, l) => sum + lineValue(l), 0);

  if (!open) return null;

  // Switching direction or site changes which items make sense, so start the lines over.
  const switchType = (next: MovementType) => { setType(next); setLines([blankLine()]); setError(''); };
  const switchSite = (next: string) => { setProjectId(next); if (!isIssue) setLines([blankLine()]); setError(''); };

  const setLine = (key: number, patch: Partial<LineState>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, blankLine()]);
  const removeLine = (key: number) => setLines((ls) => (ls.length === 1 ? ls : ls.filter((l) => l.key !== key)));

  const submit = () => {
    if (!projectId) return setError(t('movementModal.siteRequired'));
    if (!date) return setError(t('movementModal.dateRequired'));

    const parsed = lines.filter((l) => l.itemId).map((l) => ({ itemId: Number(l.itemId), quantity: Number(l.quantity) }));
    if (parsed.length === 0) return setError(t('movementModal.noLines'));
    if (parsed.some((l) => !Number.isInteger(l.quantity) || l.quantity <= 0)) return setError(t('movementModal.badQuantity'));

    // The same item may be on several lines — check the total against what's there.
    const wanted = new Map<number, number>();
    for (const l of parsed) wanted.set(l.itemId, (wanted.get(l.itemId) ?? 0) + l.quantity);
    for (const [itemId, qty] of wanted) {
      if (qty > available(itemId)) {
        const item = itemsById.get(itemId)!;
        return setError(t('movementModal.tooMany', { item: item.name, n: available(itemId), unit: item.unit }));
      }
    }

    onSave({ type, projectId: Number(projectId), date, notes: notes.trim() || null, items: parsed });
  };

  const nothingToReturn = !isIssue && projectId !== '' && onSite.size === 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head with-close">
          <div>
            <h3>{isIssue ? t('movementModal.sendTitle') : t('movementModal.returnTitle')}</h3>
            <p>{isIssue ? t('movementModal.sendSub') : t('movementModal.returnSub')}</p>
            {draft && isIssue && <div className="field-hint" style={{ color: 'var(--accent-2)' }}>{t('movementModal.draftHint')}</div>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}><XIcon /></button>
        </div>

        <div className="modal-body">
          <div className="seg" role="group" aria-label={t('movementModal.direction')}>
            {(['Issue', 'Return'] as const).map((d) => (
              <button key={d} type="button" className={`seg-btn ${type === d ? 'on' : ''}`} aria-pressed={type === d} onClick={() => switchType(d)}>
                {d === 'Issue' ? t('stock.send') : t('stock.return')}
              </button>
            ))}
          </div>

          <div className="field-row">
            <div className="field">
              <label>{t('movementModal.site')} <span className="req">*</span></label>
              <select className="select" value={projectId} onChange={(e) => switchSite(e.target.value)}>
                <option value="">{t('movementModal.chooseSite')}</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.code}</option>)}
              </select>
            </div>
            <div className="field">
              <label>{t('movementModal.date')} <span className="req">*</span></label>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>{t('movementModal.items')} <span className="req">*</span></label>

            {!isIssue && projectId === '' && <div className="field-hint">{t('movementModal.pickSiteFirst')}</div>}
            {nothingToReturn && <div className="field-hint" style={{ color: 'var(--amber)' }}>{t('movementModal.nothingOnSite')}</div>}

            {(isIssue || (projectId !== '' && !nothingToReturn)) && (
              <>
                <div className="lines">
                  <div className="line line-head">
                    <div className="line-item">{t('movementModal.item')}</div>
                    <div className="line-qty">{t('movementModal.qty')}</div>
                    <div className="line-price">{t('movementModal.available')}</div>
                    <div className="line-total">{t('movementModal.value')}</div>
                    <div className="line-remove" />
                  </div>

                  {lines.map((l) => {
                    const item = l.itemId ? itemsById.get(Number(l.itemId)) : undefined;
                    const over = item ? (parseInt(l.quantity) || 0) > available(item.id) : false;
                    return (
                      <div className="line" key={l.key}>
                        <div className="line-item">
                          <select className="select" value={l.itemId} onChange={(e) => setLine(l.key, { itemId: e.target.value })}>
                            <option value="">{t('movementModal.chooseItem')}</option>
                            {choices.map((i) => <option key={i.id} value={i.id}>{i.name} · {i.code}</option>)}
                          </select>
                        </div>
                        <div className="line-qty">
                          <input className="input" type="number" min="1" step="1" value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value })} />
                        </div>
                        <div className="line-price" style={{ color: over ? 'var(--rose)' : 'var(--text-muted)' }}>
                          {item ? `${available(item.id)} ${item.unit}` : '—'}
                        </div>
                        <div className="line-total">{formatMoney(lineValue(l))}</div>
                        <div className="line-remove">
                          <button className="act-btn danger" onClick={() => removeLine(l.key)} disabled={lines.length === 1} aria-label={t('movementModal.removeLine')} data-tip={t('movementModal.removeLine')}>
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button className="btn btn-ghost btn-sm" onClick={addLine} style={{ marginTop: 12 }}>
                  <PlusIcon /> {t('movementModal.addLine')}
                </button>
              </>
            )}
            <div className="field-hint" style={{ marginTop: 12 }}>{t('movementModal.costHint')}</div>
          </div>

          <div className="field">
            <label>{t('movementModal.notes')}</label>
            <textarea className="input" rows={2} placeholder={t('movementModal.notesPlaceholder')} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}
        </div>

        <div className="modal-foot" style={{ justifyContent: 'space-between' }}>
          <div className="grand-total">
            <span>{t('movementModal.value')}</span>
            <strong>{formatMoney(total)}</strong>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-ghost" onClick={onClose} disabled={saving}>{t('common.cancel')}</button>
            <button className="btn btn-primary" onClick={submit} disabled={saving || nothingToReturn}>
              {saving && <span className="spinner" />}
              {isIssue ? t('movementModal.confirmSend') : t('movementModal.confirmReturn')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
