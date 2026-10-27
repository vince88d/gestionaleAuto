// Formule dei chilometri (scheda «Chilometri» di Tariffe e optional). Lo staff
// decide COME il cliente indica i km quando prenota o chiede un preventivo:
//  - modo «pacchetti»: il cliente sceglie tra le formule che lo staff inserisce
//    (es. «200 km al giorno», «Km illimitati»), ognuna con un supplemento al
//    giorno (0 = incluso nel prezzo; il supplemento conta solo con «Prezzi online»);
//  - modo «dichiarati»: il cliente scrive quanti km pensa di fare IN TUTTO (o
//    sceglie «Km illimitati» se lo staff lo permette) e lo staff fa il preventivo
//    su quelli. Vale solo con il sito in «Solo richieste» (online serve un prezzo certo).
// I km oltre quelli inclusi (quelli della formula, o i dichiarati) si pagano al
// rientro, al prezzo «Km in piu'» di Penali e addebiti.
// Documento impostazioni/chilometri → { modo, dichiaratiIllimitati, formule: [{ id, km, supplemento }] }
// (km null = illimitati). Deve restare allineato a formiarent
// (functions/src/chilometri.ts e src/lib/chilometri.ts). Funzioni pure, testate.
// Mockup approvato: formiarent-documenti/mockup/gestionale-km-formule-v4.html
import { leggiEuro } from './protezioni';

const arrotonda = (n) => Math.round(n * 100) / 100;

export const KM_DICHIARATI_MAX = 99999;

// Come oggi: una sola formula, km illimitati, nessuna scelta per il cliente.
export const FORMULE_DI_PARTENZA = [{ id: 'illimitati', km: null, supplemento: 0 }];

let contatore = 0;
const nuovoId = () => `f${Date.now().toString(36)}${(contatore += 1).toString(36)}`;

const kmValidi = (v) => {
  const n = Number(String(v ?? '').replace(/\./g, '').replace(',', '.'));
  return Number.isInteger(n) && n > 0 ? n : null;
};

// Km dichiarati dal cliente: intero da 1 a KM_DICHIARATI_MAX, altrimenti null.
export const kmDichiaratiValidi = (v) => {
  const n = kmValidi(v);
  return n !== null && n <= KM_DICHIARATI_MAX ? n : null;
};

// Meno km prima, gli illimitati per ultimi (stesso ordine sul sito).
const ordina = (formule) => formule
  .map((f, i) => ({ f, i }))
  .sort((a, b) => ((a.f.km ?? Infinity) - (b.f.km ?? Infinity)) || (a.i - b.i))
  .map(({ f }) => f);

// Da Firestore (o dal form) a valori sicuri: almeno una formula, ordinate.
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
    formule.push({ id, km, supplemento: s === null || Number.isNaN(s) || s < 0 ? 0 : arrotonda(s) });
  });
  return {
    modo: dati?.modo === 'dichiarati' ? 'dichiarati' : 'pacchetti',
    dichiaratiIllimitati: dati?.dichiaratiIllimitati !== false,
    formule: ordina(formule.length === 0 ? FORMULE_DI_PARTENZA.map((f) => ({ ...f })) : formule),
  };
}

// Il modo che vale davvero: «dichiarati» solo con il sito in «Solo richieste».
export const modoEffettivo = (modo, modalitaSito) => (modo === 'dichiarati' && modalitaSito === 'richiesta' ? 'dichiarati' : 'pacchetti');

// La formula con quell'id; senza id (o sconosciuto) la prima.
export const trovaFormula = (formule, id) => formule.find((f) => f.id === id) || formule[0];

// Il cliente deve scegliere (o scrivere i km) se i pacchetti sono almeno due,
// o se il modo e' «dichiarati». `imp` = { modo, formule } normalizzato.
export const ciSonoScelte = (imp) => imp?.modo === 'dichiarati' || (imp?.formule?.length ?? 0) > 1;

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
    euroKmInPiu: formula.km === null ? null : arrotonda(euroKmInPiu),
  };
}

// Modo «dichiarati»: i km scritti dal cliente sono i km inclusi; il prezzo lo
// scrive lo staff nel preventivo (qui nessun importo).
export function chilometriDichiarati(km, euroKmInPiu) {
  return {
    formulaId: 'dichiarati',
    nome: `${numero(km)} km dichiarati`,
    kmGiorno: null,
    kmDichiarati: km,
    kmInclusi: km,
    supplementoGiorno: 0,
    importo: 0,
    euroKmInPiu: arrotonda(euroKmInPiu),
  };
}

