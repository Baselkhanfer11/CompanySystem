import { BellIcon, MenuIcon, SearchIcon, SparkIcon } from './icons';

interface Props {
  search: string;
  onSearch: (v: string) => void;
  onMenu: () => void;
}

export function Topbar({ search, onSearch, onMenu }: Props) {
  return (
    <header className="topbar">
      <button className="icon-btn mobile-only" onClick={onMenu} aria-label="Menu">
        <MenuIcon />
      </button>

      <div className="search-box">
        <SearchIcon />
        <input
          placeholder="Search employees…"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          autoComplete="off"
          name="employee-search"
        />
      </div>

      <div className="topbar-spacer" />

      <button className="icon-btn" aria-label="Assistant"><SparkIcon /></button>
      <button className="icon-btn" aria-label="Notifications"><BellIcon /></button>
    </header>
  );
}
