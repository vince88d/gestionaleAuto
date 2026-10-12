// Bozza dell'email di riepilogo al cliente, per la consegna e per il rientro.
// Il gestionale compila destinatario, oggetto e testo e apre il programma di
// posta; il PDF si allega a mano (il programma lo mostra gia' selezionato
// nella cartella). Nessun servizio di invio: funziona con qualsiasi posta.
//
// Il «mailto:» permette solo testo semplice: l'ordine si ottiene con blocchi
// che hanno un titolo in maiuscolo, punti elenco e righe vuote in mezzo.
// Mockup approvato: formiarent-documenti/mockup/gestionale-dettagli-pulsanti.html
// Funzioni pure, testate.
import { dataEOra } from './scadenze';
import { riassuntoDotazione } from './dotazione';
import { prezzoPrenotazione } from './dashboard';
import { kmPercorsi } from './rientro';
import { testoFirmaMancante } from './firmaVerbale';

// I link «mailto:» hanno un limite di lunghezza (circa 2000 caratteri, in
// particolare su Windows): oltre questo le voci facoltative si tolgono.
export const LIMITE_TESTO = 1800;

const eur = (n) => `${Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' })} €`;
const nKm = (n) => Number(n).toLocaleString('it-IT');
const auto = (p) => [p.veicolo, p.targa && `(${p.targa})`].filter(Boolean).join(' ');

// Voce di un blocco: { t, opz } (con `opz` si puo' togliere se il testo e' troppo
// lungo) oppure { t, semplice: true } per una riga senza punto elenco.
const voce = (t, opz = false) => (t ? { t, opz } : null);
const riga = (t) => (t ? { t, semplice: true } : null);
const blocco = (titolo, voci) => ({ titolo, voci: voci.filter(Boolean) });

// Testo finale. Un blocco senza voci sparisce. Se il testo e' troppo lungo si
// tolgono le voci facoltative, dall'ultima.
export function componiTesto(blocchi, chiusura = []) {
  const lavoro = blocchi.map((b) => ({ ...b, voci: [...b.voci] })).filter((b) => b.voci.length > 0);
  const testo = () => {
    const parti = lavoro.filter((b) => b.voci.length > 0).map((b) => [
      ...(b.titolo ? [b.titolo] : []),
      ...b.voci.map((v) => (v.semplice ? v.t : `• ${v.t}`)),
    ].join('\n'));
    return [...parti, chiusura.join('\n')].filter(Boolean).join('\n\n');
  };
  while (encodeURIComponent(testo()).length > LIMITE_TESTO) {
    let tolta = false;
    for (let i = lavoro.length - 1; i >= 0 && !tolta; i -= 1) {
      const j = lavoro[i].voci.map((v) => v.opz).lastIndexOf(true);
      if (j !== -1) { lavoro[i].voci.splice(j, 1); tolta = true; }
    }
    if (!tolta) break;
  }
  return testo();
}

function saluti(azienda = {}) {
  const contatti = [azienda.telefono && `Tel. ${azienda.telefono}`, azienda.email].filter(Boolean).join(' · ');
  return ['Cordiali saluti', ...[azienda.nome, contatti].filter(Boolean)];
}

const bloccoFirma = (firma) => blocco('FIRMA DEL VERBALE', [
  riga(testoFirmaMancante(firma)),
  riga(firma?.osservazioni ? `Osservazioni del cliente: ${firma.osservazioni}` : ''),
]);

function bloccoConsegna(prenotazione, scheda) {
  const dot = riassuntoDotazione(scheda);
  const p = prenotazione.protezione;
  const danni = String(scheda.danni || '').trim();
  const totale = prezzoPrenotazione(prenotazione);
  return [
    blocco('IL NOLEGGIO', [
      voce(`Consegna: ${dataEOra(prenotazione.dataInizio, prenotazione.oraInizio)}`),
      voce(`Riconsegna prevista: ${prenotazione.oraFine ? 'entro ' : ''}${dataEOra(prenotazione.dataFine, prenotazione.oraFine)}`),
      voce(totale > 0 ? `Totale noleggio: ${eur(totale)}` : '', true),
    ]),
    blocco("STATO DELL'AUTO", [
      voce(scheda.kmIniziali ? `Chilometri: ${nKm(scheda.kmIniziali)} km` : ''),
      voce(scheda.carburante ? `Carburante: ${scheda.carburante}` : ''),
      voce(dot.chiaviConsegnate ? `Chiavi consegnate: ${dot.chiaviConsegnate}` : '', true),
      voce(`Danni già presenti: ${danni && !/^nessuno$/i.test(danni) ? danni : 'nessuno segnato'}`),
      voce(dot.mancanti.length > 0 ? `Dotazione mancante: ${dot.mancanti.join(', ')}` : '', true),
    ]),
    blocco('PROTEZIONE E CAUZIONE', [
      voce(p ? `Protezione: ${p.tipo === 'totale' ? 'Totale' : 'Base'}` : '', true),
      voce(p && typeof p.cauzione === 'number' ? `Cauzione: ${eur(p.cauzione)}${prenotazione.cauzioneBloccata ? ' (bloccata sulla carta)' : ''}` : '', true),
    ]),
    bloccoFirma(scheda.firma),
  ];
}

