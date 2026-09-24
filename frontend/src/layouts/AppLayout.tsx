import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import { ItemsProvider } from '../data/ItemsContext';
import { NotificationsProvider } from '../data/NotificationsContext';
import { useI18n } from '../i18n/LanguageContext';

export interface LayoutContext {
  search: string;
}

// Per-route search config: which pages show the search bar, and its translation
// key. A route missing here (e.g. the dashboard) hides the search bar entirely.
const SEARCH_KEY_BY_PATH: Record<string, string> = {
  '/employees': 'search.employees',
  '/store': 'search.items',
  '/projects': 'search.projects',
  '/documents': 'search.documents',
  '/suppliers': 'search.suppliers',
  '/purchases': 'search.purchases',
  '/movements': 'search.movements',
  '/to-buy': 'search.toBuy',
  '/users': 'search.users',
};

export function AppLayout() {
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const { t } = useI18n();

  const searchKey = SEARCH_KEY_BY_PATH[pathname];
  const searchPlaceholder = searchKey ? t(searchKey) : undefined;

  // Reset the query whenever we change pages, so a leftover search from one
  // page never silently filters the next one.
  useEffect(() => {
    setSearch('');
  }, [pathname]);

  return (
    <ItemsProvider>
      <NotificationsProvider>
      <div className="app-shell">
        <Sidebar open={menuOpen} />
        <div className="main-area">
          <Topbar
            search={search}
            onSearch={setSearch}
            onMenu={() => setMenuOpen((o) => !o)}
            placeholder={searchPlaceholder}
          />
          <div className="page-scroll">
            <Outlet context={{ search } satisfies LayoutContext} />
          </div>
        </div>
      </div>
      </NotificationsProvider>
    </ItemsProvider>
  );
}
