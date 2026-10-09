import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ControlloDotazione from './ControlloDotazione';
import { dotazioneIniziale } from '../utils/dotazione';

const conStato = (veicolo, extra = {}) => {
  let d = dotazioneIniziale(veicolo);
  const props = () => ({ dotazione: d, onChange: (n) => { d = n; rerender(<ControlloDotazione {...props()} />); }, veicolo, dataRitiro: '2026-12-10', ...extra });
  const { rerender } = render(<ControlloDotazione {...props()} />);
  return () => d;
};

test('auto con dotazione: tutto spuntato, togliendo la spunta diventa MANCA', () => {
  const stato = conStato({ dotazione: ['Cric', 'Catene da neve'], chiavi: 2 });
  expect(screen.getAllByText("C'è")).toHaveLength(2);
  fireEvent.click(screen.getByRole('checkbox', { name: /Cric/ }));
  expect(screen.getByText('MANCA')).toBeInTheDocument();
  expect(stato().presenti).toEqual(['Catene da neve']);
  expect(screen.getByText("L'auto ne ha 2")).toBeInTheDocument();
  // Con le catene a bordo nessun avviso invernale.
  expect(screen.queryByText(/Dal 15 novembre al 15 aprile/)).toBeNull();
});

test('in inverno senza catene ne\' gomme invernali: avviso', () => {
  conStato({ dotazione: ['Cric'] });
  expect(screen.getByText(/Dal 15 novembre al 15 aprile/)).toBeInTheDocument();
});

test('auto senza dotazione: lista base vuota, Salva come dotazione gia\' spuntato, chiavi da scegliere', () => {
  const stato = conStato({});
  expect(screen.getByText(/Dotazione di questa auto non impostata/)).toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: /Salva come dotazione/ })).toBeChecked();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Cric' }));
  fireEvent.click(screen.getByRole('button', { name: '1' }));
  expect(stato()).toMatchObject({ presenti: ['Cric'], chiaviConsegnate: 1, salvaComeDotazione: true });
});

test('ricorda gli extra noleggiati da dare a parte', () => {
  conStato({ dotazione: [] }, { extra: [{ id: 's', nome: 'Seggiolino', quantita: 1 }] });
  expect(screen.getByText(/Seggiolino × 1/)).toBeInTheDocument();
});
