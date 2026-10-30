// Eta' dei conducenti (Impostazioni → «Età dei conducenti»): eta' minima e
// massima per noleggiare e supplemento al giorno per i conducenti giovani,
// a fasce («fino a 20 anni compresi: 25 € al giorno»), con un tetto
// facoltativo a noleggio. Tutto deciso dal titolare.
// Documento impostazioni/etaConducenti, letto anche dal sito: le stesse
// formule sono in formiarent/functions/src (il server ricalcola).
// Nella prenotazione si salva l'eta' esatta dichiarata, non la fascia.
// Funzioni pure, testate.
// Mockup approvato: formiarent-documenti/mockup/gestionale-giovane-conducente.html
import { leggiEuro, euro } from './protezioni';

export const ETA_MINIMA_LEGALE = 18;
export const ETA_LIMITE = 99;

export const ETA_CONDUCENTI_DI_PARTENZA = {
  attivo: false, etaMinima: ETA_MINIMA_LEGALE, etaMassima: null, fasce: [], massimo: null,
};

const arrotonda = (n) => Math.round(n * 100) / 100;
const intero = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).trim());
  return Number.isInteger(n) ? n : NaN;
};
const etaValida = (n) => Number.isInteger(n) && n >= ETA_MINIMA_LEGALE && n <= ETA_LIMITE;
const importoPositivo = (v) => {
  const n = typeof v === 'number' ? v : leggiEuro(v);
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? arrotonda(n) : null;
};

// Da Firestore (o dal form gia' controllato) a valori sicuri: quello che
// manca o e' sbagliato torna al valore di partenza, le fasce si ordinano per
// eta' e si tengono solo quelle sensate.
export function normalizzaEtaConducenti(dati) {
  const d = dati && typeof dati === 'object' ? dati : {};
  const etaMinima = etaValida(intero(d.etaMinima)) ? intero(d.etaMinima) : ETA_MINIMA_LEGALE;
  const max = intero(d.etaMassima);
  const etaMassima = etaValida(max) && max >= etaMinima ? max : null;
  const viste = new Set();
  const fasce = (Array.isArray(d.fasce) ? d.fasce : [])
    .map((f) => ({ finoA: intero(f?.finoA), euroGiorno: importoPositivo(f?.euroGiorno) }))
    .filter((f) => Number.isInteger(f.finoA) && f.finoA >= etaMinima && f.finoA < (etaMassima ?? ETA_LIMITE) && f.euroGiorno !== null)
    .sort((a, b) => a.finoA - b.finoA)
    .filter((f) => !viste.has(f.finoA) && viste.add(f.finoA));
  return {
    attivo: d.attivo === true,
    etaMinima,
    etaMassima,
    fasce,
    massimo: importoPositivo(d.massimo),
  };
}

// Il supplemento vale solo se acceso e con almeno una fascia.
const fasceAttive = (n) => (n.attivo ? n.fasce : []);

// Il sito chiede l'eta' solo se c'e' qualche regola: un supplemento o un
// limite diverso da «maggiorenne».
export function chiedeEta(dati) {
  const n = normalizzaEtaConducenti(dati);
  return fasceAttive(n).length > 0 || n.etaMassima !== null || n.etaMinima > ETA_MINIMA_LEGALE;
}

// Eta' senza supplemento, per la spunta del sito: { da, a } (a = null se non
// c'e' un'eta' massima).
export function etaSenzaSupplemento(dati) {
  const n = normalizzaEtaConducenti(dati);
  const fasce = fasceAttive(n);
  const da = fasce.length ? fasce[fasce.length - 1].finoA + 1 : n.etaMinima;
  return { da, a: n.etaMassima };
}

// Testo della spunta sotto la ricerca del sito (gia' attiva).
export function testoSpuntaEta(dati) {
  const { da, a } = etaSenzaSupplemento(dati);
  return a === null ? `Età del conducente di almeno ${da} anni` : `Età del conducente compresa tra ${da} - ${a}`;
}

// Eta' da scegliere nell'elenco (una per una). `oltre`: c'e' l'eta' massima,
// quindi in fondo va «Oltre N anni» (non si prenota online, si chiama la sede).
export function etaSelezionabili(dati) {
  const n = normalizzaEtaConducenti(dati);
  const fine = n.etaMassima ?? ETA_LIMITE;
  return {
    eta: Array.from({ length: fine - n.etaMinima + 1 }, (_, i) => n.etaMinima + i),
    oltre: n.etaMassima,
  };
}

