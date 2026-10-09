// Dotazione di bordo: cosa deve esserci sempre in un'auto (documenti, cric,
// triangolo...), scritta nella scheda del veicolo. Diversa dagli extra a
// pagamento (seggiolino, GPS...), che arrivano dalla prenotazione.
// Funzioni pure, testate. Mockup approvato:
// formiarent-documenti/mockup/gestionale-dotazione-bordo.html
//
// Sul veicolo: `dotazione` (elenco di nomi; assente = non impostata),
// `chiavi` (1 o 2), `gommeInvernali` (true/false).
// Sulla consegna (schedaVeicolo.dotazione): { voci, presenti, impostata,
// chiaviConsegnate, note, salvaComeDotazione }.

export const DOCUMENTI = 'Documenti (libretto e assicurazione)';
export const CATENE = 'Catene da neve';
export const CAVO = 'Cavo di ricarica';

export const VOCI_BASE = [DOCUMENTI, 'Cric', 'Triangolo', 'Giubbotto', 'Ruota di scorta', 'Kit gonfiaggio', CAVO, CATENE];

// Un veicolo nuovo parte con la dotazione minima e due chiavi.
export const DOTAZIONE_NUOVO_VEICOLO = [DOCUMENTI, 'Cric', 'Triangolo', 'Giubbotto', 'Ruota di scorta'];
export const CHIAVI_NUOVO_VEICOLO = 2;

const pulisci = (nome) => String(nome || '').trim().replace(/\s+/g, ' ');

// Elenco senza doppioni (senza badare alle maiuscole) e senza voci vuote.
export function normalizzaVoci(voci) {
  const viste = new Set();
  return (Array.isArray(voci) ? voci : []).map(pulisci).filter((v) => {
    const k = v.toLowerCase();
    if (!v || viste.has(k)) return false;
    viste.add(k);
    return true;
  });
}

// Dotazione impostata del veicolo, o null se non e' mai stata impostata.
export const dotazioneVeicolo = (v) => (Array.isArray(v?.dotazione) ? normalizzaVoci(v.dotazione) : null);
export const chiaviVeicolo = (v) => (v?.chiavi === 1 || v?.chiavi === 2 ? v.chiavi : null);
export const elettricaOIbrida = (v) => /elettric|ibrid/i.test(v?.carburante || '');

// Voci da mostrare nella scheda del veicolo: quelle base piu' quelle aggiunte.
export const vociDaScegliere = (dotazione) => normalizzaVoci([...VOCI_BASE, ...(dotazione || [])]);

// Dal 15 novembre al 15 aprile, dove c'e' l'ordinanza, servono catene a
// bordo o gomme invernali.
export function inStagioneCatene(dataISO) {
  const md = String(dataISO || '').slice(5, 10);
  if (!/^\d{2}-\d{2}$/.test(md)) return false;
  return md >= '11-15' || md <= '04-15';
}

// Avviso alla consegna: inverno, niente gomme invernali e niente catene in dotazione.
export function avvisoCatene(veicolo, dataISO) {
  if (!inStagioneCatene(dataISO) || veicolo?.gommeInvernali === true) return false;
  return !(dotazioneVeicolo(veicolo) || []).some((v) => v.toLowerCase() === CATENE.toLowerCase());
}

// Stato di partenza della consegna: la dotazione dell'auto gia' spuntata, o
// se non c'e' la lista base vuota (da spuntare, e da salvare sull'auto).
export function dotazioneIniziale(veicolo) {
  const dotazione = dotazioneVeicolo(veicolo);
  return {
    voci: dotazione || [...VOCI_BASE],
    presenti: dotazione ? [...dotazione] : [],
    impostata: Boolean(dotazione),
    chiaviConsegnate: chiaviVeicolo(veicolo),
    note: '',
    salvaComeDotazione: !dotazione,
  };
}

const NOMI_ACCESSORI_VECCHI = {
  cric: 'Cric',
  triangolo: 'Triangolo',
  giubbotto: 'Giubbotto',
  ruotaScorta: 'Ruota di scorta',
  cavoRicarica: CAVO,
  cateneNeve: CATENE,
};

// Cosa c'era a bordo alla consegna, per dettagli e PDF: solo le voci
// presenti, e a parte quelle che mancavano (solo se l'auto aveva la dotazione
// impostata: senza, non si sa cosa doveva esserci). Le consegne fatte prima
// avevano `accessori` ({ cric: true, ..., altro: '' }): si leggono lo stesso.
export function riassuntoDotazione(scheda = {}) {
  const d = scheda?.dotazione;
  if (d && Array.isArray(d.presenti)) {
    const presenti = normalizzaVoci(d.presenti);
    const mancanti = d.impostata
      ? normalizzaVoci(d.voci).filter((v) => !presenti.some((p) => p.toLowerCase() === v.toLowerCase()))
      : [];
    return { presenti, mancanti, chiaviConsegnate: d.chiaviConsegnate ?? null, note: pulisci(d.note) };
  }
  const a = scheda?.accessori || {};
  const presenti = Object.entries(a)
    .filter(([k, v]) => k !== 'altro' && v)
    .map(([k]) => NOMI_ACCESSORI_VECCHI[k] || k);
  if (pulisci(a.altro)) presenti.push(pulisci(a.altro));
  return { presenti, mancanti: [], chiaviConsegnate: null, note: '' };
}

// Dotazione da salvare sul veicolo dopo una consegna di un'auto che non
// l'aveva ("Salva come dotazione di questa auto"), o null se non va salvata.
export function dotazioneDaSalvare(scheda = {}) {
  const d = scheda?.dotazione;
  if (!d || d.impostata || !d.salvaComeDotazione) return null;
  const campi = { dotazione: normalizzaVoci(d.presenti) };
  if (d.chiaviConsegnate === 1 || d.chiaviConsegnate === 2) campi.chiavi = d.chiaviConsegnate;
  return campi;
}
