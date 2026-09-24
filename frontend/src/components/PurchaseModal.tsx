import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n/LanguageContext';
import { formatMoney } from '../lib/format';
import type { Item, Project, PurchaseDetail, PurchaseDraft, PurchaseInput, Supplier } from '../types';
import { PlusIcon, TrashIcon, XIcon } from './icons';

interface Props {
  open: boolean;
  initial: PurchaseDetail | null; // null = record a new purchase; otherwise edit this one
  draft?: PurchaseDraft | null; // a new purchase that starts pre-filled (e.g. from the to-buy list)
  suppliers: Supplier[];
  projects: Project[];
  items: Item[];
  saving: boolean;
  onClose: () => void;
  onSave: (data: PurchaseInput) => void;
}

interface LineState {
  key: number; // stable React key
  id?: number; // an existing line's id when editing (so the server knows which line changed)
  itemId: string;
  quantity: string;
  unitPrice: string;
}

interface FormState {
  supplierId: string;
  projectId: string; // '' = none
  invoiceNumber: string;
  date: string; // yyyy-mm-dd
  notes: string;
}

// Today as yyyy-mm-dd for the date input's default.
const today = () => new Date().toISOString().slice(0, 10);

let keySeq = 1;
const blankLine = (): LineState => ({ key: keySeq++, itemId: '', quantity: '1', unitPrice: '' });

const emptyForm: FormState = { supplierId: '', projectId: '', invoiceNumber: '', date: today(), notes: '' };

