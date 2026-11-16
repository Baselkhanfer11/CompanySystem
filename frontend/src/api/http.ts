// Central fetch wrapper: attaches the JWT token and normalizes errors.
export const TOKEN_KEY = 'cs_token';

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
export const setToken = (t: string | null) => {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore storage errors (private mode) */ }
};

const LOGIN_URL = '/api/auth/login';

// The server's message for a failed request. Our own errors are { message };
// ASP.NET's validation errors are { title, errors: { field: [..] } }.
function errorMessage(text: string, status: number): string {
  try {
    const body = JSON.parse(text);
    if (typeof body.message === 'string') return body.message;
    if (body.errors && typeof body.errors === 'object') {
      const first = Object.values(body.errors as Record<string, unknown>).flat()[0];
      if (typeof first === 'string') return first;
    }
    if (typeof body.title === 'string') return body.title;
  } catch { /* not JSON */ }
  if (status === 413) return 'The file is too large.'; // refused by the server before it was read
  return text || `Request failed (${status})`;
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  // Signing in never sends a token: a leftover (expired) one would get in the way.
  const token = url === LOGIN_URL ? null : getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(url, { ...options, headers });

  // A 401 anywhere but sign-in means this tab's session is over (expired, or signed
  // out / changed in another tab). Sign-in itself shows the server's own message.
  if (res.status === 401 && url !== LOGIN_URL) {
    setToken(null);
    window.dispatchEvent(new Event('auth:logout'));
    throw new Error('Your session has expired. Please sign in again.');
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(errorMessage(text, res.status));
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

// Download a file with the auth token attached, then save it via a temporary
// link. Used for endpoints that return a file (not JSON), e.g. document files.
async function download(url: string, filename: string): Promise<void> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(url, { headers });
  if (res.status === 401) {
    setToken(null);
    window.dispatchEvent(new Event('auth:logout'));
    throw new Error('Your session has expired. Please sign in again.');
  }
  if (!res.ok) throw new Error(`Download failed (${res.status})`);

  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Not at once: some browsers (Safari, older Firefox) drop the download if the URL goes first.
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body: unknown) => request<T>(url, jsonInit('POST', body)),
  put: <T>(url: string, body: unknown) => request<T>(url, jsonInit('PUT', body)),
  del: <T>(url: string) => request<T>(url, { method: 'DELETE' }),
  // Multipart upload — pass a FormData. We deliberately DON'T set Content-Type;
  // the browser adds the correct multipart boundary automatically.
  postForm: <T>(url: string, form: FormData) => request<T>(url, { method: 'POST', body: form }),
  download,
};
