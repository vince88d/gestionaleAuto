import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
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
// Orari della sede: quelli di partenza (lun-ven 8:30-13 / 15-19:30, dom chiuso), tolleranza 29.
jest.mock('../lib/firestoreOrari', () => {
  const { normalizzaOrari } = jest.requireActual('../utils/orari');
  const orari = normalizzaOrari(undefined);
  return { useOrari: () => orari };
});
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
    dataInizio: '2099-03-10', dataFine: '2099-03-17', oraInizio: '09:00', oraFine: '09:00', tolleranzaMinuti: 29,
    targa: 'ABC004', veicolo: 'Panda', prezzoGiornaliero: '35',
    cliente: 'Luca Neri', telefono: '333 2222222', codiceFiscale: '', patente: '',
  }));
});

test('ora di uscita e rientro: proposta alle 9:00, avvisi fuori orario e giorno in piu\'', () => {
  apri({ dataInizio: '2099-03-10', dataFine: '2099-03-13' }); // martedi' -> venerdi'
  expect(screen.getByLabelText('Ora di uscita')).toHaveValue('09:00');
  expect(screen.getByLabelText('Ora di rientro')).toHaveValue('09:00');
  expect(screen.getAllByText('3 giorni').length).toBeGreaterThan(0);

  // Entro la tolleranza (29 minuti) non cambia nulla.
  fireEvent.change(screen.getByLabelText('Ora di rientro'), { target: { value: '09:00' } });
  expect(screen.queryByRole('status')).toBeNull();

  // Menu corto (8:30-19:30): la pausa si vede grigia e non si sceglie, le 20:00 non ci sono...
  expect(screen.getAllByRole('option', { name: '14:00 · chiuso' })[1]).toBeDisabled();
  expect(screen.queryByRole('option', { name: '20:00 · chiuso' })).toBeNull();
  // ...finche' non si chiede "Orario fuori apertura" (per il rientro).
  fireEvent.click(screen.getAllByRole('button', { name: 'Orario fuori apertura' })[1]);
  expect(screen.getByRole('option', { name: '20:00 · chiuso' })).toBeEnabled();
  expect(screen.getAllByRole('option', { name: '14:00 · chiuso' })[0]).toBeDisabled(); // l'uscita no

  // Alle 20:00 la sede e' chiusa e si conta un giorno in piu'.
  fireEvent.change(screen.getByLabelText('Ora di rientro'), { target: { value: '20:00' } });
  expect(screen.getAllByText('4 giorni').length).toBeGreaterThan(0);
  expect(screen.getByText(/Venerdì 13 alle 20:00 la sede è chiusa \(aperta 8:30–13:00 \/ 15:00–19:30\)\./)).toBeInTheDocument();
  expect(screen.getByText(/si contano 4 giorni \(rientrando entro le 9:29 sarebbero 3\)/)).toBeInTheDocument();
  expect(screen.getByText(/da mar 10 marzo alle 9:00 a ven 13 marzo alle 20:00 · 4 giorni/)).toBeInTheDocument();

  // Il pulsante riporta il rientro all'ora dell'uscita.
  fireEvent.click(screen.getByRole('button', { name: 'Rientro alle 9:00' }));
  expect(screen.getByLabelText('Ora di rientro')).toHaveValue('09:00');
  expect(screen.queryByRole('status')).toBeNull();

  // Si torna alle sole ore di apertura.
  fireEvent.click(screen.getByRole('button', { name: 'Solo orari di apertura' }));
  expect(screen.getAllByRole('button', { name: 'Orario fuori apertura' })).toHaveLength(2);
  expect(screen.getAllByRole('option', { name: '14:00 · chiuso' })[1]).toBeDisabled();
});

