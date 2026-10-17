import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RichiesteSito from './RichiesteSito';

const mockConferma = jest.fn(() => Promise.resolve());
const mockRifiuta = jest.fn(() => Promise.resolve());
jest.mock('../lib/richiesteSito', () => ({
  confermaRichiestaSito: (...a) => mockConferma(...a),
  rifiutaRichiestaSito: (...a) => mockRifiuta(...a),
  messaggioErroreRichiesta: () => 'errore',
}));

const tra = (ore) => ({ toMillis: () => Date.now() + ore * 3600e3 });
const richiesta = {
  id: 'r1', cliente: 'Mario Rossi', telefono: '333 123 4567', categoria: 'SUV',
  dataInizio: '2099-10-24', oraInizio: '09:00', dataFine: '2099-10-27', oraFine: '18:00',
  protezione: { tipo: 'totale', prezzo: 72 }, optional: [{ nome: 'Seggiolino', quantita: 1, totale: 24 }],
  status: 'richiesta-sito', richiestaSenzaPagamento: true, scadeIl: tra(2), totaleListino: 261,
};

test('non mostra niente senza richieste', () => {
  const { container } = render(<RichiesteSito prenotazioni={[{ id: 'x', status: 'attiva' }]} oggi="2026-10-17" />);
  expect(container).toBeEmptyDOMElement();
});

test('mostra la richiesta con telefono e scadenza, e la conferma con il prezzo concordato', async () => {
  render(<RichiesteSito prenotazioni={[richiesta]} oggi="2026-10-17" />);
  expect(screen.getByText('Mario Rossi')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /333 123 4567/ })).toHaveAttribute('href', 'tel:3331234567');
  expect(screen.getByText(/Scade tra 1 ora|Scade tra 2 ore/)).toBeInTheDocument();
  expect(screen.getByText(/Protezione totale · Seggiolino/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Conferma/ }));
  const prezzo = screen.getByLabelText('Prezzo concordato');
  expect(prezzo.value).toBe('261');
  expect(screen.getByText(/Da listino sarebbe 261 €/)).toBeInTheDocument();
  fireEvent.change(prezzo, { target: { value: '230' } });
  fireEvent.click(screen.getByRole('button', { name: 'Conferma e avvisa il cliente' }));
  await waitFor(() => expect(mockConferma).toHaveBeenCalledWith('r1', 230));
});

test('senza un prezzo valido non conferma', () => {
  render(<RichiesteSito prenotazioni={[richiesta]} oggi="2026-10-17" />);
  fireEvent.click(screen.getByRole('button', { name: /Conferma/ }));
  fireEvent.change(screen.getByLabelText('Prezzo concordato'), { target: { value: 'boh' } });
  fireEvent.click(screen.getByRole('button', { name: 'Conferma e avvisa il cliente' }));
  expect(screen.getByRole('alert')).toHaveTextContent(/Scrivi il prezzo/);
  expect(mockConferma).not.toHaveBeenCalled();
});

test('rifiuta dopo la conferma', async () => {
  render(<RichiesteSito prenotazioni={[richiesta]} oggi="2026-10-17" />);
  fireEvent.click(screen.getByRole('button', { name: /Rifiuta/ }));
  expect(screen.getByText(/il cliente riceve un'email gentile/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Sì, rifiuta' }));
  await waitFor(() => expect(mockRifiuta).toHaveBeenCalledWith('r1'));
});
