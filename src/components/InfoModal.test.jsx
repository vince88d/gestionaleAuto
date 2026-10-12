import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import InfoModal from './InfoModal';

// Il modale non deve generare PDF in questo test.
jest.mock('jspdf', () => jest.fn());
jest.mock('html2canvas', () => jest.fn());
jest.mock('../utils/pdfRientro', () => ({
  ...jest.requireActual('../utils/pdfRientro'),
  salvaVerbaleRientro: jest.fn(),
}));

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

test('consegne di prima con gli accessori: solo quelli presenti, non quelli spenti', () => {
  const conScheda = {
    ...prenotazioneDalSito,
    schedaVeicolo: { accessori: { cric: true, triangolo: false, altro: '' } },
  };
  render(<InfoModal isOpen prenotazione={conScheda} {...azioni} />);
  expect(screen.getAllByText('Dotazione a bordo').length).toBeGreaterThan(0);
  expect(screen.getAllByText('✓ Cric').length).toBeGreaterThan(0);
  expect(screen.queryByText(/Triangolo/)).toBeNull();
});

test('dotazione alla consegna: presenti, mancanti, chiavi e nota', () => {
  const conScheda = {
    ...prenotazioneDalSito,
    consegnataIl: '2026-10-01T09:00:00Z',
    schedaVeicolo: { kmIniziali: '1000', dotazione: { voci: ['Cric', 'Cavo di ricarica'], presenti: ['Cric'], impostata: true, chiaviConsegnate: 2, note: 'in officina' } },
  };
  render(<InfoModal isOpen prenotazione={conScheda} {...azioni} />);
  expect(screen.getAllByText('Mancava: Cavo di ricarica').length).toBeGreaterThan(0);
  expect(screen.getAllByText(/in officina/).length).toBeGreaterThan(0);
});

