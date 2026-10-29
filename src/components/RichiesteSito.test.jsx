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

describe('tante richieste', () => {
  const molte = Array.from({ length: 50 }, (_, i) => ({
    ...richiesta, id: `m${i}`, cliente: `Cliente ${i}`, telefono: `333 000 ${String(i).padStart(4, '0')}`, scadeIl: tra(1 + i * 0.4),
  }));

  test('mostra in grande solo le prime 3 e un link per le altre con l\'avviso delle urgenti', () => {
    render(<RichiesteSito prenotazioni={molte} oggi="2026-10-17" />);
    expect(screen.getAllByRole('button', { name: /Conferma, paga al ritiro/ })).toHaveLength(3);
    const link = screen.getByRole('button', { name: /Mostra le altre 47/ });
    expect(link).toHaveTextContent(/scadono entro 3 ore/);
    expect(screen.queryByRole('region', { name: /Altre 47 richieste/ })).not.toBeInTheDocument();
  });

  test('apre le altre in un riquadro scorrevole, le filtra e le cerca', () => {
    render(<RichiesteSito prenotazioni={molte} oggi="2026-10-17" />);
    fireEvent.click(screen.getByRole('button', { name: /Mostra le altre 47/ }));
    expect(screen.getByRole('region', { name: /Altre 47 richieste/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Apri la richiesta di/ })).toHaveLength(47);

    fireEvent.click(screen.getByRole('button', { name: /Scadono entro 3 ore/ }));
    const urgenti = screen.getAllByRole('button', { name: /^Apri la richiesta di/ }).length;
    expect(urgenti).toBeGreaterThan(0);
    expect(urgenti).toBeLessThan(47);

    fireEvent.click(screen.getByRole('button', { name: /^Tutte/ }));
    fireEvent.change(screen.getByLabelText('Cerca tra le altre richieste'), { target: { value: 'Cliente 30' } });
    expect(screen.getAllByRole('button', { name: /^Apri la richiesta di/ })).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Cerca tra le altre richieste'), { target: { value: 'zzz' } });
    expect(screen.getByText('Nessuna richiesta corrisponde.')).toBeInTheDocument();
  });

  test('un clic su una riga compatta la apre in grande; «Mostra meno» richiude', () => {
    render(<RichiesteSito prenotazioni={molte} oggi="2026-10-17" />);
    fireEvent.click(screen.getByRole('button', { name: /Mostra le altre 47/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Apri la richiesta di Cliente 10' }));
    expect(screen.getAllByRole('button', { name: /Conferma, paga al ritiro/ })).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Mostra meno' }));
    expect(screen.getAllByRole('button', { name: /Conferma, paga al ritiro/ })).toHaveLength(3);
  });

  test('con 3 richieste o meno non cambia niente', () => {
    render(<RichiesteSito prenotazioni={molte.slice(0, 3)} oggi="2026-10-17" />);
    expect(screen.getAllByRole('button', { name: /Conferma, paga al ritiro/ })).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /Mostra le altre/ })).not.toBeInTheDocument();
  });
});
