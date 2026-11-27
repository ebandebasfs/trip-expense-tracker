'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthForm } from '../../components/auth-form';
import { Card, CardContent } from '../../components/ui/card';
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
    <main className="mx-auto flex w-full max-w-md flex-col px-4 py-10">
      <Card className="w-full">
        <CardContent className="space-y-6">
          <h1 className="text-2xl font-semibold tracking-tight">Log in</h1>
          <p role="status" className="text-sm text-muted-foreground">
            {deleted ? ACCOUNT_DELETED_MESSAGE : ''}
          </p>
          <AuthForm mode="login" onSubmit={login} />
          <p className="text-center text-sm text-muted-foreground">
            <Link href={REGISTER_PATH} className="font-medium text-primary underline-offset-4 hover:underline">
              Create an account
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
