import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';

export interface LayoutContext {
  search: string;
}

export function AppLayout() {
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar open={menuOpen} />
      <div className="main-area">
        <Topbar
          search={search}
          onSearch={setSearch}
          onMenu={() => setMenuOpen((o) => !o)}
        />
        <div className="page-scroll">
          <Outlet context={{ search } satisfies LayoutContext} />
        </div>
      </div>
    </div>
  );
}
