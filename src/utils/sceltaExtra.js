// Protezione ed extra di una prenotazione fatta nel gestionale: prezzo,
// controlli e campi da salvare. Funzioni pure, testate.
//
// I campi salvati sono gli stessi che salva il sito (formiarent,
// functions/src/extra.ts, calcolaPreventivo): `totaleNoleggio`, `protezione`,
// `cauzione`, `optional`, cosi' una prenotazione si legge allo stesso modo da
// qualunque parte arrivi. I valori sono quelli di quel momento: se lo staff
// cambia prezzi o franchigie, le prenotazioni gia' fatte non cambiano.
import { COPERTURE, normalizzaProtezione, protezioneImpostata, prezzoProtezione } from './protezioni';
import { normalizzaOptional, prezzoOptional } from './optional';

const giorno = (valore) => (valore ? String(valore).slice(0, 10) : '');
const arrotonda = (n) => Math.round(n * 100) / 100;
const IMPORTI = ['danni', 'furto', 'cauzione'];

// La Totale si puo' scegliere solo se offerta, con prezzo e importi completi.
export const totaleSceglibile = (p) => Boolean(p)
  && p.totale.offerta && p.totale.prezzoGiorno > 0 && IMPORTI.every((k) => typeof p.totale[k] === 'number');

// Scelte iniziali per il form: quelle gia' salvate o, per una nuova, Base e
// nessun extra.
export function scelteIniziali(prenotazione) {
  const sceltaOptional = {};
  (Array.isArray(prenotazione?.optional) ? prenotazione.optional : []).forEach((r) => {
    if (r?.id && r.quantita > 0) sceltaOptional[r.id] = r.quantita;
  });
  return {
    sceltaProtezione: prenotazione?.protezione?.tipo === 'totale' ? 'totale' : 'base',
    sceltaOptional,
  };
}

// Pezzi gia' presi per ogni optional nelle date: prenotazioni che occupano
// (gia' filtrate, senza quella in modifica) e hold del sito non scaduti.
export function pezziOccupati({ occupanti = [], holds = [], inizio, fine, adesso = Date.now() }) {
  const da = giorno(inizio);
  const a = giorno(fine);
  const occupati = new Map();
  const sovrappone = (p) => giorno(p.dataInizio) && giorno(p.dataFine) && giorno(p.dataInizio) <= a && giorno(p.dataFine) >= da;
  const somma = (righe) => (Array.isArray(righe) ? righe : []).forEach((r) => {
    const q = Math.floor(Number(r?.quantita) || 0);
    if (r?.id && q > 0) occupati.set(r.id, (occupati.get(r.id) || 0) + q);
  });
  if (!da || !a) return occupati;
  occupanti.filter(sovrappone).forEach((p) => somma(p.optional));
  holds
    .filter((h) => {
      const scade = typeof h.scadeIl?.toMillis === 'function' ? h.scadeIl.toMillis() : Number(h.scadeIl);
      return scade > adesso && sovrappone(h);
    })
    .forEach((h) => somma(h.optional));
  return occupati;
}

// Pezzi ancora liberi (null = senza limite).
export const pezziLiberi = (o, occupati) => (o.pezzi === null ? null : Math.max(0, o.pezzi - (occupati.get(o.id) || 0)));

// Calcola il preventivo. `protezione`: quella della categoria (dal documento
// impostazioni/protezioni) o undefined se da impostare: nel gestionale si
// puo' prenotare lo stesso, ma senza protezione ne' cauzione salvate.
// `catalogo`: optional normalizzati con id. Le righe gia' salvate di extra
// tolti dal catalogo si tengono con il loro prezzo.
// Restituisce { errore } oppure i campi da salvare.
export function preventivoPrenotazione({
  prezzoGiornaliero, giorni, protezione, sceltaProtezione = 'base', catalogo = [],
  sceltaOptional = {}, optionalSalvati = [], occupati = new Map(),
}) {
  const totaleNoleggio = arrotonda((parseFloat(prezzoGiornaliero) || 0) * giorni);

  let protezioneScelta = null;
  if (protezioneImpostata(protezione)) {
    const p = normalizzaProtezione(protezione);
    const tipo = sceltaProtezione === 'totale' ? 'totale' : 'base';
    if (tipo === 'totale' && !totaleSceglibile(p)) {
      return { errore: 'La protezione Totale non è offerta per questa categoria.' };
    }
    const f = tipo === 'totale' ? p.totale : p.base;
    protezioneScelta = {
      tipo,
      prezzo: tipo === 'totale' ? prezzoProtezione(p, giorni) : 0,
      danni: f.danni,
      furto: f.furto,
      cauzione: f.cauzione,
      copre: Object.fromEntries(COPERTURE.map(([k]) => [k, tipo === 'totale' && p.totale.copre[k] === true])),
    };
  }

  const perId = new Map(catalogo.map((o) => [o.id, o]));
  const salvatiPerId = new Map((optionalSalvati || []).filter((r) => r?.id).map((r) => [r.id, r]));
  const optional = [];
  for (const [id, q] of Object.entries(sceltaOptional || {})) {
    const quantita = Number(q);
    if (!quantita) continue;
    if (!Number.isInteger(quantita) || quantita < 0) return { errore: 'Quantità degli extra non valida.' };
    const salvato = salvatiPerId.get(id);
    const o = perId.get(id) || (salvato && normalizzaOptional({ ...salvato, maxPerNoleggio: salvato.quantita, pezzi: '' }));
    if (!o) return { errore: 'Un extra scelto non è più nell\'elenco.' };
    if (quantita > o.maxPerNoleggio) return { errore: `${o.nome}: al massimo ${o.maxPerNoleggio} per noleggio.` };
    const liberi = pezziLiberi({ ...o, id }, occupati);
    if (liberi !== null && quantita > liberi) {
      return {
        errore: liberi === 0
          ? `${o.nome}: in quelle date sono già tutti prenotati.`
          : `${o.nome}: in quelle date ne restano solo ${liberi}.`,
      };
    }
    optional.push({
      id,
      nome: o.nome,
      modo: o.modo,
      prezzo: o.prezzo,
      massimo: o.massimo,
      quantita,
      totale: prezzoOptional(o, giorni, quantita),
    });
  }

  const prezzoTotale = arrotonda(
    totaleNoleggio + (protezioneScelta?.prezzo || 0) + optional.reduce((s, o) => s + o.totale, 0),
  );
  return {
    totaleNoleggio,
    protezione: protezioneScelta,
    cauzione: protezioneScelta ? protezioneScelta.cauzione : null,
    optional,
    prezzoTotale,
  };
}