test('prenotazione salvata fuori apertura: l\'ora resta e si puo\' ancora scegliere', () => {
  apri({ id: 'x2', dataInizio: '2099-03-10', dataFine: '2099-03-13', oraInizio: '09:00', oraFine: '20:00', targa: 'ABC004', cliente: 'Mario Rossi', telefono: '1' });
  expect(screen.getByLabelText('Ora di rientro')).toHaveValue('20:00');
  expect(screen.getByText(/Fuori apertura, d'accordo con il cliente/)).toBeInTheDocument();
  expect(screen.getAllByText('4 giorni').length).toBeGreaterThan(0);
});

test('prenotazione di prima, senza ore: "—" e giorni contati per data', () => {
  apri({ id: 'x1', dataInizio: '2099-03-10', dataFine: '2099-03-13', targa: 'ABC004', cliente: 'Mario Rossi', telefono: '1' });
  expect(screen.getByLabelText('Ora di uscita')).toHaveValue('');
  expect(screen.getAllByText('3 giorni').length).toBeGreaterThan(0);
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
  const campo = screen.getByPlaceholderText(/Rossi/);
  fireEvent.change(campo, { target: { value: 'mario' } });
  expect(screen.getByRole('listbox')).toBeInTheDocument();
  fireEvent.keyDown(campo, { key: 'Enter' });
  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(screen.getByText('Documenti completi')).toBeInTheDocument();
});

test('nessun cliente trovato: si aggiunge come nuovo con il nome gia\' scritto', () => {
  apri();
  fireEvent.change(screen.getByPlaceholderText(/Rossi/), { target: { value: 'Anna Verdi' } });
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
    expect(screen.getAllByText('Seggiolino × 1').length).toBeGreaterThan(0); // riga prezzo e riquadro «Protezione ed extra»
    // 3 giorni x 35 + Totale 36 + seggiolino 24
    expect(screen.getByText('165,00 €')).toBeInTheDocument();
    expect(screen.getByText(/non paga nulla/)).toBeInTheDocument();
    expect(screen.getByText(/Non è un costo:/)).toBeInTheDocument(); // la cauzione e' una garanzia
    expect(screen.getByText(/Franchigia: la parte che il cliente paga in caso di danno/)).toBeInTheDocument();
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

describe('eta\' del conducente', () => {
  const etaConducenti = {
    attivo: true, etaMinima: 18, etaMassima: 70, fasce: [{ finoA: 20, euroGiorno: 25 }, { finoA: 24, euroGiorno: 15 }], massimo: 300,
  };
  const scelta = { dataInizio: '2099-03-10', dataFine: '2099-03-13', targa: 'ABC004', cliente: 'Mario Rossi', telefono: '333 1111111' };
  const apriCon = (initialValues, eta = etaConducenti) => {
    const onSubmit = jest.fn();
    render(
      <BookingForm onSubmit={onSubmit} initialValues={initialValues} availableVehicles={veicoli} veicoli={veicoli}
        clienti={clienti} prenotazioni={[]} etaConducenti={eta} />,
    );
    return onSubmit;
  };

  test('22 anni: riga «Giovane conducente» nel riepilogo, totale ed eta\' inviata', () => {
    const onSubmit = apriCon(scelta);
    const campo = screen.getByLabelText('Età del conducente');
    expect(campo).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Dai 25 ai 70 anni (nessun supplemento)' })).toBeInTheDocument();
    fireEvent.change(campo, { target: { value: '22' } });
    expect(screen.getByText('22 anni · 15 € × 3 giorni')).toBeInTheDocument();
    // 3 giorni x 35 + 45
    expect(screen.getByText('150,00 €')).toBeInTheDocument();
    expect(screen.getByText(/controlla la data di nascita sulla patente/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Conferma prenotazione' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ etaConducente: '22' }));
  });

  test('oltre l\'eta\' massima: avviso, si prenota senza eta\'', () => {
    const onSubmit = apriCon(scelta);
    fireEvent.change(screen.getByLabelText('Età del conducente'), { target: { value: 'oltre' } });
    expect(screen.getByText(/Oltre l'età massima che hai impostato \(70 anni\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Conferma prenotazione' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ etaConducente: '' }));
  });

  test('nessuna regola sull\'eta\': la domanda non c\'e\'', () => {
    apriCon(scelta, { attivo: false, etaMinima: 18, etaMassima: null, fasce: [], massimo: null });
    expect(screen.queryByLabelText('Età del conducente')).toBeNull();
  });

  test('pagata sul sito: eta\' bloccata e non inviata', () => {
    const onSubmit = apriCon({
      ...scelta, id: 'w1', origine: 'sito', paymentIntentId: 'pi_1', status: 'attiva', totale: 150,
      etaConducente: 22, giovaneConducente: { eta: 22, euroGiorno: 15, giorni: 3, importo: 45, alMassimo: false },
    });
    expect(screen.getByLabelText('Età del conducente')).toBeDisabled();
    expect(screen.getByLabelText('Età del conducente')).toHaveValue('22');
    fireEvent.click(screen.getByRole('button', { name: 'Salva modifiche' }));
    expect(onSubmit.mock.calls[0][0].etaConducente).toBeUndefined();
  });
});

describe('protezione ed extra: non dimenticarli', () => {
  const protezioni = {
    Utilitaria: {
      base: { danni: 1200, furto: 1500, cauzione: 500 },
      totale: { offerta: true, prezzoGiorno: 12, massimo: 120, danni: 0, furto: 300, cauzione: 200, copre: { cristalli: true, gomme: true, sottoscocca: false } },
    },
  };
  const catalogo = [{ id: 's', nome: 'Seggiolino', descrizione: '', modo: 'giorno', prezzo: 8, massimo: 60, maxPerNoleggio: 2, pezzi: 3, sulSito: true }];
  const scelta = { dataInizio: '2099-03-10', dataFine: '2099-03-13', targa: 'ABC004', cliente: 'Mario Rossi', telefono: '333 1111111' };
  let osservatore;
  const vistaSezione4 = (altezza) => osservatore({ intersectionRect: { height: altezza } });
  const apri = (initialValues = scelta, extra = {}) => {
    const onSubmit = jest.fn();
    render(
      <BookingForm onSubmit={onSubmit} initialValues={initialValues} availableVehicles={veicoli} veicoli={veicoli}
        clienti={clienti} prenotazioni={[]} protezioni={protezioni} catalogo={catalogo} {...extra} />,
    );
    return onSubmit;
  };

  beforeEach(() => {
    global.IntersectionObserver = class {
      constructor(callback) { osservatore = (voce) => act(() => callback([voce])); }
      observe() {}
      disconnect() {}
    };
    Element.prototype.scrollIntoView = jest.fn();
  });
  afterEach(() => { delete global.IntersectionObserver; delete Element.prototype.scrollIntoView; });

  test('finche\' non e\' guardata, il Riepilogo dice «da controllare» e compare la pillola', () => {
    apri();
    const riquadro = screen.getByText('da controllare', { selector: '.np-scelte-titolo span' }).closest('.np-scelte');
    expect(riquadro).toHaveTextContent('Base · inclusa');
    expect(riquadro).toHaveTextContent('nessuno');
    expect(screen.getByRole('button', { name: /Passo 4: protezione ed extra/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Protezione ed extra · da controllare/ })).toBeInTheDocument();
  });

  test('quando la sezione 4 entra nello schermo la pillola sparisce e le scelte risultano viste', () => {
    apri();
    vistaSezione4(300);
    expect(screen.queryByRole('button', { name: /Passo 4: protezione ed extra/ })).toBeNull();
    expect(screen.getByText('scelti', { selector: '.np-scelte-titolo span' })).toBeInTheDocument();
  });

  test('«Cambia» e la pillola portano alla sezione 4', () => {
    apri();
    fireEvent.click(screen.getAllByRole('button', { name: 'Cambia' })[0]);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Passo 4: protezione ed extra/ }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(2);
  });

  test('«Conferma» senza aver guardato la sezione 4 chiede una volta, con il testo delle scelte', () => {
    const onSubmit = apri();
    fireEvent.click(screen.getByRole('button', { name: 'Conferma prenotazione' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Confermi così?')).toBeInTheDocument();
    expect(screen.getByText(/Protezione Base \(cauzione 500 €\) e nessun extra/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sì, conferma' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  test('«Controlla» chiude l\'avviso e porta alla sezione 4', () => {
    const onSubmit = apri();
    fireEvent.click(screen.getByRole('button', { name: 'Conferma prenotazione' }));
    fireEvent.click(screen.getByRole('button', { name: 'Controlla' }));
    expect(screen.queryByText('Confermi così?')).toBeNull();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test('se la sezione 4 e\' stata vista, «Conferma» salva subito', () => {
    const onSubmit = apri();
    vistaSezione4(300);
    fireEvent.click(screen.getByRole('button', { name: 'Conferma prenotazione' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  test('toccando una scelta (Totale) vale come vista', () => {
    const onSubmit = apri();
    fireEvent.click(screen.getByRole('radio', { name: /Totale/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Conferma prenotazione' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  test('in modifica le scelte ci sono gia\': niente avviso', () => {
    const onSubmit = apri({ ...scelta, id: 'p1' });
    fireEvent.click(screen.getByRole('button', { name: 'Salva modifiche' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  test('senza nulla da scegliere (categoria senza protezione e senza extra) non c\'e\' riquadro ne\' avviso', () => {
    const onSubmit = jest.fn();
    render(<BookingForm onSubmit={onSubmit} initialValues={scelta} availableVehicles={veicoli} veicoli={veicoli} clienti={clienti} prenotazioni={[]} protezioni={{}} catalogo={[]} />);
    expect(screen.queryByText('Protezione ed extra', { selector: '.np-scelte-titolo span' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Conferma prenotazione' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe('prenota e consegna ora (cliente in ufficio)', () => {
  const { giornoLocale } = jest.requireActual('../utils/scadenze');
  const compila = () => {
    fireEvent.click(screen.getByRole('button', { name: '1 settimana' }));
    fireEvent.click(screen.getByRole('radio', { name: /Panda/ }));
    fireEvent.click(screen.getByRole('button', { name: /cliente nuovo/ }));
    fireEvent.change(screen.getByLabelText('Nome e cognome'), { target: { value: 'Luca Neri' } });
    fireEvent.change(screen.getByLabelText('Telefono'), { target: { value: '333 2222222' } });
  };

  test('ritiro in un altro giorno: un solo pulsante, come prima', () => {
    apri({ dataInizio: '2099-03-10' });
    compila();
    expect(screen.queryByRole('button', { name: 'Prenota e consegna ora' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Solo prenota' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Conferma prenotazione' })).toBeInTheDocument();
  });

  test('ritiro oggi con l\'auto scelta: due pulsanti', () => {
    const onSubmit = apri({ dataInizio: giornoLocale() });
    // senza auto scelta la consegna subito non c'e'
    expect(screen.queryByRole('button', { name: 'Prenota e consegna ora' })).toBeNull();
    compila();
    expect(screen.getByText(/Il ritiro è oggi/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Solo prenota' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]).toHaveLength(1); // niente richiesta di consegna

    fireEvent.click(screen.getByRole('button', { name: 'Prenota e consegna ora' }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit.mock.calls[1][1]).toEqual({ consegnaSubito: true });
    expect(onSubmit.mock.calls[1][0]).toMatchObject({ targa: 'ABC004', cliente: 'Luca Neri' });
  });

  test('modifica di una prenotazione salvata: resta «Salva modifiche»', () => {
    apri({ id: 'p1', dataInizio: giornoLocale(), dataFine: giornoLocale(), targa: 'ABC004', veicolo: 'Panda', cliente: 'Luca Neri', telefono: '333 2222222' });
    expect(screen.queryByRole('button', { name: 'Prenota e consegna ora' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Salva modifiche' })).toBeInTheDocument();
  });
});
