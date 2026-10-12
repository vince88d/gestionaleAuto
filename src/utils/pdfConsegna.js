// PDF del riepilogo di consegna (cliente, veicolo, scheda, spazio firma).
// Usato alla consegna e, per riscaricarlo dopo, dai dettagli della prenotazione.
import { prezzoPrenotazione } from './dashboard';
import { COPERTURE } from './protezioni';
import { riassuntoDotazione } from './dotazione';
import { dataEOra, formattaData } from './scadenze';
import { nuovoFoglio } from './pdfLayout';
import { calcolaGiorniNoleggio } from './giorniNoleggio';
import { quartiCarburante } from './rientro';
import { danniConsegna, elencoFoto } from './danni';

// "1.200 €" / "36,00 €" (il font standard scrive il simbolo dell'euro).
const eur = (n, decimali = false) => `${Number(n || 0).toLocaleString('it-IT', {
  minimumFractionDigits: decimali ? 2 : 0, maximumFractionDigits: 2, useGrouping: 'always',
})} €`;

// Voci della tabella «Protezione, cauzione ed extra» del verbale:
// { righe: [[voce, dettaglio, importo]], cauzione: { importo, bloccata } | null }.
// Vuote per le prenotazioni senza protezione, extra e giovane conducente.
export function vociProtezioneExtra(prenotazione = {}) {
  const p = prenotazione.protezione;
  const righe = [];
  let cauzione = null;
  if (p) {
    const limiti = [
      typeof p.danni === 'number' ? `danni max ${eur(p.danni)}` : '',
      typeof p.furto === 'number' ? `furto max ${eur(p.furto)}` : '',
    ].filter(Boolean).join(', ');
    const coperte = COPERTURE.filter(([k]) => p.copre?.[k]).map(([, nome]) => nome.toLowerCase());
    const dettaglio = [limiti && `A carico del cliente: ${limiti}`, coperte.length > 0 && `Copre anche ${coperte.join(', ')}`].filter(Boolean).join('. ');
    righe.push([p.tipo === 'totale' ? 'Protezione Totale' : 'Protezione Base', dettaglio || '-', p.tipo === 'totale' ? eur(p.prezzo, true) : 'Inclusa']);
    if (typeof p.cauzione === 'number') cauzione = { importo: p.cauzione, bloccata: Boolean(prenotazione.cauzioneBloccata) };
  }
  (Array.isArray(prenotazione.optional) ? prenotazione.optional : []).filter((r) => r?.quantita > 0)
    .forEach((r) => righe.push([r.nome, `${r.quantita} ${r.quantita === 1 ? 'pezzo' : 'pezzi'}`, eur(r.totale, true)]));
  const g = prenotazione.giovaneConducente;
  if (g) {
    righe.push(['Giovane conducente', g.alMassimo
      ? `${g.eta} anni, importo massimo`
      : `${eur(g.euroGiorno, true)} al giorno × ${g.giorni} ${g.giorni === 1 ? 'giorno' : 'giorni'}`, eur(g.importo, true)]);
  }
  return { righe, cauzione };
}

// Testo sopra le firme (da concordare con il cliente insieme alle condizioni di noleggio, file 03).
export const DICHIARAZIONE_CONSEGNA = 'Il cliente dichiara di aver ricevuto il veicolo nello stato sopra descritto, con la dotazione indicata, '
  + 'e di impegnarsi a riconsegnarlo entro i termini concordati. Valgono le condizioni di noleggio sottoscritte.';
export const NOTA_PRIVACY = 'Copia consegnata al cliente. I dati sono trattati ai sensi del Regolamento (UE) 2016/679.';

// "AB1234567 · scade 04/2031"
const patenteTesto = (patente, scadenza) => {
  if (!patente) return '';
  const d = /^(\d{4})-(\d{2})/.exec(scadenza || '');
  return d ? `${patente} · scade ${d[2]}/${d[1]}` : patente;
};

