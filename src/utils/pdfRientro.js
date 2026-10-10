// Verbale di rientro (PDF), come quello di consegna: ora, km, carburante,
// chiavi, cosa non e' tornato, danni, addebiti e cauzione, spazio per le firme.
// Mockup approvato: formiarent-documenti/mockup/gestionale-rientro.html
import { dataEOra, formattaData } from './scadenze';
import { giorniInPiu, kmPercorsi, quartiCarburante } from './rientro';
import { nuovoFoglio, COLORI } from './pdfLayout';
import { riferimentoPrenotazione } from './pdfConsegna';

const eur = (n) => `${Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' })} EUR`;
const nKm = (n) => Number(n).toLocaleString('it-IT');

// Sezioni del verbale: [{ titolo, righe: [[etichetta, valore]] }]. Funzione pura (testata).
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
      ? [...addebiti.map((a) => [a.nome, eur(a.importo)]), ['Totale', eur(r.totaleAddebiti)]]
      : [['Totale', eur(0)]],
  });
  if (r.cauzione) {
    sezioni.push({
      titolo: 'Cauzione',
      righe: [
        ['Bloccata', eur(r.cauzione.importo)],
        ['Trattenuta', eur(r.cauzione.trattenuta)],
        ['Sbloccata', eur(r.cauzione.sbloccata)],
        ...(r.cauzione.restano > 0 ? [['Restano da pagare', eur(r.cauzione.restano)]] : []),
      ],
    });
  } else if (r.totaleAddebiti > 0) {
    sezioni.push({ titolo: 'Pagamento', righe: [['Restano da pagare', eur(r.restanoDaPagare)]] });
  }
  return sezioni;
}

// Verbale di rientro, con la stessa impaginazione di quello di consegna
// (pdfLayout.js). `opzioni`: { azienda }.
export async function generaVerbaleRientroPdf(prenotazione, opzioni = {}) {
  const azienda = opzioni.azienda || {};
  const r = prenotazione.rientro || {};
  const rif = riferimentoPrenotazione(prenotazione);
  const dataDoc = r.dataRientro ? formattaData(r.dataRientro) : new Date().toLocaleDateString('it-IT');
  const foglio = await nuovoFoglio({
    azienda,
    titolo: 'Verbale di rientro',
    sottotitolo: `${rif ? `Prenotazione n. ${rif} · ` : ''}${dataDoc}`,
    piede: `${azienda.nome ? `${azienda.nome} · ` : ''}Verbale di rientro${rif ? ` · Prenotazione ${rif}` : ''}`,
  });

  const extra = giorniInPiu({ prenotazione, dataRientro: r.dataRientro, oraRientro: r.oraRientro, tolleranza: prenotazione.tolleranzaMinuti });
  const percorsi = kmPercorsi(r.kmConsegna, r.km);
  const nonTornato = [...(r.dotazioneNonTornata || []), ...(r.extraNonTornati || [])];
  const addebiti = Array.isArray(r.addebiti) ? r.addebiti : [];

  foglio.colonne([
    { titolo: 'Cliente', righe: [['Nome', prenotazione.cliente || '-'], ...(prenotazione.telefono ? [['Telefono', prenotazione.telefono]] : [])] },
    {
      titolo: 'Noleggio',
      righe: [
        ['Veicolo', `${prenotazione.veicolo || '-'}${prenotazione.targa ? ` · ${prenotazione.targa}` : ''}`],
        ['Ritiro', dataEOra(prenotazione.dataInizio, prenotazione.oraInizio)],
        ['Riconsegna', dataEOra(prenotazione.dataFine, prenotazione.oraFine)],
      ],
    },
  ]);

  foglio.sezione("Com'è tornata");
  foglio.riquadri([
    {
      etichetta: 'Rientrata', valore: dataEOra(r.dataRientro, r.oraRientro).replace(/\/\d{4}/, ''),
      ...(extra > 0 ? { nota: `${extra} ${extra === 1 ? 'giorno' : 'giorni'} in più`, notaAllarme: true } : {}),
    },
    {
      etichetta: 'Chilometri', valore: r.km != null ? `${nKm(r.km)} km` : '-',
      ...(r.kmConsegna != null ? { nota: `dalla consegna: ${nKm(r.kmConsegna)}${percorsi !== null ? ` · percorsi ${nKm(percorsi)}` : ''}` } : {}),
    },
    { etichetta: 'Chiavi', valore: r.chiaviConsegnate ? `${r.chiaviTornate ?? '-'} di ${r.chiaviConsegnate}` : '-' },
  ], [1, 1.2, 0.8]);
  const quartiA = quartiCarburante(r.carburante);
  foglio.riquadri([
    {
      etichetta: 'Carburante: consegna -> rientro', valore: `${r.carburanteConsegna ? `${r.carburanteConsegna} -> ` : ''}${r.carburante || '-'}`,
      ...(quartiA ? { barra: { pieni: quartiA, totale: 4 } } : {}),
    },
    { etichetta: 'Non tornato', valore: nonTornato.length > 0 ? nonTornato.join(', ') : 'Niente', rosso: nonTornato.length > 0 },
  ], [2, 1]);
  foglio.riquadroTesto({
    etichetta: 'Danni nuovi',
    testo: prenotazione.descrizioneDanno ? `${prenotazione.descrizioneDanno}${prenotazione.daRiparare ? ' (da riparare)' : ''}` : 'Nessuno',
    immagine: await foglio.immagine([].concat(prenotazione.fotoDanni || [])[0]),
  });

  foglio.sezione('Addebiti');
  if (addebiti.length > 0) foglio.tabella(addebiti.map((a) => [a.nome, eur(a.importo)]), ['Totale addebiti', eur(r.totaleAddebiti)]);
  else foglio.piccolo('Nessun addebito.');

  if (r.cauzione) {
    foglio.sezione('Cauzione');
    foglio.riquadri([
      { etichetta: 'Bloccata', valore: eur(r.cauzione.importo) },
      { etichetta: 'Trattenuta', valore: eur(r.cauzione.trattenuta) },
      { etichetta: 'Sbloccata', valore: eur(r.cauzione.sbloccata) },
    ]);
    if (r.cauzione.restano > 0) foglio.piccolo(`Restano da pagare: ${eur(r.cauzione.restano)}`, COLORI.allarme, 9.5);
  } else if (r.totaleAddebiti > 0) {
    foglio.spazio(6);
    foglio.piccolo(`Restano da pagare: ${eur(r.restanoDaPagare)}`, COLORI.allarme, 9.5);
  }

  foglio.firme(`Data: ${dataDoc}`);
  return foglio.chiudi();
}

// Chiede dove salvare e scrive il PDF (stesso salvataggio del riepilogo di consegna).
export async function salvaVerbaleRientro(prenotazione, azienda) {
  const pdf = await generaVerbaleRientroPdf(prenotazione, { azienda });
  return window.electronAPI.salvaDocumentiPrenotazione({
    prenotazione,
    riepilogoPdf: Array.from(new Uint8Array(pdf)),
    titolo: 'Salva verbale di rientro',
    nomeBase: 'Verbale_rientro',
  });
}
