import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '../lib/api-client';
import { AuthForm, type AuthFormProps } from './auth-form';

const VALID_EMAIL = 'name@example.com';
const VALID_PASSWORD = 'a-valid-password';

function renderForm(overrides: Partial<AuthFormProps> = {}) {
  const onSubmit = overrides.onSubmit ?? jest.fn((_email: string, _password: string) => Promise.resolve());
  const props: AuthFormProps = { mode: 'register', ...overrides, onSubmit };
  render(<AuthForm {...props} />);
  return {
    onSubmit,
    email: screen.getByLabelText('Email') as HTMLInputElement,
    password: screen.getByLabelText('Password') as HTMLInputElement,
  };
}

function typeInto(input: HTMLInputElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

function button(label: string): HTMLButtonElement {
  return screen.getByRole('button', { name: label }) as HTMLButtonElement;
}

function alertText(): string | null {
  return screen.getByRole('alert').textContent;
}

describe('AuthForm', () => {
  it('F1.AC1 register sends the typed email and password to onSubmit', async () => {
    const { onSubmit, email, password } = renderForm({ mode: 'register' });

    typeInto(email, VALID_EMAIL);
    typeInto(password, VALID_PASSWORD);
    fireEvent.click(button('Create account'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(VALID_EMAIL, VALID_PASSWORD);
  });

  it('F1.AC1 while the account is being created the button is disabled and says so', () => {
    const { email, password } = renderForm({
      mode: 'register',
      onSubmit: () => new Promise<void>(() => {}),
    });

    typeInto(email, VALID_EMAIL);
    typeInto(password, VALID_PASSWORD);
    fireEvent.click(button('Create account'));

    const busy = screen.getByRole('button', { name: 'Creating account…' }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
  });

  it('F1.AC1 a second submit while the first is pending sends one request', () => {
    const { onSubmit, email, password } = renderForm({
      mode: 'register',
      onSubmit: jest.fn((_email: string, _password: string) => new Promise<void>(() => {})),
    });

    typeInto(email, VALID_EMAIL);
    typeInto(password, VALID_PASSWORD);
    const form = button('Create account').closest('form') as HTMLFormElement;
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('F1.AC1 Enter in a field submits the form (the form is the submit path)', async () => {
    const { onSubmit, email, password } = renderForm({ mode: 'login' });

    typeInto(email, VALID_EMAIL);
    typeInto(password, VALID_PASSWORD);
    fireEvent.submit(password.closest('form') as HTMLFormElement);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(VALID_EMAIL, VALID_PASSWORD));
  });

  it('F1.AC1 inputs have visible labels and the autocomplete values from the spec', () => {
    const { email, password } = renderForm({ mode: 'register' });

    expect(email.getAttribute('autocomplete')).toBe('email');
    expect(password.getAttribute('autocomplete')).toBe('new-password');
  });

  it('F1.AC4 an email with no dot in the domain shows the email-format message and does not call onSubmit', () => {
    const { onSubmit, email, password } = renderForm({ mode: 'register' });

    typeInto(email, 'name@example');
    typeInto(password, VALID_PASSWORD);
    fireEvent.click(button('Create account'));

    expect(alertText()).toBe('Enter a valid email address, such as name@example.com.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each(['name.example.com', 'name@', '@example.com', 'name@.com', 'name@example.'])(
    'F1.AC4 the login email "%s" (no @, empty part, or no dot) is rejected before any check',
    (badEmail) => {
      const { onSubmit, email, password } = renderForm({ mode: 'login' });

      typeInto(email, badEmail);
      typeInto(password, VALID_PASSWORD);
      fireEvent.click(button('Log in'));

      expect(alertText()).toBe('Enter a valid email address, such as name@example.com.');
      expect(onSubmit).not.toHaveBeenCalled();
    },
  );

  it('F1.AC4 an empty email on register shows the empty-email message', () => {
    const { onSubmit, password } = renderForm({ mode: 'register' });

    typeInto(password, VALID_PASSWORD);
    fireEvent.click(button('Create account'));

    expect(alertText()).toBe('Enter your email address.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('F1.AC4 an empty email and password on log in shows the combined message', () => {
    const { onSubmit } = renderForm({ mode: 'login' });

    fireEvent.click(button('Log in'));

    expect(alertText()).toBe('Enter your email and password.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('F1.AC4 after a failed client check focus moves to the first invalid field', () => {
    const { email, password } = renderForm({ mode: 'register' });

    typeInto(email, 'not-an-email');
    typeInto(password, VALID_PASSWORD);
    fireEvent.click(button('Create account'));

    expect(document.activeElement).toBe(email);
  });

  it('F1.AC4 after a failed client check the email is kept and the password is cleared', () => {
    const { email, password } = renderForm({ mode: 'register' });

    typeInto(email, 'not-an-email');
    typeInto(password, VALID_PASSWORD);
    fireEvent.click(button('Create account'));

    expect(email.value).toBe('not-an-email');
    expect(password.value).toBe('');
  });

  it('F1.AC5 a 7-character password is rejected with the too-short message', () => {
    const { onSubmit, email, password } = renderForm({ mode: 'register' });

    typeInto(email, VALID_EMAIL);
    typeInto(password, 'sevench');
    fireEvent.click(button('Create account'));

    expect(alertText()).toBe('Password must be at least 8 characters.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('F1.AC5 a 129-character password is rejected with the too-long message', () => {
    const { onSubmit, email, password } = renderForm({ mode: 'register' });

    typeInto(email, VALID_EMAIL);
    typeInto(password, 'a'.repeat(129));
    fireEvent.click(button('Create account'));

    expect(alertText()).toBe('Password must be 128 characters or fewer.');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it.each([8, 128])('F1.AC5 a %i-character password is accepted and sent to onSubmit', async (length) => {
    const { onSubmit, email, password } = renderForm({ mode: 'register' });
    const value = 'p'.repeat(length);

    typeInto(email, VALID_EMAIL);
    typeInto(password, value);
    fireEvent.click(button('Create account'));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(VALID_EMAIL, value));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('F1.AC8 a wrong password on log in shows the generic message, keeps the email, clears the password, and focuses the password', async () => {
    const onSubmit = jest.fn((_email: string, _password: string) =>
      Promise.reject(new ApiError('Email or password is incorrect.', 401, null)),
    );
    const { email, password } = renderForm({ mode: 'login', onSubmit });

    typeInto(email, VALID_EMAIL);
    typeInto(password, 'wrong-password');
    fireEvent.click(button('Log in'));

    await waitFor(() => expect(alertText()).toBe('Email or password is incorrect.'));
    expect(email.value).toBe(VALID_EMAIL);
    expect(password.value).toBe('');
    expect(document.activeElement).toBe(password);
    expect(button('Log in').disabled).toBe(false);
  });

  it('F1.AC8 an unknown email on log in shows the same generic message as a wrong password', async () => {
    const onSubmit = jest.fn((_email: string, _password: string) =>
      Promise.reject(new ApiError('Email or password is incorrect.', 401, null)),
    );
    const { email, password } = renderForm({ mode: 'login', onSubmit });

    typeInto(email, 'nobody@example.com');
    typeInto(password, VALID_PASSWORD);
    fireEvent.click(button('Log in'));

    await waitFor(() => expect(alertText()).toBe('Email or password is incorrect.'));
  });

  it('F1.AC8 while logging in the button says so and is disabled', () => {
    const { email, password } = renderForm({
      mode: 'login',
      onSubmit: () => new Promise<void>(() => {}),
    });

    typeInto(email, VALID_EMAIL);
    typeInto(password, VALID_PASSWORD);
    fireEvent.click(button('Log in'));

    const busy = screen.getByRole('button', { name: 'Logging in…' }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
  });
});
