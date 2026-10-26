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
  aggiornatoAl: '2026-10-19',
  fonte: 'Art. 117, comma 2-bis, Codice della Strada (L. 177/2024, in vigore dal 14/12/2024)',
  anni: 3,
  inVigoreDal: '2024-12-14',
  // Il rapporto si calcola sulla tara COL conducente: 75 kg convenzionali
  // (convenzione ACI/Ministero: kW / ((massa a vuoto + 75) / 1000)). Non e' nel testo
  // dell'art. 117, che dice solo «riferita alla tara»: da verificare su libretti veri.
  kgConducente: 75,
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

// Tipo di veicolo: i limiti non valgono per tutti. I 75 kW/t riguardano gli
// autoveicoli, i 105 kW solo le autovetture (categoria M1, libretto campo J).
// Camper: per prudenza come le autovetture (un'autocaravan e' di norma M1);
// se sul libretto non e' M1 basta cambiare `kwMax` qui sotto.
// Senza tipo (veicoli vecchi) vale «autovettura»: la scelta piu' severa.
export const TIPI_VEICOLO = [
  { valore: 'autovettura', etichetta: 'Autovettura', soggetto: true, kwMax: true },
  { valore: 'furgone', etichetta: 'Furgone / autocarro', soggetto: true, kwMax: false },
  { valore: 'camper', etichetta: 'Camper', soggetto: true, kwMax: true },
  { valore: 'moto', etichetta: 'Moto / scooter', soggetto: false, kwMax: false },
  { valore: 'imbarcazione', etichetta: 'Imbarcazione / acquascooter / altro', soggetto: false, kwMax: false },
];
export const tipoPer = (valore) => TIPI_VEICOLO.find((t) => t.valore === valore) || TIPI_VEICOLO[0];

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
// `taraCampo` dice cosa c'e' scritto nel peso del libretto:
//  - 'G' (o niente): massa a vuoto / tara, SENZA conducente -> si aggiungono 75 kg;
//  - 'G1': massa in ordine di marcia, che include gia' il conducente -> non si aggiunge nulla.
export const TARA_CAMPI = [
  { valore: 'G', etichetta: 'Massa a vuoto (campo G o «MASSA A VUOTO» a pag. 3): aggiungo 75 kg del conducente' },
  { valore: 'G1', etichetta: 'Massa in ordine di marcia (campo G.1): include già il conducente' },
];
export const taraCampoPer = (valore) => (valore === 'G1' ? 'G1' : 'G');

// Peso usato per il rapporto: { kg, tara, aggiunti } o null se manca la tara.
export function massaPerRapporto(taraKg, taraCampo) {
  const t = numero(taraKg);
  if (t === null) return null;
  const aggiunti = taraCampoPer(taraCampo) === 'G' ? LIMITI_NEOPATENTATI.kgConducente : 0;
  return { kg: t + aggiunti, tara: t, aggiunti };
}

// Il rapporto stampato sul libretto (facciata 3: «RAPPORTO POTENZA/TARA = 66,465 KW/T») e'
// il dato del Ministero: se c'e', vale quello e il calcolo non serve. Verificato su 4 libretti
// veri: coincide con kW / ((massa a vuoto + 75 kg) / 1000).
export const rapportoLibrettoDi = (rapportoLibretto) => {
  const n = numero(rapportoLibretto);
  return n !== null && n <= 1000 ? n : null;
};

const kwTEsatto = (potenzaKw, taraKg, taraCampo, rapportoLibretto) => {
  const stampato = rapportoLibrettoDi(rapportoLibretto);
  if (stampato !== null) return stampato;
  const p = numero(potenzaKw);
  const m = massaPerRapporto(taraKg, taraCampo);
  return p === null || m === null ? null : (p * 1000) / m.kg; // p*1000/kg, non p/(kg/1000): niente errori da virgola mobile sul limite
};

