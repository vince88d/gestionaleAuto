// Verbale di rientro (PDF): confronto con la consegna, danni, dotazione,
// addebiti e cauzione, spazio per le firme. Stessa impaginazione del verbale
// di consegna (pdfLayout.js).
// Mockup approvato: formiarent-documenti/mockup/gestionale-pdf-verbali-v2.html
import { dataEOra, formattaData } from './scadenze';
import { giorniInPiu, kmPercorsi, quartiCarburante, quartiMancanti } from './rientro';
import { nuovoFoglio } from './pdfLayout';
import { dataBreve, riferimentoPrenotazione, sezioneFoto, NOTA_PRIVACY } from './pdfConsegna';
import { leggiFotoVerbale } from '../lib/fotoVerbale';
import { riassuntoDotazione } from './dotazione';
import { schemaPdf } from './pdfSchemaDanni';
import { danniRientro, elencoFoto } from './danni';
import { testoFirmaMancante } from './firmaVerbale';

const eur = (n) => `${Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' })} €`;
const eurTesto = (n) => `${Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' })} EUR`;
const nKm = (n) => Number(n).toLocaleString('it-IT');
const giorni = (n) => `${n} ${n === 1 ? 'giorno' : 'giorni'}`;

// Come e' andato il rientro, in una parola per la fascia in alto.
export function esitoRientro(prenotazione = {}) {
  const r = prenotazione.rientro || {};
  if (r.totaleAddebiti > 0) return 'Con addebiti';
  if (String(prenotazione.descrizioneDanno || '').trim() || (Array.isArray(prenotazione.segniDanni) && prenotazione.segniDanni.length > 0)) return 'Con danni';
  if ((r.dotazioneNonTornata || []).length + (r.extraNonTornati || []).length > 0) return 'Con mancanze';
  return 'Tutto in ordine';
}

// Ora del rientro: solo l'ora se e' lo stesso giorno della riconsegna prevista.
const quandoRientrata = (prenotazione, r) => {
  const ora = r.oraRientro || '';
  const stessoGiorno = String(r.dataRientro || '').slice(0, 10) === String(prenotazione.dataFine || '').slice(0, 10);
  return stessoGiorno ? ora || '-' : `${dataBreve(r.dataRientro)}${ora ? ` ${ora}` : ''}`;
};

// Righe della tabella «alla consegna / al rientro / differenza». Ogni cella e'
// una stringa o { testo, tono, segno, tag } (vedi `tabella` in pdfLayout.js).
// Funzione pura (testata). Vuota se la prenotazione non ha il rientro.
export function righeConfronto(prenotazione = {}) {
  const r = prenotazione.rientro;
  if (!r) return [];
  const consegna = prenotazione.schedaVeicolo || {};
  const righe = [];

  const percorsi = kmPercorsi(r.kmConsegna, r.km);
  righe.push([
    'Chilometri',
    r.kmConsegna != null ? `${nKm(r.kmConsegna)} km` : '-',
    r.km != null ? `${nKm(r.km)} km` : '-',
    percorsi !== null ? { testo: `${nKm(percorsi)} km percorsi`, grassetto: true } : '',
  ]);

  const mancano = quartiMancanti(r.carburanteConsegna, r.carburante);
  const a = quartiCarburante(r.carburanteConsegna);
  const b = quartiCarburante(r.carburante);
  let differenza = '';
  if (a !== null && b !== null) {
    if (mancano > 0) differenza = { testo: `${mancano}/4 in meno`, tono: 'rosso', segno: 'giu' };
    else if (b > a) differenza = { testo: `${b - a}/4 in più`, tono: 'verde', segno: 'su' };
    else differenza = { tag: 'Uguale' };
  }
  righe.push(['Carburante', r.carburanteConsegna || '-', r.carburante || '-', differenza]);

  const extra = giorniInPiu({ prenotazione, dataRientro: r.dataRientro, oraRientro: r.oraRientro, tolleranza: prenotazione.tolleranzaMinuti });
  righe.push([
    'Riconsegna',
    prenotazione.oraFine ? `entro ${prenotazione.oraFine}` : formattaData(prenotazione.dataFine),
    quandoRientrata(prenotazione, r),
    extra > 0 ? { testo: `${giorni(extra)} in più`, tono: 'rosso', segno: 'su' } : { tag: 'In orario', tono: 'verde' },
  ]);

  if (r.chiaviConsegnate) {
    const tornate = r.chiaviTornate ?? 0;
    const mancanti = Math.max(0, r.chiaviConsegnate - tornate);
    righe.push([
      'Chiavi', String(r.chiaviConsegnate), r.chiaviTornate != null ? String(tornate) : '-',
      mancanti > 0 ? { testo: `${mancanti} non ${mancanti === 1 ? 'restituita' : 'restituite'}`, tono: 'rosso' } : { tag: 'Tutte', tono: 'verde' },
    ]);
  }

  const presenti = riassuntoDotazione(consegna).presenti.length;
  const nonTornato = [...(r.dotazioneNonTornata || []), ...(r.extraNonTornati || [])];
  if (presenti > 0 || nonTornato.length > 0) {
    righe.push([
      'Dotazione', `${presenti} ${presenti === 1 ? 'voce' : 'voci'}`, `${Math.max(0, presenti - (r.dotazioneNonTornata || []).length)} ${presenti - (r.dotazioneNonTornata || []).length === 1 ? 'voce' : 'voci'}`,
      nonTornato.length > 0 ? { testo: `Manca: ${nonTornato.join(', ')}`, tono: 'rosso' } : { tag: 'Completa', tono: 'verde' },
    ]);
  }
  return righe;
}

