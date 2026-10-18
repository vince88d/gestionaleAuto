import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AddebitiRientro from './AddebitiRientro';
import { salvaAddebiti } from '../lib/firestoreAddebiti';

jest.mock('../lib/firestoreAddebiti', () => ({
  ascoltaAddebiti: (cb) => { cb({ rifornimentoQuarto: 20, pulizia: 30, chiave: 150, oggettoMancante: 15 }); return () => {}; },
  salvaAddebiti: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

test('mostra i prezzi e salva solo dopo una modifica', async () => {
  render(<AddebitiRientro />);
  const pulizia = await screen.findByLabelText('Pulizia straordinaria');
  expect(pulizia.value).toBe('30');
  const salva = screen.getByRole('button', { name: 'Salva' });
  expect(salva).toBeDisabled();
  fireEvent.change(pulizia, { target: { value: '40' } });
  expect(salva).toBeEnabled();
  fireEvent.click(salva);
  await waitFor(() => expect(salvaAddebiti).toHaveBeenCalledWith(expect.objectContaining({ pulizia: '40' })));
});

test('un importo vuoto non si salva', async () => {
  salvaAddebiti.mockClear();
  render(<AddebitiRientro />);
  const chiave = await screen.findByLabelText('Chiave non restituita');
  fireEvent.change(chiave, { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
  expect(await screen.findByText(/Scrivi l'importo/)).toBeInTheDocument();
  expect(salvaAddebiti).not.toHaveBeenCalled();
});

test('una voce di partenza si toglie e si rimette', async () => {
  salvaAddebiti.mockClear();
  render(<AddebitiRientro />);
  fireEvent.click(await screen.findByRole('button', { name: /Togli la voce Pulizia straordinaria/ }));
  expect(screen.queryByLabelText('Pulizia straordinaria')).not.toBeInTheDocument();
  expect(screen.getByText('Voci tolte')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Salva' }));
  await waitFor(() => expect(salvaAddebiti).toHaveBeenCalledWith(expect.objectContaining({ tolte: ['pulizia'] })));
  fireEvent.click(screen.getByRole('button', { name: /Rimetti la voce Pulizia straordinaria/ }));
  expect(screen.getByLabelText('Pulizia straordinaria')).toBeInTheDocument();
});
