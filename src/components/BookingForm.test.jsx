import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import BookingForm from './BookingForm';

jest.mock('react-redux', () => ({ useDispatch: () => jest.fn() }));
// Il calendario delle date non serve qui (e date-fns/locale non si carica in jest).
jest.mock('date-fns/locale', () => ({ it: {} }));
jest.mock('react-datepicker', () => ({ selected, placeholderText }) => (
  <input readOnly placeholder={placeholderText} value={selected ? selected.toISOString().slice(0, 10) : ''} />
));
jest.mock('../lib/firestoreClienti', () => ({
  creaCliente: jest.fn(),
  messaggioErroreCliente: () => 'errore',
  normalizzaCodiceFiscale: (cf) => String(cf || '').trim().toUpperCase(),
}));
jest.mock('../lib/firestorePrenotazioni', () => ({
  STATI_PRENOTAZIONE_NON_CONFERMATE: ['richiesta-sito', 'scaduta', 'pagamento-fallito'],
}));

const veicoli = [
  { id: 'v1', marca: 'Fiat', modello: 'Panda', targa: 'ABC004', categoria: 'Utilitaria', prezzo: 35 },
  { id: 'v2', marca: 'Fiat', modello: 'Ducato', targa: 'AB123TR', categoria: 'Furgone', prezzo: 70 },
];
const clienti = [
  { id: 'c1', nome: 'Mario', cognome: 'Rossi', cellulare: '333 1111111', email: 'mario@rossi.it', codiceFiscale: 'RSSMRA80A01H501U', patente: 'AB12' },
];
// Una prenotazione che occupa il Ducato in quei giorni.
const prenotazioni = [
  { id: 'p9', targa: 'AB123TR', status: 'attiva', dataInizio: '2099-03-12', dataFine: '2099-03-14' },
];

const apri = (initialValues = { dataInizio: '2099-03-10' }) => {
  const onSubmit = jest.fn();
  render(
    <BookingForm
      onSubmit={onSubmit}
      onAnnulla={jest.fn()}
      initialValues={initialValues}
      availableVehicles={veicoli}
      veicoli={veicoli}
      clienti={clienti}
      prenotazioni={prenotazioni}
    />,
  );
  return onSubmit;
};

test('tre passi in ordine: quando, quale auto, chi (cliente nuovo con nome e telefono)', () => {
  const onSubmit = apri();
  // 1. Durata rapida dal giorno arrivato dal calendario.
  fireEvent.click(screen.getByRole('button', { name: '1 settimana' }));
  expect(screen.getAllByText('7 giorni').length).toBeGreaterThan(0);

  // 2. Il Ducato e' occupato in quelle date: non si vede, la Panda si'.
  expect(screen.queryByRole('radio', { name: /Ducato/ })).toBeNull();
  fireEvent.click(screen.getByRole('radio', { name: /Panda/ }));
  expect(screen.getByText('€ 245 in tutto')).toBeInTheDocument();

  // 3. Cliente nuovo: bastano nome e telefono.
  fireEvent.click(screen.getByRole('button', { name: /cliente nuovo/ }));
  fireEvent.change(screen.getByLabelText('Nome e cognome'), { target: { value: '  Luca   Neri ' } });
  fireEvent.change(screen.getByLabelText('Telefono'), { target: { value: '333 2222222' } });
  fireEvent.click(screen.getByRole('button', { name: 'Conferma prenotazione' }));

  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    dataInizio: '2099-03-10', dataFine: '2099-03-17', targa: 'ABC004', veicolo: 'Panda', prezzoGiornaliero: '35',
    cliente: 'Luca Neri', telefono: '333 2222222', codiceFiscale: '', patente: '',
  }));
});

test('cliente gia\' in anagrafica: si cerca e porta con se\' contatti e documenti', () => {
  const onSubmit = apri({ dataInizio: '2099-03-10', dataFine: '2099-03-11', targa: 'ABC004' });
  fireEvent.change(screen.getByPlaceholderText(/Rossi/), { target: { value: 'ross' } });
  fireEvent.mouseDown(screen.getByRole('option', { name: /Mario Rossi/ }));
  expect(screen.getByText('Documenti completi')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Conferma prenotazione' }));
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    cliente: 'Mario Rossi', telefono: '333 1111111', emailCliente: 'mario@rossi.it',
    codiceFiscale: 'RSSMRA80A01H501U', patente: 'AB12', prezzoGiornaliero: '35',
  }));
});

test('ricerca cliente: tendina con frecce e Invio, senza confermare la prenotazione', () => {
  const onSubmit = apri({ dataInizio: '2099-03-10', dataFine: '2099-03-11', targa: 'ABC004' });
  const campo = screen.getByRole('combobox');
  fireEvent.change(campo, { target: { value: 'mario' } });
  expect(screen.getByRole('listbox')).toBeInTheDocument();
  fireEvent.keyDown(campo, { key: 'Enter' });
  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(screen.getByText('Documenti completi')).toBeInTheDocument();
});

test('nessun cliente trovato: si aggiunge come nuovo con il nome gia\' scritto', () => {
  apri();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Anna Verdi' } });
  expect(screen.getByText(/Nessun cliente trovato/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Aggiungi «Anna Verdi» come cliente nuovo/ }));
  expect(screen.getByLabelText('Nome e cognome')).toHaveValue('Anna Verdi');
});