// Puo' noleggiare un conducente di questa eta'? E quanto paga al giorno?
// motivo: 'sotto' (troppo giovane), 'oltre' (oltre il massimo), 'eta' (eta' non valida).
export function valutaEta(dati, eta) {
  const n = normalizzaEtaConducenti(dati);
  const e = typeof eta === 'number' ? eta : intero(eta);
  if (!Number.isInteger(e) || e < 0 || e > 120) return { ammessa: false, motivo: 'eta', euroGiorno: 0 };
  if (e < n.etaMinima) return { ammessa: false, motivo: 'sotto', euroGiorno: 0 };
  if (n.etaMassima !== null && e > n.etaMassima) return { ammessa: false, motivo: 'oltre', euroGiorno: 0 };
  const fascia = fasceAttive(n).find((f) => e <= f.finoA);
  return { ammessa: true, motivo: null, euroGiorno: fascia ? fascia.euroGiorno : 0 };
}

// Supplemento «Giovane conducente» per `giorni` giorni: euro al giorno della
// fascia x giorni, ma non oltre il tetto. null se non si paga (eta' senza
// supplemento, eta' non indicata o non ammessa).
// Si salva cosi' nella prenotazione, perche' le impostazioni possono cambiare.
export function supplementoGiovane(dati, eta, giorni) {
  if (eta === null || eta === undefined || eta === '') return null;
  const v = valutaEta(dati, eta);
  const g = Math.max(1, Math.round(Number(giorni) || 0));
  if (!v.ammessa || !(v.euroGiorno > 0)) return null;
  const { massimo } = normalizzaEtaConducenti(dati);
  const pieno = arrotonda(v.euroGiorno * g);
  const alMassimo = massimo !== null && pieno > massimo;
  return { eta: Number(eta), euroGiorno: v.euroGiorno, giorni: g, importo: alMassimo ? massimo : pieno, alMassimo };
}

// Riga del riepilogo, delle email e del PDF.
export function testoSupplemento(s) {
  if (!s) return '';
  return s.alMassimo
    ? `Giovane conducente · ${s.eta} anni · massimo ${euro(s.importo)}`
    : `Giovane conducente · ${s.eta} anni · ${euro(s.euroGiorno)} × ${s.giorni} ${s.giorni === 1 ? 'giorno' : 'giorni'}`;
}

// Scelte dell'eta' nella Nuova prenotazione del gestionale: per prima la
// fascia senza supplemento (valore ''), poi le eta' una per una con il loro
// supplemento, e «Oltre N anni» (valore 'oltre': decide lo staff). Un'eta'
// gia' salvata che non e' nell'elenco (es. 30 dal sito) si aggiunge.
export function opzioniEtaGestionale(dati, salvata) {
  const n = normalizzaEtaConducenti(dati);
  const { da, a } = etaSenzaSupplemento(n);
  const opzioni = [{
    valore: '',
    testo: a === null ? `${da} anni o più (nessun supplemento)` : `Dai ${da} ai ${a} anni (nessun supplemento)`,
  }];
  for (let eta = n.etaMinima; eta < da; eta += 1) {
    opzioni.push({ valore: String(eta), testo: `${eta} anni (+${euro(valutaEta(n, eta).euroGiorno)} al giorno)` });
  }
  const s = salvata === null || salvata === undefined || salvata === '' ? null : Number(salvata);
  if (Number.isInteger(s) && !opzioni.some((o) => o.valore === String(s))) {
    const { euroGiorno } = valutaEta(n, s);
    opzioni.push({ valore: String(s), testo: `${s} anni${euroGiorno > 0 ? ` (+${euro(euroGiorno)} al giorno)` : ''}` });
  }
  if (a !== null) opzioni.push({ valore: 'oltre', testo: `Oltre ${a} anni` });
  return opzioni;
}

