// Richieste dal sito in modalita' «Solo richieste, senza prezzi» (vedi
// formiarent/functions/src/richieste.ts): il cliente ha chiesto un'auto senza
// pagare, l'auto resta tenuta per 24 ore e lo staff lo richiama con il prezzo.
// Funzioni pure, testate.

const millis = (t) => {
  if (!t) return null;
  if (typeof t.toMillis === 'function') return t.toMillis();
  if (typeof t.seconds === 'number') return t.seconds * 1000;
  const n = new Date(t).getTime();
  return Number.isFinite(n) ? n : null;
};

// Le richieste da gestire: quelle in attesa e quelle scadute senza risposta il
// cui ritiro non e' ancora passato (lo staff puo' ancora confermarle se l'auto
// e' libera). Prima quelle che scadono prima, poi le scadute.
export function richiesteDaGestire(prenotazioni, adessoMs, oggi) {
  return (prenotazioni || [])
    .filter((p) => p?.richiestaSenzaPagamento && !p.eliminato)
    .filter((p) => p.status === 'richiesta-sito' || (p.status === 'scaduta' && String(p.dataInizio || '').slice(0, 10) >= oggi))
    .map((p) => {
      const scadeMs = millis(p.scadeIl);
      const scaduta = p.status === 'scaduta' || (scadeMs !== null && scadeMs <= adessoMs);
      return { prenotazione: p, scadeMs, scaduta };
    })
    .sort((a, b) => Number(a.scaduta) - Number(b.scaduta) || (a.scadeMs ?? Infinity) - (b.scadeMs ?? Infinity));
}

// «Scade tra 2 ore», «Scade tra 40 minuti», «Scaduta». urgente: meno di 3 ore.
export function tempoRimasto(scadeMs, adessoMs) {
  if (scadeMs === null || scadeMs === undefined) return { testo: 'In attesa', urgente: false };
  const minuti = Math.floor((scadeMs - adessoMs) / 60000);
  if (minuti <= 0) return { testo: 'Scaduta', urgente: true };
  if (minuti < 60) return { testo: `Scade tra ${minuti} ${minuti === 1 ? 'minuto' : 'minuti'}`, urgente: true };
  const ore = Math.floor(minuti / 60);
  return { testo: `Scade tra ${ore} ${ore === 1 ? 'ora' : 'ore'}`, urgente: ore < 3 };
}

// Cosa ha chiesto il cliente, in una riga: protezione ed extra senza prezzi.
export function sceltaRichiesta(p) {
  const tipo = p?.protezione?.tipo;
  const protezione = tipo === 'totale' ? 'Protezione totale' : tipo === 'base' ? 'Protezione base' : null;
  const extra = (Array.isArray(p?.optional) ? p.optional : [])
    .filter((r) => r?.nome && Number(r.quantita) > 0)
    .map((r) => (Number(r.quantita) > 1 ? `${r.nome} × ${r.quantita}` : r.nome));
  const km = p?.chilometri?.nome || null;
  return [protezione, km, ...extra].filter(Boolean).join(' · ');
}

// Il prezzo scritto dallo staff: numero da 0 in su, anche con la virgola.
// null se non e' un prezzo valido.
// Il punto vale come separatore delle migliaia se c'e' anche la virgola o se e'
// seguito da gruppi di 3 cifre (1.200 = milleduecento), altrimenti come decimale.
export function leggiPrezzo(testo) {
  let t = String(testo ?? '').trim().replace(/\s|€/g, '');
  if (t === '') return null;
  if (t.includes(',') || /^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

// Preventivo con link (vedi formiarent/functions/src/preventivo.ts): lo staff
// sceglie per quante ore e' valido; in quel tempo l'auto resta tenuta per il cliente.
export const ORE_PREVENTIVO = [12, 24, 48];
export const ORE_PREVENTIVO_DEFAULT = 24;

// «giovedì 29 ottobre alle 15:30»: quando scade un preventivo inviato adesso.
export function scadenzaPreventivo(ore, adessoMs) {
  const d = new Date(adessoMs + ore * 3600 * 1000);
  const giorno = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Rome' });
  const ora = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
  return `${giorno} alle ${ora}`;
}

// Il preventivo gia' inviato a questa richiesta (importo), o null.
export function preventivoInviato(p) {
  const t = p?.preventivo?.totale;
  return p?.daPreventivo && typeof t === 'number' ? t : null;
}
