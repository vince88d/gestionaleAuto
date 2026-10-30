// Regole del cliente (funzioni pure, testate): controlli prima di salvare e
// preparazione dei dati del form.
import { normalizzaCodiceFiscale } from '../lib/firestoreClienti';

export const TIPI_DOCUMENTO = ['CI', 'Patente', 'Passaporto', 'Permesso di soggiorno', 'Tessera sanitaria', 'Altro'];

// Cliente straniero senza codice fiscale: si riconosce da un codice interno
// (l'id del documento), non dal codice fiscale.
export const senzaCodiceFiscale = (c) => c?.senzaCodiceFiscale === true;

// Numero del documento d'identita' per confronti (maiuscolo, senza spazi).
export const normalizzaDocumento = (valore) => String(valore || '').replace(/\s+/g, '').toUpperCase();

// Dal form ai dati da salvare: codice fiscale in maiuscolo, spazi tolti,
// "Altro" sostituito dal tipo scritto a mano.
export function preparaCliente(dati) {
  const pulito = Object.fromEntries(
    Object.entries(dati).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])
  );
  const tipoAltro = pulito.tipoDocumento === 'Altro';
  const { index: _index, ...senzaIndice } = pulito;
  const senzaCf = pulito.senzaCodiceFiscale === true;
  return {
    ...senzaIndice,
    senzaCodiceFiscale: senzaCf,
    codiceFiscale: senzaCf ? '' : normalizzaCodiceFiscale(pulito.codiceFiscale),
    patente: (pulito.patente || '').toUpperCase(),
    tipoDocumento: tipoAltro ? (pulito.tipoDocumentoAltro || '') : (pulito.tipoDocumento || ''),
    tipoDocumentoAltro: tipoAltro ? (pulito.tipoDocumentoAltro || '') : '',
  };
}

// Il form vuole "Altro" + testo quando il tipo salvato non e' tra quelli fissi.
export function clientePerForm(cliente) {
  const tipo = cliente.tipoDocumento || '';
  const personalizzato = tipo && !TIPI_DOCUMENTO.includes(tipo);
  return {
    ...cliente,
    tipoDocumento: personalizzato ? 'Altro' : tipo,
    tipoDocumentoAltro: personalizzato ? tipo : (cliente.tipoDocumentoAltro || ''),
  };
}

// Errori per campo ({} se va tutto bene). `altriClienti` serve per il codice
// fiscale gia' usato; in modifica si passa `idCliente` per escludere se stesso.
export function validaCliente(cliente, altriClienti = [], idCliente = null) {
  const errori = {};
  if (!cliente.nome) errori.nome = 'Inserisci il nome.';
  if (!cliente.cognome) errori.cognome = 'Inserisci il cognome.';
  if (senzaCodiceFiscale(cliente)) {
    if (!cliente.dataNascita) errori.dataNascita = 'Senza codice fiscale serve la data di nascita.';
    if (!cliente.luogoNascita) errori.luogoNascita = 'Senza codice fiscale serve il luogo di nascita.';
    if (!cliente.tipoDocumento) errori.tipoDocumento = 'Scegli il tipo di documento d\'identità.';
    else if (cliente.tipoDocumento === 'Altro' && !cliente.tipoDocumentoAltro) errori.tipoDocumentoAltro = 'Scrivi quale documento.';
    const doc = normalizzaDocumento(cliente.documento);
    if (!doc) errori.documento = 'Senza codice fiscale serve il numero del documento d\'identità.';
    else if (altriClienti.some((c) => c.id !== idCliente && senzaCodiceFiscale(c) && normalizzaDocumento(c.documento) === doc)) {
      errori.documento = 'Questo documento è già di un altro cliente.';
    }
  } else {
    const cf = normalizzaCodiceFiscale(cliente.codiceFiscale);
    if (!cf) errori.codiceFiscale = 'Inserisci il codice fiscale.';
    else if (!/^[A-Z0-9]{16}$/.test(cf)) errori.codiceFiscale = 'Il codice fiscale ha 16 lettere e numeri.';
    else if (altriClienti.some((c) => c.id !== idCliente && normalizzaCodiceFiscale(c.codiceFiscale) === cf)) {
      errori.codiceFiscale = 'Questo codice fiscale è già di un altro cliente.';
    }
  }
  if (!cliente.patente) errori.patente = 'Inserisci il numero della patente.';
  if (cliente.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cliente.email)) errori.email = 'Email non valida.';
  return errori;
}