// Da dove viene il rapporto: 'libretto' (copiato), 'calcolato' (potenza e massa a vuoto) o null.
export function fonteRapporto(veicolo = {}) {
  if (rapportoLibrettoDi(veicolo.rapportoLibretto) !== null) return 'libretto';
  return kwTEsatto(veicolo.potenzaKw, veicolo.taraKg, veicolo.taraCampo) === null ? null : 'calcolato';
}

// kW per tonnellata (un decimale), o null se mancano i dati.
export function kwPerTonnellata(potenzaKw, taraKg, taraCampo, rapportoLibretto) {
  const esatto = kwTEsatto(potenzaKw, taraKg, taraCampo, rapportoLibretto);
  return esatto === null ? null : una(esatto);
}

// Testo fisso accanto alla tara nella scheda del veicolo.
export const NOTA_TARA = 'La legge usa la tara con il conducente a 75 kg convenzionali. Se il valore che scrivi non li comprende (la «massa a vuoto», nel campo G o scritta a pag. 3 del libretto) il programma li aggiunge; se è la massa in ordine di marcia (campo G.1) no. Se il libretto ha già il «rapporto potenza/tara» stampato a pag. 3, controlla che coincida.';

// Il veicolo puo' guidarlo un neopatentato?
// { esito: 'si' | 'no' | 'nd', kwT, kw, limiti, motivo }
// 'nd' = da verificare: mancano potenza o tara nella scheda.
export function idoneitaNeopatentati(veicolo = {}) {
  const tipo = tipoPer(veicolo.tipoVeicolo);
  const limiti = { ...limitiPer(veicolo.carburante), kwMax: tipo.kwMax ? limitiPer(veicolo.carburante).kwMax : null };
  if (!tipo.soggetto) {
    return { esito: 'si', soggetto: false, kwT: null, kw: null, limiti, motivo: `${tipo.etichetta}: non rientra nei limiti di potenza per i neopatentati` };
  }
  const kw = numero(veicolo.potenzaKw);
  const kwT = kwPerTonnellata(veicolo.potenzaKw, veicolo.taraKg, veicolo.taraCampo, veicolo.rapportoLibretto);
  const esatto = kwTEsatto(veicolo.potenzaKw, veicolo.taraKg, veicolo.taraCampo, veicolo.rapportoLibretto);
  const fonte = fonteRapporto(veicolo);
  // La potenza serve sempre per il tetto dei kW (autovetture e camper); senza tetto basta il rapporto.
  if (kwT === null || esatto === null || (kw === null && limiti.kwMax !== null)) {
    const cosa = esatto === null
      ? 'il rapporto potenza/tara del libretto (pagina 3), oppure potenza e massa a vuoto per calcolarlo'
      : 'la potenza in kW (campo P.2)';
    return { esito: 'nd', kwT, kw, limiti, fonte, motivo: `Mancano dati: scrivi ${cosa}.` };
  }
  const motivi = [];
  if (esatto > limiti.kwPerTonnellata) motivi.push(`${viraSu(esatto)} kW/t, oltre il limite di ${limiti.kwPerTonnellata}`);
  if (limiti.kwMax !== null && kw > limiti.kwMax) motivi.push(`${virgola(kw)} kW, oltre il limite di ${limiti.kwMax}`);
  if (motivi.length > 0) return { esito: 'no', kwT, kw, limiti, fonte, motivo: motivi.join('; ') };
  return { esito: 'si', kwT, kw, limiti, fonte, motivo: limiti.kwMax === null ? `${virgola(kwT)} kW/t (limite ${limiti.kwPerTonnellata})` : `${virgola(kwT)} kW/t (limite ${limiti.kwPerTonnellata}) e ${virgola(kw)} kW (limite ${limiti.kwMax})` };
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

// Registro del controllo, da salvare nella prenotazione alla consegna: serve a
// dimostrare con quali dati e con quale versione della regola e' stato fatto.
// Se il dato (kW o tara) era sbagliato si vede cosa era scritto nella scheda.
// Non contiene nulla di modificabile dopo: e' una fotografia del momento.
export function registroControllo({ veicolo = {}, rilascio, ritiro, operatore = '', adesso = new Date() }) {
  const stato = statoPatente(rilascio, ritiro);
  const idoneita = idoneitaNeopatentati(veicolo);
  const esatto = kwTEsatto(veicolo.potenzaKw, veicolo.taraKg, veicolo.taraCampo, veicolo.rapportoLibretto);
  const fonte = fonteRapporto(veicolo);
  const massa = fonte === 'calcolato' ? massaPerRapporto(veicolo.taraKg, veicolo.taraCampo) : null;
  let esito = 'non-applicabile';
  if (stato.neopatentato === null) esito = 'data-patente-mancante';
  else if (stato.neopatentato) esito = idoneita.esito;
  return {
    versioneRegola: {
      fonte: LIMITI_NEOPATENTATI.fonte,
      aggiornatoAl: LIMITI_NEOPATENTATI.aggiornatoAl,
      inVigoreDal: LIMITI_NEOPATENTATI.inVigoreDal,
      anni: LIMITI_NEOPATENTATI.anni,
    },
    controllatoIl: adesso.toISOString(),
    controllatoDa: operatore || '',
    rilascioPatente: giorno(rilascio),
    giornoRitiro: giorno(ritiro),
    neopatentato: stato.neopatentato,
    finoAl: stato.finoAl,
    limiteVelocita: statoVelocita(rilascio, ritiro),
    esito, // 'si' | 'no' | 'nd' | 'non-applicabile' | 'data-patente-mancante'
    veicolo: {
      targa: veicolo.targa || '',
      tipoVeicolo: tipoPer(veicolo.tipoVeicolo).valore,
      carburante: veicolo.carburante || '',
      potenzaKw: numero(veicolo.potenzaKw),
      taraKg: numero(veicolo.taraKg),
      taraCampo: taraCampoPer(veicolo.taraCampo),
      massaUsataKg: massa ? massa.kg : null, // il peso con cui e' stato calcolato il rapporto (null se copiato dal libretto)
      rapportoLibretto: rapportoLibrettoDi(veicolo.rapportoLibretto),
      fonteRapporto: fonte, // 'libretto' | 'calcolato' | null
      kwPerTonnellata: esatto === null ? null : Math.round(esatto * (fonte === 'libretto' ? 1000 : 100)) / (fonte === 'libretto' ? 1000 : 100),
      limiti: idoneita.limiti,
    },
  };
}

// Limiti di velocita' (art. 117, comma 2): per i primi 3 anni dalla patente
// (A2, A, B1, B) non si superano 100 km/h in autostrada e 90 km/h sulle strade
// extraurbane principali. Vale per TUTTE le patenti entro i 3 anni, anche quelle
// rilasciate prima del 14/12/2024 (a differenza dei limiti di potenza). Non blocca
// niente: e' un promemoria per lo staff e per il cliente.
export const LIMITI_VELOCITA = { autostradaKmh: 100, extraurbaneKmh: 90, anni: 3 };

// { soggetto: true|false|null, finoAl } — null se manca la data di rilascio.
export function statoVelocita(rilascio, ritiro) {
  const r = giorno(rilascio);
  const t = giorno(ritiro);
  if (!DATA.test(r) || !DATA.test(t)) return { soggetto: null, finoAl: null };
  const finoAl = neopatentatoFinoAl(r);
  return { soggetto: t < finoAl, finoAl };
}

export function testoVelocita(finoAl) {
  return `Fino al ${dataIt(finoAl)} (3 anni dal rilascio della patente) non si superano ${LIMITI_VELOCITA.autostradaKmh} km/h in autostrada e ${LIMITI_VELOCITA.extraurbaneKmh} km/h sulle strade extraurbane principali (art. 117, comma 2, Codice della Strada).`;
}
