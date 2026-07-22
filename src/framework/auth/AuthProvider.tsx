// AuthProvider — wires the ApiClient token provider to the live Firebase user
// and tracks auth state via onIdTokenChanged (auto-refresh + remember-me cold
// start). In dev-mock mode it is a no-op (session.login handles the mock).

import { useEffect, type ReactNode } from 'react';
import { onIdTokenChanged } from 'firebase/auth';
import { appConfig } from '@/config/appConfig';
import { useSessionStore } from '@/framework/stores/sessionStore';
import { getFirebaseAuth } from './firebase';
import { bootstrap, installFirebaseTokenProvider, isInteractiveLoginInFlight } from './session';

export function AuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (appConfig.mockAuth) return;
    const auth = getFirebaseAuth();
    if (!auth) return;

    installFirebaseTokenProvider(() => auth.currentUser);

    const unsub = onIdTokenChanged(auth, async (user) => {
      if (user) {
        useSessionStore.getState().setUser({
          uid: user.uid,
          email: user.email ?? '',
          displayName: user.displayName ?? '',
        });
        // Remember-me cold start: a restored session lands here — bootstrap once.
        // Skip when login() is already driving this same sign-in's bootstrap,
        // otherwise both fire GET /registry/modules in a race.
        if (useSessionStore.getState().status !== 'ready' && !isInteractiveLoginInFlight()) {
          await bootstrap();
        }
      } else {
        useSessionStore.getState().reset();
      }
    });

    return unsub;
  }, []);

  return <>{children}</>;
}
