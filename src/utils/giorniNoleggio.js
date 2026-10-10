// Regola dei giorni di noleggio, allineata a quella delle principali catene
// (Europcar, Hertz, Sixt, Avis): un giorno di noleggio è un periodo di 24 ore
// a partire dal momento del ritiro. Ritiro il 10 e riconsegna il 12 alla
// stessa ora = 2 giorni, non 3: il giorno di riconsegna non si paga a parte.
// Ritiro e riconsegna nello stesso giorno = 1 giorno (minimo fatturabile).
//
// Con le ore ("HH:MM") conta l'orario: alla riconsegna si concedono
// `tolleranza` minuti (decisi in Impostazioni → Orari della sede), oltre si
// conta un giorno in piu'. Ritiro 12 alle 9:00, rientro 15 alle 9:29 = 3
// giorni; alle 9:30 = 4. Senza ore (prenotazioni di prima) si assume la
// stessa ora: conta solo la data.
//
// Deve restare identica a `giorniNoleggio` del sito (formiarent,
// src/lib/orari.ts e functions/src/orari.ts): se cambi una, cambia anche le altre.
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const ORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const minuti = (o) => {
  const [h, m] = o.split(':').map(Number);
  return h * 60 + m;
};
// Minuti "da orologio", senza fuso: la sede e' una sola (niente salti per l'ora legale).
const istante = (d, o) => Math.round(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 60000) + minuti(o);

export function calcolaGiorniNoleggio(dataInizio, dataFine, oraInizio, oraFine, tolleranza = 0) {
  const di = String(dataInizio || '').slice(0, 10);
  const df = String(dataFine || '').slice(0, 10);
  if (!DATA.test(di) || !DATA.test(df) || df < di) return 0; // date mancanti o non valide
  const oi = ORA.test(String(oraInizio || '')) ? oraInizio : '00:00';
  const of = ORA.test(String(oraFine || '')) ? oraFine : oi;
  const durata = istante(df, of) - istante(di, oi);
  return Math.max(1, Math.ceil((durata - Math.max(0, Number(tolleranza) || 0)) / 1440));
}
