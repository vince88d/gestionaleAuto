// Regola dei giorni di noleggio, allineata a quella delle principali catene
// (Europcar, Hertz, Sixt, Avis): un giorno di noleggio è un periodo di 24 ore
// a partire dal momento del ritiro. Ritiro il 10 e riconsegna il 12 alla
// stessa ora = 2 giorni, non 3: il giorno di riconsegna non si paga a parte.
// Ritiro e riconsegna nello stesso giorno = 1 giorno (minimo fatturabile).
//
// Le prenotazioni hanno solo la data, senza orario: si assume quindi che
// riconsegna e ritiro avvengano alla stessa ora. Oltre l'orario concordato
// (di norma con una tolleranza di 29 minuti) le catene addebitano un giorno
// in più: va scritto nelle condizioni di noleggio e gestito al rientro.
//
// Deve restare identica a `calcolaGiorni` del sito (formiarent,
// functions/src/disponibilita.ts): se cambi una, cambia anche l'altra.
export function calcolaGiorniNoleggio(dataInizio, dataFine) {
  const inizio = new Date(dataInizio);
  const fine = new Date(dataFine);
  const diff = fine - inizio;
  if (Number.isNaN(diff) || diff < 0) return 0; // date mancanti o non valide
  return Math.max(Math.ceil(diff / (1000 * 60 * 60 * 24)), 1);
}
