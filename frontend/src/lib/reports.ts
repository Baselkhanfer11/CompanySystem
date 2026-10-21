import type { DateRange } from '../api/reports';
import { localDate } from './format';

// The period presets on the Costs page. Labels come from t(`costs.period.${p}`).
export const PERIODS = ['month', 'quarter', 'year', 'all'] as const;
export type Period = (typeof PERIODS)[number];

/** The date range a preset covers, ending today. "all" has no bounds. */
export function periodRange(p: Period, now = new Date()): DateRange {
  const to = localDate(now);
  switch (p) {
    case 'month':
      return { from: localDate(new Date(now.getFullYear(), now.getMonth(), 1)), to };
    case 'quarter': // this month + the two before it
      return { from: localDate(new Date(now.getFullYear(), now.getMonth() - 2, 1)), to };
    case 'year':
      return { from: localDate(new Date(now.getFullYear(), 0, 1)), to };
    default:
      return {};
  }
}

/** "Sep", or "Sep ’26" when the year should be shown. */
export const monthLabel = (year: number, month: number, withYear = false) => {
  const name = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short' });
  return withYear ? `${name} ’${String(year).slice(-2)}` : name;
};

/** Full month name for tooltips and tables, e.g. "September 2026". */
export const monthLong = (year: number, month: number) =>
  new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

/**
 * Clean, round axis ticks from 0 up to just above `max`
 * (e.g. max 59 → 0, 20, 40, 60). Steps are 1, 2 or 5 × a power of ten.
 */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  const steps = Math.ceil(max / step);
  return Array.from({ length: steps + 1 }, (_, i) => Math.round(i * step * 1e6) / 1e6);
}
