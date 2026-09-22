import type { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  value: ReactNode;
  label: string;
  color: string; // used for the icon tint + glow
  trend?: string;
  trendUp?: boolean;
  delay?: number;
}

export function StatCard({ icon, value, label, color, trend, trendUp, delay = 0 }: Props) {
  return (
    <div className="stat-card rise" style={{ animationDelay: `${delay}ms` }}>
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
    </div>
  );
}
