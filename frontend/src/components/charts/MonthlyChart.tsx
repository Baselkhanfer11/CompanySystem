import { useState, type CSSProperties } from 'react';
import { useI18n } from '../../i18n/LanguageContext';
import { formatUsd, formatUsdShort, formatUsdTick } from '../../lib/format';
import { monthLabel, monthLong, niceTicks } from '../../lib/reports';
import type { MonthlySpend } from '../../types';

interface Props {
  data: MonthlySpend[];
  height?: number; // plot height in px; the x-axis labels sit below it
  maxLabels?: number; // most x-axis labels before we start skipping some
}

/**
 * Spend per month as a single-series column chart. One colour for every
 * column (the title says what's plotted, so no legend). Every column has a
 * hover/focus tooltip, the tallest one is labelled, and a table view is one
 * click away so no value is ever hidden behind hovering.
 */
export function MonthlyChart({ data, height = 190, maxLabels = 12 }: Props) {
  const { t, dir } = useI18n();
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  if (data.length === 0) return <div className="chart-empty">{t('chart.noData')}</div>;

  const max = Math.max(...data.map((d) => d.total));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const pct = (v: number) => (v / top) * 100;
  const peak = max > 0 ? data.findIndex((d) => d.total === max) : -1;
  const labelEvery = Math.ceil(data.length / maxLabels);

  // Tooltip placement, using logical sides so it mirrors correctly in Arabic.
  // Near the edges it pins to that edge instead of centring, so it never overflows.
  let tipStyle: CSSProperties = {};
  if (active !== null) {
    const n = data.length;
    const bottom = `calc(${Math.min(pct(data[active].total), 62)}% + 10px)`;
    const pos = (active + 0.5) / n;
    if (pos < 0.2) tipStyle = { bottom, insetInlineStart: `${(active / n) * 100}%` };
    else if (pos > 0.8) tipStyle = { bottom, insetInlineEnd: `${((n - active - 1) / n) * 100}%` };
    else tipStyle = { bottom, insetInlineStart: `${pos * 100}%`, transform: `translateX(${dir === 'rtl' ? '50%' : '-50%'})` };
  }

  return (
    <div className="mchart">
      <div className="mchart-body" style={{ height }}>
        {/* y-axis tick labels */}
        <div className="mchart-y" aria-hidden="true">
          {ticks.map((v) => (
            <span key={v} style={{ bottom: `${pct(v)}%` }}>{formatUsdTick(v)}</span>
          ))}
        </div>

        <div className="mchart-plot" onPointerLeave={() => setActive(null)}>
          {ticks.map((v, i) => (
            <div key={v} className={`mchart-grid ${i === 0 ? 'base' : ''}`} style={{ bottom: `${pct(v)}%` }} />
          ))}

          <div className="mchart-cols">
            {data.map((d, i) => (
              <button
                key={`${d.year}-${d.month}`}
                type="button"
                className={`mchart-slot ${active === i ? 'on' : ''}`}
                onPointerEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                aria-label={`${monthLong(d.year, d.month)}: ${formatUsd(d.total)}`}
              >
                {d.total > 0 && <span className="mchart-col" style={{ height: `${pct(d.total)}%` }} />}
                {i === peak && active === null && (
                  <span className="mchart-peak" style={{ bottom: `${pct(d.total)}%` }}>{formatUsdShort(d.total)}</span>
                )}
              </button>
            ))}
          </div>

          {active !== null && (
            <div className="chart-tip" style={tipStyle} role="presentation">
              <strong>{formatUsd(data[active].total)}</strong>
              <span>{monthLong(data[active].year, data[active].month)}</span>
            </div>
          )}
        </div>
      </div>

      {/* x-axis month labels (thinned when there are many months) */}
      <div className="mchart-x" aria-hidden="true">
        {data.map((d, i) => (
          <span key={`${d.year}-${d.month}`}>
            {i % labelEvery === 0 ? monthLabel(d.year, d.month, i === 0 || d.month === 1) : ''}
          </span>
        ))}
      </div>

      <button type="button" className="chart-table-toggle" onClick={() => setShowTable((s) => !s)}>
        {showTable ? t('chart.hideTable') : t('chart.showTable')}
      </button>

      {showTable && (
        <div className="table-wrap chart-table">
          <table className="data">
            <thead>
              <tr>
                <th>{t('chart.month')}</th>
                <th style={{ textAlign: 'end' }}>{t('chart.spend')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={`${d.year}-${d.month}`}>
                  <td>{monthLong(d.year, d.month)}</td>
                  <td style={{ textAlign: 'end' }}>{formatUsd(d.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
