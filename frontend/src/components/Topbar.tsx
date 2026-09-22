import { MenuIcon, SearchIcon } from './icons';
import { LangSwitch } from './LangSwitch';
import { NotificationsBell } from './NotificationsBell';
import { ThemeToggle } from './ThemeToggle';

interface Props {
  search: string;
  onSearch: (v: string) => void;
  onMenu: () => void;
  /** When set, shows the search box with this placeholder. Omitted → no search box. */
  placeholder?: string;
}

export function Topbar({ search, onSearch, onMenu, placeholder }: Props) {
  return (
    <header className="topbar">
      <button className="icon-btn mobile-only" onClick={onMenu} aria-label="Menu">
        <MenuIcon />
      </button>

      {placeholder && (
        <div className="search-box">
          <SearchIcon />
          <input
            placeholder={placeholder}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            autoComplete="off"
            name="app-search"
          />
        </div>
      )}

      <div className="topbar-spacer" />

      <LangSwitch />
      <ThemeToggle />
      <NotificationsBell />
    </header>
  );
}
