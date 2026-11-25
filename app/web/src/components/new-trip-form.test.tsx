import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiError, type Trip } from '../lib/api-client';
import { NewTripForm, type NewTripFormProps } from './new-trip-form';

const TRIP: Trip = { id: 'trip-1', name: 'Lisbon', createdAt: '2026-11-25T10:00:00.000Z' };
const CREATE_FAILED = 'Could not create the trip. Try again.';

function renderForm(overrides: Partial<NewTripFormProps> = {}) {
  const createTrip = overrides.createTrip ?? jest.fn((_name: string) => Promise.resolve(TRIP));
  const onCreated = overrides.onCreated ?? jest.fn();
  render(<NewTripForm createTrip={createTrip} onCreated={onCreated} />);
  return {
    createTrip,
    onCreated,
    input: screen.getByLabelText('Trip name') as HTMLInputElement,
    submit: () => fireEvent.click(screen.getByRole('button', { name: 'Create trip' })),
  };
}

describe('NewTripForm', () => {
  it('F2.AC1 shows a labelled name field and a Create trip button', () => {
    const { input } = renderForm();

    expect(input.type).toBe('text');
    expect(screen.getByRole('button', { name: 'Create trip' })).toBeTruthy();
  });

  it('F2.AC1 a valid name is sent, the field is cleared, "Trip created." is announced and onCreated gets the trip', async () => {
    const { createTrip, onCreated, input, submit } = renderForm();

    fireEvent.change(input, { target: { value: 'Lisbon' } });
    submit();

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(TRIP));
    expect(createTrip).toHaveBeenCalledWith('Lisbon');
    expect(input.value).toBe('');
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toBe('Trip created.');
  });

  it('F2.AC1 the name is trimmed before it is sent', async () => {
    const { createTrip, input, submit } = renderForm();

    fireEvent.change(input, { target: { value: '  Lisbon  ' } });
    submit();

    await waitFor(() => expect(createTrip).toHaveBeenCalledWith('Lisbon'));
  });

  it('F2.AC3 an empty name shows the message under the field, linked by aria-describedby, and sends no request', () => {
    const { createTrip, input, submit } = renderForm();

    submit();

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe('Enter a trip name.');
    expect(input.getAttribute('aria-describedby')).toBe(alert.id);
    expect(createTrip).not.toHaveBeenCalled();
  });

  it('F2.AC3 a name of only spaces is treated as empty and sends no request', () => {
    const { createTrip, input, submit } = renderForm();

    fireEvent.change(input, { target: { value: '     ' } });
    submit();

    expect(screen.getByRole('alert').textContent).toBe('Enter a trip name.');
    expect(createTrip).not.toHaveBeenCalled();
  });

  it('F2.AC4 a name of 101 characters shows the message and sends no request', () => {
    const { createTrip, input, submit } = renderForm();

    fireEvent.change(input, { target: { value: 'a'.repeat(101) } });
    submit();

    expect(screen.getByRole('alert').textContent).toBe('Trip names can be up to 100 characters.');
    expect(createTrip).not.toHaveBeenCalled();
  });

  it('F2.AC4 a name of exactly 100 characters is sent and saved', async () => {
    const name = 'a'.repeat(100);
    const createTrip = jest.fn((_name: string) => Promise.resolve({ ...TRIP, name }));
    const { onCreated, input, submit } = renderForm({ createTrip });

    fireEvent.change(input, { target: { value: name } });
    submit();

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(createTrip).toHaveBeenCalledWith(name);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('F2.AC1 a failed create shows the failure message and keeps the typed name', async () => {
    const createTrip = jest.fn((_name: string) => Promise.reject(new ApiError('Something went wrong. Try again.', 500, null)));
    const { onCreated, input, submit } = renderForm({ createTrip });

    fireEvent.change(input, { target: { value: 'Lisbon' } });
    submit();

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe(CREATE_FAILED));
    expect(input.value).toBe('Lisbon');
    expect(onCreated).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('F2.AC1 a session-expired failure shows no message and keeps the typed name', async () => {
    const createTrip = jest.fn((_name: string) => Promise.reject(new ApiError('', 401, null, true)));
    const { input, submit } = renderForm({ createTrip });

    fireEvent.change(input, { target: { value: 'Lisbon' } });
    submit();

    await waitFor(() => expect(createTrip).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(input.value).toBe('Lisbon');
  });

  it('F2.AC1 the button is disabled while the request is in flight and a second submit sends nothing', async () => {
    let resolveCreate: (trip: Trip) => void = () => undefined;
    const createTrip = jest.fn(
      (_name: string) => new Promise<Trip>((resolve) => { resolveCreate = resolve; }),
    );
    const { onCreated, input, submit } = renderForm({ createTrip });

    fireEvent.change(input, { target: { value: 'Lisbon' } });
    submit();

    const button = screen.getByRole('button', { name: 'Create trip' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    submit();
    expect(createTrip).toHaveBeenCalledTimes(1);

    resolveCreate(TRIP);
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(TRIP));
    expect((screen.getByRole('button', { name: 'Create trip' }) as HTMLButtonElement).disabled).toBe(false);
  });
});
