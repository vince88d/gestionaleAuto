import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TariffeEOptional from './TariffeEOptional';

jest.mock('../lib/firestoreVeicoli', () => ({ ascoltaVeicoli: (cb) => { cb([{ id: '1', categoria: 'SUV', prezzo: 35 }]); return () => {}; } }));
jest.mock('../lib/firestoreTariffe', () => ({ ascoltaTariffe: (cb) => { cb({ SUV: 35 }); return () => {}; }, writeTariffe: jest.fn() }));
jest.mock('../lib/firestoreCategorie', () => ({ ascoltaCategorie: (cb) => { cb(['SUV']); return () => {}; } }));
jest.mock('../lib/firestoreOptional', () => ({ ascoltaOptional: (cb) => { cb([]); return () => {}; }, salvaOptional: jest.fn(), togliOptional: jest.fn() }));
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));

test('cambiando scheda con prezzi non salvati chiede conferma', async () => {
  render(<TariffeEOptional />);
  const prezzo = screen.getByLabelText('Prezzo al giorno SUV');
  await waitFor(() => expect(prezzo.value).toBe('35'));

  // Senza modifiche si cambia scheda subito.
  fireEvent.click(screen.getByRole('tab', { name: 'Optional' }));
  expect(screen.getByText('Optional a pagamento')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Prezzo per categoria' }));

  fireEvent.change(screen.getByLabelText('Prezzo al giorno SUV'), { target: { value: '40' } });
  fireEvent.click(screen.getByRole('tab', { name: 'Optional' }));
  expect(screen.getByText('Prezzi non salvati')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Resta qui' }));
  expect(screen.getByLabelText('Prezzo al giorno SUV').value).toBe('40');

  fireEvent.click(screen.getByRole('tab', { name: 'Optional' }));
  fireEvent.click(screen.getByRole('button', { name: 'Esci senza salvare' }));
  expect(screen.getByText('Optional a pagamento')).toBeInTheDocument();
});
