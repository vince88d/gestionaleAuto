// PDF del riepilogo di consegna (cliente, veicolo, scheda, spazio firma).
// Usato alla consegna e, per riscaricarlo dopo, dai dettagli della prenotazione.
import { prezzoPrenotazione } from './dashboard';
import { COPERTURE } from './protezioni';
import { riassuntoDotazione } from './dotazione';
import { dataEOra, formattaData } from './scadenze';
import { nuovoFoglio } from './pdfLayout';
import { calcolaGiorniNoleggio } from './giorniNoleggio';
import { quartiCarburante } from './rientro';

// "1.200 EUR" / "36,00 EUR": nel PDF si scrive EUR come nel resto del riepilogo.
const eur = (n, decimali = false) => `${Number(n || 0).toLocaleString('it-IT', {
  minimumFractionDigits: decimali ? 2 : 0, maximumFractionDigits: 2, useGrouping: 'always',
})} EUR`;

// Righe [etichetta, valore] della sezione "Protezione ed extra" del PDF.
// Vuoto per le prenotazioni senza protezione ne' extra (quelle di prima).
export function righeProtezioneExtra(prenotazione = {}) {
  const p = prenotazione.protezione;
  const extra = (Array.isArray(prenotazione.optional) ? prenotazione.optional : []).filter((r) => r?.quantita > 0);
  const righe = [];
  if (p) {
    righe.push(['Protezione', p.tipo === 'totale' ? `Totale (${eur(p.prezzo, true)})` : 'Base (inclusa)']);
    if (typeof p.danni === 'number') righe.push(['Danni (max)', `${eur(p.danni)} a carico del cliente`]);
    if (typeof p.furto === 'number') righe.push(['Furto (max)', `${eur(p.furto)} a carico del cliente`]);
    if (typeof p.cauzione === 'number') {
      righe.push(['Cauzione', `${eur(p.cauzione)}${prenotazione.cauzioneBloccata ? ' - bloccata sulla carta' : ''}`]);
    }
    const coperte = COPERTURE.filter(([k]) => p.copre?.[k]).map(([, nome], i) => (i === 0 ? nome : nome.toLowerCase()));
    if (coperte.length > 0) righe.push(['Copre anche', coperte.join(', ')]);
  }
  extra.forEach((r, i) => righe.push([i === 0 ? 'Extra' : '', `${r.nome} x ${r.quantita} (${eur(r.totale, true)})`]));
  return righe;
}

// Righe [etichetta, valore] della dotazione nel PDF.
export function righeDotazione(scheda = {}) {
  const { presenti, mancanti, chiaviConsegnate, note } = riassuntoDotazione(scheda);
  const righe = [];
  if (chiaviConsegnate) righe.push(['Chiavi consegnate', String(chiaviConsegnate)]);
  if (presenti.length > 0) righe.push(['A bordo', presenti.join(', ')]);
  if (mancanti.length > 0) righe.push(['Mancante', `${mancanti.join(', ')}${note ? ` (${note})` : ''}`]);
  else if (note) righe.push(['Note dotazione', note]);
  return righe;
}

// Testo sopra le firme (da concordare con il cliente insieme alle condizioni di noleggio, file 03).
export const DICHIARAZIONE_CONSEGNA = 'Il cliente dichiara di aver ricevuto il veicolo nello stato sopra descritto, con la dotazione indicata, '
  + 'e di impegnarsi a riconsegnarlo entro i termini concordati. Valgono le condizioni di noleggio sottoscritte.';

const euroPdf = (n) => `${Number(n || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' })} EUR`;

// "AB1234567 · scade 04/2031"
const patenteTesto = (patente, scadenza) => {
  if (!patente) return '';
  const d = /^(\d{4})-(\d{2})/.exec(scadenza || '');
  return d ? `${patente} · scade ${d[2]}/${d[1]}` : patente;
};

