'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { ApiError, GENERIC_ERROR_MESSAGE } from '../lib/api-client';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

export const EMPTY_PASSWORD_MESSAGE = 'Enter your password to delete your account.';
export const CONFIRMATION_MESSAGE = 'This deletes your account and every trip in it. This cannot be undone.';

export interface DeleteAccountFormProps {
  /** Rejects with an ApiError to show its message (for example, a wrong password). */
  deleteAccount: (password: string) => Promise<void>;
  /** Called once the account is deleted. The page sends the visitor to Log in. */
  onDeleted: () => void;
}

type Step = 'enter-password' | 'confirm';

function messageFor(caught: unknown): string {
  if (caught instanceof ApiError && caught.message) {
    return caught.message;
  }
  return GENERIC_ERROR_MESSAGE;
}

/**
 * Two-step account deletion (F1 spec, Account). Step 1 takes the password. Step 2 repeats
 * the consequence and asks for the "Delete my account" button. Nothing is deleted before that button.
 */
export function DeleteAccountForm({ deleteAccount, onDeleted }: DeleteAccountFormProps) {
  const ids = useId();
  const passwordId = `${ids}-password`;
  const errorId = `${ids}-error`;

  const [step, setStep] = useState<Step>('enter-password');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Guards against a second delete in the same tick, before the disabled button renders.
  const pendingRef = useRef(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  /** Goes back to step 1 with the password cleared, shows the message, and focuses the password field. */
  function backToPassword(message: string) {
    setStep('enter-password');
    setPassword('');
    setError(message);
    passwordRef.current?.focus();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // In step 2 only the "Delete my account" button deletes, so Enter in the field does nothing there.
    if (step !== 'enter-password') {
      return;
    }
    if (password === '') {
      setError(EMPTY_PASSWORD_MESSAGE);
      passwordRef.current?.focus();
      return;
    }
    setError(null);
    setStep('confirm');
  }

  async function confirmDelete() {
    if (pendingRef.current) {
      return;
    }
    if (password === '') {
      backToPassword(EMPTY_PASSWORD_MESSAGE);
      return;
    }

    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      await deleteAccount(password);
      // Success: the page moves on to Log in. Stay disabled so a second click cannot delete again.
      onDeleted();
    } catch (caught) {
      pendingRef.current = false;
      setPending(false);
      // A session-expired 401 is already redirecting to Log in, so no message is shown.
      if (caught instanceof ApiError && caught.sessionExpired) {
        return;
      }
      backToPassword(messageFor(caught));
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor={passwordId}>Password</Label>
        <Input
          id={passwordId}
          ref={passwordRef}
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        {error && (
          <p id={errorId} role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      {step === 'enter-password' ? (
        <Button type="submit" variant="destructive" className="w-full">
          Delete account
        </Button>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-destructive">{CONFIRMATION_MESSAGE}</p>
          <Button type="button" variant="destructive" className="w-full" onClick={confirmDelete} disabled={pending}>
            {pending ? 'Deleting…' : 'Delete my account'}
          </Button>
        </div>
      )}
    </form>
  );
}