test('veicolo assegnato ma non consegnato: prossimo passo "Consegna l\'auto", non "Ricevi"', () => {
  const onConsegna = jest.fn();
  const assegnata = { ...prenotazioneDalSito, targa: 'AA111AA', veicolo: 'Fiat Panda' };
  render(<InfoModal isOpen prenotazione={assegnata} {...azioni} onConsegna={onConsegna} />);
  expect(screen.getByText('Prossimo passo')).toBeTruthy();
  screen.getByRole('button', { name: /Consegna l'auto/ }).click();
  expect(onConsegna).toHaveBeenCalledWith(assegnata);
  expect(screen.queryByRole('button', { name: /Ricevi l'auto/ })).toBeNull();
});

test('prenotazione del sito senza auto: prossimo passo "Scegli l\'auto", categoria pagata', () => {
  const onScegliAuto = jest.fn();
  render(<InfoModal isOpen prenotazione={prenotazioneDalSito} {...azioni} onConsegna={jest.fn()} onScegliAuto={onScegliAuto} />);
  expect(screen.getByText('Categoria pagata')).toBeTruthy();
  expect(screen.getAllByText('Auto da scegliere').length).toBeGreaterThan(0);
  screen.getByRole('button', { name: /Scegli l'auto/ }).click();
  expect(onScegliAuto).toHaveBeenCalledWith(prenotazioneDalSito);
  expect(screen.queryByRole('button', { name: /Consegna l'auto/ })).toBeNull();
});

test('in sola lettura (archivio) nessun prossimo passo', () => {
  render(<InfoModal isOpen prenotazione={prenotazioneDalSito} onClose={jest.fn()} soloLettura />);
  expect(screen.queryByText('Prossimo passo')).toBeNull();
});

test('dopo la consegna: "Ricevi l\'auto" e i km alla consegna', () => {
  const consegnata = {
    ...prenotazioneDalSito, targa: 'AA111AA', veicolo: 'Fiat Panda',
    consegnataIl: '2026-10-10T09:00:00.000Z', schedaVeicolo: { kmIniziali: '45000', carburante: 'Pieno' },
  };
  render(<InfoModal isOpen prenotazione={consegnata} {...azioni} onConsegna={jest.fn()} />);
  expect(screen.getByRole('button', { name: /Ricevi l'auto/ })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Consegna l'auto/ })).toBeNull();
  expect(screen.getByText('45.000')).toBeTruthy();
});

// «Email consegna» / «Email rientro»: salva il PDF, mostra il file e apre la bozza.
describe('email di riepilogo', () => {
  const rientrata = {
    ...prenotazioneDalSito, status: 'completata', emailCliente: 'mario@example.it', veicolo: 'Fiat Panda', targa: 'AA111AA',
    consegnataIl: '2026-10-10T08:00:00.000Z', schedaVeicolo: { kmIniziali: '1000', carburante: 'Pieno' },
    rientro: { dataRientro: '2026-10-12', oraRientro: '09:00', km: 1200, kmConsegna: 1000, carburante: 'Pieno', addebiti: [], totaleAddebiti: 0 },
  };

  afterEach(() => { delete window.electronAPI; });

  const apriMenuInvia = () => fireEvent.click(screen.getByRole('button', { name: /invia riepilogo/i }));

  test('«Invia riepilogo» è il pulsante principale solo se non c\'è un prossimo passo', () => {
    window.electronAPI = { salvaDocumentiPrenotazione: jest.fn(), apriBozzaEmail: jest.fn() };
    const { unmount } = render(<InfoModal isOpen prenotazione={rientrata} {...azioni} />);
    expect(screen.getByRole('button', { name: /invia riepilogo/i })).toHaveClass('vd-btn--primario');
    unmount();
    const inCorso = { ...rientrata, status: 'attiva', rientro: undefined, veicolo: 'Fiat Panda', targa: 'AA111AA' };
    render(<InfoModal isOpen prenotazione={inCorso} {...azioni} />);
    expect(screen.getByRole('button', { name: /ricevi l'auto/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /invia riepilogo/i })).not.toHaveClass('vd-btn--primario');
  });

  test('copia il testo del rientro negli appunti, senza «in allegato»', async () => {
    window.electronAPI = { salvaDocumentiPrenotazione: jest.fn(), apriBozzaEmail: jest.fn() };
    const scrivi = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: scrivi } });
    render(<InfoModal isOpen prenotazione={rientrata} {...azioni} />);
    apriMenuInvia();
    fireEvent.click(within(screen.getByRole('group', { name: /copia il testo/i })).getByRole('menuitem', { name: /rientro/i }));
    await waitFor(() => expect(scrivi).toHaveBeenCalled());
    expect(scrivi.mock.calls[0][0]).toContain('IL RIENTRO');
    expect(scrivi.mock.calls[0][0]).not.toContain('In allegato');
  });

  test('il menu Documenti: rientro non ancora avvenuto è disattivato; Esc chiude il menu', () => {
    window.electronAPI = { salvaDocumentiPrenotazione: jest.fn(), apriBozzaEmail: jest.fn() };
    render(<InfoModal isOpen prenotazione={{ ...rientrata, rientro: undefined, status: 'attiva' }} {...azioni} />);
    fireEvent.click(screen.getByRole('button', { name: /^documenti/i }));
    expect(screen.getByRole('menuitem', { name: /verbale di rientro/i })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  test('rientro: salva il PDF, poi apre la bozza con il file da mostrare', async () => {
    const { salvaVerbaleRientro } = require('../utils/pdfRientro');
    salvaVerbaleRientro.mockResolvedValue({ success: true, paths: ['/tmp/Verbale_rientro.pdf'] });
    window.electronAPI = { salvaDocumentiPrenotazione: jest.fn(), apriBozzaEmail: jest.fn().mockResolvedValue({ success: true }) };
    render(<InfoModal isOpen prenotazione={rientrata} {...azioni} />);
    apriMenuInvia();
    fireEvent.click(within(screen.getByRole('group', { name: 'Per email' })).getByRole('menuitem', { name: /rientro/i }));
    await waitFor(() => expect(window.electronAPI.apriBozzaEmail).toHaveBeenCalled());
    const dati = window.electronAPI.apriBozzaEmail.mock.calls[0][0];
    expect(dati).toMatchObject({ to: 'mario@example.it', subject: 'Verbale di rientro - Fiat Panda AA111AA', mostraFile: '/tmp/Verbale_rientro.pdf' });
    expect(dati.body).toContain('Chilometri: 1000 → 1200 (200 km percorsi)');
  });

  test('se il salvataggio del PDF e\' annullato l\'email non si apre', async () => {
    const { salvaVerbaleRientro } = require('../utils/pdfRientro');
    salvaVerbaleRientro.mockResolvedValue({ success: false, cancelled: true });
    window.electronAPI = { salvaDocumentiPrenotazione: jest.fn(), apriBozzaEmail: jest.fn() };
    render(<InfoModal isOpen prenotazione={rientrata} {...azioni} />);
    apriMenuInvia();
    fireEvent.click(within(screen.getByRole('group', { name: 'Per email' })).getByRole('menuitem', { name: /rientro/i }));
    await waitFor(() => expect(salvaVerbaleRientro).toHaveBeenCalled());
    expect(window.electronAPI.apriBozzaEmail).not.toHaveBeenCalled();
  });
});
