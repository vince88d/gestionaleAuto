import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SchedaModalOpen from './SchedaModalOpen';

// Le foto dal telefono parlano con Firebase: qui non servono.
jest.mock('./FotoDalTelefono', () => () => null);
jest.mock('../lib/storageFoto', () => ({ caricaFotoDanno: jest.fn() }));

const prenotazione = {
  id: 'p1', cliente: 'Mario Rossi', veicolo: 'Fiat Panda', targa: 'AA111AA', dataInizio: '2099-10-12', dataFine: '2099-10-15',
  codiceFiscale: 'RSSMRA80A01H501U', patente: 'AB1234567',
};
const cliente = { scadenzaPatente: '2099-12-31' };

function Prova({ onSave, scheda = { carburante: '', kmIniziali: '', danni: '' } }) {
  const [s, setS] = useState(scheda);
  return (
    <SchedaModalOpen
      isOpen onRequestClose={jest.fn()} prenotazione={prenotazione} cliente={cliente}
      schedaVeicolo={s} setSchedaVeicolo={setS} documenti={{}} onDocumentiChange={jest.fn()} onSave={onSave}
    />
  );
}

const avanti = () => fireEvent.click(screen.getByRole('button', { name: /avanti: riepilogo e contratto/i }));

test('con carburante e km mancanti non si va avanti e lo dice, accanto al pulsante e sotto i campi', () => {
  const onSave = jest.fn();
  render(<Prova onSave={onSave} />);
  expect(screen.queryByText(/^Manca:/)).toBeNull(); // prima del tentativo niente rosso
  avanti();
  expect(onSave).not.toHaveBeenCalled();
  expect(screen.getByText('Manca: carburante e km')).toBeInTheDocument();
  expect(screen.getByText('Scegli il livello del carburante.')).toBeInTheDocument();
  expect(screen.getByText('Scrivi i km del contachilometri.')).toBeInTheDocument();
});

test('compilando i campi l\'avviso sparisce da solo e si puo\' andare avanti', () => {
  const onSave = jest.fn();
  render(<Prova onSave={onSave} />);
  avanti();
  fireEvent.click(screen.getByRole('radio', { name: '3/4' }));
  expect(screen.getByText('Manca: km')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(/km alla consegna/i), { target: { value: '45000' } });
  expect(screen.queryByText(/^Manca:/)).toBeNull();
  avanti();
  expect(onSave).toHaveBeenCalledTimes(1);
});

test('porta lo sguardo sul primo campo mancante (carburante)', () => {
  const scorri = jest.fn();
  Element.prototype.scrollIntoView = scorri;
  render(<Prova onSave={jest.fn()} />);
  avanti();
  expect(scorri).toHaveBeenCalled();
  expect(document.activeElement).toBe(screen.getByRole('radio', { name: '1/4' }));
});
