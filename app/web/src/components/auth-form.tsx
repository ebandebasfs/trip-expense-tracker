'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { ApiError, GENERIC_ERROR_MESSAGE } from '../lib/api-client';
import { validateLogin, validateRegistration, type ValidationField } from '../lib/validation';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

export type AuthMode = 'register' | 'login';

export interface AuthFormProps {
  mode: AuthMode;
  /** Resolves when the account is ready. Rejects with an ApiError to show its message. */
  onSubmit: (email: string, password: string) => Promise<void>;
}

interface FormError {
  field: ValidationField;
  message: string;
}

const COPY = {
  register: {
    idleLabel: 'Create account',
    busyLabel: 'Creating account…',
    passwordAutocomplete: 'new-password',
  },
  login: {
    idleLabel: 'Log in',
    busyLabel: 'Logging in…',
    passwordAutocomplete: 'current-password',
  },
} as const;

function toFormError(caught: unknown): FormError {
  if (caught instanceof ApiError) {
    return { field: caught.field, message: caught.message || GENERIC_ERROR_MESSAGE };
  }
  return { field: null, message: GENERIC_ERROR_MESSAGE };
}

/**
 * Email and password form for Register and Log in (F1 spec, Accessibility).
 * Checks the input on the client first, then calls onSubmit. The server result always wins.
 */
export function AuthForm({ mode, onSubmit }: AuthFormProps) {
  const ids = useId();
  const copy = COPY[mode];
  const emailId = `${ids}-email`;
  const passwordId = `${ids}-password`;
  const hintId = `${ids}-hint`;
  const errorId = `${ids}-error`;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<FormError | null>(null);
  const [pending, setPending] = useState(false);
  // Guards against a second submit in the same tick, before the disabled button renders.
  const pendingRef = useRef(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  /** Shows the error, clears the password, and moves focus to the first invalid input. */
  function fail(next: FormError, typedEmail: string) {
    setError(next);
    setPassword('');
    const focusEmail = next.field === 'email' || (next.field === null && typedEmail.trim() === '');
    (focusEmail ? emailRef.current : passwordRef.current)?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) {
      return;
    }

    const problem = mode === 'register' ? validateRegistration(email, password) : validateLogin(email, password);
    if (problem) {
      fail(problem, email);
      return;
    }

    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      await onSubmit(email, password);
      // Success: the page moves on to Trips. Stay disabled so a second click cannot submit again.
    } catch (caught) {
      pendingRef.current = false;
      setPending(false);
      fail(toFormError(caught), email);
    }
  }

  const emailError = error?.field === 'email' ? error : null;
  const passwordError = error?.field === 'password' ? error : null;
  const formError = error?.field === null ? error : null;

  const passwordDescribedBy = [mode === 'register' ? hintId : null, passwordError ? errorId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <form noValidate onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor={emailId}>Email</Label>
        <Input
          id={emailId}
          ref={emailRef}
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? errorId : undefined}
        />
        {emailError && (
          <p id={errorId} role="alert" className="text-sm text-destructive">
            {emailError.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={passwordId}>Password</Label>
        {mode === 'register' && (
          <p id={hintId} className="text-sm text-muted-foreground">
            At least 8 characters.
          </p>
        )}
        <Input
          id={passwordId}
          ref={passwordRef}
          name="password"
          type="password"
          autoComplete={copy.passwordAutocomplete}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={passwordError ? true : undefined}
          aria-describedby={passwordDescribedBy || undefined}
        />
        {passwordError && (
          <p id={errorId} role="alert" className="text-sm text-destructive">
            {passwordError.message}
          </p>
        )}
      </div>

      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError.message}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? copy.busyLabel : copy.idleLabel}
      </Button>
    </form>
  );
}