export function PurchaseModal({ open, initial, draft, suppliers, projects, items, saving, onClose, onSave }: Props) {
  const { t } = useI18n();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [lines, setLines] = useState<LineState[]>([blankLine()]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    if (initial) {
      // Edit: start from the saved invoice.
      setForm({
        supplierId: String(initial.supplierId),
        projectId: initial.projectId ? String(initial.projectId) : '',
        invoiceNumber: initial.invoiceNumber ?? '',
        date: initial.date.slice(0, 10), // stored as a calendar date, so no timezone shift
        notes: initial.notes ?? '',
      });
      setLines(initial.items.map((li) => ({
        key: keySeq++,
        id: li.id,
        itemId: String(li.itemId),
        quantity: String(li.quantity),
        unitPrice: String(li.unitPrice),
      })));
    } else if (draft) {
      // New, pre-filled: the supplier is still the user's choice.
      setForm({ ...emptyForm, date: today(), projectId: draft.projectId ? String(draft.projectId) : '' });
      setLines(draft.lines.map((l) => ({ key: keySeq++, itemId: String(l.itemId), quantity: String(l.quantity), unitPrice: String(l.unitPrice) })));
    } else {
      setForm({ ...emptyForm, date: today() });
      setLines([blankLine()]);
    }
  }, [open, initial, draft]);

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const lineTotal = (l: LineState) => (parseFloat(l.quantity) || 0) * (parseFloat(l.unitPrice) || 0);
  const total = useMemo(() => lines.reduce((sum, l) => sum + lineTotal(l), 0), [lines]);

  if (!open) return null;

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const setLine = (key: number, patch: Partial<LineState>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  // Picking an item pre-fills its list price (the user can still override).
  const pickItem = (key: number, itemId: string) => {
    const item = itemsById.get(Number(itemId));
    setLine(key, { itemId, unitPrice: item ? String(item.price) : '' });
  };

  const addLine = () => setLines((ls) => [...ls, blankLine()]);
  const removeLine = (key: number) =>
    setLines((ls) => (ls.length === 1 ? ls : ls.filter((l) => l.key !== key)));

  const submit = () => {
    if (!form.supplierId) return setError(t('purchaseModal.supplierRequired'));
    if (!form.date) return setError(t('purchaseModal.dateRequired'));

    const parsed = lines
      .filter((l) => l.itemId) // ignore blank rows
      .map((l) => ({ id: l.id ?? null, itemId: Number(l.itemId), quantity: Number(l.quantity), unitPrice: Number(l.unitPrice) }));

    if (parsed.length === 0) return setError(t('purchaseModal.noLines'));
    if (parsed.some((l) => !Number.isFinite(l.quantity) || l.quantity <= 0))
      return setError(t('purchaseModal.badQuantity'));
    if (parsed.some((l) => !Number.isFinite(l.unitPrice) || l.unitPrice < 0))
      return setError(t('purchaseModal.badPrice'));

    onSave({
      supplierId: Number(form.supplierId),
      projectId: form.projectId ? Number(form.projectId) : null,
      invoiceNumber: form.invoiceNumber.trim() || null,
      date: form.date,
      notes: form.notes.trim() || null,
      items: parsed,
    });
  };

  const noItems = items.length === 0;
  const noSuppliers = suppliers.length === 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3>{initial ? t('purchaseModal.editTitle') : t('purchaseModal.title')}</h3>
            <p>{initial ? t('purchaseModal.editSub') : t('purchaseModal.sub')}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}><XIcon /></button>
        </div>

        <div className="modal-body">
          {initial && <div className="field-hint">{t('purchaseModal.editHint')}</div>}
          {!initial && draft && <div className="field-hint" style={{ color: 'var(--accent-2)' }}>{t('purchaseModal.draftHint')}</div>}
          {(noSuppliers || noItems) && (
            <div className="field-hint" style={{ color: 'var(--amber)' }}>
              {noSuppliers ? t('purchaseModal.needSupplier') : t('purchaseModal.needItem')}
            </div>
          )}

          <div className="field-row">
            <div className="field">
              <label>{t('purchaseModal.supplier')} <span className="req">*</span></label>
              <select className="select" value={form.supplierId} onChange={(e) => setField('supplierId', e.target.value)}>
                <option value="">{t('purchaseModal.chooseSupplier')}</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.code}</option>)}
              </select>
            </div>
            <div className="field">
              <label>{t('purchaseModal.project')}</label>
              <select className="select" value={form.projectId} onChange={(e) => setField('projectId', e.target.value)}>
                <option value="">{t('purchaseModal.noProject')}</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.code}</option>)}
              </select>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>{t('purchaseModal.date')} <span className="req">*</span></label>
              <input className="input" type="date" value={form.date} onChange={(e) => setField('date', e.target.value)} />
            </div>
            <div className="field">
              <label>{t('purchaseModal.invoiceNumber')}</label>
              <input className="input" autoComplete="off" placeholder={t('purchaseModal.invoicePlaceholder')} value={form.invoiceNumber} onChange={(e) => setField('invoiceNumber', e.target.value)} />
            </div>
          </div>

          {/* Line items */}
          <div className="field">
            <label>{t('purchaseModal.items')} <span className="req">*</span></label>
            <div className="lines">
              <div className="line line-head">
                <div className="line-item">{t('purchaseModal.item')}</div>
                <div className="line-qty">{t('purchaseModal.qty')}</div>
                <div className="line-price">{t('purchaseModal.unitPrice')}</div>
                <div className="line-total">{t('purchaseModal.lineTotal')}</div>
                <div className="line-remove" />
              </div>

              {lines.map((l) => (
                <div className="line" key={l.key}>
                  <div className="line-item">
                    <select className="select" value={l.itemId} onChange={(e) => pickItem(l.key, e.target.value)}>
                      <option value="">{t('purchaseModal.chooseItem')}</option>
                      {items.map((i) => <option key={i.id} value={i.id}>{i.name} · {i.code}</option>)}
                    </select>
                  </div>
                  <div className="line-qty">
                    <input className="input" type="number" min="1" step="1" value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value })} />
                  </div>
                  <div className="line-price">
                    <input className="input" type="number" min="0" step="0.01" value={l.unitPrice} onChange={(e) => setLine(l.key, { unitPrice: e.target.value })} />
                  </div>
                  <div className="line-total">{formatMoney(lineTotal(l))}</div>
                  <div className="line-remove">
                    <button className="act-btn danger" onClick={() => removeLine(l.key)} disabled={lines.length === 1} aria-label={t('purchaseModal.removeLine')} title={t('purchaseModal.removeLine')}>
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button className="btn btn-ghost btn-sm" onClick={addLine} style={{ marginTop: 10 }}>
              <PlusIcon /> {t('purchaseModal.addLine')}
            </button>
          </div>

          <div className="field">
            <label>{t('purchaseModal.notes')}</label>
            <textarea className="input" rows={2} placeholder={t('purchaseModal.notesPlaceholder')} value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
          </div>

          {error && <div style={{ color: 'var(--rose)', fontSize: 13 }}>{error}</div>}
        </div>

        <div className="modal-foot" style={{ justifyContent: 'space-between' }}>
          <div className="grand-total">
            <span>{t('purchaseModal.total')}</span>
            <strong>{formatMoney(total)}</strong>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-ghost" onClick={onClose} disabled={saving}>{t('common.cancel')}</button>
            <button className="btn btn-primary" onClick={submit} disabled={saving}>
              {saving && <span className="spinner" />}
              {initial ? t('common.saveChanges') : t('purchaseModal.record')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
