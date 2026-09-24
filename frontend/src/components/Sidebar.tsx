import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { canManage, isAdmin } from '../auth/roles';
import { useI18n } from '../i18n/LanguageContext';
import {
  BoxesIcon, CartIcon, CubeIcon, DashboardIcon, FileIcon, LogoutIcon,
  ProjectsIcon, ShieldIcon, SwapIcon, TrendingIcon, TruckIcon, UsersIcon, WalletIcon,
} from './icons';
import { Avatar } from './Avatar';

const live = [
  { to: '/', labelKey: 'nav.dashboard', icon: <DashboardIcon />, end: true },
  { to: '/employees', labelKey: 'nav.employees', icon: <UsersIcon /> },
];

const soon = [
  { labelKey: 'nav.sales', icon: <TrendingIcon /> },
];

export function Sidebar({ open }: { open: boolean }) {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand">
        <div className="brand-logo"><CubeIcon /></div>
        <div>
          <div className="brand-name">CompanySystem</div>
          <div className="brand-sub">{t('brand.sub')}</div>
        </div>
      </div>

      <div className="nav-label">{t('nav.main')}</div>
      {live.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          {item.icon}
          <span>{t(item.labelKey)}</span>
        </NavLink>
      ))}

      {/* Users management — administrators only */}
      {isAdmin(user?.role) && (
        <NavLink to="/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <ShieldIcon />
          <span>{t('nav.users')}</span>
        </NavLink>
      )}

      <div className="nav-label">{t('nav.operations')}</div>
      <NavLink to="/store" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <BoxesIcon />
        <span>{t('nav.store')}</span>
      </NavLink>
      <NavLink to="/projects" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <ProjectsIcon />
        <span>{t('nav.projects')}</span>
      </NavLink>
      <NavLink to="/documents" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <FileIcon />
        <span>{t('nav.documents')}</span>
      </NavLink>
      <NavLink to="/suppliers" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <TruckIcon />
        <span>{t('nav.suppliers')}</span>
      </NavLink>
      <NavLink to="/purchases" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <CartIcon />
        <span>{t('nav.purchases')}</span>
      </NavLink>
      <NavLink to="/movements" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <SwapIcon />
        <span>{t('nav.movements')}</span>
      </NavLink>
      {/* Spending reports — managers only (CEO + head manager) */}
      {canManage(user?.role) && (
        <NavLink to="/costs" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <WalletIcon />
          <span>{t('nav.costs')}</span>
        </NavLink>
      )}
      {soon.map((item) => (
        <div key={item.labelKey} className="nav-item disabled">
          {item.icon}
          <span>{t(item.labelKey)}</span>
          <span className="soon-tag">{t('nav.soon')}</span>
        </div>
      ))}

      <div className="sidebar-footer">
        <div className="user-chip">
          <Avatar name={user?.fullName || 'User'} size={34} />
          <div className="meta">
            <div className="name">{user?.fullName || 'User'}</div>
            <div className="role">{user?.role ? t(`role.${user.role}`) : ''}</div>
          </div>
          <button className="act-btn" onClick={logout} aria-label={t('nav.signOut')} title={t('nav.signOut')}>
            <LogoutIcon />
          </button>
        </div>
      </div>
    </aside>
  );
}