// Sezioni di testo del rientro per i dettagli della prenotazione (RientroDettagli):
// [{ titolo, righe: [[etichetta, valore]] }]. Funzione pura (testata).
export function sezioniRientro(prenotazione = {}) {
  const r = prenotazione.rientro;
  if (!r) return [];
  const percorsi = kmPercorsi(r.kmConsegna, r.km);
  const extra = giorniInPiu({ prenotazione, dataRientro: r.dataRientro, oraRientro: r.oraRientro, tolleranza: prenotazione.tolleranzaMinuti });
  const ritardo = extra > 0 ? ` (${extra} ${extra === 1 ? 'giorno' : 'giorni'} in più)` : '';

  const generali = [
    ['Cliente', prenotazione.cliente || '-'],
    ['Veicolo', `${prenotazione.veicolo || '-'}${prenotazione.targa ? ` · ${prenotazione.targa}` : ''}`],
    ['Periodo', `dal ${dataEOra(prenotazione.dataInizio, prenotazione.oraInizio)} al ${dataEOra(prenotazione.dataFine, prenotazione.oraFine)}`],
    ['Rientrata', `${dataEOra(r.dataRientro, r.oraRientro)}${ritardo}`],
    ['Km', r.kmConsegna != null ? `${nKm(r.kmConsegna)} -> ${nKm(r.km)}${percorsi !== null ? ` (${nKm(percorsi)} km)` : ''}` : nKm(r.km)],
    ...(prenotazione.chilometri?.nome
      ? [['Formula km', `${prenotazione.chilometri.nome}${prenotazione.chilometri.kmInclusi ? ` · ${nKm(prenotazione.chilometri.kmInclusi)} km inclusi` : ''}`]]
      : []),
    ['Carburante', r.carburanteConsegna ? `${r.carburanteConsegna} -> ${r.carburante}` : r.carburante],
  ];
  if (r.chiaviConsegnate) generali.push(['Chiavi', `${r.chiaviConsegnate} consegnate, ${r.chiaviTornate ?? '-'} tornate`]);
  const nonTornato = [...(r.dotazioneNonTornata || []), ...(r.extraNonTornati || [])];
  generali.push(['Non tornato', nonTornato.length > 0 ? nonTornato.join(', ') : 'Niente']);
  generali.push(['Danni nuovi', prenotazione.descrizioneDanno ? `${prenotazione.descrizioneDanno}${prenotazione.daRiparare ? ' (da riparare)' : ''}` : 'Nessuno']);

  const sezioni = [{ titolo: 'Com\'è tornata', righe: generali }];
  const addebiti = Array.isArray(r.addebiti) ? r.addebiti : [];
  sezioni.push({
    titolo: 'Addebiti',
    righe: addebiti.length > 0
      ? [...addebiti.map((a) => [a.nome, eurTesto(a.importo)]), ['Totale', eurTesto(r.totaleAddebiti)]]
      : [['Totale', eurTesto(0)]],
  });
  if (r.cauzione) {
    sezioni.push({
      titolo: 'Cauzione',
      righe: [
        ['Bloccata', eurTesto(r.cauzione.importo)],
        ['Trattenuta', eurTesto(r.cauzione.trattenuta)],
        ['Sbloccata', eurTesto(r.cauzione.sbloccata)],
        ...(r.cauzione.restano > 0 ? [['Restano da pagare', eurTesto(r.cauzione.restano)]] : []),
      ],
    });
  } else if (r.totaleAddebiti > 0) {
    sezioni.push({ titolo: 'Pagamento', righe: [['Restano da pagare', eurTesto(r.restanoDaPagare)]] });
  }
  return sezioni;
}

