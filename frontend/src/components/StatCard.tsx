import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface Props {
  icon: ReactNode;
  value: ReactNode;
  label: string;
  color: string; // used for the icon tint + glow
  trend?: string;
  trendUp?: boolean;
  delay?: number;
  to?: string; // makes the whole tile a link to that page
}

export function StatCard({ icon, value, label, color, trend, trendUp, delay = 0, to }: Props) {
  const body = (
    <>
      <div className="glow" style={{ background: color }} />
      <div className="stat-icon" style={{ background: `${color}22`, color }}>
        {icon}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {trend && (
        <div className={`stat-trend ${trendUp ? 'up' : 'flat'}`}>
          {trendUp ? '▲' : '—'} {trend}
        </div>
      )}
    </>
  );
  const style = { animationDelay: `${delay}ms` };
  return to
    ? <Link to={to} className="stat-card stat-link rise" style={style}>{body}</Link>
    : <div className="stat-card rise" style={style}>{body}</div>;
}
