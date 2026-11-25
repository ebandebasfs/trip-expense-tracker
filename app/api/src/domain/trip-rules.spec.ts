import { checkTripName, normalizeTripName, sortNewestFirst, TRIP_NAME_MAX_LENGTH } from './trip-rules';

describe('trip rules', () => {
  describe('name normalization', () => {
    it('F2.AC2 trims leading and trailing spaces from the saved name', () => {
      expect(normalizeTripName('  Lisbon  ')).toBe('Lisbon');
    });

    it('F2.AC2 keeps spaces inside the name', () => {
      expect(normalizeTripName('  Costa del Sol  ')).toBe('Costa del Sol');
    });
  });

  describe('name checks', () => {
    const repeat = (char: string, count: number) => char.repeat(count);

    it('F2.AC3 rejects an empty name with name_required', () => {
      expect(checkTripName('')).toBe('name_required');
    });

    it('F2.AC3 rejects a name of only spaces with name_required', () => {
      expect(checkTripName('     ')).toBe('name_required');
    });

    it('F2.AC4 rejects a 101-character name with name_too_long', () => {
      expect(checkTripName(repeat('a', 101))).toBe('name_too_long');
    });

    it('F2.AC4 accepts a 100-character name', () => {
      expect(checkTripName(repeat('a', 100))).toBeNull();
    });

    it('F2.AC4 counts characters, not bytes: 100 emoji are accepted', () => {
      // Each emoji is 4 bytes in UTF-8 but one code point.
      expect(checkTripName('😀'.repeat(100))).toBeNull();
    });

    it('F2.AC4 counts characters, not bytes: 101 emoji are rejected', () => {
      expect(checkTripName('😀'.repeat(101))).toBe('name_too_long');
    });

    it('F2.AC4 checks the trimmed length: 100 characters plus spaces is accepted', () => {
      expect(checkTripName(`  ${repeat('a', 100)}  `)).toBeNull();
    });

    it('F2.AC3 accepts a name with any characters', () => {
      expect(checkTripName('Trip #1 & friends!')).toBeNull();
    });
  });

  describe('newest-first sort', () => {
    it('F2.AC6 orders trips by creation time, newest first', () => {
      const older = { id: 'a', createdAt: new Date('2026-01-01T10:00:00Z') };
      const newer = { id: 'b', createdAt: new Date('2026-01-02T10:00:00Z') };
      const sorted = sortNewestFirst([older, newer]);
      expect(sorted.map((t) => t.id)).toEqual(['b', 'a']);
    });

    it('F2.AC6 breaks a creation-time tie by ID, descending', () => {
      const same = new Date('2026-01-01T10:00:00Z');
      const sorted = sortNewestFirst([
        { id: 'trip-1', createdAt: same },
        { id: 'trip-3', createdAt: same },
        { id: 'trip-2', createdAt: same },
      ]);
      expect(sorted.map((t) => t.id)).toEqual(['trip-3', 'trip-2', 'trip-1']);
    });

    it('F2.AC6 does not modify the input array', () => {
      const input = [
        { id: 'a', createdAt: new Date('2026-01-01T10:00:00Z') },
        { id: 'b', createdAt: new Date('2026-01-02T10:00:00Z') },
      ];
      sortNewestFirst(input);
      expect(input.map((t) => t.id)).toEqual(['a', 'b']);
    });
  });
});
