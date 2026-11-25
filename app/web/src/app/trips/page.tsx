'use client';

import { useEffect, useState } from 'react';
import { ApiError, GENERIC_ERROR_MESSAGE, apiClient } from '../../lib/api-client';

/** Placeholder until the Trips list exists (F2). A logged-out visitor is sent to Log in by the client. */
export default function TripsPage() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    apiClient.me().catch((error: unknown) => {
      // A session-expired 401 is already redirecting to Log in, so no message is shown.
      if (error instanceof ApiError && error.sessionExpired) {
        return;
      }
      setFailed(true);
    });
  }, []);

  return (
    <main>
      <h1>Trips</h1>
      {failed ? <p role="alert">{GENERIC_ERROR_MESSAGE}</p> : <p>Your trips will appear here.</p>}
    </main>
  );
}
