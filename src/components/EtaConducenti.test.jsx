import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import EtaConducenti from './EtaConducenti';

let invia;
const mockSalva = jest.fn(() => Promise.resolve());
jest.mock('react-toastify', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../lib/firestoreEtaConducenti', () => ({
  ascoltaEtaConducenti: (onDati) => { invia = onDati; return () => {}; },
  salvaEtaConducenti: (...a) => mockSalva(...a),
}));

const ESEMPIO = {
  attivo: true, etaMinima: 18, etaMassima: 70,
  fasce: [{ finoA: 20, euroGiorno: 25 }, { finoA: 24, euroGiorno: 15 }], massimo: 300,
};
const apri = (dati = { dati: ESEMPIO, esiste: true }) => {
  render(<EtaConducenti />);
  act(() => invia(dati));
};

beforeEach(() => mockSalva.mockClear());

test('mai impostate: avviso, supplemento spento, sul sito non si chiede l\'eta\'', async () => {
  apri({ dati: undefined, esiste: false });
  expect(screen.getByText(/Non ancora impostate/)).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: /Applica un supplemento/ })).not.toBeChecked();
  expect(screen.getByText(/non si chiede l'età/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Salva/ }));
  await waitFor(() => expect(mockSalva).toHaveBeenCalled());
});

test('impostate: fasce, tetto e anteprima del sito', () => {
  apri();
  expect(screen.getByRole('button', { name: /^Salva$/ })).toBeDisabled();
  expect(screen.getByText(/«Età del conducente compresa tra 25 - 70»/)).toBeInTheDocument();
  expect(screen.getByText(/20 anni = 75 € · 24 anni = 45 €/)).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Massimo a noleggio in euro' })).toHaveValue('300,00');
});

test('fascia senza importo: errore e non salva; poi si corregge e salva', async () => {
  apri();
  fireEvent.click(screen.getByRole('button', { name: '+ Aggiungi una fascia' }));
  // la nuova fascia propone 25 anni: l'anteprima non cambia finche' manca l'importo
  fireEvent.click(screen.getByRole('button', { name: /^Salva$/ }));
  expect(screen.getByText('Scrivi l\'importo.')).toBeInTheDocument();
  expect(mockSalva).not.toHaveBeenCalled();

  fireEvent.change(screen.getByRole('textbox', { name: 'Fascia 3: euro al giorno' }), { target: { value: '8' } });
  fireEvent.click(screen.getByRole('button', { name: /^Salva$/ }));
  await waitFor(() => expect(mockSalva).toHaveBeenCalled());
  expect(mockSalva.mock.calls[0][0].fasce[2]).toEqual({ finoA: '25', euroGiorno: '8' });
});

test('spegnere il supplemento nasconde le fasce', () => {
  apri();
  fireEvent.click(screen.getByRole('checkbox', { name: /Applica un supplemento/ }));
  expect(screen.queryByText('+ Aggiungi una fascia')).toBeNull();
  expect(screen.getByText(/«Età del conducente compresa tra 18 - 70»/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^Salva$/ })).not.toBeDisabled();
});
