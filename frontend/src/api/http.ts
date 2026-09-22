// Central fetch wrapper: attaches the JWT token and normalizes errors.
const TOKEN_KEY = 'cs_token';

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (t: string | null) => {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore storage errors (private mode) */ }
};

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    // Token missing/expired/invalid — clear it and tell the app to log out.
    setToken(null);
    window.dispatchEvent(new Event('auth:logout'));
    throw new Error('Your session has expired. Please sign in again.');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let msg = text;
    try { msg = JSON.parse(text).message ?? text; } catch { /* not JSON */ }
    throw new Error(msg || `Request failed (${res.status})`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body: unknown) => request<T>(url, jsonInit('POST', body)),
  put: <T>(url: string, body: unknown) => request<T>(url, jsonInit('PUT', body)),
  del: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
};
