import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SospendiVeicoloModal from './SospendiVeicoloModal';

const veicoli = [
  { id: 'v1', marca: 'Fiat', modello: 'Panda', targa: 'AA111AA', categoria: 'City Car' },
  { id: 'v2', marca: 'Citroen', modello: 'C3', targa: 'BB222BB', categoria: 'City Car' },
];
const prenotazioni = [
  { id: 'p1', status: 'attiva', targa: 'AA111AA', cliente: 'Mario Rossi', dataInizio: '2026-10-10', dataFine: '2026-10-12' },
  { id: 'p2', status: 'attiva', targa: 'BB222BB', cliente: 'Anna Verdi', dataInizio: '2026-10-11', dataFine: '2026-10-13' },
];

const monta = (extra = {}) => render(
  <SospendiVeicoloModal
    isOpen
    veicolo={veicoli[0]}
    veicoli={veicoli}
    prenotazioni={prenotazioni}
    holds={[]}
    oggi="2026-10-01"
    onCancel={jest.fn()}
    onConfirm={jest.fn().mockResolvedValue()}
    {...extra}
  />
);

test('mostra cosa succede: prenotazione da riassegnare e giorni in sovraprenotazione', () => {
  monta();
  expect(screen.getByText(/1 prenotazione ha questa targa/)).toBeTruthy();
  expect(screen.getByText(/Mario Rossi/)).toBeTruthy();
  expect(screen.getByText(/2 impegni, 1 auto noleggiabile/)).toBeTruthy();
});

test('senza impegni non mostra avvisi', () => {
  monta({ prenotazioni: [] });
  expect(screen.queryByText(/ha questa targa/)).toBeNull();
  expect(screen.queryByText(/più impegni/)).toBeNull();
});

test('conferma passa il motivo scritto', async () => {
  const onConfirm = jest.fn().mockResolvedValue();
  monta({ onConfirm });
  fireEvent.change(screen.getByPlaceholderText(/incidente/), { target: { value: 'incidente' } });
  fireEvent.click(screen.getByText('Sospendi dal noleggio'));
  await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('incidente'));
});