// Eta' dal codice fiscale (data di nascita nei caratteri 7-11), anche con le
// lettere dell'omocodia. null se il codice non si legge.
const OMOCODIA = 'LMNPQRSTUV';
const MESI_CF = 'ABCDEHLMPRST';
export function etaDaCodiceFiscale(codiceFiscale, oggi) {
  const c = String(codiceFiscale || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{16}$/.test(c) || !/^\d{4}-\d{2}-\d{2}/.test(String(oggi || ''))) return null;
  const cifra = (ch) => (/\d/.test(ch) ? Number(ch) : OMOCODIA.indexOf(ch));
  const [aa1, aa2, g1, g2] = [c[6], c[7], c[9], c[10]].map(cifra);
  const mese = MESI_CF.indexOf(c[8]) + 1;
  if ([aa1, aa2, g1, g2].some((n) => n < 0) || mese === 0) return null;
  let giorno = g1 * 10 + g2;
  if (giorno > 40) giorno -= 40; // donne
  if (giorno < 1 || giorno > 31) return null;
  const [anno, m, g] = String(oggi).slice(0, 10).split('-').map(Number);
  const aa = aa1 * 10 + aa2;
  const nascita = 2000 + aa > anno ? 1900 + aa : 2000 + aa;
  return anno - nascita - (m < mese || (m === mese && g < giorno) ? 1 : 0);
}

// Eta' dalla data di nascita scritta (AAAA-MM-GG): per i clienti senza codice
// fiscale. null se la data non si legge.
export function etaDaDataNascita(dataNascita, oggi) {
  const n = String(dataNascita || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(n) || !/^\d{4}-\d{2}-\d{2}/.test(String(oggi || ''))) return null;
  const [na, nm, ng] = n.split('-').map(Number);
  const [a, m, g] = String(oggi).slice(0, 10).split('-').map(Number);
  if (nm < 1 || nm > 12 || ng < 1 || ng > 31 || na > a) return null;
  return a - na - (m < nm || (m === nm && g < ng) ? 1 : 0);
}

// Promemoria alla consegna sull'eta' dichiarata. Con il codice fiscale
// (se guida il cliente) l'eta' si controlla da sola: avvisa solo se non
// torna. Senza, ricorda di guardare la patente.
// Restituisce null oppure { livello: 'errore' | 'attenzione' | 'info', testo }.
export function controlloEtaConsegna({ prenotazione, etaConducenti, codiceFiscale, dataNascita, oggi, pagataSulSito = false }) {
  const n = normalizzaEtaConducenti(etaConducenti);
  const dichiarata = typeof prenotazione?.etaConducente === 'number' ? prenotazione.etaConducente : null;
  const g = prenotazione?.giovaneConducente || null;
  if (!chiedeEta(n) && dichiarata === null && !g) return null;

  const daCf = etaDaCodiceFiscale(codiceFiscale, oggi);
  const x = daCf !== null ? daCf : etaDaDataNascita(dataNascita, oggi);
  const fonte = daCf !== null ? 'Dal codice fiscale' : 'Dalla data di nascita';
  if (x !== null) {
    const v = valutaEta(n, x);
    if (v.motivo === 'sotto') {
      return { livello: 'errore', testo: `${fonte} il cliente ha ${x} anni: si noleggia dai ${n.etaMinima} anni. Se guida lui, non consegnare.` };
    }
    if (v.motivo === 'oltre') {
      return { livello: 'attenzione', testo: `${fonte} il cliente ha ${x} anni, oltre l'età massima (${n.etaMassima}). Consegna solo se l'hai deciso tu.` };
    }
    const pagato = g?.euroGiorno || 0;
    if (v.euroGiorno === pagato) return null;
    const giusto = v.euroGiorno > 0 ? `il supplemento giusto è ${euro(v.euroGiorno)} al giorno` : 'non deve pagare il supplemento';
    const come = pagataSulSito
      ? 'La prenotazione è pagata sul sito: sistema la differenza al banco.'
      : 'Se guida lui, prima di consegnare correggi l\'età con «Modifica».';
    return {
      livello: 'attenzione',
      testo: `${fonte} il cliente ha ${x} anni${dichiarata !== null ? `, ma ha dichiarato ${dichiarata}` : ''}: ${giusto}${pagato > 0 ? ` (ne paga ${euro(pagato)})` : ''}. ${come}`,
    };
  }

  if (dichiarata !== null) {
    return {
      livello: 'info',
      testo: `Il cliente ha dichiarato ${dichiarata} anni${g ? ` (supplemento ${euro(g.importo)})` : ''}. Controlla la data di nascita sulla patente: se non corrisponde, correggi l'età nella prenotazione prima di consegnare.`,
    };
  }
  const { da, a } = etaSenzaSupplemento(n);
  return {
    livello: 'info',
    testo: `Il cliente ha dichiarato ${a === null ? `almeno ${da} anni` : `un'età tra ${da} e ${a} anni`}: controlla la data di nascita sulla patente.`,
  };
}

