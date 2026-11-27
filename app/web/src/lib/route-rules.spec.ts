import { LOGIN_PATH, REGISTER_PATH, TRIPS_PATH, routeFor, safeNextPath } from './route-rules';

describe('route-rules', () => {
  it.each(['/trips', '/trips/', '/trips/abc', '/trips/abc/expenses', '/trips?tab=people', '/trips#top'])(
    'F1.AC10 a logged-out visitor on "%s" goes to Log in',
    (path) => {
      expect(routeFor(path, false)).toBe(LOGIN_PATH);
    },
  );

  it('F1.AC10 a logged-out visitor on a path that only starts with /trips is not redirected', () => {
    expect(routeFor('/tripsfoo', false)).toBeNull();
  });

  it('F1.AC10 a logged-out visitor on Log in or Register is not redirected again', () => {
    expect(routeFor(LOGIN_PATH, false)).toBeNull();
    expect(routeFor(REGISTER_PATH, false)).toBeNull();
  });

  it.each([LOGIN_PATH, `${LOGIN_PATH}/`, REGISTER_PATH])(
    'F1.AC10 a logged-in visitor on "%s" goes to Trips',
    (path) => {
      expect(routeFor(path, true)).toBe(TRIPS_PATH);
    },
  );

  it('F1.AC10 a logged-in visitor on a trip path is not redirected', () => {
    expect(routeFor('/trips/abc', true)).toBeNull();
  });

  it('F1.AC7 keeps an in-app path, with its query and hash', () => {
    expect(safeNextPath('/trips/abc')).toBe('/trips/abc');
    expect(safeNextPath('/trips?tab=people#top')).toBe('/trips?tab=people#top');
  });

  it.each([null, undefined, '', 'trips', 'trips/abc'])(
    'F1.AC7 falls back to Trips when next is %p',
    (next) => {
      expect(safeNextPath(next)).toBe(TRIPS_PATH);
    },
  );

  it.each([
    'https://evil.example/trips',
    'http://evil.example',
    '//evil.example/trips',
    '/\\evil.example',
    '\\\\evil.example',
    'javascript:alert(1)',
    '/trips\nLocation: x',
    '/trips\t//evil.example',
  ])('F1.AC7 falls back to Trips for the unsafe next value %j', (next) => {
    expect(safeNextPath(next)).toBe(TRIPS_PATH);
  });
});
