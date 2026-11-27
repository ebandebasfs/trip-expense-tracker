'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AuthForm } from '../../components/auth-form';
import { Card, CardContent } from '../../components/ui/card';
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
    <main className="mx-auto flex w-full max-w-md flex-col px-4 py-10">
      <Card className="w-full">
        <CardContent className="space-y-6">
          <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
          <AuthForm mode="register" onSubmit={register} />
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href={LOGIN_PATH} className="font-medium text-primary underline-offset-4 hover:underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
