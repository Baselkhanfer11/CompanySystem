import type { ReactNode } from 'react';

export interface BarRow {
  key: string | number;
  label: string;
  sub?: string; // small secondary line under the label (e.g. a code)
  value: number;
  meta?: string; // extra detail after the share, e.g. "3 purchases"
  muted?: boolean; // de-emphasised (gray) bar, e.g. the "General" bucket
  onClick?: () => void; // makes the row a button (e.g. open a drill-down)
}

interface Props {
  rows: BarRow[];
  format: (n: number) => string;
  total?: number; // when given, each row shows its share of this total
}

// "37%", "<1%" for tiny non-zero shares, "0%" for nothing.
const shareLabel = (value: number, total: number) => {
  const p = (value / total) * 100;
  if (p === 0) return '0%';
  if (p < 1) return '<1%';
  return `${Math.round(p)}%`;
};

/**
 * A ranked list of horizontal bars — one colour for every bar (single series).
 * Each row prints its own label, exact value and share, so the list doubles as
 * the table view: nothing is only visible on hover.
 */
export function BarList({ rows, format, total }: Props) {
  const max = Math.max(0, ...rows.map((r) => r.value));

  return (
    <div className="barlist">
      {rows.map((r) => {
        const width = max > 0 ? (r.value / max) * 100 : 0;
        const details = [total && total > 0 ? shareLabel(r.value, total) : null, r.meta].filter(Boolean).join(' · ');

        const inner: ReactNode = (
          <>
            <div className="barlist-label">
              <span className="name">{r.label}</span>
              {r.sub && <span className="sub">{r.sub}</span>}
            </div>
            <div className="barlist-track" aria-hidden="true">
              {r.value > 0 && <span className="barlist-bar" style={{ width: `${width}%` }} />}
            </div>
            <div className="barlist-value">
              <strong>{format(r.value)}</strong>
              {details && <span>{details}</span>}
            </div>
          </>
        );

        const cls = `barlist-row ${r.muted ? 'muted' : ''}`;
        return r.onClick ? (
          <button key={r.key} type="button" className={`${cls} clickable`} onClick={r.onClick}>{inner}</button>
        ) : (
          <div key={r.key} className={cls}>{inner}</div>
        );
      })}
    </div>
  );
}
