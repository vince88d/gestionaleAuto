// Limiti di potenza per i neopatentati (art. 117, comma 2-bis, Codice della
// Strada, come modificato dalla L. 177/2024, in vigore dal 14/12/2024): per i
// primi 3 anni dal rilascio della patente B non si guidano autoveicoli con
// piu' di 75 kW per tonnellata di tara e, per le auto (M1, anche elettriche o
// ibride plug-in), piu' di 105 kW. Vale per chi guida: lo deve controllare il
// noleggiatore. I limiti sono di legge, NON impostazioni del gestore: stanno
// qui, in un posto solo, una riga per alimentazione (oggi tutte uguali), cosi'
// se la legge cambia si cambia un numero. Funzioni pure, testate.
// Dati dal libretto: potenza = campo P.2 (kW), tara = campo G (kg).
// Per elettriche e ibride la norma non dice con chiarezza quale potenza contare:
// si usa il valore del libretto e il gestore e' avvisato di controllarlo.
// Mockup approvato: formiarent-documenti/mockup/gestionale-sito-neopatentati.html
// Le stesse regole sono in formiarent/functions/src/neopatentati.ts e in
// formiarent/src/lib/neopatentati.ts.
import { leggiEuro } from './protezioni';

export const LIMITI_NEOPATENTATI = {
  aggiornatoAl: '2026-10-18',
  fonte: 'Art. 117, comma 2-bis, Codice della Strada (L. 177/2024, in vigore dal 14/12/2024)',
  anni: 3,
  inVigoreDal: '2024-12-14',
  // Una riga per alimentazione; `predefinito` vale per tutte le altre.
  alimentazioni: {
    predefinito: { kwPerTonnellata: 75, kwMax: 105 },
    Elettrico: { kwPerTonnellata: 75, kwMax: 105 },
    Ibrido: { kwPerTonnellata: 75, kwMax: 105 },
  },
};

// Testi fissi: il software e' uno strumento di supporto, non una verifica legale.
// Si mostrano accanto a ogni controllo (non dicono «adatta» come garanzia).
export const AVVISO_CONTROLLO = 'Controllo di supporto basato sui dati del libretto inseriti da voi. La verifica finale (patente del cliente e idoneità dell\'auto) resta del noleggiatore.';
export const AVVISO_ELETTRICHE_IBRIDE = 'Elettriche e ibride: la norma è meno chiara su quale potenza contare. Controlla sul libretto e, se hai dubbi, usa il valore più alto.';
export const eElettricaOIbrida = (alimentazione) => /elettric|ibrid|hybrid|plug/i.test(String(alimentazione || ''));

export const limitiPer = (alimentazione) => LIMITI_NEOPATENTATI.alimentazioni[alimentazione] || LIMITI_NEOPATENTATI.alimentazioni.predefinito;

const numero = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : leggiEuro(v);
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
};
const una = (n) => Math.round(n * 10) / 10;
const virgola = (n) => n.toLocaleString('it-IT', { maximumFractionDigits: 1 });
// Per le frasi di rifiuto: mai un valore che sembri nel limite (75,02 non diventa «75»).
const viraSu = (n) => (Math.ceil(n * 100) / 100).toLocaleString('it-IT', { maximumFractionDigits: 2 });

// kW per tonnellata ESATTO, senza arrotondare: il confronto con la legge
// («superiore a 75») si fa su questo, l'arrotondamento e' solo per mostrare.
const kwTEsatto = (potenzaKw, taraKg) => {
  const p = numero(potenzaKw);
  const t = numero(taraKg);
  return p === null || t === null ? null : (p * 1000) / t; // p*1000/t, non p/(t/1000): niente errori da virgola mobile sul limite
};

// kW per tonnellata (un decimale), o null se mancano potenza o tara.
export function kwPerTonnellata(potenzaKw, taraKg) {
  const p = numero(potenzaKw);
  const t = numero(taraKg);
  return p === null || t === null ? null : una(p / (t / 1000));
}