test('se manca qualcosa non salva e dice cosa manca', () => {
  const onSubmit = apri({});
  fireEvent.click(screen.getByRole('button', { name: 'Conferma prenotazione' }));
  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.getByText(/Manca ancora: giorno di uscita, giorno di rientro, auto, cliente/)).toBeInTheDocument();
});

test('un\'auto ancora dal cliente oltre la data di fine ha l\'avviso "non ancora rientrata"', () => {
  const inRitardo = { id: 'r1', targa: 'ABC004', status: 'attiva', dataInizio: '2020-01-01', dataFine: '2020-01-05', consegnataIl: '2020-01-01T09:00:00Z' };
  render(
    <BookingForm onSubmit={jest.fn()} initialValues={{}} availableVehicles={veicoli} veicoli={veicoli} clienti={[]} prenotazioni={[inRitardo]} />,
  );
  expect(screen.getByText(/Non rientrata \(doveva il 05\/01\)/)).toBeInTheDocument();
});

test('dice se e\' stato toccato (per chiedere conferma solo se c\'e\' qualcosa da perdere)', () => {
  const onModificato = jest.fn();
  render(
    <BookingForm onSubmit={jest.fn()} initialValues={{ dataInizio: '2099-03-10' }} availableVehicles={veicoli} veicoli={veicoli}
      clienti={[]} prenotazioni={[]} onModificato={onModificato} />,
  );
  // Aperto dal calendario con il giorno gia' scelto: non e' una modifica.
  expect(onModificato).toHaveBeenLastCalledWith(false);
  fireEvent.click(screen.getByRole('button', { name: '1 giorno' }));
  expect(onModificato).toHaveBeenLastCalledWith(true);
});

describe('domanda 4: protezione ed extra', () => {
  const protezioni = {
    Utilitaria: {
      base: { danni: 1200, furto: 1500, cauzione: 500 },
      totale: { offerta: true, prezzoGiorno: 12, massimo: 120, danni: 0, furto: 300, cauzione: 200, copre: { cristalli: true, gomme: true, sottoscocca: false } },
    },
  };
  const catalogo = [
    { id: 's', nome: 'Seggiolino', descrizione: '', modo: 'giorno', prezzo: 8, massimo: 60, maxPerNoleggio: 2, pezzi: 3, sulSito: true },
    { id: 'g', nome: 'Navigatore', descrizione: '', modo: 'giorno', prezzo: 5, massimo: null, maxPerNoleggio: 1, pezzi: null, sulSito: false },
  ];
  const apriCon = (initialValues, altre = []) => {
    const onSubmit = jest.fn();
    render(
      <BookingForm onSubmit={onSubmit} initialValues={initialValues} availableVehicles={veicoli} veicoli={veicoli}
        clienti={clienti} prenotazioni={altre} protezioni={protezioni} catalogo={catalogo} />,
    );
    return onSubmit;
  };
  const scelta = { dataInizio: '2099-03-10', dataFine: '2099-03-13', targa: 'ABC004', cliente: 'Mario Rossi', telefono: '333 1111111' };

  test('Totale e un seggiolino: righe nel riepilogo, cauzione e scelte inviate', () => {
    const onSubmit = apriCon(scelta);
    expect(screen.getByText('Cauzione da bloccare al ritiro').closest('.px-cauzione')).toHaveTextContent('500 €');
    fireEvent.click(screen.getByRole('radio', { name: /Totale/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi Seggiolino' }));
    expect(screen.getByText('Seggiolino × 1')).toBeInTheDocument();
    // 3 giorni x 35 + Totale 36 + seggiolino 24
    expect(screen.getByText('165,00 €')).toBeInTheDocument();
    expect(screen.getByText(/non paga nulla/)).toBeInTheDocument();
    expect(screen.getByText('Solo al banco')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Conferma prenotazione' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ sceltaProtezione: 'totale', sceltaOptional: { s: 1 } }));
  });

  test('pezzi gia\' presi in quelle date: il + si ferma ai liberi', () => {
    const altra = { id: 'p1', targa: 'AB123TR', status: 'attiva', dataInizio: '2099-03-11', dataFine: '2099-03-12', optional: [{ id: 's', quantita: 2 }] };
    apriCon(scelta, [altra]);
    expect(screen.getByText('1 libero in queste date (3 in tutto)')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi Seggiolino' }));
    expect(screen.getByRole('button', { name: 'Aggiungi Seggiolino' })).toBeDisabled();
  });

  test('categoria senza protezione: avviso, si prenota lo stesso', () => {
    apriCon({ ...scelta, targa: 'AB123TR' });
    expect(screen.getByText(/Furgone: protezione e cauzione non impostate/)).toBeInTheDocument();
  });

  test('pagata sul sito: si vede cosa ha scelto il cliente, non si cambia', () => {
    apriCon({
      ...scelta, id: 'w1', origine: 'sito', paymentIntentId: 'pi_1', status: 'attiva', totale: 99,
      protezione: { tipo: 'base', prezzo: 0, danni: 1200, furto: 1500, cauzione: 500 },
      optional: [{ id: 's', nome: 'Seggiolino', quantita: 1, totale: 24 }],
    });
    expect(screen.getByText(/Scelti e pagati dal cliente sul sito/)).toBeInTheDocument();
    expect(screen.getByText('Seggiolino × 1')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Totale/ })).toBeNull();
    expect(screen.getByText('Cauzione da bloccare al ritiro').closest('.px-cauzione')).toHaveTextContent('500 €');
  });
});
