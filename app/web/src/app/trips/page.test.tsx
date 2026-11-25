import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ApiError, GENERIC_ERROR_MESSAGE, apiClient, type Trip } from '../../lib/api-client';
import TripsPage from './page';

jest.mock('../../lib/api-client', () => {
  const actual = jest.requireActual('../../lib/api-client');
  return {
    ...actual,
    apiClient: { listTrips: jest.fn(), createTrip: jest.fn(), deleteTrip: jest.fn() },
  };
});

const client = apiClient as unknown as {
  listTrips: jest.Mock;
  createTrip: jest.Mock;
  deleteTrip: jest.Mock;
};

const PARIS: Trip = { id: 'trip-2', name: 'Paris 2026', createdAt: '2026-11-25T12:00:00.000Z' };
const LISBON: Trip = { id: 'trip-1', name: 'Lisbon', createdAt: '2026-11-25T10:00:00.000Z' };

beforeEach(() => {
  jest.resetAllMocks();
});

describe('TripsPage', () => {
  it('F2.AC6 shows the form above the list, and the list comes from listTrips', async () => {
    client.listTrips.mockResolvedValue([PARIS, LISBON]);

    render(<TripsPage />);

    expect(screen.getByLabelText('Trip name')).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('link', { name: 'Paris 2026' })).toBeTruthy());
    expect(client.listTrips).toHaveBeenCalledTimes(1);
    const rows = screen.getAllByRole('listitem');
    expect(within(rows[0]).getByRole('link', { name: 'Paris 2026' })).toBeTruthy();
    expect(within(rows[1]).getByRole('link', { name: 'Lisbon' })).toBeTruthy();
  });

  it('F2.AC7 with no trips, shows the empty-state message and no rows', async () => {
    client.listTrips.mockResolvedValue([]);

    render(<TripsPage />);

    await waitFor(() =>
      expect(screen.getByText('You have no trips yet. Create one above to get started.')).toBeTruthy(),
    );
    expect(screen.queryByRole('listitem')).toBeNull();
  });

  it('F2.AC6 shows the loading message until the list arrives', async () => {
    let resolve: (trips: Trip[]) => void = () => {};
    client.listTrips.mockReturnValue(new Promise<Trip[]>((done) => (resolve = done)));

    render(<TripsPage />);

    expect(screen.getByText('Loading your trips…')).toBeTruthy();
    resolve([LISBON]);
    await waitFor(() => expect(screen.getByRole('link', { name: 'Lisbon' })).toBeTruthy());
  });

  it('F2.AC9 a trip created on the page is added at the top of the list', async () => {
    client.listTrips.mockResolvedValue([LISBON]);
    client.createTrip.mockResolvedValue(PARIS);

    render(<TripsPage />);
    await waitFor(() => expect(screen.getByRole('link', { name: 'Lisbon' })).toBeTruthy());

    fireEvent.change(screen.getByLabelText('Trip name'), { target: { value: 'Paris 2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create trip' }));

    await waitFor(() => expect(screen.getAllByRole('listitem')[0].textContent).toContain('Paris 2026'));
    expect(client.createTrip).toHaveBeenCalledWith('Paris 2026');
  });

  it('F2.AC9 a confirmed delete calls the API and removes the row', async () => {
    client.listTrips.mockResolvedValue([PARIS, LISBON]);
    client.deleteTrip.mockResolvedValue(undefined);

    render(<TripsPage />);
    await waitFor(() => expect(screen.getByRole('link', { name: 'Lisbon' })).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Delete trip Lisbon' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete trip' }));

    await waitFor(() => expect(screen.queryByRole('link', { name: 'Lisbon' })).toBeNull());
    expect(client.deleteTrip).toHaveBeenCalledWith('trip-1');
    expect(screen.getByText('Trip deleted.').getAttribute('role')).toBe('status');
  });

  it('F2.AC6 a session-expired 401 shows no message, since the client is sending the visitor to Log in', async () => {
    client.listTrips.mockRejectedValue(new ApiError('', 401, null, true));

    render(<TripsPage />);

    await waitFor(() => expect(client.listTrips).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('F2.AC6 any other failure shows the generic message', async () => {
    client.listTrips.mockRejectedValue(new ApiError(GENERIC_ERROR_MESSAGE, 500, null));

    render(<TripsPage />);

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(GENERIC_ERROR_MESSAGE));
    expect(screen.queryByRole('listitem')).toBeNull();
  });
});
