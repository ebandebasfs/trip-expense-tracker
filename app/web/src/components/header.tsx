'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError, GENERIC_ERROR_MESSAGE, apiClient, createApiClient, type AuthUser } from '../lib/api-client';
import { LOGIN_PATH } from '../lib/route-rules';

export const ACCOUNT_PATH = '/account';

/** The two calls the header makes. Tests pass fakes. */
export interface HeaderClient {
  me(): Promise<AuthUser>;
  logout(): Promise<void>;
}

// A 401 here only means "not logged in", so it must not send the visitor to Log in (that would loop on that page).
const probe = createApiClient({ redirectToLogin: () => {} });

const defaultClient: HeaderClient = {
  me: () => probe.me(),
  logout: () => apiClient.logout(),
};

export interface HeaderProps {
  client?: HeaderClient;
}

/**
 * Header on every screen. Shows Account and Log out only when someone is logged in (F1.AC9).
 * Log out ends the session, then shows the Log in screen.
 */
export function Header({ client = defaultClient }: HeaderProps) {
  const router = useRouter();
  // The root layout stays mounted across client navigation, so re-check the session on every path change.
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // A stale response from a previous path must not overwrite the current result.
    let active = true;
    client.me().then(
      () => {
        if (active) {
          setLoggedIn(true);
        }
      },
      () => {
        // A failed check (including a 401 with no session) means not logged in. Never keep a stale true.
        if (active) {
          setLoggedIn(false);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [client, pathname]);

  async function logOut() {
    setPending(true);
    setError(null);
    try {
      await client.logout();
      setLoggedIn(false);
      router.replace(LOGIN_PATH);
    } catch (caught) {
      setPending(false);
      // A session-expired 401 is already redirecting to Log in, so no message is shown.
      if (caught instanceof ApiError && caught.sessionExpired) {
        return;
      }
      setError(GENERIC_ERROR_MESSAGE);
    }
  }

  return (
    <header>
      {loggedIn && (
        <nav aria-label="Main">
          <Link href={ACCOUNT_PATH}>Account</Link>{' '}
          <button type="button" onClick={logOut} disabled={pending}>
            Log out
          </button>
        </nav>
      )}
      {error && <p role="alert">{error}</p>}
    </header>
  );
}
