import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError } from '../lib/api-client';
import { DeleteAccountForm, type DeleteAccountFormProps } from './delete-account-form';

const PASSWORD = 'a-valid-password';
const WRONG_PASSWORD_MESSAGE = 'Password is incorrect. Your account was not deleted.';

function renderForm(overrides: Partial<DeleteAccountFormProps> = {}) {
  const deleteAccount = overrides.deleteAccount ?? jest.fn((_password: string) => Promise.resolve());
  const onDeleted = overrides.onDeleted ?? jest.fn();
  render(<DeleteAccountForm deleteAccount={deleteAccount} onDeleted={onDeleted} />);
  return {
    deleteAccount,
    onDeleted,
    password: screen.getByLabelText('Password') as HTMLInputElement,
  };
}

function typeInto(input: HTMLInputElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

/** Step 1: type the password and click "Delete account", which only shows the confirmation step. */
function reviewWith(password: HTMLInputElement, value: string) {
  typeInto(password, value);
  fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));
}

describe('DeleteAccountForm', () => {
  it('F1.AC12 an empty password shows the message and deletes nothing', () => {
    const { deleteAccount, password } = renderForm();

    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }));

    expect(screen.getByRole('alert').textContent).toBe('Enter your password to delete your account.');
    expect(deleteAccount).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(password);
  });

  it('F1.AC12 a typed password shows the confirmation sentence and the final button, and deletes nothing yet', () => {
    const { deleteAccount, password } = renderForm();

    reviewWith(password, PASSWORD);

    expect(screen.getByText('This deletes your account and every trip in it. This cannot be undone.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete my account' })).toBeTruthy();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('F1.AC12 Enter in the password field in the confirmation step does not delete', () => {
    const { deleteAccount, password } = renderForm();

    reviewWith(password, PASSWORD);
    fireEvent.submit(password.closest('form') as HTMLFormElement);

    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('F1.AC12 a wrong password shows the message, stays on the page and deletes nothing', async () => {
    const deleteAccount = jest.fn((_password: string) =>
      Promise.reject(new ApiError(WRONG_PASSWORD_MESSAGE, 401, 'password')),
    );
    const { onDeleted, password } = renderForm({ deleteAccount });

    reviewWith(password, 'wrong-password');
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(WRONG_PASSWORD_MESSAGE));
    expect(deleteAccount).toHaveBeenCalledWith('wrong-password');
    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Delete account' })).toBeTruthy();
    expect(password.value).toBe('');
    expect(document.activeElement).toBe(password);
  });

  it('F1.AC12 the correct password deletes the account and calls onDeleted', async () => {
    const { deleteAccount, onDeleted, password } = renderForm();

    reviewWith(password, PASSWORD);
    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(deleteAccount).toHaveBeenCalledWith(PASSWORD);
  });

  it('F1.AC12 while deleting, the button is disabled and says so, and a second click sends one request', () => {
    const deleteAccount = jest.fn((_password: string) => new Promise<void>(() => {}));
    const { password } = renderForm({ deleteAccount });

    reviewWith(password, PASSWORD);
    const confirm = screen.getByRole('button', { name: 'Delete my account' }) as HTMLButtonElement;
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    const busy = screen.getByRole('button', { name: 'Deleting…' }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    expect(deleteAccount).toHaveBeenCalledTimes(1);
  });
});
