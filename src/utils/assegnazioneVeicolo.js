import { STATI_PRENOTAZIONE_NON_CONFERMATE } from '../lib/firestorePrenotazioni';

// Prenotazioni arrivate dal sito e già pagate ('attiva') a cui lo staff non ha
// ancora assegnato un veicolo fisico: il cliente ha prenotato una categoria,
// la targa si decide in sede.
export function daAssegnare(prenotazione) {
  return (
    prenotazione?.origine === 'sito' &&
    prenotazione.status === 'attiva' &&
    !prenotazione.targa
  );
}

const giorno = (valore) => (valore ? String(valore).slice(0, 10) : '');

// Veicoli della categoria della prenotazione che non hanno altre prenotazioni
// sovrapposte per l'intero periodo. Le date sono stringhe 'YYYY-MM-DD' e si
// confrontano come stringhe (stesso approccio di disponibilitaCategoria.js).
// Una prenotazione conclusa libera il veicolo dalla data di rientro effettivo,
// come già fa Booking.jsx.
export function veicoliLiberiPerPrenotazione(prenotazione, veicoli, prenotazioni) {
  const inizio = giorno(prenotazione.dataInizio);
  const fine = giorno(prenotazione.dataFine);

  return (veicoli || []).filter((veicolo) => {
    if (!veicolo.targa || veicolo.categoria !== prenotazione.categoria) return false;

    const occupato = (prenotazioni || []).some((p) => {
      if (p.id === prenotazione.id || p.targa !== veicolo.targa) return false;
      if (p.status === 'annullata' || STATI_PRENOTAZIONE_NON_CONFERMATE.includes(p.status)) {
        return false;
      }
      const pInizio = giorno(p.dataInizio);
      const pFine = giorno(p.dataRientroEffettiva || p.dataFine);
      return pInizio <= fine && pFine >= inizio;
    });

    return !occupato;
  });
}
