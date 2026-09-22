import { NavLink } from 'react-router-dom';
import {
  BoxesIcon, BriefcaseIcon, CartIcon, CubeIcon, DashboardIcon,
  ProjectsIcon, TrendingIcon, UsersIcon,
} from './icons';

const live = [
  { to: '/', label: 'Dashboard', icon: <DashboardIcon />, end: true },
  { to: '/employees', label: 'Employees', icon: <UsersIcon /> },
];

const soon = [
  { label: 'Store', icon: <BoxesIcon /> },
  { label: 'Projects', icon: <ProjectsIcon /> },
  { label: 'Purchases', icon: <CartIcon /> },
  { label: 'Sales', icon: <TrendingIcon /> },
];

export function Sidebar({ open }: { open: boolean }) {
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand">
        <div className="brand-logo"><CubeIcon /></div>
        <div>
          <div className="brand-name">CompanySystem</div>
          <div className="brand-sub">Inventory · ERP</div>
        </div>
      </div>

      <div className="nav-label">Main</div>
      {live.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          {item.icon}
          <span>{item.label}</span>
        </NavLink>
      ))}

      <div className="nav-label">Operations</div>
      {soon.map((item) => (
        <div key={item.label} className="nav-item disabled">
          {item.icon}
          <span>{item.label}</span>
          <span className="soon-tag">Soon</span>
        </div>
      ))}

      <div className="sidebar-footer">
        <div className="user-chip">
          <div className="brand-logo" style={{ width: 34, height: 34, borderRadius: 10 }}>
            <BriefcaseIcon />
          </div>
          <div className="meta">
            <div className="name">Basel Khanfer</div>
            <div className="role">Administrator</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
