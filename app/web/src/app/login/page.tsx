'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthForm } from '../../components/auth-form';
import { apiClient, createApiClient } from '../../lib/api-client';
import { REGISTER_PATH, TRIPS_PATH } from '../../lib/route-rules';

const ACCOUNT_DELETED_MESSAGE = 'Your account has been deleted.';

export default function LoginPage() {
  const router = useRouter();
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    // Read from window, not useSearchParams, so the page needs no Suspense boundary.
    if (new URLSearchParams(window.location.search).get('deleted') === '1') {
      setDeleted(true);
    }

    // A 401 here only means "not logged in", so it must not redirect back to this page (that would loop).
    // Any failure leaves the form in place, so the visitor can still log in.
    const probe = createApiClient({ redirectToLogin: () => {} });
    probe.me().then(
      () => router.replace(TRIPS_PATH),
      () => undefined,
    );
  }, [router]);

  async function login(email: string, password: string) {
    await apiClient.login(email, password);
    router.replace(TRIPS_PATH);
  }

  return (
    <main>
      <h1>Log in</h1>
      <p role="status">{deleted ? ACCOUNT_DELETED_MESSAGE : ''}</p>
      <AuthForm mode="login" onSubmit={login} />
      <p>
        <Link href={REGISTER_PATH}>Create an account</Link>
      </p>
    </main>
  );
}
