import { render, screen, waitFor } from '@testing-library/react';
import { ApiError, GENERIC_ERROR_MESSAGE, apiClient, type Trip } from '../../../lib/api-client';
import TripPage from './page';

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: mockTripId }),
}));

// Changed by a test before render to choose the trip ID in the route.
let mockTripId = 'trip-1';

jest.mock('../../../lib/api-client', () => {
  const actual = jest.requireActual('../../../lib/api-client');
  return {
    ...actual,
    apiClient: { getTrip: jest.fn() },
  };
});

const client = apiClient as unknown as { getTrip: jest.Mock };

const LISBON: Trip = { id: 'trip-1', name: 'Lisbon', createdAt: '2026-11-25T10:00:00.000Z' };

beforeEach(() => {
  jest.resetAllMocks();
  mockTripId = 'trip-1';
});

describe('TripPage', () => {
  it('F2.R9 shows the trip name and a Back to trips link, and loads the trip by its ID', async () => {
    client.getTrip.mockResolvedValue(LISBON);

    render(<TripPage />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Lisbon' })).toBeTruthy());
    expect(client.getTrip).toHaveBeenCalledWith('trip-1');
    expect(screen.getByRole('link', { name: 'Back to trips' }).getAttribute('href')).toBe('/trips');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('F2.AC11 a trip that is missing or belongs to another user shows the not-found message and a Back to trips link', async () => {
    mockTripId = 'trip-of-user-a';
    client.getTrip.mockRejectedValue(new ApiError('not_found', 404, null));

    render(<TripPage />);

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('This trip could not be found.'),
    );
    expect(client.getTrip).toHaveBeenCalledWith('trip-of-user-a');
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to trips' }).getAttribute('href')).toBe('/trips');
  });

  it('F2.AC11 a session-expired 401 shows no message, since the client is sending the visitor to Log in', async () => {
    client.getTrip.mockRejectedValue(new ApiError('', 401, null, true));

    render(<TripPage />);

    await waitFor(() => expect(client.getTrip).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('This trip could not be found.')).toBeNull();
  });

  it('F2.AC11 any other failure shows the generic message, not the not-found message', async () => {
    client.getTrip.mockRejectedValue(new ApiError(GENERIC_ERROR_MESSAGE, 500, null));

    render(<TripPage />);

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(GENERIC_ERROR_MESSAGE));
    expect(screen.queryByText('This trip could not be found.')).toBeNull();
  });
});