// ---------- Form delle Impostazioni ----------

const testoEuro = (n) => (n === null || n === undefined ? '' : n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

// Campi del form (testo) dai dati salvati. Senza dati: proposta di esempio
// (spenta), cosi' il titolare vede subito come funziona.
export function etaConducentiPerForm(dati) {
  const n = normalizzaEtaConducenti(dati);
  const nuovo = !dati;
  return {
    attivo: n.attivo,
    etaMinima: String(n.etaMinima),
    conMassima: nuovo ? false : n.etaMassima !== null,
    etaMassima: String(n.etaMassima ?? 75),
    fasce: n.fasce.length
      ? n.fasce.map((f) => ({ finoA: String(f.finoA), euroGiorno: testoEuro(f.euroGiorno) }))
      : [{ finoA: '24', euroGiorno: '' }],
    conMassimo: n.massimo !== null,
    massimo: testoEuro(n.massimo),
  };
}

// Errori per campo ({} se si puo' salvare). Chiavi: etaMinima, etaMassima,
// massimo, fasce, "fasce.0.finoA", "fasce.0.euroGiorno"...
export function validaEtaConducenti(form) {
  const errori = {};
  const min = intero(form.etaMinima);
  if (!etaValida(min)) errori.etaMinima = `Da ${ETA_MINIMA_LEGALE} a ${ETA_LIMITE} anni.`;
  const max = form.conMassima ? intero(form.etaMassima) : null;
  if (form.conMassima) {
    if (!etaValida(max)) errori.etaMassima = `Da ${ETA_MINIMA_LEGALE} a ${ETA_LIMITE} anni.`;
    else if (etaValida(min) && max <= min) errori.etaMassima = 'Deve essere più dell\'età minima.';
  }

  if (form.attivo) {
    const fasce = form.fasce || [];
    if (fasce.length === 0) errori.fasce = 'Aggiungi almeno una fascia, o togli la spunta del supplemento.';
    const viste = new Set();
    fasce.forEach((f, i) => {
      const a = intero(f.finoA);
      if (!Number.isInteger(a)) errori[`fasce.${i}.finoA`] = 'Scegli l\'età.';
      else if (etaValida(min) && a < min) errori[`fasce.${i}.finoA`] = 'Non sotto l\'età minima.';
      else if (Number.isInteger(max) && a >= max) errori[`fasce.${i}.finoA`] = 'Deve essere meno dell\'età massima.';
      else if (a >= ETA_LIMITE) errori[`fasce.${i}.finoA`] = `Meno di ${ETA_LIMITE} anni.`;
      else if (viste.has(a)) errori[`fasce.${i}.finoA`] = 'C\'è già una fascia con questa età.';
      viste.add(a);
      const e = leggiEuro(f.euroGiorno);
      if (e === null) errori[`fasce.${i}.euroGiorno`] = 'Scrivi l\'importo.';
      else if (Number.isNaN(e) || !(e > 0)) errori[`fasce.${i}.euroGiorno`] = 'Scrivi un importo, es. 15';
    });
    if (form.conMassimo) {
      const m = leggiEuro(form.massimo);
      if (m === null) errori.massimo = 'Scrivi il massimo, o togli la spunta.';
      else if (Number.isNaN(m) || !(m > 0)) errori.massimo = 'Scrivi un importo, es. 300';
    }
  }
  return errori;
}

// Dal form ai valori da salvare. Con il supplemento spento si tengono
// comunque le fasce scritte (se lo si riaccende non vanno riscritte).
export function preparaEtaConducenti(form) {
  return normalizzaEtaConducenti({
    attivo: form.attivo === true,
    etaMinima: form.etaMinima,
    etaMassima: form.conMassima ? form.etaMassima : null,
    fasce: (form.fasce || []).map((f) => ({ finoA: f.finoA, euroGiorno: f.euroGiorno })),
    massimo: form.conMassimo ? form.massimo : null,
  });
}
