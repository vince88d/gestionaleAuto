// Formule dei chilometri (scheda «Chilometri» di Tariffe e optional): lo staff
// decide quali formule offre (es. «200 km al giorno», «Km illimitati»), ognuna
// con un supplemento al giorno uguale per tutte le categorie. Una e' «di
// partenza»: e' compresa nel prezzo al giorno (supplemento 0) ed e' gia' scelta.
// Il cliente sceglie la formula quando prenota (sito o banco); i km oltre
// quelli inclusi si pagano al rientro, al prezzo «Km in piu'» di Penali e addebiti.
// Documento impostazioni/chilometri → { formule: [{ id, km, supplemento, partenza }] }
// (km null = illimitati). Deve restare allineato a formiarent
// (functions/src/chilometri.ts e src/lib/chilometri.ts). Funzioni pure, testate.
// Mockup approvato: formiarent-documenti/mockup/gestionale-sito-km.html
import { leggiEuro } from './protezioni';

const arrotonda = (n) => Math.round(n * 100) / 100;

// Come oggi: una sola formula, km illimitati, nessuna scelta per il cliente.
export const FORMULE_DI_PARTENZA = [{ id: 'illimitati', km: null, supplemento: 0, partenza: true }];

let contatore = 0;
const nuovoId = () => `f${Date.now().toString(36)}${(contatore += 1).toString(36)}`;

const kmValidi = (v) => {
  const n = Number(String(v ?? '').replace(/\./g, '').replace(',', '.'));
  return Number.isInteger(n) && n > 0 ? n : null;
};

// Da Firestore (o dal form) a valori sicuri: almeno una formula, una sola di
// partenza (se manca, la prima) e con supplemento 0.
export function normalizzaFormule(dati) {
  const grezze = Array.isArray(dati?.formule) ? dati.formule : [];
  const viste = new Set();
  const formule = [];
  grezze.forEach((f) => {
    const illimitati = f?.km === null || f?.illimitati === true;
    const km = illimitati ? null : kmValidi(f?.km);
    if (!illimitati && km === null) return; // limitata senza km validi: non si usa
    const id = typeof f?.id === 'string' && f.id ? f.id : nuovoId();
    if (viste.has(id)) return;
    viste.add(id);
    const s = leggiEuro(f?.supplemento);
    formule.push({ id, km, supplemento: s === null || Number.isNaN(s) || s < 0 ? 0 : arrotonda(s), partenza: f?.partenza === true });
  });
  if (formule.length === 0) return { formule: FORMULE_DI_PARTENZA.map((f) => ({ ...f })) };
  const iPartenza = Math.max(0, formule.findIndex((f) => f.partenza));
  return { formule: formule.map((f, i) => ({ ...f, partenza: i === iPartenza, supplemento: i === iPartenza ? 0 : f.supplemento })) };
}

export const formulaDiPartenza = (formule) => formule.find((f) => f.partenza) || formule[0];

// La formula con quell'id, altrimenti quella di partenza.
export const trovaFormula = (formule, id) => formule.find((f) => f.id === id) || formulaDiPartenza(formule);

// Il cliente sceglie solo se ci sono almeno due formule.
export const ciSonoScelte = (formule) => formule.length > 1;

const numero = (n) => n.toLocaleString('it-IT', { useGrouping: 'always' });

export const nomeFormula = (f) => (f.km === null ? 'Km illimitati' : `${numero(f.km)} km al giorno`);

// Km inclusi per tutto il noleggio (null = illimitati).
export const kmInclusi = (f, giorni) => (f.km === null ? null : f.km * Math.max(1, giorni || 1));

// Cosa si salva nella prenotazione: formula, km inclusi, supplemento e prezzo
// del km in piu' di adesso (se lo staff li cambia, la prenotazione non cambia).
export function chilometriPrenotazione(formula, giorni, euroKmInPiu) {
  const g = Math.max(1, giorni || 1);
  return {
    formulaId: formula.id,
    nome: nomeFormula(formula),
    kmGiorno: formula.km,
    kmInclusi: kmInclusi(formula, g),
    supplementoGiorno: formula.supplemento,
    importo: arrotonda(formula.supplemento * g),
    euroKmInPiu: formula.km === null ? null : arrotonda(Number(euroKmInPiu) || 0),
  };
}

// Km in piu' al rientro: { km, importo } (km 0 = niente da pagare).
export function kmInPiu(chilometri, percorsi, euroKmInPiu) {
  if (!chilometri || chilometri.kmInclusi === null || chilometri.kmInclusi === undefined || percorsi === null || percorsi === undefined) {
    return { km: 0, importo: 0 };
  }
  const km = Math.max(0, Number(percorsi) - Number(chilometri.kmInclusi));
  const euro = typeof chilometri.euroKmInPiu === 'number' ? chilometri.euroKmInPiu : Number(euroKmInPiu) || 0;
  return { km, importo: arrotonda(km * euro) };
}

// --- Form della scheda «Chilometri» ---------------------------------------

export const formulePerForm = (dati) => normalizzaFormule(dati).formule.map((f) => ({
  id: f.id,
  illimitati: f.km === null,
  km: f.km === null ? '' : String(f.km),
  supplemento: f.supplemento.toLocaleString('it-IT', { maximumFractionDigits: 2 }),
  partenza: f.partenza,
}));

export const nuovaFormula = () => ({ id: nuovoId(), illimitati: false, km: '', supplemento: '', partenza: false });

// Errori per campo ("0.km", "1.supplemento", "doppie") — {} se si puo' salvare.
export function validaFormule(righe = []) {
  const errori = {};
  righe.forEach((r, i) => {
    if (!r.illimitati && kmValidi(r.km) === null) errori[`${i}.km`] = 'Scrivi i km al giorno, es. 200';
    if (!r.partenza) {
      const s = leggiEuro(r.supplemento);
      if (s === null) errori[`${i}.supplemento`] = 'Scrivi il supplemento (anche 0).';
      else if (Number.isNaN(s) || s < 0) errori[`${i}.supplemento`] = 'Scrivi un importo, es. 6';
    }
  });
  const chiavi = righe.map((r) => (r.illimitati ? 'illimitati' : String(kmValidi(r.km))));
  if (new Set(chiavi).size !== chiavi.length) errori.doppie = 'Due formule hanno gli stessi km: tienine una sola.';
  return errori;
}

export const preparaFormule = (righe = []) => normalizzaFormule({
  formule: righe.map((r) => ({ id: r.id, km: r.illimitati ? null : r.km, supplemento: r.partenza ? 0 : r.supplemento, partenza: r.partenza })),
});
