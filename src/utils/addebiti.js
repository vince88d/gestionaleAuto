// Listino «Penali e addebiti» (scheda di Tariffe e optional, ex «Addebiti al
// rientro»). Importi fissi che il gestionale propone, gia' compilati, quando si
// riceve l'auto (si possono sempre cambiare caso per caso), piu' le voci
// libere del titolare. Ogni voce puo' essere mostrata sul sito, nelle
// condizioni di noleggio. Il ritardo e' automatico (giorni in piu' x prezzo al
// giorno della prenotazione): qui si decide solo se mostrarlo.
// Documento impostazioni/addebiti, letto anche dal sito (src/lib/penali.ts:
// stesse regole). Funzioni pure, testate.
// Mockup approvato: formiarent-documenti/mockup/gestionale-listino-penali.html
import { leggiEuro } from './protezioni';

export const ADDEBITI = [
  { chiave: 'rifornimentoQuarto', nome: 'Rifornimento', aiuto: 'Per ogni quarto di serbatoio mancante rispetto alla consegna', unita: '€ / quarto' },
  { chiave: 'kmInPiu', nome: 'Km in più', aiuto: 'Per ogni km oltre quelli inclusi nella formula scelta dal cliente (solo per le formule con i km limitati, vedi la scheda Chilometri)', unita: '€ / km' },
  { chiave: 'pulizia', nome: 'Pulizia straordinaria', aiuto: 'Auto molto sporca, peli di animali, odore di fumo', unita: '€' },
  { chiave: 'chiave', nome: 'Chiave non restituita', aiuto: 'Per ogni chiave in meno rispetto a quelle consegnate', unita: '€ / chiave' },
  { chiave: 'oggettoMancante', nome: 'Oggetto della dotazione mancante', aiuto: 'Triangolo, giubbotto, cavo… (si cambia caso per caso)', unita: '€' },
  { chiave: 'gestioneMulta', nome: 'Gestione multa', aiuto: 'Spese di gestione per ogni verbale ricevuto dopo il noleggio. La multa vera si gira al cliente.', unita: '€ / verbale' },
];

// Il ritardo non ha un importo: e' automatico.
export const RITARDO = {
  chiave: 'ritardo',
  nome: 'Ritardo nella riconsegna',
  aiuto: 'Automatico: giorni in più × prezzo al giorno della prenotazione, oltre la tolleranza (vedi la tolleranza qui sotto).',
};

// Prezzi di partenza.
export const ADDEBITI_DI_PARTENZA = { rifornimentoQuarto: 20, kmInPiu: 0.25, pulizia: 30, chiave: 150, oggettoMancante: 15, gestioneMulta: 30 };

// Quali voci si mostrano sul sito, se il titolare non ha deciso.
export const SITO_DI_PARTENZA = {
  rifornimentoQuarto: true, kmInPiu: true, pulizia: true, chiave: true, oggettoMancante: false, gestioneMulta: true, ritardo: true,
};

export const MODI_VOCE = [
  { valore: 'volta', testo: 'una volta' },
  { valore: 'giorno', testo: 'al giorno' },
];

const importo = (v, base) => {
  const n = leggiEuro(v);
  return n === null || Number.isNaN(n) || n < 0 ? base : Math.round(n * 100) / 100;
};

let contatore = 0;
const nuovoId = () => `v${Date.now().toString(36)}${(contatore += 1).toString(36)}`;

// Voci libere: quelle senza nome si scartano, l'importo sbagliato diventa 0.
function normalizzaVoci(grezze) {
  const viste = new Set();
  return (Array.isArray(grezze) ? grezze : [])
    .map((v) => ({
      id: typeof v?.id === 'string' && v.id ? v.id : nuovoId(),
      nome: String(v?.nome ?? '').trim(),
      importo: importo(v?.importo, 0),
      modo: v?.modo === 'giorno' ? 'giorno' : 'volta',
      descrizione: String(v?.descrizione ?? '').trim(),
      sito: v?.sito !== false,
      attiva: v?.attiva !== false,
    }))
    .filter((v) => v.nome && !viste.has(v.id) && viste.add(v.id));
}

