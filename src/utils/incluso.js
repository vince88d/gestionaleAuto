// «Cosa e' incluso nel noleggio»: le voci scritte dallo staff che il sito mostra
// sotto «Incluso» nella tappa «Il tuo noleggio» (documento pubblico
// impostazioni/incluso). Le voci automatiche (cancellazione, pagamento, km,
// categoria) non stanno qui: dipendono da altre impostazioni.
// Mockup: formiarent-documenti/mockup/sito-patente-e-incluso.html
// Il sito le legge con le stesse regole (formiarent: src/lib/incluso.ts).
export const MAX_VOCI_INCLUSO = 20;
export const MAX_TESTO_INCLUSO = 80;

export const INCLUSO_DI_PARTENZA = { voci: [] };

const testoPulito = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();

// Dal documento (anche mancante o sporco) a { voci: [{ id, testo, attiva }] }.
export function normalizzaIncluso(dati) {
  const grezze = Array.isArray(dati?.voci) ? dati.voci : [];
  const voci = [];
  grezze.forEach((v, i) => {
    const testo = testoPulito(v?.testo).slice(0, MAX_TESTO_INCLUSO);
    if (!testo || voci.length >= MAX_VOCI_INCLUSO) return;
    voci.push({ id: typeof v?.id === 'string' && v.id ? v.id : `v${i + 1}`, testo, attiva: v?.attiva !== false });
  });
  return { voci };
}

// Il form lavora sulle stesse voci (il testo si puo' scrivere a meta').
export const inclusoPerForm = (dati) => normalizzaIncluso(dati);

export function nuovaVoceIncluso() {
  return { id: `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, testo: '', attiva: true };
}

// Quello che si salva: senza voci vuote, testi puliti.
export function preparaIncluso(form) {
  return normalizzaIncluso({ voci: (form?.voci || []).map((v) => ({ ...v, testo: testoPulito(v.testo) })) });
}

// Errori per riga: { 'voci.2': 'testo' }. Una riga vuota si segnala, non si butta via in silenzio.
export function validaIncluso(form) {
  const errori = {};
  const voci = form?.voci || [];
  voci.forEach((v, i) => {
    const t = testoPulito(v.testo);
    if (!t) errori[`voci.${i}`] = 'Scrivi la voce oppure toglila.';
    else if (t.length > MAX_TESTO_INCLUSO) errori[`voci.${i}`] = `Al massimo ${MAX_TESTO_INCLUSO} caratteri.`;
  });
  if (voci.length > MAX_VOCI_INCLUSO) errori.voci = `Al massimo ${MAX_VOCI_INCLUSO} voci.`;
  return errori;
}

// I testi che il sito mostra (solo le voci accese), nell'ordine scritto.
export const vociInclusePerSito = (dati) => normalizzaIncluso(dati).voci.filter((v) => v.attiva).map((v) => v.testo);
