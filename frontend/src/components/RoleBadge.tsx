import { ROLES } from '../auth/roles';
import { useI18n } from '../i18n/LanguageContext';

const COLORS: Record<string, string> = {
  [ROLES.Administrator]: '#7c6cff',
  [ROLES.WarehouseManager]: '#33d6e6',
  [ROLES.Employee]: '#99a1b7',
};

export function RoleBadge({ role }: { role: string }) {
  const { t } = useI18n();
  const c = COLORS[role] ?? '#99a1b7';
  return (
    <span className="badge" style={{ background: `${c}1e`, color: c, border: `1px solid ${c}40` }}>
      <span className="dot" style={{ background: c }} />
      {t(`role.${role}`)}
    </span>
  );
}