// Verbale di rientro. `opzioni`: { azienda, foto }.
export async function generaVerbaleRientroPdf(prenotazione, opzioni = {}) {
  const azienda = opzioni.azienda || {};
  const r = prenotazione.rientro || {};
  const rif = riferimentoPrenotazione(prenotazione);
  const dataDoc = r.dataRientro ? formattaData(r.dataRientro) : new Date().toLocaleDateString('it-IT');
  const auto = `${prenotazione.veicolo || '-'}${prenotazione.targa ? ` · ${prenotazione.targa}` : ''}`;
  const foglio = await nuovoFoglio({
    azienda,
    titolo: 'Verbale di rientro',
    numero: rif,
    data: dataDoc,
    copia: 'Copia per il cliente',
    riepilogo: [prenotazione.cliente, [prenotazione.veicolo, prenotazione.targa].filter(Boolean).join(' ')].filter(Boolean).join(' · '),
    piede: `${azienda.nome ? `${azienda.nome} · ` : ''}Verbale di rientro${rif ? ` · N. ${rif}` : ''}`,
    soggetto: `Verbale di rientro del veicolo di ${prenotazione.cliente || 'cliente'}`,
  });

  foglio.fascia([
    { etichetta: 'Cliente', valore: prenotazione.cliente || '-' },
    { etichetta: 'Veicolo', valore: auto },
    { etichetta: 'Rientrata', valore: `${dataBreve(r.dataRientro)}${r.oraRientro ? ` ore ${r.oraRientro}` : ''}` },
    { etichetta: 'Esito', valore: esitoRientro(prenotazione) },
  ], [1.2, 1.9, 1.2, 1]);

  foglio.sezione("Com'è tornata: confronto con la consegna");
  foglio.tabella({
    colonne: [{ titolo: 'Controllo', peso: 1 }, { titolo: 'Alla consegna', peso: 1.1 }, { titolo: 'Al rientro', peso: 1.1 }, { titolo: 'Differenza', peso: 1.6 }],
    righe: righeConfronto(prenotazione),
  });

  foglio.sezione('Danni');
  const voceDanni = danniRientro(prenotazione);
  foglio.danni(voceDanni, { vuoto: 'Nessun danno', schema: schemaPdf(voceDanni) });

  const consegna = prenotazione.schedaVeicolo || {};
  const dot = riassuntoDotazione(consegna);
  const nonTornati = new Set((r.dotazioneNonTornata || []).map((v) => v.toLowerCase()));
  const voci = [
    ...dot.presenti.map((testo) => (nonTornati.has(testo.toLowerCase()) ? { testo: `${testo}: non tornato`, manca: true } : { testo, ok: true })),
    ...(r.extraNonTornati || []).map((testo) => ({ testo: `${testo}: non tornato`, manca: true })),
  ];
  if (voci.length > 0) {
    foglio.sezione('Dotazione al rientro');
    foglio.caselle(voci);
    if (dot.mancanti.length > 0) { foglio.spazio(3); foglio.piccolo(`Già mancante alla consegna, nessun addebito: ${dot.mancanti.join(', ')}.`); }
    if ((r.dotazioneTolta || []).length > 0) { foglio.spazio(2); foglio.piccolo(`Tolto dalla dotazione dell'auto: ${r.dotazioneTolta.join(', ')}.`); }
  }

  const addebiti = Array.isArray(r.addebiti) ? r.addebiti : [];
  foglio.sezione('Addebiti e cauzione');
  if (addebiti.length > 0) {
    foglio.tabella({
      colonne: [{ titolo: 'Voce', peso: 1.5 }, { titolo: 'Come si calcola', peso: 2.2 }, { titolo: 'Importo', peso: 0.8, destra: true }],
      righe: addebiti.map((a) => [a.nome, a.dettaglio || '', eur(a.importo)]),
      totale: ['Totale addebiti', '', eur(r.totaleAddebiti)],
    });
  } else {
    foglio.piccolo('Nessun addebito.', undefined, 9);
    foglio.spazio(4);
  }
  if (r.cauzione) {
    foglio.riquadroDati({
      etichetta: 'Cauzione',
      righe: [
        ['Cauzione bloccata', eur(r.cauzione.importo)],
        ['Trattenuta per gli addebiti', `- ${eur(r.cauzione.trattenuta)}`],
        ...(r.cauzione.restano > 0 ? [['Restano da pagare', eur(r.cauzione.restano)]] : []),
      ],
      totale: ['Sbloccata al cliente', eur(r.cauzione.sbloccata)],
      nota: 'Lo sblocco avviene entro i tempi della banca del cliente.',
    });
  } else if (r.totaleAddebiti > 0) {
    foglio.riquadroDati({ etichetta: 'Pagamento', totale: ['Restano da pagare', eur(r.restanoDaPagare)] });
  }

  await sezioneFoto(foglio, 'Foto al rientro', opzioni.foto, elencoFoto(prenotazione.fotoDanni));

  foglio.dichiarazione(DICHIARAZIONE_RIENTRO);
  foglio.osservazioni(r.firma?.osservazioni || '');
  foglio.firme(`Il cliente${prenotazione.cliente ? ` · ${prenotazione.cliente}` : ''}`, `Per ${azienda.nome || "l'azienda"} · operatore`, testoFirmaMancante(r.firma));
  foglio.spazio(8);
  foglio.piccolo(`Data: ${dataDoc}. ${NOTA_PRIVACY}`);
  return foglio.chiudi();
}

