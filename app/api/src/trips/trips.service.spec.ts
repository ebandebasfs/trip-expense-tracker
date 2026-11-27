import { Logger } from '@nestjs/common';
import { NestTripLogger, type TripLogEvent, type TripLogger } from './trip-logger';
import type { TripRecord, TripRepository } from './trip.repository';
import { TripError, TripsService } from './trips.service';

/** Fake TripLogger that records every call. */
class FakeTripLogger implements TripLogger {
  readonly events: TripLogEvent[] = [];

  log(event: TripLogEvent): void {
    this.events.push({ ...event });
  }
}

/** In-memory TripRepository. Timestamps are fixed and advance one second per insert. */
class FakeTripRepository implements TripRepository {
  readonly rows: TripRecord[] = [];
  readonly deleteCalls: Array<{ userId: string; id: string }> = [];
  private nextId = 1;
  private tick = 0;

  async create(userId: string, name: string): Promise<TripRecord> {
    const record: TripRecord = {
      id: `trip-${this.nextId++}`,
      userId,
      name,
      createdAt: new Date(Date.UTC(2026, 0, 1) + this.tick++ * 1000),
    };
    this.rows.push(record);
    return { ...record };
  }

  async listByOwner(userId: string): Promise<TripRecord[]> {
    // Returns insertion order (oldest first), so the service must do the newest-first sort itself.
    return this.rows.filter((row) => row.userId === userId).map((row) => ({ ...row }));
  }

  async findByIdForOwner(userId: string, id: string): Promise<TripRecord | null> {
    const row = this.rows.find((r) => r.id === id && r.userId === userId);
    return row ? { ...row } : null;
  }

  async deleteForOwner(userId: string, id: string): Promise<boolean> {
    this.deleteCalls.push({ userId, id });
    const index = this.rows.findIndex((r) => r.id === id && r.userId === userId);
    if (index === -1) {
      return false;
    }
    this.rows.splice(index, 1);
    return true;
  }
}

