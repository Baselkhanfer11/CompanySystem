import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

// Wraps protected routes: shows a loader while checking, redirects to /login if not signed in.
export function RequireAuth() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-loading">
        <span className="spinner" style={{ width: 28, height: 28 }} />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return <Outlet />;
}
