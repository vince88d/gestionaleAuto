import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RientroModal from './RientroModal';

const prenotazione = {
  id: 'p1', cliente: 'Mario Rossi', veicolo: 'Fiat Panda', targa: 'AA111AA',
  dataInizio: '2026-10-12', dataFine: '2026-10-15', oraInizio: '09:00', oraFine: '09:00', tolleranzaMinuti: 29,
  prezzoGiornaliero: '25', cauzioneBloccata: true,
  protezione: { tipo: 'base', danni: 1200, furto: 1500, cauzione: 500 },
  optional: [{ id: 's', nome: 'Seggiolino bambino', quantita: 1 }],
  schedaVeicolo: {
    kmIniziali: '48318', carburante: 'Pieno', danni: '',
    dotazione: { voci: ['Cric', 'Triangolo'], presenti: ['Cric', 'Triangolo'], impostata: true, chiaviConsegnate: 2 },
  },
};
const prezzi = { rifornimentoQuarto: 20, pulizia: 30, chiave: 150, oggettoMancante: 15 };

function apri(onConferma = jest.fn().mockResolvedValue(true)) {
  render(<RientroModal isOpen onClose={jest.fn()} onConferma={onConferma} prenotazione={prenotazione} prezzi={prezzi} tolleranza={29} />);
  return onConferma;
}

test('il passo 1 non va avanti senza km, carburante e chiavi', () => {
  apri();
  fireEvent.click(screen.getByRole('button', { name: /Avanti/ }));
  expect(screen.getByText('Scrivi i km del contachilometri.')).toBeInTheDocument();
  expect(screen.getByText('Scegli il livello del carburante.')).toBeInTheDocument();
  expect(screen.getByText('Scegli quante chiavi sono tornate.')).toBeInTheDocument();
});

test('rientro in ritardo, carburante basso e triangolo mancante: addebiti e cauzione trattenuta', async () => {
  const onConferma = apri();
  fireEvent.change(screen.getByLabelText('Data del rientro'), { target: { value: '2026-10-15' } });
  fireEvent.change(screen.getByLabelText('Ora del rientro'), { target: { value: '11:30' } });
  fireEvent.change(screen.getByLabelText(/Km al rientro/), { target: { value: '48730' } });
  fireEvent.click(screen.getByRole('radio', { name: '1/2' }));
  fireEvent.click(screen.getByRole('radio', { name: '2' }));
  fireEvent.click(screen.getByLabelText(/Triangolo/)); // non tornato
  fireEvent.click(screen.getByRole('button', { name: /Avanti/ }));

  expect(await screen.findByText('Totale addebiti')).toBeInTheDocument();
  // ritardo 25 + rifornimento 40 + triangolo 15 = 80
  expect(screen.getAllByText('80,00 €').length).toBeGreaterThan(0);
  expect(screen.getByText('Totale addebiti').parentElement).toHaveTextContent('80,00 €');

  fireEvent.click(screen.getByRole('button', { name: 'Concludi il noleggio' }));
  await waitFor(() => expect(onConferma).toHaveBeenCalled());
  const dati = onConferma.mock.calls[0][0];
  expect(dati).toMatchObject({ km: '48730', carburante: '1/2', chiaviTornate: 2, dotazioneNonTornata: ['Triangolo'], trattieni: 80 });
  expect(dati.righe.filter((r) => r.attiva).map((r) => r.id)).toEqual(['ritardo', 'rifornimento', 'mancante:Triangolo']);
});

test('si puo\' sbloccare tutta la cauzione', async () => {
  const onConferma = apri();
  fireEvent.change(screen.getByLabelText('Data del rientro'), { target: { value: '2026-10-15' } });
  fireEvent.change(screen.getByLabelText('Ora del rientro'), { target: { value: '09:00' } });
  fireEvent.change(screen.getByLabelText(/Km al rientro/), { target: { value: '48400' } });
  fireEvent.click(screen.getByRole('radio', { name: 'Pieno' }));
  fireEvent.click(screen.getByRole('radio', { name: '2' }));
  fireEvent.click(screen.getByRole('button', { name: /Avanti/ }));
  await screen.findByText('Totale addebiti');
  fireEvent.click(screen.getByLabelText('Sblocca tutta la cauzione'));
  fireEvent.click(screen.getByRole('button', { name: 'Concludi il noleggio' }));
  await waitFor(() => expect(onConferma).toHaveBeenCalled());
  expect(onConferma.mock.calls[0][0].trattieni).toBe(0);
});
