// AppConfig — the one place environment values live. Ported as a concept from
// the Godot F0 (config/app_config.gd).
//
// Resolution order (last wins):
//   1. baked defaults (safe, non-secret),
//   2. Vite env (import.meta.env — VITE_* and NEXT_PUBLIC_* aliases),
//   3. window.__CITY_CONFIG__ (hosting-time injection, no rebuild).
//
// Each field accepts its canonical VITE_ name AND the main WarRoom frontend's
// NEXT_PUBLIC_ name (canonical first). SECURITY: the Firebase *web* API key is a
// client identifier, not a secret — but we never hardcode a value we weren't
// given; blank → the login screen shows a clear "configuration missing" message.

declare global {
  interface Window {
    __CITY_CONFIG__?: Partial<{
      firebaseApiKey: string;
      firebaseProjectId: string;
      firebaseAuthDomain: string;
      apiBaseUrl: string;
      registerUrl: string;
    }>;
  }
}

export const CLIENT_VERSION = 'city@0.0.1-f0'; // sent as clientVersion on submit (PRD §8.2)

const DEFAULTS = {
  firebaseApiKey: '',
  firebaseProjectId: 'warroom-498513', // confirmed in backend config (PRD §10)
  firebaseAuthDomain: '', // derived from projectId when not provided
  apiBaseUrl: 'http://localhost:8080',
  registerUrl: 'https://warroom.humanfirstbykk.com/register',
};

/** Read the first present, non-empty value among candidate env var names. */
function fromEnv(...names: string[]): string {
  const env = import.meta.env as Record<string, string | undefined>;
  for (const name of names) {
    const v = env[name];
    if (typeof v === 'string' && v.trim() !== '') return v.trim();
  }
  return '';
}

/**
 * Normalize a backend base URL to the service ORIGIN that our "/api/v1/..."
 * paths expect. The main frontend's NEXT_PUBLIC_API_URL ends in "/api", but the
 * academy routes live at "/api/v1" off root — a naive base would double up.
 * Strip trailing slashes, then one trailing "/api", then slashes again.
 */
export function normalizeBaseUrl(raw: string): string {
  let u = raw.trim().replace(/\/+$/, '');
  if (u.endsWith('/api/v1')) u = u.slice(0, -7);
  else if (u.endsWith('/api')) u = u.slice(0, -4);
  return u.replace(/\/+$/, '');
}

function resolve() {
  const cfg = { ...DEFAULTS };

  const envKey = fromEnv('VITE_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_API_KEY');
  const envProject = fromEnv('VITE_FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID');
  const envAuthDomain = fromEnv('VITE_FIREBASE_AUTH_DOMAIN', 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
  const envBase = fromEnv('VITE_API_BASE_URL', 'NEXT_PUBLIC_API_URL');
  const envRegister = fromEnv('VITE_REGISTER_URL', 'NEXT_PUBLIC_REGISTER_URL');

  if (envKey) cfg.firebaseApiKey = envKey;
  if (envProject) cfg.firebaseProjectId = envProject;
  if (envAuthDomain) cfg.firebaseAuthDomain = envAuthDomain;
  if (envBase) cfg.apiBaseUrl = normalizeBaseUrl(envBase);
  if (envRegister) cfg.registerUrl = envRegister;

  // window.__CITY_CONFIG__ (hosting-time) wins.
  const w = typeof window !== 'undefined' ? window.__CITY_CONFIG__ : undefined;
  if (w) {
    if (w.firebaseApiKey) cfg.firebaseApiKey = w.firebaseApiKey;
    if (w.firebaseProjectId) cfg.firebaseProjectId = w.firebaseProjectId;
    if (w.firebaseAuthDomain) cfg.firebaseAuthDomain = w.firebaseAuthDomain;
    if (w.apiBaseUrl) cfg.apiBaseUrl = normalizeBaseUrl(w.apiBaseUrl);
    if (w.registerUrl) cfg.registerUrl = w.registerUrl;
  }

  // Derive the auth domain from the project id when not explicitly provided.
  if (!cfg.firebaseAuthDomain) cfg.firebaseAuthDomain = `${cfg.firebaseProjectId}.firebaseapp.com`;

  const mockAuth = fromEnv('VITE_CITY_MOCK_AUTH') === '1';

  return { ...cfg, mockAuth };
}

export const appConfig = resolve();

/** True when login can proceed — real Firebase key present, or dev-mock mode. */
export function isConfigured(): boolean {
  return appConfig.mockAuth || appConfig.firebaseApiKey.trim() !== '';
}

/** Build a full backend URL from a "/api/v1/..." path. */
export function apiUrl(path: string): string {
  return appConfig.apiBaseUrl + path;
}
