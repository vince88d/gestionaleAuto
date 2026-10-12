// Foto della consegna e del rientro caricate dal telefono (QR): etichette,
// foto consigliate e riepiloghi. Funzioni pure, testate. Mockup approvato:
// formiarent-documenti/mockup/gestionale-foto-telefono.html
//
// Ogni foto sta in `fotoVerbali/{id}`: { prenotazioneId, fase, url, path,
// etichetta, scattataIl, caricataIl } (la crea la Cloud Function del sito).
import { formattaData } from './scadenze';

// Stesso elenco della funzione e della pagina del telefono (sito).
export const ETICHETTE = [
  'Angolo anteriore sinistro', 'Angolo anteriore destro', 'Angolo posteriore destro', 'Angolo posteriore sinistro',
  'Quadro (km e carburante)', 'Interni', 'Danno', 'Altro',
];

// Foto consigliate [etichetta, nome breve]: 4 angoli, quadro acceso, interni.
export const CONSIGLIATE = [
  ['Angolo anteriore sinistro', 'Ant. sinistro'],
  ['Angolo anteriore destro', 'Ant. destro'],
  ['Angolo posteriore destro', 'Post. destro'],
  ['Angolo posteriore sinistro', 'Post. sinistro'],
  ['Quadro (km e carburante)', 'Quadro'],
  ['Interni', 'Interni'],
];

// Sotto questo numero di foto compare l'avviso (non blocca la consegna).
export const MINIMO_CONSIGLIATO = 5;

export const FASI = ['consegna', 'rientro'];

const ms = (t) => (typeof t?.toMillis === 'function' ? t.toMillis() : typeof t === 'number' ? t : null);

// Documento Firestore -> foto con date in millisecondi.
export function normalizzaFoto(id, dati = {}) {
  return {
    id,
    url: dati.url || '',
    path: dati.path || '',
    fase: dati.fase || '',
    etichetta: ETICHETTE.includes(dati.etichetta) ? dati.etichetta : '',
    scattataIl: ms(dati.scattataIl),
    caricataIl: ms(dati.caricataIl),
  };
}

// Ordine di scatto (se c'e' la data), poi di caricamento.
export function ordinaFoto(foto = []) {
  return [...foto].sort((a, b) => (a.scattataIl ?? a.caricataIl ?? 0) - (b.scattataIl ?? b.caricataIl ?? 0) || (a.caricataIl ?? 0) - (b.caricataIl ?? 0));
}

// Foto consigliate che non ci sono ancora: [[etichetta, nome breve]].
export function consigliateMancanti(foto = []) {
  const presenti = new Set(foto.map((f) => f.etichetta).filter(Boolean));
  return CONSIGLIATE.filter(([etichetta]) => !presenti.has(etichetta));
}

export const pocheFoto = (foto = []) => foto.length < MINIMO_CONSIGLIATO;

const ora = (t) => new Date(t).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
const giornoBreve = (t) => formattaData(new Date(t)).split('/').slice(0, 2).join('/');
const stessoGiorno = (a, b) => giornoBreve(a) === giornoBreve(b);

// «Scattate il 12/10 alle 09:02–09:06 · caricate alle 09:21». Senza data di
// scatto (foto senza dati) resta solo il caricamento.
export function testoOrari(foto = []) {
  const scatti = foto.map((f) => f.scattataIl).filter((t) => typeof t === 'number').sort((a, b) => a - b);
  const caricamenti = foto.map((f) => f.caricataIl).filter((t) => typeof t === 'number').sort((a, b) => a - b);
  const parti = [];
  if (scatti.length > 0) {
    const [prima, ultima] = [scatti[0], scatti[scatti.length - 1]];
    if (!stessoGiorno(prima, ultima)) parti.push(`Scattate dal ${giornoBreve(prima)} alle ${ora(prima)} al ${giornoBreve(ultima)} alle ${ora(ultima)}`);
    else if (ora(prima) === ora(ultima)) parti.push(`Scattate il ${giornoBreve(prima)} alle ${ora(prima)}`);
    else parti.push(`Scattate il ${giornoBreve(prima)} alle ${ora(prima)}–${ora(ultima)}`);
  }
  if (caricamenti.length > 0) {
    const ultimo = caricamenti[caricamenti.length - 1];
    const stessoDelloScatto = scatti.length > 0 && stessoGiorno(scatti[0], ultimo);
    parti.push(`${scatti.length > 0 ? 'caricate' : 'Caricate'} ${stessoDelloScatto || scatti.length === 0 ? '' : `il ${giornoBreve(ultimo)} `}alle ${ora(ultimo)}`.replace('  ', ' '));
  }
  return parti.join(' · ');
}

// Etichetta di una foto per l'elenco e il PDF: quella scelta o «Foto N».
export const nomeFoto = (foto, indice) => foto.etichetta || `Foto ${indice + 1}`;

// Riga sotto la foto nel PDF: «Scattata 12/10 09:02 · caricata 09:21», o solo il caricamento.
export function didascaliaPdf(foto) {
  const partiScatto = typeof foto.scattataIl === 'number' ? `scattata ${giornoBreve(foto.scattataIl)} ${ora(foto.scattataIl)}` : '';
  const partiCarica = typeof foto.caricataIl === 'number' ? `caricata ${giornoBreve(foto.caricataIl)} ${ora(foto.caricataIl)}` : '';
  return [partiScatto, partiCarica].filter(Boolean).join(' · ');
}
