'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DeleteAccountForm } from '../../components/delete-account-form';
import { Card, CardContent } from '../../components/ui/card';
import { ApiError, GENERIC_ERROR_MESSAGE, apiClient } from '../../lib/api-client';

/** Log in screen, with the query that makes it show "Your account has been deleted." */
const DELETED_LOGIN_PATH = '/login?deleted=1';

export default function AccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiClient.me().then(
      (user) => setEmail(user.email),
      (error: unknown) => {
        // A session-expired 401 is already redirecting to Log in, so no message is shown.
        if (error instanceof ApiError && error.sessionExpired) {
          return;
        }
        setFailed(true);
      },
    );
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col px-4 py-10">
      <Card className="w-full">
        <CardContent className="space-y-6">
          <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
          {failed ? (
            <p role="alert" className="text-sm text-destructive">
              {GENERIC_ERROR_MESSAGE}
            </p>
          ) : (
            email !== null && <p className="text-sm text-muted-foreground">Email: {email}</p>
          )}
          <section className="space-y-4 border-t pt-6">
            <h2 className="text-lg font-semibold">Delete account</h2>
            <DeleteAccountForm
              deleteAccount={(password) => apiClient.deleteAccount(password)}
              onDeleted={() => router.replace(DELETED_LOGIN_PATH)}
            />
          </section>
        </CardContent>
      </Card>
    </main>
  );
}
