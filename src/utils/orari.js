// Orari della sede: settimana, chiusure straordinarie e tolleranza alla
// riconsegna. Funzioni pure, testate. Le imposta lo staff in Impostazioni;
// il sito le legge (documento pubblico impostazioni/orari) per mostrarle e
// per far scegliere l'ora di ritiro e riconsegna. Mockup approvato:
// formiarent-documenti/mockup/gestionale-orari.html
//
// Documento: { settimana: { lun: { aperto, fasce: [{ da: '08:30', a: '13:00' }] }, ... },
//              chiusure: [{ dal: 'AAAA-MM-GG', al: 'AAAA-MM-GG', motivo }], tolleranzaMinuti }
//
// Le stesse regole (orarioDelGiorno, oreSelezionabili) servono al sito
// (formiarent): se cambi qui, cambia anche li'.

export const GIORNI = [
  ['lun', 'Lunedì'], ['mar', 'Martedì'], ['mer', 'Mercoledì'], ['gio', 'Giovedì'],
  ['ven', 'Venerdì'], ['sab', 'Sabato'], ['dom', 'Domenica'],
];
const ABBREVIATI = { lun: 'Lun', mar: 'Mar', mer: 'Mer', gio: 'Gio', ven: 'Ven', sab: 'Sab', dom: 'Dom' };
// getDay(): 0 = domenica
const DA_GETDAY = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];

export const PASSO_MINUTI = 30;
export const TOLLERANZA_PREDEFINITA = 29;

const feriale = () => ({ aperto: true, fasce: [{ da: '08:30', a: '13:00' }, { da: '15:00', a: '19:30' }] });

// Gli orari scritti finora nel sito (src/data/azienda.ts): si parte da questi.
export const ORARI_PREDEFINITI = {
  settimana: {
    lun: feriale(), mar: feriale(), mer: feriale(), gio: feriale(), ven: feriale(),
    sab: { aperto: true, fasce: [{ da: '09:00', a: '13:00' }, { da: '15:30', a: '19:00' }] },
    dom: { aperto: false, fasce: [] },
  },
  chiusure: [],
  tolleranzaMinuti: TOLLERANZA_PREDEFINITA,
};

const ORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
export const oraValida = (o) => ORA.test(String(o || ''));
export const minuti = (o) => {
  const [h, m] = String(o).split(':').map(Number);
  return h * 60 + m;
};
const daMinuti = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

// Tutte le ore di un giorno, ogni PASSO_MINUTI: per i menu del gestionale.
export const ORE_DEL_GIORNO = Array.from({ length: (24 * 60) / PASSO_MINUTI }, (_, i) => daMinuti(i * PASSO_MINUTI));

// "08:30" -> "8:30"
export const oraBreve = (o) => String(o || '').replace(/^0(\d)/, '$1');

export function normalizzaOrari(dati) {
  if (!dati || typeof dati !== 'object' || !dati.settimana) {
    return JSON.parse(JSON.stringify(ORARI_PREDEFINITI));
  }
  const settimana = {};
  GIORNI.forEach(([k]) => {
    const g = dati.settimana?.[k] || {};
    const fasce = (Array.isArray(g.fasce) ? g.fasce : [])
      .filter((f) => oraValida(f?.da) && oraValida(f?.a))
      .slice(0, 2)
      .map((f) => ({ da: f.da, a: f.a }));
    settimana[k] = { aperto: g.aperto === true && fasce.length > 0, fasce };
  });
  const chiusure = (Array.isArray(dati.chiusure) ? dati.chiusure : [])
    .filter((c) => DATA.test(c?.dal || ''))
    .map((c) => ({ dal: c.dal, al: DATA.test(c?.al || '') && c.al >= c.dal ? c.al : c.dal, motivo: String(c?.motivo || '').trim() }))
    .sort((a, b) => a.dal.localeCompare(b.dal));
  const t = Number(dati.tolleranzaMinuti);
  return {
    settimana,
    chiusure,
    tolleranzaMinuti: Number.isInteger(t) && t >= 0 && t <= 180 ? t : TOLLERANZA_PREDEFINITA,
  };
}