// Riferimento breve della prenotazione per testata e piede.
export const riferimentoPrenotazione = (p) => String(p?.id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();

// Verbale di consegna (pagina A4). `opzioni`: { azienda, scadenzaPatente }.
// L'impaginazione sta in pdfLayout.js; mockup approvato in
// formiarent-documenti/mockup/gestionale-pdf-consegna.html.
export async function generaRiepilogoPdf(prenotazione, scheda = {}, opzioni = {}) {
  const azienda = opzioni.azienda || {};
  const rif = riferimentoPrenotazione(prenotazione);
  const quando = prenotazione.consegnataIl ? new Date(prenotazione.consegnataIl) : new Date();
  const dataDoc = quando.toLocaleDateString('it-IT');
  const foglio = await nuovoFoglio({
    azienda,
    titolo: 'Verbale di consegna',
    sottotitolo: `${rif ? `Prenotazione n. ${rif} · ` : ''}${dataDoc}`,
    piede: `${azienda.nome ? `${azienda.nome} · ` : ''}Verbale di consegna${rif ? ` · Prenotazione ${rif}` : ''}`,
  });

  const giorni = calcolaGiorniNoleggio(prenotazione.dataInizio, prenotazione.dataFine, prenotazione.oraInizio, prenotazione.oraFine, prenotazione.tolleranzaMinuti);
  const riconsegna = prenotazione.oraFine
    ? `entro ${dataEOra(prenotazione.dataFine, prenotazione.oraFine)}`
    : formattaData(prenotazione.dataFine);
  const prezzo = prezzoPrenotazione(prenotazione);
  const pieno = (r) => r.filter(([, v]) => v);

  foglio.colonne([
    {
      titolo: 'Cliente',
      righe: pieno([
        ['Nome', prenotazione.cliente || '-'],
        ['Codice fiscale', prenotazione.codiceFiscale],
        ['Patente', patenteTesto(prenotazione.patente, opzioni.scadenzaPatente)],
        ['Telefono', prenotazione.telefono],
        ['Email', prenotazione.emailCliente],
      ]),
    },
    {
      titolo: 'Noleggio',
      righe: pieno([
        ['Veicolo', `${prenotazione.veicolo || '-'}${prenotazione.targa ? ` · ${prenotazione.targa}` : ''}`],
        ['Ritiro', dataEOra(prenotazione.dataInizio, prenotazione.oraInizio)],
        ['Riconsegna', riconsegna],
        ['Durata', giorni > 0 ? `${giorni} ${giorni === 1 ? 'giorno' : 'giorni'}` : ''],
        ['Totale noleggio', prezzo > 0 ? euroPdf(prezzo) : ''],
      ]),
    },
  ]);

  const dotazione = riassuntoDotazione(scheda);
  const quarti = quartiCarburante(scheda.carburante);
  foglio.sezione('Stato del veicolo alla consegna');
  foglio.riquadri([
    { etichetta: 'Chilometri', valore: scheda.kmIniziali ? `${Number(scheda.kmIniziali).toLocaleString('it-IT')} km` : '-' },
    { etichetta: 'Carburante', valore: scheda.carburante || '-', ...(quarti ? { barra: { pieni: quarti, totale: 4 } } : {}) },
    { etichetta: 'Chiavi consegnate', valore: dotazione.chiaviConsegnate ? String(dotazione.chiaviConsegnate) : '-' },
  ], [1, 1.2, 0.8]);
  foglio.riquadroTesto({
    etichetta: 'Danni già presenti',
    testo: scheda.danni || 'Nessuno',
    immagine: await foglio.immagine(scheda.fotoDanni),
  });

  foglio.sezione('Dotazione a bordo');
  const voci = [
    ...dotazione.presenti.map((testo) => ({ testo, ok: true })),
    ...dotazione.mancanti.map((testo) => ({ testo: `${testo}: mancante`, manca: true })),
  ];
  if (voci.length > 0) foglio.elencoCaselle(voci);
  else foglio.piccolo('Dotazione non segnata alla consegna.');
  if (dotazione.note) { foglio.spazio(4); foglio.piccolo(`Note: ${dotazione.note}`); }

  const righe = righeProtezioneExtra(prenotazione);
  if (righe.length > 0) {
    foglio.sezione('Protezione, cauzione ed extra');
    const CHIAVI_SINISTRA = ['Protezione', 'Danni (max)', 'Furto (max)', 'Copre anche'];
    const sinistra = righe.filter(([e]) => CHIAVI_SINISTRA.includes(e));
    const destra = righe.filter(([e]) => !CHIAVI_SINISTRA.includes(e));
    foglio.datiADueColonne(sinistra, destra);
  }

  foglio.paragrafo(DICHIARAZIONE_CONSEGNA);
  foglio.firme(`Data: ${dataDoc}`);
  return foglio.chiudi();
}

// Chiede dove salvare e scrive il PDF (piu' l'eventuale contratto).
// Restituisce { success, cancelled, paths, error } come l'API di Electron.
export async function salvaPdfConsegna({ prenotazione, scheda, contrattoPdf = null, nomeContratto = '', azienda, scadenzaPatente }) {
  const riepilogo = await generaRiepilogoPdf(prenotazione, scheda || prenotazione.schedaVeicolo || {}, { azienda, scadenzaPatente });
  return window.electronAPI.salvaDocumentiPrenotazione({
    prenotazione,
    riepilogoPdf: Array.from(new Uint8Array(riepilogo)),
    titolo: 'Salva verbale di consegna',
    nomeBase: 'Verbale_consegna',
    contrattoPdf,
    nomeContratto,
  });
}