// Testo sopra le firme (da concordare con il cliente, file 03).
export const DICHIARAZIONE_RIENTRO = 'Il cliente ha riconsegnato il veicolo e prende atto dello stato descritto e degli addebiti indicati. '
  + 'Le contestazioni vanno comunicate per iscritto entro i termini delle condizioni di noleggio.';

// Chiede dove salvare e scrive il PDF (stesso salvataggio del riepilogo di consegna).
export async function salvaVerbaleRientro(prenotazione, azienda) {
  const foto = await leggiFotoVerbale(prenotazione.id, 'rientro');
  const pdf = await generaVerbaleRientroPdf(prenotazione, { azienda, foto });
  return window.electronAPI.salvaDocumentiPrenotazione({
    prenotazione,
    riepilogoPdf: Array.from(new Uint8Array(pdf)),
    titolo: 'Salva verbale di rientro',
    nomeBase: 'Verbale_rientro',
  });
}

// Stampa senza salvare: apre la finestra di stampa del sistema.
export async function stampaVerbaleRientro(prenotazione, azienda) {
  const foto = await leggiFotoVerbale(prenotazione.id, 'rientro');
  const pdf = await generaVerbaleRientroPdf(prenotazione, { azienda, foto });
  return window.electronAPI.stampaPdf({ pdf: Array.from(new Uint8Array(pdf)), nome: 'Verbale_rientro' });
}