// Errori del form ({} se si puo' salvare). Chiavi: "lun.0", "lun.1", "chiusura.2", "tolleranza".
export function validaOrari(form) {
  const errori = {};
  GIORNI.forEach(([k, nome]) => {
    const g = form.settimana[k];
    if (!g.aperto) return;
    if (g.fasce.length === 0) errori[`${k}.0`] = `${nome}: scrivi almeno un orario, o segnalo chiuso.`;
    g.fasce.forEach((f, i) => {
      if (!oraValida(f.da) || !oraValida(f.a)) errori[`${k}.${i}`] = 'Scegli l\'orario.';
      else if (minuti(f.a) <= minuti(f.da)) errori[`${k}.${i}`] = 'La chiusura deve venire dopo l\'apertura.';
    });
    if (g.fasce.length === 2 && !errori[`${k}.0`] && !errori[`${k}.1`] && minuti(g.fasce[1].da) <= minuti(g.fasce[0].a)) {
      errori[`${k}.1`] = 'Il pomeriggio deve cominciare dopo la mattina.';
    }
  });
  form.chiusure.forEach((c, i) => {
    if (!DATA.test(c.dal || '')) errori[`chiusura.${i}`] = 'Scegli il giorno.';
    else if (c.al && c.al < c.dal) errori[`chiusura.${i}`] = 'La fine viene prima dell\'inizio.';
  });
  const t = Number(form.tolleranzaMinuti);
  if (!(Number.isInteger(t) && t >= 0 && t <= 180)) errori.tolleranza = 'Da 0 a 180 minuti.';
  return errori;
}

// Dal form al documento da salvare.
export const preparaOrari = (form) => normalizzaOrari({
  ...form,
  tolleranzaMinuti: Number(form.tolleranzaMinuti),
  chiusure: form.chiusure.map((c) => ({ ...c, al: c.al || c.dal })),
});

const fasceTesto = (g) => g.fasce.map((f) => `${oraBreve(f.da)}–${oraBreve(f.a)}`).join(' / ');
const dataBreve = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7);

// "Lun–Ven 8:30–13:00 / 15:00–19:30 · Sab 9:00–13:00 · Dom chiuso": giorni
// di fila con gli stessi orari si uniscono.
export function testoSettimana(orari) {
  const gruppi = [];
  GIORNI.forEach(([k]) => {
    const g = orari.settimana[k];
    const testo = g.aperto ? fasceTesto(g) : 'chiuso';
    const ultimo = gruppi[gruppi.length - 1];
    if (ultimo && ultimo.testo === testo) ultimo.a = k;
    else gruppi.push({ da: k, a: k, testo });
  });
  return gruppi
    .map(({ da, a, testo }) => `${ABBREVIATI[da]}${da !== a ? `–${ABBREVIATI[a]}` : ''} ${testo}`)
    .join(' · ');
}

export function testoChiusure(orari) {
  return orari.chiusure
    .map((c) => (c.al && c.al !== c.dal ? `dal ${dataBreve(c.dal)} al ${dataBreve(c.al)}` : `il ${dataBreve(c.dal)}`)
      + (c.motivo ? ` (${c.motivo})` : ''))
    .join(', ');
}

// Orario di un giorno preciso: chiusura straordinaria, giorno chiuso o fasce.
export function orarioDelGiorno(orari, dataISO) {
  const giorno = String(dataISO || '').slice(0, 10);
  if (!DATA.test(giorno)) return null;
  const chiusura = orari.chiusure.find((c) => giorno >= c.dal && giorno <= (c.al || c.dal));
  if (chiusura) return { chiuso: true, motivo: chiusura.motivo || 'chiusura straordinaria', fasce: [] };
  const k = DA_GETDAY[new Date(`${giorno}T12:00:00`).getDay()];
  const g = orari.settimana[k];
  return g?.aperto ? { chiuso: false, motivo: '', fasce: g.fasce } : { chiuso: true, motivo: '', fasce: [] };
}

// La sede e' aperta a quell'ora di quel giorno? (estremi compresi: alle 13:00 si riconsegna ancora)
export function apertaAlle(orari, dataISO, ora) {
  const o = orarioDelGiorno(orari, dataISO);
  if (!o || o.chiuso || !oraValida(ora)) return false;
  const m = minuti(ora);
  return o.fasce.some((f) => m >= minuti(f.da) && m <= minuti(f.a));
}

// Ore che il cliente puo' scegliere quel giorno, ogni PASSO_MINUTI, dentro le fasce.
export function oreSelezionabili(orari, dataISO) {
  const o = orarioDelGiorno(orari, dataISO);
  if (!o || o.chiuso) return [];
  const ore = [];
  o.fasce.forEach((f) => {
    const inizio = Math.ceil(minuti(f.da) / PASSO_MINUTI) * PASSO_MINUTI;
    for (let m = inizio; m <= minuti(f.a); m += PASSO_MINUTI) ore.push(daMinuti(m));
  });
  return ore;
}
