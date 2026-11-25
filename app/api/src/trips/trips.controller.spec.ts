import 'reflect-metadata';
import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  RequestMethod,
  UnauthorizedException,
} from '@nestjs/common';
import { GUARDS_METADATA, HTTP_CODE_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { type AuthenticatedRequest, SessionGuard } from '../auth/session.guard';
import type { NewSession, SessionRepository } from '../auth/session.repository';
import { TripsController } from './trips.controller';
import { TripError, type TripSummary, TripsService } from './trips.service';

/** Records the calls the controller makes and returns the results set by each test. */
class FakeTripsService {
  readonly calls: Array<{ method: string; args: unknown[] }> = [];
  createResult: TripSummary = { id: 'trip-1', name: 'Lisbon', createdAt: new Date(0) };
  listResult: TripSummary[] = [];
  /** When set, the next call throws this error. */
  throwNext: Error | null = null;

  private record(method: string, args: unknown[]): void {
    this.calls.push({ method, args });
    if (this.throwNext !== null) {
      const error = this.throwNext;
      this.throwNext = null;
      throw error;
    }
  }

  async list(userId: string): Promise<TripSummary[]> {
    this.record('list', [userId]);
    return this.listResult;
  }

  async create(userId: string, name: string): Promise<TripSummary> {
    this.record('create', [userId, name]);
    return this.createResult;
  }

  async get(userId: string, id: string): Promise<TripSummary> {
    this.record('get', [userId, id]);
    return this.createResult;
  }

  async delete(userId: string, id: string): Promise<void> {
    this.record('delete', [userId, id]);
  }
}

class FakeSessionRepository implements SessionRepository {
  async create(_session: NewSession): Promise<void> {
    return;
  }

  async findUserIdByTokenHash(_tokenHash: string): Promise<string | null> {
    return null;
  }
}

function requestWith(overrides: Partial<AuthenticatedRequest> = {}): AuthenticatedRequest {
  return { headers: {}, ...overrides };
}

function contextFor(request: AuthenticatedRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function errorBody(error: unknown): { error: string; field: string | null } {
  expect(error).toBeInstanceOf(HttpException);
  return (error as HttpException).getResponse() as { error: string; field: string | null };
}

describe('TripsController', () => {
  const ALICE = 'user-alice';

  function setup() {
    const service = new FakeTripsService();
    const controller = new TripsController(service as unknown as TripsService);
    return { service, controller };
  }

  it('F2.AC13 create uses the session user as owner and ignores any owner or user ID in the body', async () => {
    const { service, controller } = setup();
    const body = { name: 'Lisbon', userId: 'user-bob', ownerId: 'user-bob', owner: 'user-bob' };

    await controller.create(requestWith({ userId: ALICE }), body);

    expect(service.calls).toEqual([{ method: 'create', args: [ALICE, 'Lisbon'] }]);
  });

  it('F2.AC1 create returns 201 body { trip: { id, name, createdAt } }', async () => {
    const { service, controller } = setup();
    const trip = { id: 'trip-9', name: 'Lisbon', createdAt: new Date(5) };
    service.createResult = trip;

    const body = await controller.create(requestWith({ userId: ALICE }), { name: 'Lisbon' });

    expect(body).toEqual({ trip });
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, TripsController.prototype.create)).toBe(
      HttpStatus.CREATED,
    );
  });

  it('F2.AC6 list returns 200 body { trips: [...] } with the session user trips in service order', async () => {
    const { service, controller } = setup();
    const trips = [
      { id: 'trip-2', name: 'Porto', createdAt: new Date(20) },
      { id: 'trip-1', name: 'Lisbon', createdAt: new Date(10) },
    ];
    service.listResult = trips;

    const body = await controller.list(requestWith({ userId: ALICE }));

    expect(service.calls).toEqual([{ method: 'list', args: [ALICE] }]);
    expect(body).toEqual({ trips });
  });

  it('F2.AC13 create passes only the name from the body, even when the body is missing', async () => {
    const { service, controller } = setup();

    await controller.create(requestWith({ userId: ALICE }), undefined);

    expect(service.calls).toEqual([{ method: 'create', args: [ALICE, ''] }]);
  });

  it('F2.AC12 the controller class is guarded by SessionGuard so every trip route is guarded', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, TripsController) as unknown[];

    expect(guards).toEqual([SessionGuard]);
  });

  it('F2.AC12 every trip route rejects a request with no session and never reaches the handler', async () => {
    const { service, controller } = setup();
    const guard = new SessionGuard(new FakeSessionRepository());
    // Nest runs the guard before the handler, so the guard's rejection stops the handler.
    const runRoute = async (handler: () => Promise<unknown>): Promise<unknown> => {
      await guard.canActivate(contextFor(requestWith()));
      return handler();
    };
    const routes: Array<() => Promise<unknown>> = [
      () => runRoute(() => controller.list(requestWith())),
      () => runRoute(() => controller.create(requestWith(), { name: 'Lisbon' })),
      () => runRoute(() => controller.get(requestWith(), 'trip-1')),
      () => runRoute(() => controller.delete(requestWith(), 'trip-1')),
    ];

    for (const route of routes) {
      await expect(route()).rejects.toBeInstanceOf(UnauthorizedException);
    }

    expect(service.calls).toEqual([]);
  });

  it('F2.AC12 a session cookie with an unknown token is rejected before any handler runs', async () => {
    const { service } = setup();
    const guard = new SessionGuard(new FakeSessionRepository());
    const request = requestWith({ headers: { cookie: `${SESSION_COOKIE_NAME}=not-a-real-token` } });

    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(UnauthorizedException);

    expect(request.userId).toBeUndefined();
    expect(service.calls).toEqual([]);
  });

  it('F2.AC3 a name error from the service maps to 400 with field name', async () => {
    const { service, controller } = setup();
    service.throwNext = new TripError('name_required');

    const failure = await controller.create(requestWith({ userId: ALICE }), { name: '   ' }).catch((e) => e);

    expect(errorBody(failure)).toEqual({ error: 'name_required', field: 'name' });
    expect((failure as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
  });

  it('F2.AC4 a too-long name error from the service maps to 400 with field name', async () => {
    const { service, controller } = setup();
    service.throwNext = new TripError('name_too_long');

    const failure = await controller
      .create(requestWith({ userId: ALICE }), { name: 'x'.repeat(101) })
      .catch((e) => e);

    expect(errorBody(failure)).toEqual({ error: 'name_too_long', field: 'name' });
    expect((failure as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
  });

  it('F2.AC11 get returns 200 body { trip: { id, name, createdAt } } for the session user trip', async () => {
    const { service, controller } = setup();
    const trip = { id: 'trip-1', name: 'Lisbon', createdAt: new Date(0) };
    service.createResult = trip;

    const body = await controller.get(requestWith({ userId: ALICE }), 'trip-1');

    expect(service.calls).toEqual([{ method: 'get', args: [ALICE, 'trip-1'] }]);
    expect(body).toEqual({ trip });
  });

  it('F2.AC11 not_found from get maps to 404 with field null', async () => {
    const { service, controller } = setup();
    service.throwNext = new TripError('not_found');

    const failure = await controller.get(requestWith({ userId: ALICE }), 'trip-2').catch((e) => e);

    expect(errorBody(failure)).toEqual({ error: 'not_found', field: null });
    expect((failure as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
  });

  it('F2.AC11 not_found from delete maps to 404 with field null', async () => {
    const { service, controller } = setup();
    service.throwNext = new TripError('not_found');

    const failure = await controller.delete(requestWith({ userId: ALICE }), 'trip-2').catch((e) => e);

    expect(errorBody(failure)).toEqual({ error: 'not_found', field: null });
    expect((failure as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
  });

  it('F2.AC9 delete returns 204 and passes the session user and trip ID to the service', async () => {
    const { service, controller } = setup();

    await controller.delete(requestWith({ userId: ALICE }), 'trip-1');

    expect(service.calls).toEqual([{ method: 'delete', args: [ALICE, 'trip-1'] }]);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, TripsController.prototype.delete)).toBe(
      HttpStatus.NO_CONTENT,
    );
  });

  it('F2.R10 the controller has no update route, so a trip name cannot change', () => {
    const proto = TripsController.prototype as unknown as Record<string, unknown>;
    // Only Nest route handlers carry the HTTP method metadata. Private helpers do not.
    const routes = Object.getOwnPropertyNames(TripsController.prototype)
      .filter((name) => Reflect.hasMetadata(METHOD_METADATA, proto[name] as object))
      .map((name) => ({ name, method: Reflect.getMetadata(METHOD_METADATA, proto[name] as object) as RequestMethod }));

    expect(routes.map((route) => route.name).sort()).toEqual(['create', 'delete', 'get', 'list']);
    expect(routes.map((route) => route.method)).not.toEqual(
      expect.arrayContaining([RequestMethod.PUT, RequestMethod.PATCH]),
    );
  });
});
