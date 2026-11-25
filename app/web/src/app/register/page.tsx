'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AuthForm } from '../../components/auth-form';
import { apiClient, createApiClient } from '../../lib/api-client';
import { LOGIN_PATH, TRIPS_PATH } from '../../lib/route-rules';

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    // A 401 here only means "not logged in", so it must not redirect back to this page (that would loop).
    // Any failure leaves the form in place, so the visitor can still register.
    const probe = createApiClient({ redirectToLogin: () => {} });
    probe.me().then(
      () => router.replace(TRIPS_PATH),
      () => undefined,
    );
  }, [router]);

  async function register(email: string, password: string) {
    await apiClient.register(email, password);
    router.replace(TRIPS_PATH);
  }

  return (
    <main>
      <h1>Create account</h1>
      <AuthForm mode="register" onSubmit={register} />
      <p>
        Already have an account? <Link href={LOGIN_PATH}>Log in</Link>
      </p>
    </main>
  );
}
