import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import CosaInclusa from './CosaInclusa';

let invia;
const mockSalva = jest.fn(() => Promise.resolve());
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../lib/firestoreIncluso', () => ({
  ascoltaIncluso: (onDati) => { invia = onDati; return () => {}; },
  salvaIncluso: (...a) => mockSalva(...a),
}));

const SALVATE = { voci: [{ id: 'a', testo: 'Assicurazione RCA inclusa', attiva: true }, { id: 'b', testo: 'Assistenza stradale', attiva: false }] };
const apri = (dati = { dati: SALVATE, esiste: true }) => {
  render(<CosaInclusa />);
  act(() => invia(dati));
};

beforeEach(() => mockSalva.mockClear());

test('mai scritte: avviso, solo voci automatiche; si aggiunge una voce e si salva', async () => {
  apri({ dati: undefined, esiste: false });
  expect(screen.getByText(/Non ancora scritte/)).toBeInTheDocument();
  expect(screen.getByText('Solo le voci automatiche.')).toBeInTheDocument();
  expect(screen.getByText(/Cancellazione gratuita fino a 48 ore prima/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '+ Aggiungi una voce' }));
  fireEvent.change(screen.getByLabelText('Voce 1'), { target: { value: 'Seconda guida gratuita' } });
  fireEvent.click(screen.getByRole('button', { name: /^Salva$/ }));
  await waitFor(() => expect(mockSalva).toHaveBeenCalled());
  expect(mockSalva.mock.calls[0][0].voci[0]).toMatchObject({ testo: 'Seconda guida gratuita', attiva: true });
});

test('salvate: l\'anteprima mostra solo le voci accese e Salva e\' spento finche\' non cambia nulla', () => {
  apri();
  expect(screen.getByRole('button', { name: /^Salva$/ })).toBeDisabled();
  expect(screen.getByText(/In più delle voci automatiche: Assicurazione RCA inclusa\./)).toBeInTheDocument();
  expect(screen.getByRole('switch', { name: 'Mostra sul sito: voce 2' })).toHaveAttribute('aria-checked', 'false');
});

test('accendere una voce spenta cambia l\'anteprima e attiva Salva', () => {
  apri();
  fireEvent.click(screen.getByRole('switch', { name: 'Mostra sul sito: voce 2' }));
  expect(screen.getByText(/Assicurazione RCA inclusa · Assistenza stradale\./)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^Salva$/ })).toBeEnabled();
});

test('riga vuota: errore e non salva', async () => {
  apri();
  fireEvent.click(screen.getByRole('button', { name: '+ Aggiungi una voce' }));
  fireEvent.click(screen.getByRole('button', { name: /^Salva$/ }));
  expect(await screen.findByText('Scrivi la voce oppure toglila.')).toBeInTheDocument();
  expect(mockSalva).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Togli la voce 3' }));
  fireEvent.click(screen.getByRole('button', { name: /^Salva$/ }));
  // dopo aver tolto la riga vuota non ci sono modifiche rispetto ai dati salvati
  expect(mockSalva).not.toHaveBeenCalled();
});

test('si sposta una voce su e giu\'; Annulla modifiche ripristina', () => {
  apri();
  fireEvent.click(screen.getByRole('button', { name: 'Sposta giù la voce 1' }));
  expect(screen.getByLabelText('Voce 1')).toHaveValue('Assistenza stradale');
  fireEvent.click(screen.getByRole('button', { name: 'Annulla modifiche' }));
  expect(screen.getByLabelText('Voce 1')).toHaveValue('Assicurazione RCA inclusa');
});
