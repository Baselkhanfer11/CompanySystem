import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { AlertIcon, CubeIcon } from '../components/icons';
import { LangSwitch } from '../components/LangSwitch';
import { useI18n } from '../i18n/LanguageContext';

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();

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
      setError((err as Error).message || t('login.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div style={{ position: 'absolute', top: 20, insetInlineEnd: 20 }}>
        <LangSwitch />
      </div>
      <form className="login-card rise" onSubmit={submit}>
        <div className="login-brand">
          <div className="brand-logo" style={{ width: 52, height: 52, borderRadius: 15 }}>
            <CubeIcon />
          </div>
        </div>
        <h1 className="login-title">{t('login.title')}</h1>
        <p className="login-sub">{t('login.sub')}</p>

        <div className="field" style={{ marginTop: 22 }}>
          <label>{t('login.username')}</label>
          <input
            className="input"
            autoFocus
            placeholder="admin"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <label>{t('login.password')}</label>
          <input
            className="input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
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
          {t('login.signIn')}
        </button>

        <div className="login-hint">
          {t('login.hint')} <b>admin</b> / <b>Admin@123</b>
        </div>
      </form>
    </div>
  );
}