// Il veicolo puo' guidarlo un neopatentato?
// { esito: 'si' | 'no' | 'nd', kwT, kw, limiti, motivo }
// 'nd' = da verificare: mancano potenza o tara nella scheda.
export function idoneitaNeopatentati(veicolo = {}) {
  const limiti = limitiPer(veicolo.carburante);
  const kw = numero(veicolo.potenzaKw);
  const kwT = kwPerTonnellata(veicolo.potenzaKw, veicolo.taraKg);
  const esatto = kwTEsatto(veicolo.potenzaKw, veicolo.taraKg);
  if (kw === null || kwT === null || esatto === null) {
    return { esito: 'nd', kwT, kw, limiti, motivo: 'Mancano potenza e tara: completa la scheda del veicolo.' };
  }
  const motivi = [];
  if (esatto > limiti.kwPerTonnellata) motivi.push(`${viraSu(esatto)} kW/t, oltre il limite di ${limiti.kwPerTonnellata}`);
  if (kw > limiti.kwMax) motivi.push(`${virgola(kw)} kW, oltre il limite di ${limiti.kwMax}`);
  if (motivi.length > 0) return { esito: 'no', kwT, kw, limiti, motivo: motivi.join(' e ') };
  return { esito: 'si', kwT, kw, limiti, motivo: `${virgola(kwT)} kW/t (limite ${limiti.kwPerTonnellata}) e ${virgola(kw)} kW (limite ${limiti.kwMax})` };
}

const giorno = (v) => (v ? String(v).slice(0, 10) : '');
const DATA = /^\d{4}-\d{2}-\d{2}$/;

// Fine dei limiti: data di rilascio + 3 anni ('AAAA-MM-GG'), o null.
export function neopatentatoFinoAl(rilascio) {
  const r = giorno(rilascio);
  if (!DATA.test(r)) return null;
  const [a, m, g] = r.split('-').map(Number);
  const fine = new Date(Date.UTC(a + LIMITI_NEOPATENTATI.anni, m - 1, g));
  if (fine.getUTCMonth() !== (m - 1)) fine.setUTCDate(0); // 29 febbraio
  return fine.toISOString().slice(0, 10);
}

// Il conducente e' neopatentato al ritiro (`ritiro` = 'AAAA-MM-GG')?
// Le patenti rilasciate prima del 14/12/2024 avevano un solo anno di limiti,
// ormai scaduto: non sono neopatentati. Senza data di rilascio: 'nd'.
export function statoPatente(rilascio, ritiro) {
  const r = giorno(rilascio);
  const t = giorno(ritiro);
  if (!DATA.test(r) || !DATA.test(t)) return { neopatentato: null, finoAl: null };
  if (r < LIMITI_NEOPATENTATI.inVigoreDal) return { neopatentato: false, finoAl: null };
  const finoAl = neopatentatoFinoAl(r);
  return { neopatentato: t < finoAl, finoAl };
}

// Quanto manca ai 3 anni, per le frasi ("1 anno e 7 mesi").
export function testoDurataPatente(rilascio, ritiro) {
  const r = giorno(rilascio);
  const t = giorno(ritiro);
  if (!DATA.test(r) || !DATA.test(t) || t < r) return '';
  let mesi = (Number(t.slice(0, 4)) - Number(r.slice(0, 4))) * 12 + (Number(t.slice(5, 7)) - Number(r.slice(5, 7)));
  if (t.slice(8, 10) < r.slice(8, 10)) mesi -= 1;
  const anni = Math.floor(mesi / 12);
  const resto = mesi % 12;
  const parti = [];
  if (anni > 0) parti.push(`${anni} ${anni === 1 ? 'anno' : 'anni'}`);
  if (resto > 0) parti.push(`${resto} ${resto === 1 ? 'mese' : 'mesi'}`);
  return parti.length ? parti.join(' e ') : 'meno di un mese';
}

const dataIt = (d) => d.split('-').reverse().join('/');

// Controllo completo: patente + veicolo. { ok, avviso, messaggio, neopatentato, finoAl, idoneita }
// `ok` false = non si puo' abbinare (veicolo non adatto, o da verificare).
export function controlloAbbinamento({ veicolo, rilascio, ritiro }) {
  const stato = statoPatente(rilascio, ritiro);
  if (stato.neopatentato === null) return { ok: true, neopatentato: null, finoAl: null, messaggio: '', idoneita: null };
  if (!stato.neopatentato) return { ok: true, neopatentato: false, finoAl: stato.finoAl, messaggio: '', idoneita: null };
  const idoneita = idoneitaNeopatentati(veicolo);
  const base = { neopatentato: true, finoAl: stato.finoAl, idoneita };
  if (idoneita.esito === 'si') return { ...base, ok: true, messaggio: '' };
  if (idoneita.esito === 'no') {
    return { ...base, ok: false, messaggio: `Auto oltre i limiti di legge per un neopatentato (fino al ${dataIt(stato.finoAl)}): ${idoneita.motivo}.` };
  }
  return { ...base, ok: false, messaggio: 'Auto da verificare per un neopatentato: mancano potenza e tara nella scheda del veicolo.' };
}
