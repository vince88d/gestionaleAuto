import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FotoDalTelefono from './FotoDalTelefono';
import * as lib from '../lib/fotoVerbale';

jest.mock('qrcode', () => ({ toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,AAAA') }));
jest.mock('../lib/fotoVerbale', () => ({
  useFotoVerbale: jest.fn(),
  creaSessioneFoto: jest.fn(),
  chiudiSessioneFoto: jest.fn().mockResolvedValue(undefined),
  aggiornaEtichettaFoto: jest.fn().mockResolvedValue(undefined),
  eliminaFoto: jest.fn().mockResolvedValue(undefined),
  messaggioErroreFoto: (e) => e.message,
}));

const foto = (id, etichetta) => ({ id, url: `https://x/${id}`, path: `p/${id}`, etichetta, scattataIl: 1, caricataIl: 2 });

beforeEach(() => {
  // Lo `resetMocks` di react-scripts azzera i valori dati nella factory.
  lib.useFotoVerbale.mockReturnValue({ foto: [], caricato: true, errore: null });
  lib.chiudiSessioneFoto.mockResolvedValue(undefined);
  lib.aggiornaEtichettaFoto.mockResolvedValue(undefined);
  lib.eliminaFoto.mockResolvedValue(undefined);
  require('qrcode').toDataURL.mockResolvedValue('data:image/png;base64,AAAA');
});

test('senza foto: pulsante, foto consigliate e avviso (non blocca)', () => {
  render(<FotoDalTelefono prenotazioneId="p1" fase="consegna" />);
  expect(screen.getByRole('button', { name: /aggiungi foto dal telefono/i })).toBeInTheDocument();
  expect(screen.getByText('Quadro: km e carburante')).toBeInTheDocument();
  expect(screen.getByText(/Nessuna foto ancora/)).toBeInTheDocument();
});

test('apre il QR, lo mostra e lo chiude', async () => {
  lib.creaSessioneFoto.mockResolvedValue({ token: 't', url: 'https://sito/#/foto/t', scadeIlMs: Date.now() + 28 * 60000 });
  render(<FotoDalTelefono prenotazioneId="p1" fase="rientro" />);
  fireEvent.click(screen.getByRole('button', { name: /aggiungi foto dal telefono/i }));
  expect(await screen.findByAltText(/codice qr per caricare le foto della rientro/i)).toBeInTheDocument();
  expect(lib.creaSessioneFoto).toHaveBeenCalledWith('p1', 'rientro');
  expect(screen.getByText(/scade tra 28 min/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /chiudi il collegamento/i }));
  expect(lib.chiudiSessioneFoto).toHaveBeenCalledWith('t');
  await waitFor(() => expect(screen.queryByAltText(/codice qr/i)).toBeNull());
});

test('errore nell\'apertura del collegamento: messaggio leggibile', async () => {
  lib.creaSessioneFoto.mockRejectedValue(new Error('Il servizio delle foto non risponde.'));
  render(<FotoDalTelefono prenotazioneId="p1" fase="consegna" />);
  fireEvent.click(screen.getByRole('button', { name: /aggiungi foto dal telefono/i }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Il servizio delle foto non risponde.');
});

test('con le foto: griglia, etichette, segni ✓ sulle consigliate e avviso se poche', () => {
  lib.useFotoVerbale.mockReturnValue({
    foto: [foto('a', 'Angolo anteriore sinistro'), foto('b', 'Interni'), foto('c', '')], caricato: true, errore: null,
  });
  render(<FotoDalTelefono prenotazioneId="p1" fase="consegna" />);
  expect(screen.getByText(/3 caricate/)).toBeInTheDocument();
  expect(screen.getByText('✓ Ant. sinistro')).toBeInTheDocument();
  expect(screen.getByText('✓ Interni')).toBeInTheDocument();
  expect(screen.getByText('Quadro')).toBeInTheDocument(); // manca: senza ✓
  expect(screen.getByText(/Solo 3 foto/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Etichetta della foto 3'), { target: { value: 'Danno' } });
  expect(lib.aggiornaEtichettaFoto).toHaveBeenCalledWith('c', 'Danno');
});
