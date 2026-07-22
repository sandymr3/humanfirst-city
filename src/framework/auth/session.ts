// Session — login / logout / bootstrap and the login-outcome mapping. Ported as
// a concept from the Godot F0 (autoload/session.gd + ui/login/login.gd).
//
// Reality (PRD §10 / F0 audit): the live backend has NO /me route and NEVER
// returns a 403 for unknown users — it auto-provisions any valid token. So:
//   • bootstrap() = GET /registry/modules (one-line swap to /me later),
//   • "unregistered" is detected at the FIREBASE layer (auth/user-not-found).
//     Because email-enumeration protection can collapse that into
//     auth/invalid-credential, the login screen ALSO keeps a persistent
//     "Register" link visible.

import {
  browserLocalPersistence,
  inMemoryPersistence,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import { appConfig, isApiConfigured } from '@/config/appConfig';
import { api } from '@/framework/api/client';
import { setTokenProvider } from '@/framework/api/client';
import { events } from '@/framework/events';
import { economy } from '@/framework/economy/economy';
import { useSessionStore } from '@/framework/stores/sessionStore';
import { getFirebaseAuth } from './firebase';

export type LoginStatus =
  | 'ok'
  | 'unregistered'
  | 'bad_credentials'
  | 'disabled'
  | 'rate_limited'
  | 'invalid_input'
  | 'config_missing'
  | 'network'
  | 'error';

export interface LoginOutcome {
  status: LoginStatus;
  message: string;
}

const CONFIG_MISSING_MSG =
  "The city isn't configured yet (missing Firebase key). Copy .env.example to .env and set VITE_FIREBASE_API_KEY.";

const API_CONFIG_MISSING_MSG =
  "This deployment isn't configured with a backend (missing VITE_API_BASE_URL). Contact the site admin.";

// Set while an interactive login() owns the upcoming bootstrap, so the
// onIdTokenChanged listener in AuthProvider (which fires on the same sign-in)
// doesn't race it with a second, duplicate bootstrap() call.
let interactiveLoginInFlight = false;

export function isInteractiveLoginInFlight(): boolean {
  return interactiveLoginInFlight;
}

/** Interactive login: Firebase sign-in → bootstrap. Returns a renderable outcome. */
export async function login(
  email: string,
  password: string,
  remember: boolean,
): Promise<LoginOutcome> {
  useSessionStore.getState().setAuthing();

  // Dev-mock path (CI / e2e / offline): no Firebase, no network, no fake coins.
  if (appConfig.mockAuth) {
    installMockTokenProvider();
    useSessionStore.getState().setUser({
      uid: 'mock-user',
      email: email.trim() || 'player@thecity.dev',
      displayName: 'City Player',
    });
    useSessionStore.getState().setBootstrap({ modules: [], registryVersion: 'mock' });
    events.emit('session_ready');
    return { status: 'ok', message: '' };
  }

  const auth = getFirebaseAuth();
  if (!auth) return { status: 'config_missing', message: CONFIG_MISSING_MSG };
  if (!isApiConfigured()) return { status: 'config_missing', message: API_CONFIG_MISSING_MSG };

  interactiveLoginInFlight = true;
  try {
    await setPersistence(auth, remember ? browserLocalPersistence : inMemoryPersistence);
    await signInWithEmailAndPassword(auth, email.trim(), password);
  } catch (e) {
    interactiveLoginInFlight = false;
    useSessionStore.getState().reset();
    return outcomeForFirebase(firebaseErrorCode(e));
  }

  const ok = await bootstrap();
  interactiveLoginInFlight = false;
  if (!ok) {
    return {
      status: 'network',
      message: "Signed in, but the city didn't respond. Try again.",
    };
  }
  return { status: 'ok', message: '' };
}

/** The bootstrap call. Swap this one line to GET /me once the backend adds it. */
export async function bootstrap(): Promise<boolean> {
  try {
    const data = await api.getModules();
    useSessionStore.getState().setBootstrap({
      modules: data.modules ?? [],
      registryVersion: data.registryVersion ?? '',
    });
    events.emit('session_ready');
    return true;
  } catch {
    return false;
  }
}

export async function logout(): Promise<void> {
  const auth = getFirebaseAuth();
  if (auth) {
    try {
      await signOut(auth);
    } catch {
      /* best effort */
    }
  }
  economy.reset();
  useSessionStore.getState().reset();
  events.emit('session_lost', { reason: 'logout' });
}

// ── Firebase error mapping ───────────────────────────────────────────────────
function firebaseErrorCode(e: unknown): string {
  if (e && typeof e === 'object' && 'code' in e) {
    return String((e as { code: unknown }).code);
  }
  return 'unknown';
}

function outcomeForFirebase(code: string): LoginOutcome {
  switch (code) {
    case 'auth/user-not-found':
      return { status: 'unregistered', message: '' };
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return { status: 'bad_credentials', message: "That email and password didn't match." };
    case 'auth/user-disabled':
      return {
        status: 'disabled',
        message: 'This account is disabled. Contact your program lead.',
      };
    case 'auth/too-many-requests':
      return {
        status: 'rate_limited',
        message: 'Too many attempts. Please wait a moment and try again.',
      };
    case 'auth/invalid-email':
    case 'auth/missing-email':
    case 'auth/missing-password':
      return { status: 'invalid_input', message: 'Enter a valid email and password.' };
    case 'auth/network-request-failed':
      return { status: 'network', message: "Couldn't reach sign-in. Check your connection." };
    case 'auth/api-key-not-valid':
    case 'auth/invalid-api-key':
      return { status: 'config_missing', message: CONFIG_MISSING_MSG };
    default:
      return { status: 'error', message: 'Sign-in failed. Please try again.' };
  }
}

// ── Token providers ──────────────────────────────────────────────────────────

/** Wire the ApiClient to the live Firebase user (called by AuthProvider). */
export function installFirebaseTokenProvider(currentUser: () => User | null): void {
  setTokenProvider({
    getToken: async () => {
      const u = currentUser();
      return u ? u.getIdToken() : null;
    },
    refreshToken: async () => {
      const u = currentUser();
      return u ? u.getIdToken(true) : null;
    },
  });
}

function installMockTokenProvider(): void {
  setTokenProvider({
    getToken: async () => 'mock-token',
    refreshToken: async () => 'mock-token',
  });
}
