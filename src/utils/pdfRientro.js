// Verbale di rientro (PDF), come quello di consegna: ora, km, carburante,
// chiavi, cosa non e' tornato, danni, addebiti e cauzione, spazio per le firme.
// Mockup approvato: formiarent-documenti/mockup/gestionale-rientro.html
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { dataEOra } from './scadenze';
import { giorniInPiu, kmPercorsi } from './rientro';

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

export async function generaVerbaleRientroPdf(prenotazione) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const indent = 50;
  let page = doc.addPage([595, 842]);
  let y = 800;
  const libero = (altezza) => {
    if (y - altezza < 60) { page = doc.addPage([595, 842]); y = 800; }
  };

  page.drawText('Verbale di rientro', { x: indent, y, size: 20, font: bold, color: rgb(0.1, 0.2, 0.5) });
  y -= 30;

  sezioniRientro(prenotazione).forEach(({ titolo, righe }) => {
    libero(40 + righe.length * 18);
    page.drawText(titolo, { x: indent, y, size: 14, font: bold, color: rgb(0.1, 0.1, 0.1) });
    y -= 20;
    page.drawLine({ start: { x: indent, y }, end: { x: 545, y }, thickness: 0.8, color: rgb(0.8, 0.8, 0.8) });
    y -= 10;
    righe.forEach(([etichetta, valore]) => {
      libero(18);
      const ultima = etichetta === 'Totale';
      page.drawText(`${etichetta}:`, { x: indent, y, size: 12, font: bold, color: rgb(0.2, 0.2, 0.2) });
      page.drawText(String(valore || '-'), { x: indent + 150, y, size: 12, font: ultima ? bold : font, color: rgb(0, 0, 0) });
      y -= 18;
    });
    y -= 8;
  });

  libero(80);
  y -= 24;
  [[indent, 'Firma del cliente'], [indent + 280, 'Firma per l\'azienda']].forEach(([x, testo]) => {
    page.drawLine({ start: { x, y }, end: { x: x + 215, y }, thickness: 1, color: rgb(0, 0, 0) });
    page.drawText(testo, { x, y: y - 15, size: 12, font, color: rgb(0, 0, 0) });
  });
  return doc.save();
}

// Chiede dove salvare e scrive il PDF (stesso salvataggio del riepilogo di consegna).
export async function salvaVerbaleRientro(prenotazione) {
  const pdf = await generaVerbaleRientroPdf(prenotazione);
  return window.electronAPI.salvaDocumentiPrenotazione({
    prenotazione,
    riepilogoPdf: Array.from(new Uint8Array(pdf)),
    titolo: 'Salva verbale di rientro',
    nomeBase: 'Verbale_rientro',
  });
}