// Da Firestore (o dal form) a valori sicuri: il valore mancante o sbagliato
// torna a quello di partenza. Risultato: gli importi per chiave, `sito` (quali
// voci si mostrano) e `voci` (voci libere).
export function normalizzaAddebiti(dati = {}) {
  const d = dati && typeof dati === 'object' ? dati : {};
  const sito = d.sito && typeof d.sito === 'object' ? d.sito : {};
  // Voci di partenza che il gestore ha tolto: non si propongono al rientro e
  // non si mostrano sul sito, ma l'importo resta per poterle rimettere.
  const tolte = (Array.isArray(d.tolte) ? d.tolte : []).filter((k, i, a) => k in SITO_DI_PARTENZA && a.indexOf(k) === i);
  return {
    ...Object.fromEntries(ADDEBITI.map(({ chiave }) => [chiave, importo(d[chiave], ADDEBITI_DI_PARTENZA[chiave])])),
    sito: Object.fromEntries(Object.entries(SITO_DI_PARTENZA).map(([k, base]) => [k, !tolte.includes(k) && (typeof sito[k] === 'boolean' ? sito[k] : base)])),
    tolte,
    voci: normalizzaVoci(d.voci),
  };
}

// Errori per campo ({} se si puo' salvare). Chiavi: gli importi per chiave e
// "voci.0.nome", "voci.0.importo".
export function validaAddebiti(form = {}) {
  const errori = {};
  ADDEBITI.forEach(({ chiave }) => {
    if ((form.tolte || []).includes(chiave)) return;
    const n = leggiEuro(form[chiave]);
    if (n === null) errori[chiave] = 'Scrivi l\'importo (anche 0).';
    else if (Number.isNaN(n) || n < 0) errori[chiave] = 'Scrivi un importo, es. 20';
  });
  (form.voci || []).forEach((v, i) => {
    if (!String(v.nome ?? '').trim()) errori[`voci.${i}.nome`] = 'Scrivi il nome.';
    const n = leggiEuro(v.importo);
    if (n === null) errori[`voci.${i}.importo`] = 'Scrivi l\'importo.';
    else if (Number.isNaN(n) || n < 0) errori[`voci.${i}.importo`] = 'Scrivi un importo, es. 20';
  });
  return errori;
}

const testoEuro = (n) => n.toLocaleString('it-IT', { maximumFractionDigits: 2 });

// Campi del form (testo, all'italiana) dai dati salvati.
export function addebitiPerForm(dati) {
  const n = normalizzaAddebiti(dati);
  return {
    ...Object.fromEntries(ADDEBITI.map(({ chiave }) => [chiave, testoEuro(n[chiave])])),
    sito: { ...n.sito },
    tolte: [...n.tolte],
    voci: n.voci.map((v) => ({ ...v, importo: testoEuro(v.importo) })),
  };
}

// Dal form ai valori da salvare.
export const preparaAddebiti = (form) => normalizzaAddebiti(form);

// Una voce libera nuova, per il pulsante «Aggiungi una voce».
export const nuovaVoce = () => ({ id: nuovoId(), nome: '', importo: '', modo: 'volta', descrizione: '', sito: true, attiva: true });

// Righe «Altri addebiti dal listino» del rientro: voci che non nascono dalla
// riconsegna (pulizia, multa, oggetto) e le voci libere. `giorni` = giorni del
// noleggio, per le voci «al giorno».
export function vociLibereListino(prezzi, giorni = 1) {
  const g = Math.max(1, Math.round(Number(giorni) || 1));
  return (prezzi?.voci || []).filter((v) => v.attiva !== false && v.importo > 0).map((v) => ({
    id: `listino:${v.id}`,
    nome: v.nome,
    dettaglio: v.modo === 'giorno' ? `${testoEuro(v.importo)} € × ${g} ${g === 1 ? 'giorno' : 'giorni'}` : 'Voce del listino',
    importo: Math.round(v.importo * (v.modo === 'giorno' ? g : 1) * 100) / 100,
    attiva: false,
    gruppo: 'listino',
  }));
}

// Testi per l'anteprima «Come lo vede il cliente»: [{ id, nome, testo }] delle
// voci da mostrare sul sito (importo 0 = gratis, non si mostra; il ritardo si
// mostra sempre se acceso).
export function vociPerSito(dati, tolleranza) {
  const n = normalizzaAddebiti(dati);
  const righe = [];
  ADDEBITI.forEach(({ chiave, nome, unita }) => {
    if (!n.sito[chiave] || !(n[chiave] > 0)) return;
    righe.push({ id: chiave, nome, testo: `${testoEuro(n[chiave])} €${unita.includes('/') ? ` ${unita.replace('€ / ', 'per ')}` : ''}` });
  });
  n.voci.forEach((v) => {
    if (!v.attiva || !v.sito || !(v.importo > 0)) return;
    righe.push({ id: v.id, nome: v.nome, testo: `${testoEuro(v.importo)} €${v.modo === 'giorno' ? ' al giorno' : ''}` });
  });
  if (n.sito.ritardo) {
    righe.push({
      id: 'ritardo',
      nome: RITARDO.nome,
      testo: Number(tolleranza) > 0 ? `oltre ${tolleranza} minuti si paga un giorno in più` : 'si paga un giorno in più',
    });
  }
  return righe;
}
