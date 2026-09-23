// Regole del cliente (funzioni pure, testate): controlli prima di salvare e
// preparazione dei dati del form.
import { normalizzaCodiceFiscale } from '../lib/firestoreClienti';

export const TIPI_DOCUMENTO = ['CI', 'Patente', 'Passaporto', 'Permesso di soggiorno', 'Tessera sanitaria', 'Altro'];

// Dal form ai dati da salvare: codice fiscale in maiuscolo, spazi tolti,
// "Altro" sostituito dal tipo scritto a mano.
export function preparaCliente(dati) {
  const pulito = Object.fromEntries(
    Object.entries(dati).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])
  );
  const tipoAltro = pulito.tipoDocumento === 'Altro';
  const { index: _index, ...senzaIndice } = pulito;
  return {
    ...senzaIndice,
    codiceFiscale: normalizzaCodiceFiscale(pulito.codiceFiscale),
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
  const cf = normalizzaCodiceFiscale(cliente.codiceFiscale);
  if (!cf) errori.codiceFiscale = 'Inserisci il codice fiscale.';
  else if (!/^[A-Z0-9]{16}$/.test(cf)) errori.codiceFiscale = 'Il codice fiscale ha 16 lettere e numeri.';
  else if (altriClienti.some((c) => c.id !== idCliente && normalizzaCodiceFiscale(c.codiceFiscale) === cf)) {
    errori.codiceFiscale = 'Questo codice fiscale è già di un altro cliente.';
  }
  if (!cliente.patente) errori.patente = 'Inserisci il numero della patente.';
  if (cliente.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cliente.email)) errori.email = 'Email non valida.';
  return errori;
}

// Prenotazioni legate al cliente (per codice fiscale, senza badare alle
// maiuscole: quelle del sito lo salvano come l'ha scritto il cliente).
export function prenotazioniDelCliente(codiceFiscale, prenotazioni = []) {
  const cf = normalizzaCodiceFiscale(codiceFiscale);
  if (!cf) return [];
  return prenotazioni.filter((p) => normalizzaCodiceFiscale(p.codiceFiscale) === cf);
}
