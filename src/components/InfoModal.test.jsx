import React from 'react';
import { render, screen } from '@testing-library/react';
import InfoModal from './InfoModal';

// Il modale non deve generare PDF in questo test.
jest.mock('jspdf', () => jest.fn());
jest.mock('html2canvas', () => jest.fn());

const azioni = { onClose: jest.fn(), onModifica: jest.fn(), onElimina: jest.fn(), onConcludi: jest.fn() };

// Una prenotazione nata dal sito non ha `schedaVeicolo`: la compila lo staff
// alla consegna. Aprire le info non deve mandare in crash l'app (pagina bianca).
const prenotazioneDalSito = {
  id: 'p1', origine: 'sito', status: 'attiva', categoria: 'City Car',
  cliente: 'Mario Rossi', emailCliente: 'mario@example.it', codiceFiscale: 'RSSMRA80A01H501U',
  veicolo: 'City Car (da assegnare)', targa: '', dataInizio: '2026-10-10', dataFine: '2026-10-12',
};

test('le info di una prenotazione del sito, senza scheda veicolo, si aprono senza errori', () => {
  render(<InfoModal isOpen prenotazione={prenotazioneDalSito} {...azioni} />);
  expect(screen.getAllByText('Mario Rossi').length).toBeGreaterThan(0);
  expect(screen.queryByText('Accessori')).toBeNull();
});

test('una prenotazione pagata online mostra "Annulla e rimborsa" invece di "Elimina"', () => {
  render(<InfoModal isOpen prenotazione={{ ...prenotazioneDalSito, paymentIntentId: 'pi_1' }} {...azioni} />);
  expect(screen.getByText('Annulla e rimborsa')).toBeTruthy();
  expect(screen.queryByText('Elimina')).toBeNull();
});

test('una prenotazione creata dal gestionale (senza pagamento online) mostra "Elimina"', () => {
  render(<InfoModal isOpen prenotazione={{ ...prenotazioneDalSito, origine: undefined }} {...azioni} />);
  expect(screen.getByText('Elimina')).toBeTruthy();
});

test('con la scheda veicolo compilata mostra gli accessori', () => {
  const conScheda = {
    ...prenotazioneDalSito,
    schedaVeicolo: { accessori: { cric: true, triangolo: false, altro: '' } },
  };
  render(<InfoModal isOpen prenotazione={conScheda} {...azioni} />);
  expect(screen.getAllByText('Accessori').length).toBeGreaterThan(0);
});

test('veicolo assegnato ma non consegnato: c\'e\' "Consegna", non "Concludi"', () => {
  const onConsegna = jest.fn();
  const assegnata = { ...prenotazioneDalSito, targa: 'AA111AA', veicolo: 'Fiat Panda' };
  render(<InfoModal isOpen prenotazione={assegnata} {...azioni} onConsegna={onConsegna} />);
  screen.getByText('Consegna', { selector: 'button' }).click();
  expect(onConsegna).toHaveBeenCalledWith(assegnata);
  expect(screen.queryByText('Concludi')).toBeNull();
});

test('dopo la consegna: "Concludi" e i km alla consegna', () => {
  const consegnata = {
    ...prenotazioneDalSito, targa: 'AA111AA', veicolo: 'Fiat Panda',
    consegnataIl: '2026-10-10T09:00:00.000Z', schedaVeicolo: { kmIniziali: '45000', carburante: 'Pieno' },
  };
  render(<InfoModal isOpen prenotazione={consegnata} {...azioni} onConsegna={jest.fn()} />);
  expect(screen.getByText('Concludi')).toBeTruthy();
  expect(screen.queryByText('Consegna', { selector: 'button' })).toBeNull();
  expect(screen.getByText('45000')).toBeTruthy();
});
