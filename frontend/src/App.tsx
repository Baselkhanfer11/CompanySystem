import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './auth/RequireAuth';
import { AppLayout } from './layouts/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { LoginPage } from './pages/LoginPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { CostsPage } from './pages/CostsPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { StockMovementsPage } from './pages/StockMovementsPage';
import { StorePage } from './pages/StorePage';
import { SuppliersPage } from './pages/SuppliersPage';
import { ToBuyPage } from './pages/ToBuyPage';
import { UsersPage } from './pages/UsersPage';

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected — must be logged in */}
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/store" element={<StorePage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/purchases" element={<PurchasesPage />} />
          <Route path="/movements" element={<StockMovementsPage />} />
          <Route path="/to-buy" element={<ToBuyPage />} />
          <Route path="/costs" element={<CostsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
