import { useCallback, useMemo, useState } from 'react';
import { plansApi } from '../api/plans';
import { useI18n } from '../i18n/LanguageContext';
import { useCached } from '../lib/cache';
import { formatDateTime, formatTimeAgo, formatUsd } from '../lib/format';
import type { Item, Project, ProjectPlan } from '../types';
import { TrashIcon, XIcon } from './icons';
import { useToast } from './toast';

interface Props {
  project: Project | null; // null = closed
  canEdit: boolean; // managers only
  items: Item[]; // for the "add to plan" picker
  onClose: () => void;
  onSaved: () => void; // the plan changed — refresh shortages elsewhere
}

// A row as shown: saved plan data with the (possibly edited) planned quantity.
interface Row {
  itemId: number;
  name: string;
  code: string;
  unit: string;
  price: number;
  onSite: number;
  planned: number;
  inPlan: boolean;
}

// The planned quantities being edited, by item id (as typed, so '' is allowed).
type Draft = Record<number, string>;

const draftFrom = (plan: ProjectPlan): Draft =>
  Object.fromEntries(plan.lines.filter((l) => l.inPlan).map((l) => [l.itemId, String(l.planned)]));

// Rendered only while a project is chosen, and fresh for each project.
export function ProjectPlanModal(props: Props) {
  if (!props.project) return null;
  return <PlanEditor key={props.project.id} {...props} project={props.project} />;
}

