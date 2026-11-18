import { useMemo, useState } from 'react';
import { useDialog } from '../lib/useDialog';
import { useI18n } from '../i18n/LanguageContext';
import { formatMoney, localDate, numberOrNaN } from '../lib/format';
import type { Customer, Item, SaleDetail, SaleInput } from '../types';
import { PlusIcon, TrashIcon, XIcon } from './icons';

interface Props {
  open: boolean;
  initial: SaleDetail | null; // null = record a new order; otherwise edit this one
  customers: Customer[];
  items: Item[];
  saving: boolean;
  onClose: () => void;
  onSave: (data: SaleInput) => void;
}

interface LineState {
  key: number; // stable React key
  id?: number; // an existing line's id when editing (so the server knows which line changed)
  itemId: string;
  quantity: string;
  unitPrice: string;
}

interface FormState {
  customerId: string;
  reference: string;
  date: string; // yyyy-mm-dd
  notes: string;
}

let keySeq = 1;
const blankLine = (): LineState => ({ key: keySeq++, itemId: '', quantity: '1', unitPrice: '' });

function startForm(initial: SaleDetail | null): FormState {
  if (initial) {
    return {
      customerId: String(initial.customerId),
      reference: initial.reference ?? '',
      date: initial.date.slice(0, 10), // stored as a calendar date, so no timezone shift
      notes: initial.notes ?? '',
    };
  }
  return { customerId: '', reference: '', date: localDate(), notes: '' };
}

function startLines(initial: SaleDetail | null): LineState[] {
  if (!initial) return [blankLine()];
  return initial.items.map((li) => ({
    key: keySeq++,
    id: li.id,
    itemId: String(li.itemId),
    quantity: String(li.quantity),
    unitPrice: String(li.unitPrice ?? ''),
  }));
}

// Rendered only while open, and fresh each time, so the form always starts
// from the order being edited, or blank.
export function SaleModal(props: Props) {
  if (!props.open) return null;
  return <SaleForm key={props.initial?.id ?? 'new'} {...props} />;
}