// Riferimento breve della prenotazione per testata e piede.
export const riferimentoPrenotazione = (p) => String(p?.id || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();

// "12/10" da una data.
export const dataBreve = (valore) => formattaData(valore).split('/').slice(0, 2).join('/');

// Verbale di consegna. `opzioni`: { azienda, scadenzaPatente }.
// Mockup approvato: formiarent-documenti/mockup/gestionale-pdf-verbali-v2.html
export async function generaRiepilogoPdf(prenotazione, scheda = {}, opzioni = {}) {
  const azienda = opzioni.azienda || {};
  const rif = riferimentoPrenotazione(prenotazione);
  const quando = prenotazione.consegnataIl ? new Date(prenotazione.consegnataIl) : new Date();
  const dataDoc = quando.toLocaleDateString('it-IT');
  const foglio = await nuovoFoglio({
    azienda,
    titolo: 'Verbale di consegna',
    numero: rif,
    data: dataDoc,
    copia: 'Copia per il cliente',
    riepilogo: [prenotazione.cliente, [prenotazione.veicolo, prenotazione.targa].filter(Boolean).join(' ')].filter(Boolean).join(' · '),
    piede: `${azienda.nome ? `${azienda.nome} · ` : ''}Verbale di consegna${rif ? ` · N. ${rif}` : ''}`,
    soggetto: `Verbale di consegna del veicolo a ${prenotazione.cliente || 'cliente'}`,
  });

  const giorni = calcolaGiorniNoleggio(prenotazione.dataInizio, prenotazione.dataFine, prenotazione.oraInizio, prenotazione.oraFine, prenotazione.tolleranzaMinuti);
  const auto = `${prenotazione.veicolo || '-'}${prenotazione.targa ? ` · ${prenotazione.targa}` : ''}`;
  const prezzo = prezzoPrenotazione(prenotazione);
  const pieno = (r) => r.filter(([, v]) => v);

  foglio.fascia([
    { etichetta: 'Cliente', valore: prenotazione.cliente || '-' },
    { etichetta: 'Veicolo', valore: auto },
    { etichetta: 'Periodo', valore: `${dataBreve(prenotazione.dataInizio)} al ${dataBreve(prenotazione.dataFine)}` },
    { etichetta: 'Durata', valore: giorni > 0 ? `${giorni} ${giorni === 1 ? 'giorno' : 'giorni'}` : '-' },
  ], [1.2, 1.9, 1.2, 0.8]);

  foglio.sezione('Cliente e noleggio');
  foglio.coppie(
    pieno([
      ['Nome', prenotazione.cliente || '-'],
      ['Codice fiscale', prenotazione.codiceFiscale],
      ['Patente', patenteTesto(prenotazione.patente, opzioni.scadenzaPatente)],
      ['Telefono', prenotazione.telefono],
      ['Email', prenotazione.emailCliente],
    ]),
    pieno([
      ['Ritiro', dataEOra(prenotazione.dataInizio, prenotazione.oraInizio)],
      ['Riconsegna', prenotazione.oraFine ? `entro ${dataEOra(prenotazione.dataFine, prenotazione.oraFine)}` : formattaData(prenotazione.dataFine)],
      ['Età conducente', typeof prenotazione.etaConducente === 'number' ? `${prenotazione.etaConducente} anni` : ''],
      ['Totale noleggio', prezzo > 0 ? eur(prezzo, true) : ''],
    ]),
  );

  const dotazione = riassuntoDotazione(scheda);
  const quarti = quartiCarburante(scheda.carburante);
  foglio.sezione("Stato dell'auto alla consegna");
  foglio.riquadri([
    { etichetta: 'Chilometri', valore: scheda.kmIniziali ? `${Number(scheda.kmIniziali).toLocaleString('it-IT')} km` : '-' },
    { etichetta: 'Carburante', valore: scheda.carburante || '-', ...(quarti ? { barra: { pieni: quarti, totale: 4 } } : {}) },
    { etichetta: 'Chiavi consegnate', valore: dotazione.chiaviConsegnate ? String(dotazione.chiaviConsegnate) : '-' },
  ], [1, 1.2, 1]);
  foglio.danni(danniConsegna(scheda), {
    vuoto: 'Nessun danno segnato alla consegna',
    nota: 'Il cliente può far annotare qui anche danni minori prima di firmare.',
  });

  foglio.sezione('Dotazione a bordo');
  const voci = [
    ...dotazione.presenti.map((testo) => ({ testo, ok: true })),
    ...dotazione.mancanti.map((testo) => ({ testo: `${testo}: mancante`, manca: true })),
  ];
  if (voci.length > 0) foglio.caselle(voci);
  else foglio.piccolo('Dotazione non segnata alla consegna.');
  if (dotazione.note) { foglio.spazio(4); foglio.piccolo(`Note: ${dotazione.note}`); }

  const { righe, cauzione } = vociProtezioneExtra(prenotazione);
  if (righe.length > 0 || cauzione) {
    foglio.sezione('Protezione, cauzione ed extra');
    if (righe.length > 0) {
      foglio.tabella({
        colonne: [{ titolo: 'Voce', peso: 1.3 }, { titolo: 'Dettaglio', peso: 2.6 }, { titolo: 'Importo', peso: 0.9, destra: true }],
        righe,
      });
    }
    if (cauzione) {
      foglio.riquadroDati({
        etichetta: 'Cauzione',
        righe: [['Importo', eur(cauzione.importo, true)]],
        nota: `${cauzione.bloccata ? 'Bloccata sulla carta del cliente. ' : ''}Viene restituita al rientro, salvo gli addebiti indicati nel verbale di rientro.`,
      });
    }
  }

  const fotoDanni = elencoFoto(scheda.fotoDanni);
  if (fotoDanni.length > 0) {
    foglio.sezione('Foto alla consegna');
    const immagini = await Promise.all(fotoDanni.map((f) => foglio.immagine(f)));
    const items = immagini.map((immagine, i) => ({ immagine, etichetta: `Danni ${i + 1}` })).filter((it) => it.immagine);
    if (items.length > 0) foglio.foto(items);
  }

  foglio.dichiarazione(DICHIARAZIONE_CONSEGNA);
  foglio.firme(`Il cliente${prenotazione.cliente ? ` · ${prenotazione.cliente}` : ''}`, `Per ${azienda.nome || "l'azienda"} · operatore`);
  foglio.spazio(8);
  foglio.piccolo(`Data: ${dataDoc}. ${NOTA_PRIVACY}`);
  return foglio.chiudi();
}

// Chiede dove salvare e scrive il PDF (piu' l'eventuale contratto).
// Restituisce { success, cancelled, paths, error } come l'API di Electron.
export async function salvaPdfConsegna({ prenotazione, scheda, contrattoPdf = null, nomeContratto = '', azienda, scadenzaPatente }) {
  const riepilogo = await generaRiepilogoPdf(prenotazione, scheda || prenotazione.schedaVeicolo || {}, { azienda, scadenzaPatente });
  return window.electronAPI.salvaDocumentiPrenotazione({
    prenotazione,
    riepilogoPdf: Array.from(new Uint8Array(riepilogo)),
    contrattoPdf,
    nomeContratto,
  });
}
