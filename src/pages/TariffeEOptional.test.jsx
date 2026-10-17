import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TariffeEOptional from './TariffeEOptional';

jest.mock('../lib/firestoreVeicoli', () => ({ ascoltaVeicoli: (cb) => { cb([{ id: '1', categoria: 'SUV', prezzo: 35 }]); return () => {}; } }));
jest.mock('../lib/firestoreTariffe', () => ({ ascoltaTariffe: (cb) => { cb({ SUV: 35 }); return () => {}; }, writeTariffe: jest.fn() }));
jest.mock('../lib/firestoreCategorie', () => ({ ascoltaCategorie: (cb) => { cb(['SUV', 'Berlina']); return () => {}; } }));
jest.mock('../lib/firestoreOptional', () => ({ ascoltaOptional: (cb) => { cb([]); return () => {}; }, salvaOptional: jest.fn(), togliOptional: jest.fn() }));
const mockSalvaModalita = jest.fn(() => Promise.resolve());
jest.mock('../lib/firestoreSito', () => ({
  ascoltaModalitaSito: (cb) => { cb('pagamento'); return () => {}; },
  salvaModalitaSito: (...a) => mockSalvaModalita(...a),
}));
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() } }));

test('cambiando scheda con prezzi non salvati chiede conferma', async () => {
  render(<TariffeEOptional />);
  const prezzo = screen.getByLabelText('Prezzo al giorno SUV');
  await waitFor(() => expect(prezzo.value).toBe('35'));

  // Senza modifiche si cambia scheda subito.
  fireEvent.click(screen.getByRole('tab', { name: 'Extra' }));
  expect(screen.getByText('Optional a pagamento')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Prezzo al giorno' }));

  fireEvent.change(screen.getByLabelText('Prezzo al giorno SUV'), { target: { value: '40' } });
  fireEvent.click(screen.getByRole('tab', { name: 'Extra' }));
  expect(screen.getByText('Prezzi non salvati')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Resta qui' }));
  expect(screen.getByLabelText('Prezzo al giorno SUV').value).toBe('40');

  fireEvent.click(screen.getByRole('tab', { name: 'Extra' }));
  fireEvent.click(screen.getByRole('button', { name: 'Esci senza salvare' }));
  expect(screen.getByText('Optional a pagamento')).toBeInTheDocument();
});

test('i prezzi solo proposti (mai toccati) non fanno comparire l\'avviso', async () => {
  // SUV ha una tariffa salvata; "Berlina" no: il suo campo e' proposto, non cambiato dal gestore.
  render(<TariffeEOptional />);
  await waitFor(() => expect(screen.getByLabelText('Prezzo al giorno SUV').value).toBe('35'));
  fireEvent.click(screen.getByRole('tab', { name: 'Extra' }));
  expect(screen.queryByText('Prezzi non salvati')).not.toBeInTheDocument();
});

test('«Prezzi sul sito»: si cambia solo dopo la conferma', async () => {
  render(<TariffeEOptional />);
  const pagamento = screen.getByRole('radio', { name: /Prenota e paga online/ });
  const richieste = screen.getByRole('radio', { name: /Solo richieste, senza prezzi/ });
  expect(pagamento).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByText(/Sul sito il cliente vede questi prezzi/)).toBeInTheDocument();

  fireEvent.click(richieste);
  expect(screen.getByText('Togliere i prezzi dal sito?')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'No, lascia così' }));
  expect(mockSalvaModalita).not.toHaveBeenCalled();

  fireEvent.click(richieste);
  fireEvent.click(screen.getByRole('button', { name: 'Sì, cambia il sito' }));
  await waitFor(() => expect(mockSalvaModalita).toHaveBeenCalledWith('richiesta'));
});

test('il «?» si apre col clic e si chiude con Esc', () => {
  render(<TariffeEOptional />);
  fireEvent.click(screen.getByRole('button', { name: /Chi vede i miei prezzi/ }));
  expect(screen.getByRole('dialog', { name: 'Chi vede i miei prezzi?' })).toBeInTheDocument();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: 'Chi vede i miei prezzi?' })).not.toBeInTheDocument();
});