// La scelta dei km (pacchetto o km dichiarati) → { chilometri } oppure { errore }.
// `scelta` = { sceltaKm: id|'illimitati'|null, kmDichiarati: string|number|null }.
export function sceglieChilometri(imp, scelta, giorni, euroKmInPiu) {
  if (imp.modo === 'dichiarati') {
    if (scelta.sceltaKm === 'illimitati' && imp.dichiaratiIllimitati) {
      return { chilometri: chilometriPrenotazione({ id: 'illimitati', km: null, supplemento: 0 }, giorni, euroKmInPiu) };
    }
    const km = kmDichiaratiValidi(scelta.kmDichiarati);
    if (km === null) return { errore: 'Scrivi quanti km farà in tutto il cliente (un numero intero, es. 1500).' };
    return { chilometri: chilometriDichiarati(km, euroKmInPiu) };
  }
  return { chilometri: chilometriPrenotazione(trovaFormula(imp.formule, scelta.sceltaKm), giorni, euroKmInPiu) };
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

// Testo per dettagli e verbali: «400 km al giorno · 1.200 km inclusi · poi 0,25 € al km».
export function descrizioneChilometri(c) {
  if (!c?.nome) return '';
  const euroKm = c.kmInclusi && c.euroKmInPiu ? ` · poi ${c.euroKmInPiu.toLocaleString('it-IT', { minimumFractionDigits: 2 })} € al km` : '';
  const inclusi = c.kmInclusi ? (c.kmDichiarati ? '' : ` · ${numero(c.kmInclusi)} km inclusi`) : '';
  return `${c.nome}${inclusi}${euroKm}`;
}

// --- Scheda «Chilometri» ---------------------------------------------------

export const nuovaFormula = () => ({ id: nuovoId(), illimitati: false, km: '', supplemento: '0' });

// Dal documento al form: righe con testi, per i campi.
export function schemaPerScheda(dati) {
  const imp = normalizzaFormule(dati);
  return {
    modo: imp.modo,
    dichiaratiIllimitati: imp.dichiaratiIllimitati,
    formule: imp.formule.map((f) => ({
      id: f.id,
      illimitati: f.km === null,
      km: f.km === null ? '' : String(f.km),
      supplemento: f.supplemento.toLocaleString('it-IT', { maximumFractionDigits: 2 }),
    })),
  };
}

// Errori per campo ("0.km", "1.supplemento", "doppie", "ordine") — {} se si puo' salvare.
// In modo «dichiarati» l'elenco dei pacchetti non conta (resta salvato).
export function validaSchema(schema, { conPrezzi = true } = {}) {
  const errori = {};
  if (schema.modo === 'dichiarati') return errori;
  schema.formule.forEach((r, i) => {
    if (!r.illimitati && kmValidi(r.km) === null) errori[`${i}.km`] = 'Scrivi i km al giorno, es. 200';
    if (conPrezzi) {
      const s = leggiEuro(r.supplemento);
      if (s === null) errori[`${i}.supplemento`] = 'Scrivi il costo (anche 0).';
      else if (Number.isNaN(s) || s < 0) errori[`${i}.supplemento`] = 'Scrivi un importo, es. 6';
    }
  });
  const chiavi = schema.formule.map((r) => (r.illimitati ? 'illimitati' : String(kmValidi(r.km))));
  if (new Set(chiavi).size !== chiavi.length) errori.doppie = 'Due pacchetti hanno gli stessi km: tienine uno solo.';
  if (conPrezzi && !errori.doppie) {
    const prezzi = ordina(schema.formule.map((r) => ({ km: r.illimitati ? null : kmValidi(r.km), s: leggiEuro(r.supplemento) })));
    for (let i = 1; i < prezzi.length; i += 1) {
      if (typeof prezzi[i].s === 'number' && typeof prezzi[i - 1].s === 'number' && prezzi[i].s < prezzi[i - 1].s) {
        errori.ordine = 'Un pacchetto con più km non può costare meno di uno con meno km.';
      }
    }
  }
  return errori;
}

// Dal form al documento: { modo, dichiaratiIllimitati, formule } normalizzato.
export const schemaAFormule = (schema) => normalizzaFormule({
  modo: schema.modo,
  dichiaratiIllimitati: schema.dichiaratiIllimitati,
  formule: schema.formule.map((r) => ({ id: r.id, km: r.illimitati ? null : r.km, supplemento: r.supplemento })),
});
