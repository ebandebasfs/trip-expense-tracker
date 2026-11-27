import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError, GENERIC_ERROR_MESSAGE, type AuthUser } from '../lib/api-client';
import { Header, type HeaderClient } from './header';

const mockReplace = jest.fn();
// Changed between renders to simulate client navigation.
let mockPathname = '/trips';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => mockPathname,
}));

const USER: AuthUser = { id: 'user-1', email: 'name@example.com' };

function fakeClient(overrides: Partial<HeaderClient> = {}): HeaderClient {
  return {
    me: overrides.me ?? jest.fn(() => Promise.resolve(USER)),
    logout: overrides.logout ?? jest.fn(() => Promise.resolve()),
  };
}

describe('Header', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockPathname = '/trips';
  });

  it('F1.AC9 the Account and Log out links appear after the path changes and me() succeeds', async () => {
    mockPathname = '/login';
    const me = jest.fn((): Promise<AuthUser> => Promise.reject(new ApiError('', 401, null, true)));
    const client = fakeClient({ me });
    const { rerender } = render(<Header client={client} />);

    await waitFor(() => expect(me).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: 'Log out' })).toBeNull();

    me.mockImplementation(() => Promise.resolve(USER));
    mockPathname = '/trips';
    rerender(<Header client={client} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Log out' })).toBeTruthy());
    expect(me).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('link', { name: 'Account' }).getAttribute('href')).toBe('/account');
  });

  it('F1.AC9 the Account and Log out links disappear after the path changes and me() fails', async () => {
    const me = jest.fn((): Promise<AuthUser> => Promise.resolve(USER));
    const client = fakeClient({ me });
    const { rerender } = render(<Header client={client} />);

    await screen.findByRole('button', { name: 'Log out' });

    me.mockImplementation(() => Promise.reject(new ApiError('', 401, null, true)));
    mockPathname = '/login';
    rerender(<Header client={client} />);

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Log out' })).toBeNull());
    expect(me).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('link', { name: 'Account' })).toBeNull();
  });

  it('F1.AC9 a logged-in user sees the Account link and the Log out button', async () => {
    render(<Header client={fakeClient()} />);

    await waitFor(() => expect(screen.getByRole('button', { name: 'Log out' })).toBeTruthy());
    expect(screen.getByRole('link', { name: 'Account' }).getAttribute('href')).toBe('/account');
  });

  it('F1.AC9 a visitor who is not logged in sees no Log out button', async () => {
    const client = fakeClient({ me: jest.fn(() => Promise.reject(new ApiError('', 401, null, true))) });
    render(<Header client={client} />);

    await waitFor(() => expect(client.me).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: 'Log out' })).toBeNull();
  });

  it('F1.AC9 Log out ends the session, then shows the Log in screen', async () => {
    const client = fakeClient();
    render(<Header client={client} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Log out' }));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
    expect(client.logout).toHaveBeenCalledTimes(1);
  });

  it('F1.AC9 a failed log out shows the generic message and does not go to Log in', async () => {
    const client = fakeClient({ logout: jest.fn(() => Promise.reject(new ApiError(GENERIC_ERROR_MESSAGE, 500, null))) });
    render(<Header client={client} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Log out' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(GENERIC_ERROR_MESSAGE));
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
