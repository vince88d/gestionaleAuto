// Bozza dell'email di riepilogo al cliente, per la consegna e per il rientro.
// Il gestionale compila destinatario, oggetto e testo e apre il programma di
// posta; il PDF si allega a mano (il programma lo mostra gia' selezionato
// nella cartella). Nessun servizio di invio: funziona con qualsiasi posta.
// Funzioni pure, testate.
import { dataEOra } from './scadenze';
import { riassuntoDotazione } from './dotazione';
import { prezzoPrenotazione } from './dashboard';
import { kmPercorsi } from './rientro';
import { testoFirmaMancante } from './firmaVerbale';

// I link «mailto:» hanno un limite di lunghezza (circa 2000 caratteri, in
// particolare su Windows): oltre questo le righe facoltative si tolgono.
export const LIMITE_TESTO = 1800;

const eur = (n) => `${Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' })} €`;
const nKm = (n) => Number(n).toLocaleString('it-IT');
const auto = (p) => [p.veicolo, p.targa && `(${p.targa})`].filter(Boolean).join(' ');

// Riga {t, opz}: `opz` = si puo' togliere se il testo e' troppo lungo.
const riga = (t, opz = false) => (t ? { t, opz } : null);

function chiusura(azienda = {}) {
  const contatti = [azienda.telefono && `Tel. ${azienda.telefono}`, azienda.email].filter(Boolean).join(' · ');
  return ['', 'Cordiali saluti', ...[azienda.nome, contatti].filter(Boolean)];
}

// Testo finale: toglie le righe facoltative, dall'ultima, finche' sta nel limite.
export function componiTesto(righe, chiudi) {
  const attive = righe.filter(Boolean);
  const testo = () => [...attive.map((r) => r.t), ...chiudi].join('\n');
  while (encodeURIComponent(testo()).length > LIMITE_TESTO) {
    const i = attive.map((r) => r.opz).lastIndexOf(true);
    if (i === -1) break;
    attive.splice(i, 1);
  }
  return testo();
}

function righeConsegna(prenotazione, scheda) {
  const dot = riassuntoDotazione(scheda);
  const p = prenotazione.protezione;
  const danni = String(scheda.danni || '').trim();
  const firma = scheda.firma;
  const firmaTesto = testoFirmaMancante(firma);
  return [
    riga(`Le confermiamo la consegna del veicolo ${auto(prenotazione)}.`),
    riga(''),
    riga(`Consegna: ${dataEOra(prenotazione.dataInizio, prenotazione.oraInizio)}`),
    riga(`Riconsegna prevista: ${prenotazione.oraFine ? 'entro ' : ''}${dataEOra(prenotazione.dataFine, prenotazione.oraFine)}`),
    riga(scheda.kmIniziali ? `Chilometri alla consegna: ${nKm(scheda.kmIniziali)} km` : ''),
    riga(scheda.carburante ? `Carburante: ${scheda.carburante}` : ''),
    riga(dot.chiaviConsegnate ? `Chiavi consegnate: ${dot.chiaviConsegnate}` : '', true),
    riga(`Danni già presenti: ${danni && !/^nessuno$/i.test(danni) ? danni : 'nessuno segnato'}`),
    riga(dot.mancanti.length > 0 ? `Dotazione mancante: ${dot.mancanti.join(', ')}` : '', true),
    riga(p ? `Protezione: ${p.tipo === 'totale' ? 'Totale' : 'Base'}${typeof p.cauzione === 'number' ? ` · Cauzione ${eur(p.cauzione)}${prenotazione.cauzioneBloccata ? ' (bloccata sulla carta)' : ''}` : ''}` : '', true),
    riga(prezzoPrenotazione(prenotazione) > 0 ? `Totale noleggio: ${eur(prezzoPrenotazione(prenotazione))}` : '', true),
    riga(firmaTesto ? `\n${firmaTesto}` : ''),
    riga(firma?.osservazioni ? `Osservazioni del cliente: ${firma.osservazioni}` : ''),
    riga(''),
    riga('In allegato trova il verbale di consegna.'),
  ];
}

function righeRientro(prenotazione) {
  const r = prenotazione.rientro || {};
  const percorsi = kmPercorsi(r.kmConsegna, r.km);
  const nonTornato = [...(r.dotazioneNonTornata || []), ...(r.extraNonTornati || [])];
  const addebiti = Array.isArray(r.addebiti) ? r.addebiti : [];
  const danno = String(prenotazione.descrizioneDanno || '').trim();
  const c = r.cauzione;
  const firmaTesto = testoFirmaMancante(r.firma);
  return [
    riga(`Le confermiamo il rientro del veicolo ${auto(prenotazione)}.`),
    riga(''),
    riga(`Rientrato: ${dataEOra(r.dataRientro, r.oraRientro)}`),
    riga(r.km != null ? `Chilometri: ${r.kmConsegna != null ? `${nKm(r.kmConsegna)} → ` : ''}${nKm(r.km)}${percorsi !== null ? ` (${nKm(percorsi)} km percorsi)` : ''}` : ''),
    riga(r.carburante ? `Carburante: ${r.carburanteConsegna ? `${r.carburanteConsegna} → ` : ''}${r.carburante}` : ''),
    riga(r.chiaviConsegnate ? `Chiavi restituite: ${r.chiaviTornate ?? '-'} su ${r.chiaviConsegnate}` : '', true),
    riga(nonTornato.length > 0 ? `Non tornato: ${nonTornato.join(', ')}` : '', true),
    riga(`Danni nuovi: ${danno || 'nessuno'}`),
    riga(addebiti.length > 0 ? '\nAddebiti:' : '\nAddebiti: nessuno'),
    ...addebiti.map((a) => riga(`- ${a.nome}: ${eur(a.importo)}`, true)),
    riga(addebiti.length > 0 ? `Totale addebiti: ${eur(r.totaleAddebiti)}` : ''),
    riga(c ? `Cauzione: ${eur(c.importo)} · trattenuti ${eur(c.trattenuta)} · sbloccati ${eur(c.sbloccata)}${c.restano > 0 ? ` · restano da pagare ${eur(c.restano)}` : ''}` : (r.totaleAddebiti > 0 ? `Restano da pagare: ${eur(r.restanoDaPagare)}` : '')),
    riga(firmaTesto ? `\n${firmaTesto}` : ''),
    riga(r.firma?.osservazioni ? `Osservazioni del cliente: ${r.firma.osservazioni}` : ''),
    riga(''),
    riga('In allegato trova il verbale di rientro.'),
  ];
}

// { to, subject, body } per il programma di posta.
//   fase: 'consegna' | 'rientro'; scheda: scheda della consegna (di solito `prenotazione.schedaVeicolo`);
//   conContratto: e' stato salvato anche il contratto.
export function bozzaEmail({ fase, prenotazione = {}, scheda, azienda = {}, conContratto = false }) {
  const consegna = fase !== 'rientro';
  const righe = consegna ? righeConsegna(prenotazione, scheda || prenotazione.schedaVeicolo || {}) : righeRientro(prenotazione);
  if (consegna && conContratto) righe.push(riga('In allegato anche il contratto di noleggio.'));
  const intro = [riga(`Gentile ${prenotazione.cliente || 'cliente'},`), riga('')];
  return {
    to: prenotazione.emailCliente || '',
    subject: `${consegna ? 'Verbale di consegna' : 'Verbale di rientro'} - ${[prenotazione.veicolo, prenotazione.targa].filter(Boolean).join(' ') || 'veicolo'}`,
    body: componiTesto([...intro, ...righe], chiusura(azienda)),
  };
}
