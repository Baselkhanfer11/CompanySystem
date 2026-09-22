import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AlertIcon, CubeIcon } from '../components/icons';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Already signed in? Skip the login page.
  if (user) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(username.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError((err as Error).message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card rise" onSubmit={submit}>
        <div className="login-brand">
          <div className="brand-logo" style={{ width: 52, height: 52, borderRadius: 15 }}>
            <CubeIcon />
          </div>
        </div>
        <h1 className="login-title">Welcome back</h1>
        <p className="login-sub">Sign in to your CompanySystem account</p>

        <div className="field" style={{ marginTop: 22 }}>
          <label>Username</label>
          <input
            className="input"
            autoFocus
            placeholder="admin"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <label>Password</label>
          <input
            className="input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && (
          <div className="login-error">
            <AlertIcon style={{ width: 16, height: 16, flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <button className="btn btn-primary" style={{ width: '100%', marginTop: 20, padding: '12px' }} disabled={busy}>
          {busy && <span className="spinner" />}
          Sign in
        </button>

        <div className="login-hint">
          First time? Use the seeded admin — <b>admin</b> / <b>Admin@123</b>
        </div>
      </form>
    </div>
  );
}
