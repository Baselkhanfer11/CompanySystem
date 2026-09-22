import { useEffect, useState } from 'react';
import { UNITS } from '../lib/units';
import type { Item, ItemInput } from '../types';
import { XIcon } from './icons';

interface Props {
  open: boolean;
  initial: Item | null; // null = create
  saving: boolean;
  onClose: () => void;
  onSave: (data: ItemInput) => void;
}

interface FormState {
  name: string;
  code: string;
  quantity: string; // kept as string for the input, parsed on submit
  unit: string;
  price: string;
}

const empty: FormState = { name: '', code: '', quantity: '0', unit: 'pcs', price: '0' };

export function ItemModal({ open, initial, saving, onClose, onSave }: Props) {
  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setError('');
      setForm(
        initial
          ? { name: initial.name, code: initial.code, quantity: String(initial.quantity), unit: initial.unit, price: String(initial.price) }
          : empty,
      );
    }
  }, [open, initial]);

  if (!open) return null;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    if (!form.name.trim()) return setError('Name is required.');
    if (!form.code.trim()) return setError('Code is required.');
    const quantity = Number(form.quantity);
    const price = Number(form.price);
    if (!Number.isFinite(quantity) || quantity < 0) return setError('Quantity must be 0 or more.');
    if (!Number.isFinite(price) || price < 0) return setError('Price must be 0 or more.');

    onSave({ name: form.name.trim(), code: form.code.trim(), quantity, unit: form.unit, price });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3>{initial ? 'Edit item' : 'New item'}</h3>
            <p>{initial ? 'Update this item.' : 'Add a new item to the store.'}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><XIcon /></button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>Name <span className="req">*</span></label>
            <input className="input" autoFocus autoComplete="off" placeholder="e.g. Steel bolt M8" value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>

          <div className="field-row">
            <div className="field">
              <label>Code <span className="req">*</span></label>
              <input className="input" autoComplete="off" placeholder="e.g. SB-M8-001" value={form.code} onChange={(e) => set('code', e.target.value)} />
            </div>
            <div className="field">
              <label>Unit</label>
              <select className="select" value={form.unit} onChange={(e) => set('unit', e.target.value)}>
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Quantity</label>
              <input className="input" type="number" min="0" step="1" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
            </div>
            <div className="field">
              <label>Price (USD)</label>
              <input className="input" type="number" min="0" step="0.01" value={form.price} onChange={(e) => set('price', e.target.value)} />
            </div>
          </div>

          {error && <div style={{ color: 'var(--rose)', fontSize: 13 }}>{error}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving && <span className="spinner" />}
            {initial ? 'Save changes' : 'Create item'}
          </button>
        </div>
      </div>
    </div>
  );
}
