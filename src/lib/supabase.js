// Tiny Supabase client (no extra dependency): sign-in, table access, RPC and photo upload.
// The URL and the publishable key are meant to be public. Access is enforced by
// row level security rules in the database, not by hiding these values.

const SUPABASE_URL = 'https://vpmhvjhuqggtybsadqzi.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_R30G-CiuX8zbA0dCQ0cEMg_QxoLnfQL';
const SESSION_KEY = 'family_sb_session_v1';

// The shared account that every family member signs in to. Its password is the family code.
export const FAMILY_EMAIL = 'family-access@example.com';

const readSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeSession = (session) => {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage can be unavailable (private mode). The session then lasts until the page closes.
  }
};

let memorySession = readSession();

const setSession = (session) => {
  memorySession = session;
  writeSession(session);
};

const toSession = (body) => ({
  access_token: body.access_token,
  refresh_token: body.refresh_token,
  expires_at: body.expires_at || Math.floor(Date.now() / 1000) + (body.expires_in || 3600),
  user: { id: body.user?.id, email: body.user?.email },
});

const errorFrom = async (res) => {
  let message = `HTTP ${res.status}`;
  try {
    const body = await res.json();
    message = body.msg || body.message || body.error_description || body.error || message;
  } catch {
    // keep the status text
  }
  const err = new Error(message);
  err.status = res.status;
  return err;
};

const authHeaders = (token) => ({
  apikey: PUBLISHABLE_KEY,
  Authorization: `Bearer ${token || PUBLISHABLE_KEY}`,
});

export const getSession = () => memorySession;

export async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw await errorFrom(res);
  const session = toSession(await res.json());
  setSession(session);
  return session;
}

let refreshing = null;

async function refreshSession() {
  if (!memorySession?.refresh_token) throw new Error('no session');
  if (!refreshing) {
    const refreshToken = memorySession.refresh_token;
    refreshing = fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) {
          setSession(null);
          throw await errorFrom(res);
        }
        const session = toSession(await res.json());
        setSession(session);
        return session;
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

export async function signOut() {
  const token = memorySession?.access_token;
  setSession(null);
  if (!token) return;
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: 'POST', headers: authHeaders(token) });
  } catch {
    // The local session is already gone; the server copy expires by itself.
  }
}

// Authenticated request with one automatic token refresh.
async function request(path, options = {}) {
  if (!memorySession) throw new Error('not signed in');
  if (memorySession.expires_at - 60 < Date.now() / 1000) await refreshSession();
  const send = () => fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: { ...authHeaders(memorySession.access_token), ...(options.headers || {}) },
  });
  let res = await send();
  if (res.status === 401) {
    await refreshSession();
    res = await send();
  }
  if (!res.ok) throw await errorFrom(res);
  return res;
}

const json = { 'Content-Type': 'application/json' };

export async function selectRows(table, query = 'select=*') {
  const res = await request(`/rest/v1/${table}?${query}`);
  return res.json();
}

export async function upsertRow(table, row) {
  await request(`/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...json, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(row),
  });
}

export async function insertRow(table, row) {
  await request(`/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...json, Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
}

export async function deleteRow(table, id) {
  await request(`/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
}

export async function rpc(name, args = {}) {
  const res = await request(`/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: json,
    body: JSON.stringify(args),
  });
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Uploads an image blob and returns its public address.
export async function uploadPhoto(blob) {
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
  const name = `${crypto.randomUUID()}.${ext}`;
  await request(`/storage/v1/object/photos/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': blob.type, 'x-upsert': 'false' },
    body: blob,
  });
  return `${SUPABASE_URL}/storage/v1/object/public/photos/${name}`;
}
