import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { employeesApi } from '../api/employees';
import { itemsApi } from '../api/items';
import { Avatar } from '../components/Avatar';
import { StatCard } from '../components/StatCard';
import {
  BoxesIcon, BriefcaseIcon, TrendingIcon, UserCheckIcon, UsersIcon,
} from '../components/icons';
import type { Employee, Item } from '../types';

export function DashboardPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      employeesApi.getAll().then(setEmployees).catch(() => {}),
      itemsApi.getAll().then(setItems).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  const total = employees.length;
  const active = employees.filter((e) => e.isActive).length;
  const positions = new Set(employees.map((e) => e.position).filter(Boolean)).size;
  const recent = [...employees].sort((a, b) => b.id - a.id).slice(0, 5);

  return (
    <div>
      {/* Hero banner */}
      <div
        className="card rise"
        style={{
          padding: '28px 30px', marginBottom: 26, position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(120deg, rgba(124,108,255,0.18), rgba(176,108,255,0.06) 60%, transparent)',
        }}
      >
        <div style={{ position: 'absolute', right: -30, top: -30, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,108,255,0.35), transparent 70%)', filter: 'blur(20px)' }} />
        <div style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent-2)', fontWeight: 600 }}>
          Welcome back
        </div>
        <h1 style={{ fontSize: 28, marginTop: 8 }}>Company overview</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 6, maxWidth: 460 }}>
          A quick snapshot of your team. More modules — store, projects, and sales — are on the way.
        </p>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <StatCard icon={<UsersIcon />} value={loading ? '—' : total} label="Total employees" color="#7c6cff" trend="Team size" delay={0} />
        <StatCard icon={<UserCheckIcon />} value={loading ? '—' : active} label="Active" color="#34d399" trend={total ? `${Math.round((active / total) * 100)}% active` : '—'} trendUp delay={70} />
        <StatCard icon={<BriefcaseIcon />} value={loading ? '—' : positions} label="Distinct roles" color="#33d6e6" trend="Positions" delay={140} />
        <StatCard icon={<BoxesIcon />} value={loading ? '—' : items.length} label="Items in store" color="#fbbf24" trend={items.length ? 'In stock' : 'Add items'} delay={210} />
      </div>

      {/* Recent employees + coming soon */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18 }} className="dash-cols">
        <div className="panel rise" style={{ animationDelay: '120ms' }}>
          <div className="panel-head">
            <div>
              <h3>Recent employees</h3>
              <div className="sub">Latest additions to your team</div>
            </div>
            <Link className="btn btn-ghost" to="/employees">View all</Link>
          </div>
          {recent.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <div className="empty-illus"><UsersIcon /></div>
              <p style={{ margin: 0 }}>No employees yet.</p>
            </div>
          ) : (
            <div style={{ padding: 8 }}>
              {recent.map((e) => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 12 }}>
                  <Avatar name={e.fullName} size={36} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600 }}>{e.fullName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{e.position || 'No position'}</div>
                  </div>
                  <span className={`badge ${e.isActive ? 'active' : 'inactive'}`} style={{ marginLeft: 'auto' }}>
                    <span className="dot" />{e.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel rise" style={{ animationDelay: '200ms' }}>
          <div className="panel-head"><div><h3>What’s next</h3><div className="sub">Upcoming modules</div></div></div>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { icon: <BoxesIcon />, label: 'Store & inventory', desc: 'Track materials and stock levels' },
              { icon: <TrendingIcon />, label: 'Purchases & sales', desc: 'Buy in, sell out, see statistics' },
            ].map((x) => (
              <div key={x.label} style={{ display: 'flex', gap: 12, padding: 14, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="stat-icon" style={{ width: 38, height: 38, margin: 0, background: 'rgba(124,108,255,0.15)', color: 'var(--accent)' }}>{x.icon}</div>
                <div>
                  <div style={{ fontWeight: 600 }}>{x.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{x.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