function bloccoRientro(prenotazione) {
  const r = prenotazione.rientro || {};
  const percorsi = kmPercorsi(r.kmConsegna, r.km);
  const nonTornato = [...(r.dotazioneNonTornata || []), ...(r.extraNonTornati || [])];
  const addebiti = Array.isArray(r.addebiti) ? r.addebiti : [];
  const danno = String(prenotazione.descrizioneDanno || '').trim();
  const c = r.cauzione;
  return [
    blocco('IL RIENTRO', [
      voce(`Rientrato: ${dataEOra(r.dataRientro, r.oraRientro)}`),
      voce(r.km != null ? `Chilometri: ${r.kmConsegna != null ? `${nKm(r.kmConsegna)} → ` : ''}${nKm(r.km)}${percorsi !== null ? ` (${nKm(percorsi)} km percorsi)` : ''}` : ''),
      voce(r.carburante ? `Carburante: ${r.carburanteConsegna ? `${r.carburanteConsegna} → ` : ''}${r.carburante}` : ''),
      voce(r.chiaviConsegnate ? `Chiavi restituite: ${r.chiaviTornate ?? '-'} su ${r.chiaviConsegnate}` : '', true),
      voce(nonTornato.length > 0 ? `Non tornato: ${nonTornato.join(', ')}` : '', true),
      voce(`Danni nuovi: ${danno || 'nessuno'}`),
    ]),
    blocco('ADDEBITI', addebiti.length > 0
      ? [...addebiti.map((a) => voce(`${a.nome}: ${eur(a.importo)}`, true)), riga(`Totale addebiti: ${eur(r.totaleAddebiti)}`)]
      : [riga('Nessun addebito.')]),
    c
      ? blocco('CAUZIONE', [
        voce(`Cauzione: ${eur(c.importo)}`),
        voce(`Trattenuti: ${eur(c.trattenuta)}`),
        voce(`Sbloccati: ${eur(c.sbloccata)}`),
        voce(c.restano > 0 ? `Restano da pagare: ${eur(c.restano)}` : ''),
      ])
      : blocco('PAGAMENTO', [riga(r.totaleAddebiti > 0 ? `Restano da pagare: ${eur(r.restanoDaPagare)}` : '')]),
    bloccoFirma(r.firma),
  ];
}

// Testo completo. `senzaAllegato`: per il testo da copiare (WhatsApp, SMS), dove
// «in allegato» non avrebbe senso.
function testoPerFase({ fase, prenotazione, scheda, azienda, conContratto, senzaAllegato }) {
  const consegna = fase !== 'rientro';
  const blocchi = [
    { titolo: '', voci: [riga(`Gentile ${prenotazione.cliente || 'cliente'},`)] },
    { titolo: '', voci: [riga(`Le confermiamo ${consegna ? 'la consegna' : 'il rientro'} del veicolo ${auto(prenotazione)}.`)] },
    ...(consegna ? bloccoConsegna(prenotazione, scheda || prenotazione.schedaVeicolo || {}) : bloccoRientro(prenotazione)),
  ];
  const allegato = senzaAllegato ? [] : [
    `In allegato trova il verbale di ${consegna ? 'consegna' : 'rientro'}.`,
    ...(consegna && conContratto ? ['In allegato anche il contratto di noleggio.'] : []),
  ];
  return componiTesto(blocchi, [...allegato, ...(allegato.length ? [''] : []), ...saluti(azienda)]);
}

const oggetto = (fase, prenotazione) => `${fase === 'rientro' ? 'Verbale di rientro' : 'Verbale di consegna'} - ${[prenotazione.veicolo, prenotazione.targa].filter(Boolean).join(' ') || 'veicolo'}`;

// { to, subject, body } per il programma di posta.
//   fase: 'consegna' | 'rientro'; scheda: scheda della consegna (di solito `prenotazione.schedaVeicolo`);
//   conContratto: e' stato salvato anche il contratto.
export function bozzaEmail({ fase, prenotazione = {}, scheda, azienda = {}, conContratto = false }) {
  return {
    to: prenotazione.emailCliente || '',
    subject: oggetto(fase, prenotazione),
    body: testoPerFase({ fase, prenotazione, scheda, azienda, conContratto, senzaAllegato: false }),
  };
}

// Lo stesso riepilogo da copiare e incollare (WhatsApp, SMS...): senza «in allegato».
export function testoRiepilogo({ fase, prenotazione = {}, scheda, azienda = {} }) {
  return testoPerFase({ fase, prenotazione, scheda, azienda, conContratto: false, senzaAllegato: true });
}