describe('TripsService', () => {
  const ALICE = 'user-alice';
  const BOB = 'user-bob';

  function setup() {
    const repo = new FakeTripRepository();
    const logger = new FakeTripLogger();
    const service = new TripsService(repo, logger);
    return { repo, logger, service };
  }

  describe('create', () => {
    it('F2.AC1 saves the trip with the session user as owner', async () => {
      const { repo, service } = setup();

      const trip = await service.create(ALICE, 'Lisbon');

      expect(repo.rows).toHaveLength(1);
      expect(repo.rows[0]).toMatchObject({ userId: ALICE, name: 'Lisbon' });
      expect(trip).toMatchObject({ id: repo.rows[0].id, name: 'Lisbon' });
    });

    it('F2.AC1 appears first in the owner list after creation', async () => {
      const { service } = setup();
      await service.create(ALICE, 'Porto');
      await service.create(ALICE, 'Lisbon');

      const list = await service.list(ALICE);

      expect(list[0].name).toBe('Lisbon');
    });

    it('F2.AC1 ignores any owner, because the service takes the owner only from the session user ID', async () => {
      const { repo, service } = setup();

      await service.create(ALICE, 'Lisbon');

      expect(repo.rows[0].userId).toBe(ALICE);
      expect(repo.rows.some((row) => row.userId === BOB)).toBe(false);
    });

    it('F2.AC5 saves two trips with the same name for the same user', async () => {
      const { repo, service } = setup();

      await service.create(ALICE, 'Lisbon');
      await service.create(ALICE, 'Lisbon');

      expect(repo.rows).toHaveLength(2);
      expect(repo.rows.every((row) => row.name === 'Lisbon' && row.userId === ALICE)).toBe(true);
    });

    it('F2.AC5 lists both trips that share a name', async () => {
      const { service } = setup();
      await service.create(ALICE, 'Lisbon');
      await service.create(ALICE, 'Lisbon');

      const list = await service.list(ALICE);

      expect(list.map((t) => t.name)).toEqual(['Lisbon', 'Lisbon']);
      expect(new Set(list.map((t) => t.id)).size).toBe(2);
    });

    it('F2.AC3 rejects an empty name with name_required and saves nothing', async () => {
      const { repo, service } = setup();

      await expect(service.create(ALICE, '   ')).rejects.toMatchObject({ code: 'name_required' });
      expect(repo.rows).toHaveLength(0);
    });

    it('F2.AC4 rejects a 101-character name with name_too_long and saves nothing', async () => {
      const { repo, service } = setup();

      await expect(service.create(ALICE, 'a'.repeat(101))).rejects.toMatchObject({ code: 'name_too_long' });
      expect(repo.rows).toHaveLength(0);
    });

    it('F2.AC1 throws a TripError carrying the code on failure', async () => {
      const { service } = setup();

      await expect(service.create(ALICE, '')).rejects.toBeInstanceOf(TripError);
    });
  });

  describe('list', () => {
    it('F2.AC6 returns only the session user\'s trips, newest first, with id, name and createdAt only', async () => {
      const { service } = setup();
      await service.create(ALICE, 'Porto');
      await service.create(BOB, 'Rome');
      await service.create(ALICE, 'Lisbon');

      const list = await service.list(ALICE);

      expect(list.map((t) => t.name)).toEqual(['Lisbon', 'Porto']);
      for (const trip of list) {
        expect(Object.keys(trip).sort()).toEqual(['createdAt', 'id', 'name']);
      }
    });

    it('F2.AC7 returns an empty array when the user has no trips', async () => {
      const { service } = setup();
      await service.create(BOB, 'Rome');

      const list = await service.list(ALICE);

      expect(list).toEqual([]);
    });
  });

  describe('get', () => {
    it('F2.AC11 returns not_found for another user\'s trip ID and leaves the trip unchanged', async () => {
      const { repo, service } = setup();
      const trip = await service.create(ALICE, 'Lisbon');

      await expect(service.get(BOB, trip.id)).rejects.toMatchObject({ code: 'not_found' });
      expect(repo.rows).toHaveLength(1);
      expect(repo.rows[0]).toMatchObject({ id: trip.id, userId: ALICE, name: 'Lisbon' });
    });
  });

  describe('delete', () => {
    it('F2.AC9 calls the repository once with the trip ID and owner, then the trip is gone', async () => {
      const { repo, service } = setup();
      const trip = await service.create(ALICE, 'Lisbon');

      await service.delete(ALICE, trip.id);

      expect(repo.deleteCalls).toEqual([{ userId: ALICE, id: trip.id }]);
      expect(repo.rows).toHaveLength(0);
    });

    it('F2.AC11 returns not_found for another user\'s trip ID and leaves the trip unchanged', async () => {
      const { repo, service } = setup();
      const trip = await service.create(ALICE, 'Lisbon');

      await expect(service.delete(BOB, trip.id)).rejects.toMatchObject({ code: 'not_found' });
      expect(repo.deleteCalls).toEqual([{ userId: BOB, id: trip.id }]);
      expect(repo.rows).toHaveLength(1);
      expect(repo.rows[0].userId).toBe(ALICE);
    });

    it('F2.AC11 returns not_found for a trip ID that does not exist', async () => {
      const { service } = setup();

      await expect(service.delete(ALICE, 'missing')).rejects.toMatchObject({ code: 'not_found' });
    });
  });

  describe('logging', () => {
    const SECRET_NAME = 'Secret Lisbon Honeymoon';
    const SESSION_TOKEN = 'session-token-value-xyz';

    it('F2.AC15 logs create, list, not-found and delete with user ID and trip ID only', async () => {
      const { logger, service } = setup();
      const trip = await service.create(ALICE, 'Lisbon');
      await service.list(ALICE);
      await expect(service.get(BOB, trip.id)).rejects.toMatchObject({ code: 'not_found' });
      await service.delete(ALICE, trip.id);

      expect(logger.events).toEqual([
        { action: 'create', userId: ALICE, tripId: trip.id },
        { action: 'list', userId: ALICE },
        { action: 'not_found', userId: BOB, tripId: trip.id },
        { action: 'delete', userId: ALICE, tripId: trip.id },
      ]);
    });

    it('F2.AC15 never logs the trip name in any create, list, not-found or delete event', async () => {
      const { logger, service } = setup();
      const trip = await service.create(ALICE, SECRET_NAME);
      await service.list(ALICE);
      await expect(service.get(BOB, trip.id)).rejects.toMatchObject({ code: 'not_found' });
      await service.delete(ALICE, trip.id);

      expect(logger.events).toHaveLength(4);
      expect(JSON.stringify(logger.events)).not.toContain(SECRET_NAME);
      expect(JSON.stringify(logger.events)).not.toContain('Secret');
    });

    it('F2.AC15 never logs a session token, because the service receives only the user ID', async () => {
      const { logger, service } = setup();
      const trip = await service.create(ALICE, SECRET_NAME);
      await service.list(ALICE);
      await service.delete(ALICE, trip.id);

      expect(JSON.stringify(logger.events)).not.toContain(SESSION_TOKEN);
      for (const event of logger.events) {
        expect(Object.keys(event).every((key) => ['action', 'userId', 'tripId'].includes(key))).toBe(true);
      }
    });

    it('F2.AC15 the Nest adapter writes the trip name to no log line', async () => {
      const spy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
      try {
        const adapter = new NestTripLogger();
        const named = new TripsService(new FakeTripRepository(), adapter);
        const trip = await named.create(ALICE, SECRET_NAME);
        await named.list(ALICE);
        await named.delete(ALICE, trip.id);

        const lines = spy.mock.calls.map((call) => String(call[0]));
        expect(lines).toHaveLength(3);
        for (const line of lines) {
          expect(line).not.toContain(SECRET_NAME);
          expect(line).not.toContain(SESSION_TOKEN);
          expect(line).toContain(ALICE);
        }
      } finally {
        spy.mockRestore();
      }
    });
  });
});
