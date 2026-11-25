import {
  TRIP_NAME_EMPTY_MESSAGE,
  TRIP_NAME_TOO_LONG_MESSAGE,
  normalizeTripName,
  validateTripName,
} from './trip-validation';

describe('trip-validation', () => {
  it('F2.AC1 a name of "Lisbon" passes the client check', () => {
    expect(validateTripName('Lisbon')).toBeNull();
  });

  it('F2.AC1 trims leading and trailing spaces before the name is sent', () => {
    expect(normalizeTripName('  Lisbon  ')).toBe('Lisbon');
  });

  it('F2.AC3 an empty name shows "Enter a trip name." on the name field', () => {
    expect(validateTripName('')).toEqual({ field: 'name', message: 'Enter a trip name.' });
    expect(TRIP_NAME_EMPTY_MESSAGE).toBe('Enter a trip name.');
  });

  it('F2.AC3 a name of only spaces shows "Enter a trip name."', () => {
    expect(validateTripName('   ')).toEqual({ field: 'name', message: 'Enter a trip name.' });
  });

  it('F2.AC4 a name of 101 characters shows the limit message', () => {
    expect(validateTripName('a'.repeat(101))).toEqual({
      field: 'name',
      message: 'Trip names can be up to 100 characters.',
    });
    expect(TRIP_NAME_TOO_LONG_MESSAGE).toBe('Trip names can be up to 100 characters.');
  });

  it('F2.AC4 a name of exactly 100 characters passes', () => {
    expect(validateTripName('a'.repeat(100))).toBeNull();
  });

  it('F2.AC4 counts characters, not UTF-16 units, so 100 emoji pass and 101 fail', () => {
    expect(validateTripName('😀'.repeat(100))).toBeNull();
    expect(validateTripName('😀'.repeat(101))).toEqual({
      field: 'name',
      message: 'Trip names can be up to 100 characters.',
    });
  });

  it('F2.AC4 the length is checked after trimming, so padding does not count', () => {
    expect(validateTripName(`  ${'a'.repeat(100)}  `)).toBeNull();
  });
});
