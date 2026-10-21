import { useAuth } from './AuthContext';
import { canManage, canProcure } from './roles';

/**
 * Which money the signed-in user may see — the same rule the API applies
 * (backend Json/MoneyVisibility.cs), used to hide whole columns and tiles:
 *  - costs:  what material cost a project (managers only)
 *  - prices: what we pay suppliers (managers and the Procurement Officer)
 */
export function useMoney() {
  const { user } = useAuth();
  return { costs: canManage(user?.role), prices: canProcure(user?.role) };
}