function PlanEditor({ project, canEdit, items, onClose, onSaved }: Props & { project: Project }) {
  const { t } = useI18n();
  const toast = useToast();
  // The plan as loaded (last copy at once, always re-checked), or as just saved.
  const fetchPlan = useCallback(() => plansApi.get(project.id), [project.id]);
  const loaded = useCached(`plan:${project.id}`, fetchPlan, 0);
  const [saved, setSaved] = useState<ProjectPlan | null>(null);
  const plan = saved ?? loaded.data ?? null;
  const loading = loaded.loading;

  // Your edits; null = none yet, so the quantities are the plan's own.
  const [edits, setEdits] = useState<Draft | null>(null);
  const planDraft = useMemo(() => (plan ? draftFrom(plan) : {}), [plan]);
  const draft = edits ?? planDraft;

  const [saveError, setError] = useState('');
  const error = saveError || loaded.error;
  const [saving, setSaving] = useState(false);

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  // Everything on the plan or on the site, with the edited quantities applied.
  const rows = useMemo<Row[]>(() => {
    if (!plan) return [];
    const fromPlan: Row[] = plan.lines.map((l) => ({
      itemId: l.itemId, name: l.name, code: l.code, unit: l.unit, price: l.price, onSite: l.onSite,
      planned: l.itemId in draft ? parseInt(draft[l.itemId]) || 0 : 0,
      inPlan: l.itemId in draft,
    }));
    const known = new Set(plan.lines.map((l) => l.itemId));
    const added: Row[] = Object.keys(draft).map(Number).filter((id) => !known.has(id) && itemsById.has(id)).map((id) => {
      const i = itemsById.get(id)!;
      return { itemId: id, name: i.name, code: i.code, unit: i.unit, price: i.price, onSite: 0, planned: parseInt(draft[id]) || 0, inPlan: true };
    });
    return [...fromPlan, ...added];
  }, [plan, draft, itemsById]);

  // Live totals, so the numbers react while typing.
  const still = (r: Row) => Math.max(0, r.planned - r.onSite);
  const budget = rows.reduce((s, r) => s + r.planned * r.price, 0);
  const stillToSpend = rows.reduce((s, r) => s + still(r) * r.price, 0);
  const covered = rows.reduce((s, r) => s + Math.min(r.onSite, r.planned) * r.price, 0);
  const progress = budget > 0 ? Math.round((covered / budget) * 100) : 0;

  const dirty = edits !== null && JSON.stringify(edits) !== JSON.stringify(planDraft);
  const addable = items.filter((i) => !(i.id in draft));

  const setQty = (itemId: number, value: string) => setEdits({ ...draft, [itemId]: value });
  const remove = (itemId: number) => { const next = { ...draft }; delete next[itemId]; setEdits(next); };

  const save = async () => {
    const lines = Object.entries(draft).map(([id, v]) => ({ itemId: Number(id), planned: Number(v === '' ? 0 : v) }));
    if (lines.some((l) => !Number.isInteger(l.planned) || l.planned < 0)) return setError(t('plan.badQty'));
    setError('');
    setSaving(true);
    try {
      const result = await plansApi.save(project.id, lines);
      setSaved(result);
      setEdits(null);
      toast('success', t('plan.saved'));
      onSaved();
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const isEmpty = rows.length === 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head with-close">
          <div>
            <h3>{t('project.plan')} · {project.name}</h3>
            <p>{t('plan.sub')}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t('common.close')}><XIcon /></button>
        </div>

        <div className="modal-body">
          {loading && <div className="notif-empty">{t('common.loading')}</div>}
          {!loading && error && <div className="form-error" role="alert">{error}</div>}

          {!loading && plan && (
            <>
              <div className="mini-stats">
                <div><span className="k">{t('plan.budget')}</span><span className="v">{formatUsd(budget)}</span></div>
                <div><span className="k">{t('plan.spent')}</span><span className="v">{formatUsd(plan.spentSoFar)}</span></div>
                <div><span className="k">{t('plan.stillToSpend')}</span><span className="v">{formatUsd(stillToSpend)}</span></div>
              </div>

              {budget > 0 && (
                <div className="plan-progress">
                  <div className="plan-progress-head">
                    <span>{t('plan.progress')}</span>
                    <strong>{t('plan.progressOf', { p: progress })}</strong>
                  </div>
                  <div className="plan-progress-track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={t('plan.progress')}>
                    <span style={{ width: `${Math.min(progress, 100)}%` }} />
                  </div>
                </div>
              )}

              {isEmpty ? (
                <div className="field-hint">{canEdit ? t('plan.empty') : t('plan.emptyViewer')}</div>
              ) : (
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>{t('plan.colItem')}</th>
                        <th className="num">{t('plan.colPlanned')}</th>
                        <th className="num">{t('plan.colOnSite')}</th>
                        <th className="num">{t('plan.colStill')}</th>
                        <th className="num">{t('plan.colCost')}</th>
                        {canEdit && <th />}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => {
                        const left = still(r);
                        return (
                          <tr key={r.itemId}>
                            <td><div className="name">{r.name}</div><div className="email">{r.code}</div></td>
                            <td className="num">
                              {canEdit ? (
                                <input
                                  className="input plan-qty"
                                  type="number" min="0" step="1"
                                  placeholder="0"
                                  value={draft[r.itemId] ?? ''}
                                  onChange={(e) => setQty(r.itemId, e.target.value)}
                                  aria-label={`${t('plan.colPlanned')} — ${r.name}`}
                                />
                              ) : r.inPlan ? `${r.planned} ${r.unit}` : '—'}
                            </td>
                            <td className="num">{r.onSite} {r.unit}</td>
                            <td className="num">
                              {!r.inPlan || r.planned === 0 ? (
                                <span style={{ color: 'var(--text-dim)' }}>{t('plan.notPlanned')}</span>
                              ) : left > 0 ? (
                                <strong>{left} {r.unit}</strong>
                              ) : (
                                <span className="badge active"><span className="dot" />{t('plan.done')}{r.onSite > r.planned ? ` · ${t('plan.over', { n: r.onSite - r.planned })}` : ''}</span>
                              )}
                            </td>
                            <td className="num" style={{ fontWeight: 600 }}>{left > 0 ? formatUsd(left * r.price) : '—'}</td>
                            {canEdit && (
                              <td>
                                {r.inPlan && (
                                  <button className="act-btn danger" onClick={() => remove(r.itemId)} aria-label={t('plan.remove')} data-tip={t('plan.remove')}><TrashIcon /></button>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {canEdit && addable.length > 0 && (
                <div className="field" style={{ maxWidth: 360 }}>
                  <label>{t('plan.addItem')}</label>
                  <select className="select" value="" onChange={(e) => e.target.value && setQty(Number(e.target.value), '1')}>
                    <option value="">{t('plan.chooseItem')}</option>
                    {addable.map((i) => <option key={i.id} value={i.id}>{i.name} · {i.code}</option>)}
                  </select>
                </div>
              )}

              <div className="field-hint">
                {t('plan.priceHint')}
                {plan.updatedByName && plan.updatedAt && (
                  <> · <span title={formatDateTime(plan.updatedAt)}>{t('plan.lastEdited', { name: plan.updatedByName, when: formatTimeAgo(plan.updatedAt, t) })}</span></>
                )}
              </div>
            </>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>{t('common.close')}</button>
          {canEdit && plan && (
            <button className="btn btn-primary" onClick={save} disabled={saving || !dirty}>
              {saving && <span className="spinner" />}
              {t('plan.save')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
