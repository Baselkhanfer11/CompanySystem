import { useI18n } from '../i18n/LanguageContext';
import type { MovementType } from '../types';

// "Sent to site" / "Returned" pill, used wherever a movement is listed.
export function MovementBadge({ type }: { type: MovementType }) {
  const { t } = useI18n();
  return (
    <span className={`badge ${type === 'Issue' ? 'done' : 'onhold'}`}>
      <span className="dot" />{t(`stock.type.${type}`)}
    </span>
  );
}
