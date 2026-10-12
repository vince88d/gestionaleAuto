// Schema dell'auto con i danni numerati: dati e disegno condivisi tra la
// finestra (SVG) e il PDF (stesse forme, stessi numeri).
//
// Un segno e' { id, vista: 'alto' | 'sx' | 'dx' | null, x, y, tipo, testo }.
// `vista` null = danno scritto a mano in passato, senza punto sullo schema.
// Le coordinate sono quelle del disegno (SCHEMA_LARGHEZZA x SCHEMA_ALTEZZA).

export const SCHEMA_LARGHEZZA = 380;
export const SCHEMA_ALTEZZA = 290;

export const VISTE = { alto: 'Dall’alto', sx: 'Lato sinistro', dx: 'Lato destro' };
export const TIPI_DANNO = ['Graffio', 'Ammaccatura', 'Scheggiatura', 'Rottura', 'Usura / sporco', 'Altro'];

const rettangolo = (x, y, w, h, r) =>
  `M${x + r} ${y} L${x + w - r} ${y} Q${x + w} ${y} ${x + w} ${y + r} L${x + w} ${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} ` +
  `L${x + r} ${y + h} Q${x} ${y + h} ${x} ${y + h - r} L${x} ${y + r} Q${x} ${y} ${x + r} ${y} Z`;

const ruota = (cx, cy, r) =>
  `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;

// Fianco: il corpo con le ruote e i finestrini, a `y` dall'alto.
function fianco(y) {
  return [
    { d: `M178 ${y + 34} L178 ${y + 22} Q178 ${y + 16} 188 ${y + 14} L222 ${y + 10} L240 ${y - 2} Q244 ${y - 4} 252 ${y - 4} L300 ${y - 4} Q308 ${y - 4} 314 ${y + 4} L338 ${y + 12} Q362 ${y + 14} 366 ${y + 22} L366 ${y + 34} Z`, riempi: 'bianco', contorno: 2 },
    { d: `M247 ${y + 8} L256 ${y} L276 ${y} L276 ${y + 8} Z M282 ${y} L300 ${y} Q305 ${y} 309 ${y + 8} L282 ${y + 8} Z`, riempi: 'vetro', contorno: 1 },
    { d: ruota(212, y + 34, 13), riempi: 'nero' }, { d: ruota(212, y + 34, 5), riempi: 'cerchione' },
    { d: ruota(332, y + 34, 13), riempi: 'nero' }, { d: ruota(332, y + 34, 5), riempi: 'cerchione' },
  ];
}

// Vista dall'alto, a sinistra.
const ALTO = [
  { d: rettangolo(26, 16, 98, 256, 38), riempi: 'bianco', contorno: 2 },
  { d: 'M38 88 Q75 72 112 88 L108 118 Q75 110 42 118 Z', riempi: 'vetro', contorno: 1.4 },
  { d: 'M42 196 Q75 206 108 196 L112 224 Q75 238 38 224 Z', riempi: 'vetro', contorno: 1.4 },
  { d: rettangolo(42, 124, 66, 66, 6), contorno: 1.1 },
  { d: rettangolo(14, 48, 14, 36, 5), riempi: 'nero' }, { d: rettangolo(122, 48, 14, 36, 5), riempi: 'nero' },
  { d: rettangolo(14, 202, 14, 36, 5), riempi: 'nero' }, { d: rettangolo(122, 202, 14, 36, 5), riempi: 'nero' },
];

// Le tre viste: parti da disegnare, zona dove si puo' toccare e scritte.
export const SAGOME = {
  alto: { parti: ALTO, zona: { x: 10, y: 12, w: 130, h: 264 } },
  sx: { parti: fianco(34), zona: { x: 172, y: 26, w: 200, h: 60 } },
  dx: { parti: fianco(170), zona: { x: 172, y: 162, w: 200, h: 60 } },
};

export const SCRITTE = [
  { testo: 'DAVANTI', x: 75, y: 10, centro: true },
  { testo: 'DIETRO', x: 75, y: 286, centro: true },
  { testo: 'LATO SINISTRO', x: 170, y: 30 },
  { testo: 'DAVANTI', x: 178, y: 90 }, { testo: 'DIETRO', x: 368, y: 90, fine: true },
  { testo: 'LATO DESTRO', x: 170, y: 166 },
  { testo: 'DIETRO', x: 178, y: 226 }, { testo: 'DAVANTI', x: 368, y: 226, fine: true },
];

export const nuovoId = () => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Vista toccata e posizione: null se il punto e' fuori dalle sagome.
export function vistaDelPunto(x, y) {
  const trovata = Object.entries(SAGOME).find(([, { zona }]) => x >= zona.x && x <= zona.x + zona.w && y >= zona.y && y <= zona.y + zona.h);
  return trovata ? trovata[0] : null;
}

export const nuovoSegno = (vista, x, y) => ({ id: nuovoId(), vista, x: Math.round(x), y: Math.round(y), tipo: TIPI_DANNO[0], testo: '' });

// Elenco dei segni sicuro, qualunque cosa ci sia nei dati salvati.
export function segniValidi(valore) {
  return (Array.isArray(valore) ? valore : []).filter((s) => s && typeof s === 'object').map((s, i) => ({
    id: typeof s.id === 'string' && s.id ? s.id : `d${i}`,
    vista: VISTE[s.vista] ? s.vista : null,
    x: Number.isFinite(Number(s.x)) ? Number(s.x) : 0,
    y: Number.isFinite(Number(s.y)) ? Number(s.y) : 0,
    tipo: TIPI_DANNO.includes(s.tipo) ? s.tipo : 'Altro',
    testo: String(s.testo || ''), // senza trim: chi scrive deve poter digitare gli spazi
  }));
}

// Dalle prenotazioni vecchie: il testo libero diventa un segno senza punto.
export function segniDaTesto(testo) {
  const t = String(testo || '').trim();
  if (!t || /^(nessuno|nessun danno|niente|-|—)$/i.test(t)) return [];
  return [{ id: 'testo', vista: null, x: 0, y: 0, tipo: 'Altro', testo: t }];
}

// Segni da mostrare: quelli salvati o, se non ce ne sono, il vecchio testo.
export const segniDi = (salvati, testoVecchio) => (Array.isArray(salvati) ? segniValidi(salvati) : segniDaTesto(testoVecchio));

// Testo riassuntivo (resta nei campi `danni` / `descrizioneDanno`, che leggono
// email, dettagli, archivio e dashboard): «Graffio - portiera destra; …».
export function testoDanni(segni = []) {
  return segniValidi(segni).map((s) => {
    const testo = s.testo.trim();
    return testo ? `${s.tipo === 'Altro' ? '' : `${s.tipo} - `}${testo}` : s.tipo;
  }).join('; ');
}

// Punti senza descrizione: nel PDF non si capirebbe di cosa si tratta.
export const senzaDescrizione = (segni = []) => segniValidi(segni).filter((s) => !s.testo.trim());