function SaleForm({ initial, customers, items, saving, onClose, onSave }: Props) {
  const dialog = useDialog(onClose);
  const { t } = useI18n();
  const [form, setForm] = useState<FormState>(() => startForm(initial));
  const [lines, setLines] = useState<LineState[]>(() => startLines(initial));
  const [error, setError] = useState('');

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  // Only active customers are offered — plus the one already on this order.
  const choices = useMemo(
    () => customers.filter((c) => c.status === 'Active' || c.id === initial?.customerId),
    [customers, initial],
  );

  const lineTotal = (l: LineState) => (parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0);
  const total = useMemo(() => lines.reduce((sum, l) => sum + lineTotal(l), 0), [lines]);

  // What the warehouse has of each item, against what this order asks for in
  // total (the same item may be on two lines). An order may exceed it — it's a
  // promise, not a move — but the person should know before promising.
  const wanted = useMemo(() => {
    const m = new Map<number, number>();
    for (const l of lines) if (l.itemId) m.set(Number(l.itemId), (m.get(Number(l.itemId)) ?? 0) + (parseInt(l.quantity, 10) || 0));
    return m;
  }, [lines]);

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setLine = (key: number, patch: Partial<LineState>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  // Picking an item pre-fills its price (the user can still override).
  const pickItem = (key: number, itemId: string) => {
    const item = itemsById.get(Number(itemId));
    setLine(key, { itemId, unitPrice: item?.price != null ? String(item.price) : '' });
  };

  const addLine = () => setLines((ls) => [...ls, blankLine()]);
  const removeLine = (key: number) =>
    setLines((ls) => (ls.length === 1 ? ls : ls.filter((l) => l.key !== key)));

  const submit = () => {
    if (saving) return;
    if (!form.customerId) return setError(t('saleModal.customerRequired'));
    if (!form.date) return setError(t('saleModal.dateRequired'));

    // A blank box is not a number: Number('') is 0, which would save a free sale.
    const parsed = lines
      .filter((l) => l.itemId) // ignore blank rows
      .map((l) => ({ id: l.id ?? null, itemId: Number(l.itemId), quantity: numberOrNaN(l.quantity), unitPrice: numberOrNaN(l.unitPrice) }));

    if (parsed.length === 0) return setError(t('saleModal.noLines'));
    if (parsed.some((l) => !Number.isInteger(l.quantity) || l.quantity <= 0))
      return setError(t('saleModal.badQuantity'));
    if (parsed.some((l) => !Number.isFinite(l.unitPrice) || l.unitPrice < 0))
      return setError(t('saleModal.badPrice'));

    onSave({
      customerId: Number(form.customerId),
      reference: form.reference.trim() || null,
      date: form.date,
      notes: form.notes.trim() || null,
      items: parsed,
    });
  };

  const noItems = items.length === 0;
  const noCustomers = choices.length === 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" ref={dialog} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head with-close">
          <div>
            <h3>{initial ? t('saleModal.editTitle') : t('saleModal.title')}</h3>
            <p>{initial ? t('saleModal.editSub') : t('saleModal.sub')}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}><XIcon /></button>
        </div>

        <div className="modal-body">
          {initial && <div className="field-hint">{t('saleModal.editHint')}</div>}
          {(noCustomers || noItems) && (
            <div className="field-hint" style={{ color: 'var(--amber)' }}>
              {noCustomers ? t('saleModal.needCustomer') : t('saleModal.needItem')}
            </div>
          )}

          <div className="field-row">
            <div className="field">
              <label>{t('saleModal.customer')} <span className="req">*</span></label>
              <select className="select" value={form.customerId} onChange={(e) => setField('customerId', e.target.value)}>
                <option value="">{t('saleModal.chooseCustomer')}</option>
                {choices.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.code}</option>)}
              </select>
            </div>
            <div className="field">
              <label>{t('saleModal.date')} <span className="req">*</span></label>
              <input className="input" type="date" value={form.date} onChange={(e) => setField('date', e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label>{t('saleModal.reference')}</label>
            <input className="input" autoComplete="off" placeholder={t('saleModal.referencePlaceholder')} value={form.reference} onChange={(e) => setField('reference', e.target.value)} />
          </div>

          {/* Line items */}
          <div className="field">
            <label>{t('saleModal.items')} <span className="req">*</span></label>
            <div className="lines">
              <div className="line line-head">
                <div className="line-item">{t('saleModal.item')}</div>
                <div className="line-qty">{t('saleModal.qty')}</div>
                <div className="line-price">{t('saleModal.unitPrice')}</div>
                <div className="line-total">{t('saleModal.lineTotal')}</div>
                <div className="line-remove" />
              </div>

              {lines.map((l) => {
                const item = itemsById.get(Number(l.itemId));
                const short = item ? (wanted.get(item.id) ?? 0) > item.quantity : false;
                return (
                  <div className="line" key={l.key}>
                    <div className="line-item">
                      <select className="select" value={l.itemId} onChange={(e) => pickItem(l.key, e.target.value)}>
                        <option value="">{t('saleModal.chooseItem')}</option>
                        {items.map((i) => <option key={i.id} value={i.id}>{i.name} · {i.code}</option>)}
                      </select>
                    </div>
                    <div className="line-qty">
                      <input className="input" type="number" min="1" step="1" value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value })} />
                    </div>
                    <div className="line-price">
                      <input className="input" type="number" min="0" step="0.0001" value={l.unitPrice} onChange={(e) => setLine(l.key, { unitPrice: e.target.value })} />
                    </div>
                    <div className="line-total">{formatMoney(lineTotal(l))}</div>
                    <div className="line-remove">
                      <button className="act-btn danger" onClick={() => removeLine(l.key)} disabled={lines.length === 1} aria-label={t('saleModal.removeLine')} data-tip={t('saleModal.removeLine')}>
                        <TrashIcon />
                      </button>
                    </div>
                    {item && (
                      <div className="line-note" style={short ? { color: 'var(--rose)' } : undefined}>
                        {short
                          ? t('saleModal.short', { n: item.quantity, unit: item.unit })
                          : t('saleModal.available', { n: item.quantity, unit: item.unit })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button className="btn btn-ghost btn-sm" onClick={addLine} style={{ marginTop: 12 }}>
              <PlusIcon /> {t('saleModal.addLine')}
            </button>
          </div>

          <div className="field">
            <label>{t('saleModal.notes')}</label>
            <textarea className="input" rows={2} placeholder={t('saleModal.notesPlaceholder')} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}
        </div>

        <div className="modal-foot" style={{ justifyContent: 'space-between' }}>
          <div className="grand-total">
            <span>{t('saleModal.total')}</span>
            <strong>{formatMoney(total)}</strong>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-ghost" onClick={onClose} disabled={saving}>{t('common.cancel')}</button>
            <button className="btn btn-primary" onClick={submit} disabled={saving}>
              {saving && <span className="spinner" />}
              {initial ? t('common.saveChanges') : t('saleModal.record')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