// Prenotazioni legate al cliente: per codice fiscale (senza badare alle
// maiuscole: quelle del sito lo salvano come l'ha scritto il cliente) oppure
// per codice interno (`idCliente`, per i clienti senza codice fiscale).
// Accetta il cliente intero o, come prima, il solo codice fiscale.
export function prenotazioniDelCliente(cliente, prenotazioni = []) {
  const { codiceFiscale, id } = typeof cliente === 'object' && cliente !== null ? cliente : { codiceFiscale: cliente };
  const cf = normalizzaCodiceFiscale(codiceFiscale);
  return prenotazioni.filter((p) => (
    (cf && normalizzaCodiceFiscale(p.codiceFiscale) === cf) || (id && p.idCliente === id)
  ));
}

// Ricerca immediata su piu' parole: nome, cognome, contatti, codice fiscale,
// patente, ragione sociale e targhe dei veicoli che ha noleggiato.
export function cercaClienti(clienti = [], testo = '', prenotazioni = []) {
  const parole = testo.toLowerCase().split(/\s+/).filter(Boolean);
  if (parole.length === 0) return clienti;
  const targhe = new Map();
  prenotazioni.forEach((p) => {
    if (!p.targa) return;
    [normalizzaCodiceFiscale(p.codiceFiscale), p.idCliente].filter(Boolean)
      .forEach((chiave) => targhe.set(chiave, `${targhe.get(chiave) || ''} ${p.targa}`));
  });
  return clienti.filter((c) => {
    const testoCliente = [
      c.nome, c.cognome, c.email, c.telefono, c.cellulare, c.codiceFiscale, c.patente, c.ragioneSociale,
      senzaCodiceFiscale(c) && 'senza codice fiscale', c.documento,
      targhe.get(normalizzaCodiceFiscale(c.codiceFiscale)), targhe.get(c.id),
    ].filter(Boolean).join(' ').toLowerCase();
    return parole.every((parola) => testoCliente.includes(parola));
  });
}

// Patente alla consegna: { blocca } se e' gia' scaduta (o scade prima del
// ritiro), { avviso } se scade durante il noleggio, {} se va bene o manca la data.
export function controllaPatente(scadenza, { ritiro, riconsegna }) {
  if (!scadenza) return {};
  const data = String(scadenza).slice(0, 10);
  if (data < String(ritiro).slice(0, 10)) {
    return { blocca: `La patente è scaduta il ${data.split('-').reverse().join('/')}: non si può consegnare il veicolo.` };
  }
  if (riconsegna && data < String(riconsegna).slice(0, 10)) {
    return { avviso: `La patente scade il ${data.split('-').reverse().join('/')}, prima della riconsegna.` };
  }
  return {};
}

// Dati per l'anagrafica presi da una prenotazione (es. arrivata dal sito, che
// salva nome e cognome insieme in `cliente`): alla consegna il cliente entra
// in anagrafica.
export function clienteDaPrenotazione(prenotazione, { patente, scadenzaPatente, rilascioPatente } = {}) {
  const [nome = '', ...resto] = String(prenotazione.cliente || '').trim().split(/\s+/);
  return {
    nome: prenotazione.nomeCliente || nome,
    cognome: prenotazione.cognomeCliente || resto.join(' '),
    codiceFiscale: normalizzaCodiceFiscale(prenotazione.codiceFiscale),
    ...(prenotazione.senzaCodiceFiscale === true ? {
      senzaCodiceFiscale: true,
      dataNascita: prenotazione.dataNascita || '',
      luogoNascita: prenotazione.luogoNascita || '',
      tipoDocumento: prenotazione.tipoDocumento || '',
      documento: prenotazione.documento || '',
      nazionalita: prenotazione.nazionalita || '',
    } : {}),
    email: prenotazione.emailCliente || '',
    telefono: prenotazione.telefono || '',
    patente: (patente || prenotazione.patente || '').trim().toUpperCase(),
    scadenzaPatente: scadenzaPatente || '',
    rilascioPatente: rilascioPatente || prenotazione.rilascioPatente || '',
    origine: prenotazione.origine === 'sito' ? 'sito' : 'gestionale',
  };
}
