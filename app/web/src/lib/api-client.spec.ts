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
