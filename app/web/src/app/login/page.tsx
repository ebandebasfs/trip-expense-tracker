'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AuthForm } from '../../components/auth-form';
import { apiClient, createApiClient } from '../../lib/api-client';
import { REGISTER_PATH, TRIPS_PATH } from '../../lib/route-rules';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
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
      <AuthForm mode="login" onSubmit={login} />
      <p>
        <Link href={REGISTER_PATH}>Create an account</Link>
      </p>
    </main>
  );
}
