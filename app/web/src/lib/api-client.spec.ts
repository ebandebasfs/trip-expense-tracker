import { ApiError, GENERIC_ERROR_MESSAGE, createApiClient } from './api-client';

/** A minimal stand-in for fetch's Response. Only the fields the client reads are set. */
function fakeResponse(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === undefined) {
        throw new SyntaxError('Unexpected end of JSON input');
      }
      return body;
    },
  } as unknown as Response;
}

function setup(...responses: Array<Response | Error>) {
  const fetchImpl = jest.fn();
  for (const response of responses) {
    if (response instanceof Error) {
      fetchImpl.mockRejectedValueOnce(response);
    } else {
      fetchImpl.mockResolvedValueOnce(response);
    }
  }
  const redirectToLogin = jest.fn();
  const client = createApiClient({ fetchImpl: fetchImpl as unknown as typeof fetch, redirectToLogin });
  return { client, fetchImpl, redirectToLogin };
}

describe('api-client', () => {
  it('F1.AC7 login posts the credentials same-origin to /api/login and returns the user', async () => {
    const user = { id: 'u1', email: 'name@example.com' };
    const { client, fetchImpl } = setup(fakeResponse(200, user));

    await expect(client.login('name@example.com', 'a-valid-password')).resolves.toEqual(user);

    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'name@example.com', password: 'a-valid-password' }),
      }),
    );
  });

  it('F1.AC7 register posts to /api/register same-origin', async () => {
    const user = { id: 'u1', email: 'name@example.com' };
    const { client, fetchImpl } = setup(fakeResponse(201, user));

    await expect(client.register('name@example.com', 'a-valid-password')).resolves.toEqual(user);
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/register');
    expect(fetchImpl.mock.calls[0][1]).toEqual(expect.objectContaining({ credentials: 'same-origin' }));
  });

  it('F1.AC10 me gets /api/me same-origin and returns the user', async () => {
    const user = { id: 'u1', email: 'name@example.com' };
    const { client, fetchImpl } = setup(fakeResponse(200, user));

    await expect(client.me()).resolves.toEqual(user);

    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/me',
      expect.objectContaining({ method: 'GET', credentials: 'same-origin', body: undefined }),
    );
  });

  it('F1.AC10 me with no session sends the visitor to Log in with no message', async () => {
    const { client, redirectToLogin } = setup(fakeResponse(401));

    await expect(client.me()).rejects.toMatchObject({ status: 401, sessionExpired: true, message: '' });
    expect(redirectToLogin).toHaveBeenCalledTimes(1);
  });

  it('F1.AC7 logout and account deletion accept a 204 with no body', async () => {
    const { client, fetchImpl } = setup(fakeResponse(204), fakeResponse(204));

    await expect(client.logout()).resolves.toBeUndefined();
    await expect(client.deleteAccount('a-valid-password')).resolves.toBeUndefined();
    expect(fetchImpl.mock.calls[1][0]).toBe('/api/account');
    expect(fetchImpl.mock.calls[1][1]).toEqual(expect.objectContaining({ method: 'DELETE' }));
  });

  it('F1.AC10 a 401 from a trip request with no session sends the visitor to Log in with no message', async () => {
    const { client, redirectToLogin } = setup(
      fakeResponse(401, { message: 'Unauthorized', error: 'Unauthorized', statusCode: 401 }),
    );

    const failure = await client.request('GET', '/trips').catch((error: unknown) => error);

    expect(redirectToLogin).toHaveBeenCalledTimes(1);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ status: 401, sessionExpired: true, message: '' });
  });

  it('F1.R10 and F1.AC10 a rejected trip request returns no trip data', async () => {
    const tripData = { id: 'trip-1', name: 'Lisbon' };
    const { client } = setup(fakeResponse(401, { message: 'Unauthorized', statusCode: 401 }));

    const result = await client.request('GET', '/trips/trip-1').then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );

    expect(result).not.toHaveProperty('value');
    expect(result).toHaveProperty('error');
    expect(JSON.stringify(result)).not.toContain(tripData.name);
  });

  it('F1.AC10 a 401 with the API error shape (wrong login) shows its message and does not redirect', async () => {
    const { client, redirectToLogin } = setup(
      fakeResponse(401, { error: 'Email or password is incorrect.', field: null }),
    );

    await expect(client.login('name@example.com', 'wrong-password')).rejects.toMatchObject({
      status: 401,
      message: 'Email or password is incorrect.',
      field: null,
      sessionExpired: false,
    });
    expect(redirectToLogin).not.toHaveBeenCalled();
  });

  it('F1.AC4 a 400 email error from the server wins and names the email field', async () => {
    const { client } = setup(
      fakeResponse(400, { error: 'This email is already registered.', field: 'email' }),
    );

    await expect(client.register('name@example.com', 'a-valid-password')).rejects.toMatchObject({
      status: 400,
      message: 'This email is already registered.',
      field: 'email',
    });
  });

  it('F1.AC5 a 400 password error from the server wins and names the password field', async () => {
    const { client } = setup(
      fakeResponse(400, { error: 'Password must be at least 8 characters.', field: 'password' }),
    );

    await expect(client.register('name@example.com', 'short')).rejects.toMatchObject({
      status: 400,
      message: 'Password must be at least 8 characters.',
      field: 'password',
    });
  });

  it('F2.AC1 createTrip posts the name same-origin to /api/trips and returns the new trip', async () => {
    const trip = { id: 'trip-1', name: 'Lisbon', createdAt: '2026-11-25T10:00:00.000Z' };
    const { client, fetchImpl } = setup(fakeResponse(201, { trip }));

    const created = await client.createTrip('Lisbon');
    expect(created).toEqual(trip);
    expect(created).not.toHaveProperty('trip');

    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/trips',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Lisbon' }),
      }),
    );
  });

  it('F2.AC3 a 400 name_required error reaches the form with the name field', async () => {
    const { client } = setup(fakeResponse(400, { error: 'name_required', field: 'name' }));

    await expect(client.createTrip('   ')).rejects.toMatchObject({
      status: 400,
      message: 'name_required',
      field: 'name',
    });
  });

  it('F2.AC4 a 400 name_too_long error reaches the form with the name field', async () => {
    const { client } = setup(fakeResponse(400, { error: 'name_too_long', field: 'name' }));

    await expect(client.createTrip('a'.repeat(101))).rejects.toMatchObject({
      status: 400,
      message: 'name_too_long',
      field: 'name',
    });
  });

  it('F2.AC6 listTrips gets /api/trips same-origin and returns the list', async () => {
    const trips = [{ id: 'trip-2', name: 'Porto', createdAt: '2026-11-25T11:00:00.000Z' }];
    const { client, fetchImpl } = setup(fakeResponse(200, { trips }));

    const listed = await client.listTrips();
    expect(listed).toEqual(trips);
    expect(listed).not.toHaveProperty('trips');

    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/trips',
      expect.objectContaining({ method: 'GET', credentials: 'same-origin', body: undefined }),
    );
  });

  it('F2.AC6 listTrips with no session sends the visitor to Log in with no message', async () => {
    const { client, redirectToLogin } = setup(fakeResponse(401, { message: 'Unauthorized', statusCode: 401 }));

    await expect(client.listTrips()).rejects.toMatchObject({
      status: 401,
      sessionExpired: true,
      message: '',
    });
    expect(redirectToLogin).toHaveBeenCalledTimes(1);
  });

  it('F2.AC9 deleteTrip sends DELETE to /api/trips/:id same-origin and accepts a 204', async () => {
    const { client, fetchImpl } = setup(fakeResponse(204));

    await expect(client.deleteTrip('trip-1')).resolves.toBeUndefined();

    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/trips/trip-1',
      expect.objectContaining({ method: 'DELETE', credentials: 'same-origin' }),
    );
  });

  it('F2.AC9 a failed deleteTrip rejects with the server error code', async () => {
    const { client } = setup(fakeResponse(404, { error: 'not_found', field: null }));

    await expect(client.deleteTrip('trip-1')).rejects.toMatchObject({
      status: 404,
      message: 'not_found',
      field: null,
    });
  });

  it('F2.AC11 getTrip gets /api/trips/:id same-origin and returns the trip', async () => {
    const trip = { id: 'trip-1', name: 'Lisbon', createdAt: '2026-11-25T10:00:00.000Z' };
    const { client, fetchImpl } = setup(fakeResponse(200, { trip }));

    const fetched = await client.getTrip('trip-1');
    expect(fetched).toEqual(trip);
    expect(fetched).not.toHaveProperty('trip');

    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/trips/trip-1',
      expect.objectContaining({ method: 'GET', credentials: 'same-origin' }),
    );
  });

  it('F2.AC11 getTrip for another user\'s trip rejects with not_found and no trip data', async () => {
    const { client, redirectToLogin } = setup(fakeResponse(404, { error: 'not_found', field: null }));

    const failure = await client.getTrip('trip-of-user-a').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ status: 404, message: 'not_found', field: null, sessionExpired: false });
    expect(redirectToLogin).not.toHaveBeenCalled();
  });

  it('F2.AC11 deleteTrip for another user\'s trip rejects with not_found', async () => {
    const { client } = setup(fakeResponse(404, { error: 'not_found', field: null }));

    await expect(client.deleteTrip('trip-of-user-a')).rejects.toMatchObject({
      status: 404,
      message: 'not_found',
    });
  });

  it('F1.AC7 a 500 with a non-JSON body shows the generic message with no detail', async () => {
    const { client, redirectToLogin } = setup(fakeResponse(500));

    await expect(client.logout()).rejects.toMatchObject({
      status: 500,
      message: GENERIC_ERROR_MESSAGE,
      field: null,
    });
    expect(redirectToLogin).not.toHaveBeenCalled();
  });

  it('F1.AC7 a network failure shows the generic message', async () => {
    const { client } = setup(new TypeError('Failed to fetch'));

    await expect(client.login('name@example.com', 'a-valid-password')).rejects.toMatchObject({
      status: 0,
      message: GENERIC_ERROR_MESSAGE,
    });
  });
});
