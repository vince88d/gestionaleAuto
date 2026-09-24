// Recupero dei dati dalla versione precedente del gestionale, che salvava tutto
// in file sul computer (veicoli.json, prenotazioni.json, clienti.json, foto in
// images/, contratti PDF, conferme OTP). Funzioni pure, testate: qui si decide
// COSA recuperare e si elencano i problemi, senza leggere o scrivere nulla.

import { normalizzaTarga } from './validaVeicolo';
import { clienteDaPrenotazione } from './validaCliente';

export const SEGNO_RECUPERO = 'versione-precedente';

const STATI_NOTI = ['attiva', 'completata', 'annullata'];
const DATA_ISO = /^\d{4}-\d{2}-\d{2}/;

const normalizzaCf = (valore) => String(valore || '').trim().toUpperCase();

// ---------- Riferimenti a file ----------

// Che cosa c'e' in una stringa dei vecchi dati:
// - 'file': percorso di un file del vecchio computer (file://C:\...\images\x.jpg,
//   file:///Users/.../images/x.jpg, C:\...\x.pdf);
// - 'incorporata': foto dentro il dato (data:image/...;base64);
// - 'temporanea': blob:, valida solo mentre il vecchio programma era aperto,
//   irrecuperabile;
// - 'online': gia' un indirizzo web.
export function tipoRiferimento(valore) {
  if (typeof valore !== 'string') return null;
  const v = valore.trim();
  if (/^file:/i.test(v) || /^[A-Za-z]:[\\/]/.test(v)) return 'file';
  if (/^data:[a-z]+\/[\w.+-]+;base64,/i.test(v)) return 'incorporata';
  if (/^blob:/i.test(v)) return 'temporanea';
  if (/^https?:\/\//i.test(v)) return 'online';
  return null;
}

// Nome del file (e cartella che lo contiene) da un percorso del vecchio
// computer, con barre di Windows o Mac anche mescolate.
export function nomeFileDaPercorso(percorso) {
  let p = String(percorso || '').trim().replace(/^file:\/*/i, '');
  try { p = decodeURIComponent(p); } catch { /* percorso con % non codificati: lo si usa com'e' */ }
  const parti = p.split(/[\\/]+/).filter(Boolean);
  const nome = parti[parti.length - 1] || '';
  const cartella = parti.length > 1 ? parti[parti.length - 2] : '';
  return { nome, cartella };
}

// Tutti i riferimenti a file dentro un dato (anche annidati), con il percorso
// del campo, per il resoconto e per sostituirli dopo il caricamento.
export function raccogliRiferimenti(valore, campo = '') {
  const tipo = tipoRiferimento(valore);
  if (tipo && tipo !== 'online') return [{ campo, tipo, valore }];
  if (Array.isArray(valore)) return valore.flatMap((v, i) => raccogliRiferimenti(v, `${campo}[${i}]`));
  if (valore && typeof valore === 'object') {
    return Object.entries(valore).flatMap(([k, v]) => raccogliRiferimenti(v, campo ? `${campo}.${k}` : k));
  }
  return [];
}

// Sostituisce ogni riferimento con quello indicato da `nuovo(valore)`; se
// `nuovo` restituisce undefined il valore resta com'e'.
export function sostituisciRiferimenti(valore, nuovo) {
  const tipo = tipoRiferimento(valore);
  if (tipo && tipo !== 'online') {
    const sostituto = nuovo(valore, tipo);
    return sostituto === undefined ? valore : sostituto;
  }
  if (Array.isArray(valore)) return valore.map((v) => sostituisciRiferimenti(v, nuovo));
  if (valore && typeof valore === 'object') {
    return Object.fromEntries(Object.entries(valore).map(([k, v]) => [k, sostituisciRiferimenti(v, nuovo)]));
  }
  return valore;
}

// ---------- Veicoli ----------

const numeroOTesto = (valore) => {
  if (valore === '' || valore === null || valore === undefined) return '';
  const n = Number(String(valore).replace(',', '.'));
  return Number.isFinite(n) ? n : valore;
};

// Un danno della vecchia versione poteva essere solo il percorso della foto:
// diventa un danno come quelli di oggi (descrizione vuota, non da riparare).
function preparaDanno(danno) {
  if (typeof danno === 'string') return { descrizione: '', immagine: danno, daRiparare: false };
  return danno;
}

export function preparaVeicolo(vecchio, indice) {
  const veicolo = { ...vecchio };
  veicolo.id = String(vecchio.id || '').trim() || `recupero-veicolo-${indice + 1}`;
  veicolo.targa = normalizzaTarga(vecchio.targa);
  ['anno', 'km', 'porte', 'prezzo'].forEach((campo) => {
    if (campo in veicolo) veicolo[campo] = numeroOTesto(veicolo[campo]);
  });
  if (Array.isArray(vecchio.danni)) veicolo.danni = vecchio.danni.map(preparaDanno);
  veicolo.scadenze = { assicurazione: '', bollo: '', revisione: '', ...(vecchio.scadenze || {}) };
  // Le prenotazioni stanno nella loro collezione: la vecchia copia sul veicolo
  // non serve (e si disallineerebbe).
  delete veicolo.prenotazioni;
  return veicolo;
}

// ---------- Prenotazioni ----------

export function preparaPrenotazione(vecchia, indice) {
  const prenotazione = { ...vecchia };
  prenotazione.id = String(vecchia.id || '').trim() || `recupero-prenotazione-${indice + 1}`;
  prenotazione.targa = normalizzaTarga(vecchia.targa);
  prenotazione.codiceFiscale = normalizzaCf(vecchia.codiceFiscale);
  prenotazione.status = vecchia.status || 'attiva';
  // fotoDanni: null o assente non servono; una sola foto diventa un elenco.
  if (prenotazione.fotoDanni === null || prenotazione.fotoDanni === undefined) delete prenotazione.fotoDanni;
  else if (typeof prenotazione.fotoDanni === 'string') prenotazione.fotoDanni = [prenotazione.fotoDanni];
  return prenotazione;
}

// Conferma OTP della vecchia versione collegata alla prenotazione con stessa
// targa, data di inizio e codice fiscale.
export function collegaConfermeOtp(prenotazioni, conferme = []) {
  const usate = new Set();
  const collegate = prenotazioni.map((p) => {
    const i = conferme.findIndex((o, idx) => !usate.has(idx)
      && normalizzaTarga(o.targa) === p.targa
      && o.dataInizio === p.dataInizio
      && (!o.codiceFiscale || normalizzaCf(o.codiceFiscale) === p.codiceFiscale));
    if (i === -1) return p;
    usate.add(i);
    const o = conferme[i];
    return { ...p, confermaOtp: { confermatoIl: o.confermatoIl || '', ip: o.ip || '', email: o.email || '' } };
  });
  return { prenotazioni: collegate, nonCollegate: conferme.filter((_, i) => !usate.has(i)) };
}

// ---------- Clienti ----------

// Campi vuoti del primo riempiti con quelli del secondo.
function completa(a, b) {
  const unito = { ...a };
  Object.entries(b).forEach(([k, v]) => {
    if ((unito[k] === undefined || unito[k] === '' || unito[k] === null) && v !== undefined) unito[k] = v;
  });
  return unito;
}

// Clienti da clienti.json piu' quelli che compaiono solo nelle prenotazioni
// (la vecchia versione non li salvava sempre in anagrafica). Una persona = un
// codice fiscale (id del documento, come nel gestionale di oggi). Per i dati
// ricavati dalle prenotazioni vince la piu' recente.
export function preparaClienti(vecchiClienti = [], prenotazioni = []) {
  const perCf = new Map();
  const senzaCf = [];

  vecchiClienti.forEach((c) => {
    const cf = normalizzaCf(c.codiceFiscale);
    if (!cf) { senzaCf.push(c); return; }
    const pulito = { ...c, codiceFiscale: cf };
    delete pulito.id;
    perCf.set(cf, perCf.has(cf) ? completa(perCf.get(cf), pulito) : pulito);
  });
  const daAnagrafica = new Set(perCf.keys());

  [...prenotazioni]
    .filter((p) => p.codiceFiscale)
    .sort((a, b) => String(b.dataInizio || '').localeCompare(String(a.dataInizio || '')))
    .forEach((p) => {
      const ricavato = { ...clienteDaPrenotazione(p), documento: p.documento || '' };
      const cf = ricavato.codiceFiscale;
      perCf.set(cf, perCf.has(cf) ? completa(perCf.get(cf), ricavato) : ricavato);
    });

  const clienti = [...perCf.entries()].map(([cf, c]) => ({
    ...c,
    id: cf,
    ricavatoDaPrenotazioni: !daAnagrafica.has(cf),
  }));
  const doppi = vecchiClienti.length - senzaCf.length - daAnagrafica.size;
  return { clienti, senzaCf, doppi };
}

// ---------- Analisi ----------

const dataValida = (valore) => typeof valore === 'string' && DATA_ISO.test(valore)
  && !Number.isNaN(new Date(valore.slice(0, 10)).getTime());

// Legge i vecchi dati (gia' caricati dai file) e prepara tutto quello che
// verrebbe recuperato, piu' il resoconto con conteggi e problemi.
// `esistenti`: cio' che c'e' gia' su Firebase ({ veicoli: [{id, targa}],
// prenotazioni: [id], clienti: [id] }).
// `fileDisponibili`: { immagini: ['1749.jpg'], contratti: [{ nome, cartella }] }.
export function analizzaRecupero({
  veicoli = [], prenotazioni = [], clienti = [], conferme = [], erroriLettura = [],
}, esistenti = {}, fileDisponibili = {}) {
  const problemi = [];
  const aggiungi = (gravita, messaggio, dettagli = []) => problemi.push({ gravita, messaggio, dettagli });

  erroriLettura.forEach((e) => aggiungi('grave', `Non riesco a leggere ${e.file}: ${e.errore}`));

  // Veicoli
  const veicoliPronti = veicoli.map(preparaVeicolo);
  const perTarga = new Map();
  veicoliPronti.forEach((v) => {
    if (!v.targa) return;
    perTarga.set(v.targa, [...(perTarga.get(v.targa) || []), v]);
  });
  const senzaTarga = veicoliPronti.filter((v) => !v.targa);
  if (senzaTarga.length) {
    aggiungi('attenzione', `${senzaTarga.length} veicoli senza targa: verranno recuperati, ma nessuna prenotazione potra' collegarsi a loro.`,
      senzaTarga.map((v) => `${v.marca || ''} ${v.modello || ''}`.trim() || v.id));
  }
  const targheDoppie = [...perTarga.entries()].filter(([, lista]) => lista.length > 1);
  if (targheDoppie.length) {
    aggiungi('attenzione', 'Targhe presenti su piu\' veicoli: dopo il recupero va tenuto un solo veicolo per targa.',
      targheDoppie.map(([t, lista]) => `${t} (${lista.length} veicoli)`));
  }

  const veicoliEsistenti = esistenti.veicoli || [];
  const idVeicoliEsistenti = new Set(veicoliEsistenti.map((v) => v.id));
  const targaEsistente = new Map(veicoliEsistenti.map((v) => [normalizzaTarga(v.targa), v.id]));
  const targheInConflitto = veicoliPronti.filter((v) => v.targa && !idVeicoliEsistenti.has(v.id)
    && targaEsistente.has(v.targa) && targaEsistente.get(v.targa) !== v.id);
  if (targheInConflitto.length) {
    aggiungi('attenzione', 'Veicoli con una targa gia\' usata da un altro veicolo nel gestionale nuovo: non verranno recuperati.',
      targheInConflitto.map((v) => v.targa));
  }

  // Prenotazioni
  const { prenotazioni: prenotazioniPronte, nonCollegate } = collegaConfermeOtp(prenotazioni.map(preparaPrenotazione), conferme);
  const targheFlotta = new Set([...perTarga.keys(), ...targaEsistente.keys()]);
  const senzaVeicolo = prenotazioniPronte.filter((p) => p.targa && !targheFlotta.has(p.targa));
  if (senzaVeicolo.length) {
    aggiungi('info', `${senzaVeicolo.length} prenotazioni di veicoli che non ci sono piu' (eliminati o con targa cambiata): verranno recuperate come storico.`,
      [...new Set(senzaVeicolo.map((p) => p.targa))]);
  }
  const dateSbagliate = prenotazioniPronte.filter((p) => !dataValida(p.dataInizio) || !dataValida(p.dataFine)
    || String(p.dataFine).slice(0, 10) < String(p.dataInizio).slice(0, 10));
  if (dateSbagliate.length) {
    aggiungi('attenzione', `${dateSbagliate.length} prenotazioni con date mancanti o non valide: controllale dopo il recupero.`,
      dateSbagliate.map((p) => `${p.targa || '?'} ${p.dataInizio || '?'} → ${p.dataFine || '?'}`));
  }
  const statiStrani = prenotazioniPronte.filter((p) => !STATI_NOTI.includes(p.status));
  if (statiStrani.length) {
    aggiungi('attenzione', `${statiStrani.length} prenotazioni con uno stato sconosciuto.`,
      [...new Set(statiStrani.map((p) => p.status))]);
  }
  const prenotazioniSenzaCf = prenotazioniPronte.filter((p) => !p.codiceFiscale);
  if (prenotazioniSenzaCf.length) {
    aggiungi('info', `${prenotazioniSenzaCf.length} prenotazioni senza codice fiscale: il cliente non potra' essere aggiunto in anagrafica.`);
  }
  if (nonCollegate.length) {
    aggiungi('info', `${nonCollegate.length} conferme OTP di prenotazioni che non ci sono piu': restano nella copia di sicurezza.`);
  }

  // Clienti
  const { clienti: clientiPronti, senzaCf, doppi } = preparaClienti(clienti, prenotazioniPronte);
  if (senzaCf.length) {
    aggiungi('attenzione', `${senzaCf.length} clienti senza codice fiscale: non verranno recuperati (restano nella copia di sicurezza).`,
      senzaCf.map((c) => `${c.nome || ''} ${c.cognome || ''}`.trim() || '(senza nome)'));
  }
  if (doppi > 0) aggiungi('info', `${doppi} clienti registrati due volte con lo stesso codice fiscale: verranno uniti.`);

  // File
  const immaginiDisponibili = new Set(fileDisponibili.immagini || []);
  const riferimenti = [
    ...veicoliPronti.flatMap((v) => raccogliRiferimenti(v).map((r) => ({ ...r, dove: `veicolo ${v.targa || v.id}` }))),
    ...prenotazioniPronte.flatMap((p) => raccogliRiferimenti(p).map((r) => ({ ...r, dove: `prenotazione ${p.targa || ''} ${p.dataInizio || ''}`.trim() }))),
    ...clientiPronti.flatMap((c) => raccogliRiferimenti(c).map((r) => ({ ...r, dove: `cliente ${c.id}` }))),
  ];
  const fileTrovati = new Set();
  const fileMancanti = [];
  riferimenti.filter((r) => r.tipo === 'file').forEach((r) => {
    const { nome } = nomeFileDaPercorso(r.valore);
    const contratto = (fileDisponibili.contratti || []).some((c) => c.nome === nome);
    if (immaginiDisponibili.has(nome) || contratto) fileTrovati.add(nome);
    else fileMancanti.push(`${nome} (${r.dove})`);
  });
  const incorporate = riferimenti.filter((r) => r.tipo === 'incorporata');
  const temporanee = riferimenti.filter((r) => r.tipo === 'temporanea');
  if (fileMancanti.length) {
    aggiungi('attenzione', `${fileMancanti.length} foto o documenti indicati nei dati ma non trovati nella cartella: al loro posto restera' il vecchio percorso.`, fileMancanti);
  }
  if (temporanee.length) {
    aggiungi('info', `${temporanee.length} foto erano solo temporanee nella vecchia versione e non si possono recuperare.`,
      temporanee.map((r) => r.dove));
  }
  const contrattiCollegati = new Set([...fileTrovati].filter((n) => (fileDisponibili.contratti || []).some((c) => c.nome === n)));
  const contrattiArchivio = (fileDisponibili.contratti || []).filter((c) => !contrattiCollegati.has(c.nome));

  // Gia' presenti su Firebase: non si toccano.
  const idPrenotazioniEsistenti = new Set(esistenti.prenotazioni || []);
  const idClientiEsistenti = new Set(esistenti.clienti || []);
  const conta = (lista, esistentiSet) => {
    const gia = lista.filter((x) => esistentiSet.has(x.id)).length;
    return { totale: lista.length, nuovi: lista.length - gia, giaPresenti: gia };
  };
  const veicoliDaScrivere = veicoliPronti.filter((v) => !targheInConflitto.includes(v));

  return {
    dati: {
      veicoli: veicoliDaScrivere,
      prenotazioni: prenotazioniPronte,
      clienti: clientiPronti,
      contrattiArchivio,
    },
    conteggi: {
      veicoli: conta(veicoliDaScrivere, idVeicoliEsistenti),
      prenotazioni: conta(prenotazioniPronte, idPrenotazioniEsistenti),
      clienti: conta(clientiPronti, idClientiEsistenti),
      clientiRicavati: clientiPronti.filter((c) => c.ricavatoDaPrenotazioni).length,
      confermeOtpCollegate: prenotazioniPronte.filter((p) => p.confermaOtp).length,
      fileDaCaricare: fileTrovati.size + incorporate.length,
      fileMancanti: fileMancanti.length,
      immaginiNonUsate: Math.max(0, immaginiDisponibili.size - [...fileTrovati].filter((n) => immaginiDisponibili.has(n)).length),
      contrattiArchivio: contrattiArchivio.length,
    },
    problemi,
  };
}

// Resoconto leggibile, da salvare in un file di testo.
export function testoResoconto({ conteggi, problemi }, { cartella = '', data = new Date() } = {}) {
  const c = conteggi;
  const righe = [
    'RESOCONTO RECUPERO DATI DALLA VERSIONE PRECEDENTE',
    `Data: ${data.toLocaleString('it-IT')}`,
    cartella ? `Cartella: ${cartella}` : null,
    '',
    `Veicoli:      ${c.veicoli.totale} (nuovi ${c.veicoli.nuovi}, gia' presenti ${c.veicoli.giaPresenti})`,
    `Prenotazioni: ${c.prenotazioni.totale} (nuove ${c.prenotazioni.nuovi}, gia' presenti ${c.prenotazioni.giaPresenti})`,
    `Clienti:      ${c.clienti.totale} (nuovi ${c.clienti.nuovi}, gia' presenti ${c.clienti.giaPresenti}; ricavati dalle prenotazioni ${c.clientiRicavati})`,
    `Conferme OTP collegate alle prenotazioni: ${c.confermeOtpCollegate}`,
    `Foto e documenti da caricare online: ${c.fileDaCaricare} (mancanti ${c.fileMancanti})`,
    `Contratti PDF per l'archivio: ${c.contrattiArchivio}`,
    `Immagini non usate (restano solo nella copia di sicurezza): ${c.immaginiNonUsate}`,
    '',
    problemi.length ? 'DA CONTROLLARE:' : 'Nessun problema trovato.',
    ...problemi.flatMap((p) => [
      `- [${p.gravita.toUpperCase()}] ${p.messaggio}`,
      ...p.dettagli.map((d) => `    · ${d}`),
    ]),
  ];
  return righe.filter((r) => r !== null).join('\n');
}
