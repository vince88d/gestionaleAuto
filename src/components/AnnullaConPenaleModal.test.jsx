import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AnnullaConPenaleModal from './AnnullaConPenaleModal';

const prenotazione = { id: 'p1', cliente: 'Mario Rossi', dataInizio: '2026-11-10', dataFine: '2026-11-13', totale: 75 };
const montato = (extra = {}) => {
  const onConferma = jest.fn();
  render(<AnnullaConPenaleModal prenotazione={prenotazione} inCorso={false} onClose={jest.fn()} onConferma={onConferma} {...extra} />);
  return onConferma;
};

test('all\'inizio è un rimborso totale e non si invia nessuna penale', () => {
  const onConferma = montato();
  expect(screen.getByText(/Rimborso al cliente:/).textContent).toMatch(/75,00 €/);
  fireEvent.click(screen.getByText('Annulla e rimborsa'));
  expect(onConferma).toHaveBeenCalledWith(undefined);
});

test('una percentuale rapida mostra penale e rimborso e li invia', () => {
  const onConferma = montato();
  fireEvent.click(screen.getByText('20%'));
  expect(screen.getByText(/Penale trattenuta:/).textContent).toMatch(/15,00 €/);
  expect(screen.getByText(/Rimborso al cliente:/).textContent).toMatch(/60,00 €/);
  fireEvent.click(screen.getByText('Annulla e rimborsa'));
  expect(onConferma).toHaveBeenCalledWith({ percentuale: 20 });
});

test('importo fisso: senza aver scritto un valore non si può confermare', () => {
  const onConferma = montato();
  fireEvent.click(screen.getByText('Importo fisso'));
  expect(screen.getByText('Annulla e rimborsa').disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Importo (€)'), { target: { value: '12.5' } });
  expect(screen.getByText(/Rimborso al cliente:/).textContent).toMatch(/62,50 €/);
  fireEvent.click(screen.getByText('Annulla e rimborsa'));
  expect(onConferma).toHaveBeenCalledWith({ importo: 12.5 });
});

test('una penale superiore all\'importo pagato è rifiutata', () => {
  const onConferma = montato();
  fireEvent.click(screen.getByText('Importo fisso'));
  fireEvent.change(screen.getByLabelText('Importo (€)'), { target: { value: '80' } });
  expect(screen.getByRole('alert').textContent).toMatch(/non può superare/);
  expect(screen.getByText('Annulla e rimborsa').disabled).toBe(true);
  expect(onConferma).not.toHaveBeenCalled();
});

test('durante l\'annullamento i pulsanti sono bloccati', () => {
  montato({ inCorso: true });
  expect(screen.getByText('Annullamento in corso…').disabled).toBe(true);
  expect(screen.getByText('Indietro').disabled).toBe(true);
});
