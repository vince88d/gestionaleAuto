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
const ORA = /^([01]\d|2[0-3]):[0-5]\d$/;

// Minuti "da orologio" (senza fuso) di una data 'AAAA-MM-GG' e di un'ora 'HH:MM'.
const istante = (data, ora) => {
  const [h, m] = ora.split(':').map(Number);
  return Math.round(Date.UTC(+data.slice(0, 4), +data.slice(5, 7) - 1, +data.slice(8, 10)) / 60000) + h * 60 + m;
};

// Data e ora locali di un istante ISO (es. il rientro effettivo di un noleggio concluso).
const dataEOraLocali = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const due = (n) => String(n).padStart(2, '0');
  return { data: `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`, ora: `${due(d.getHours())}:${due(d.getMinutes())}` };
};

// Un'auto rientrata alle 14:24 si puo' dare a un altro cliente alle 15:30 dello
// stesso giorno: quando la prenotazione da assegnare ha le ore (e l'altra ha
// l'ora di fine o il rientro effettivo) si confrontano gli orari, non i
// giorni interi. Senza ore resta il confronto per giorno (anche il giorno di
// rientro conta occupato).
function siSovrapponeConOre(nuova, altra) {
  if (!ORA.test(nuova.oraInizio || '') || !ORA.test(nuova.oraFine || '')) return null;
  const effettivo = altra.dataRientroEffettiva ? dataEOraLocali(altra.dataRientroEffettiva) : null;
  const fineData = effettivo ? effettivo.data : giorno(altra.dataFine);
  const fineOra = effettivo ? effettivo.ora : altra.oraFine;
  if (!fineData || !ORA.test(fineOra || '')) return null;
  const inizioOra = ORA.test(altra.oraInizio || '') ? altra.oraInizio : '00:00';
  const aInizio = istante(giorno(altra.dataInizio), inizioOra);
  const aFine = istante(fineData, fineOra);
  return aInizio < istante(giorno(nuova.dataFine), nuova.oraFine) && aFine > istante(giorno(nuova.dataInizio), nuova.oraInizio);
}

// Veicoli della categoria della prenotazione che non hanno altre prenotazioni
// sovrapposte per l'intero periodo. Le date sono stringhe 'YYYY-MM-DD' e si
// confrontano come stringhe (stesso approccio di disponibilitaCategoria.js).
// Una prenotazione conclusa libera il veicolo dalla data di rientro effettivo,
// come già fa Booking.jsx.
export function veicoliLiberiPerPrenotazione(prenotazione, veicoli, prenotazioni) {
  const inizio = giorno(prenotazione.dataInizio);
  const fine = giorno(prenotazione.dataFine);

  return (veicoli || []).filter((veicolo) => {
    if (!veicolo.targa || veicolo.sospeso || veicolo.categoria !== prenotazione.categoria) return false;

    const occupato = (prenotazioni || []).some((p) => {
      if (p.id === prenotazione.id || p.targa !== veicolo.targa) return false;
      if (p.status === 'annullata' || STATI_PRENOTAZIONE_NON_CONFERMATE.includes(p.status)) {
        return false;
      }
      const conOre = siSovrapponeConOre(prenotazione, p);
      if (conOre !== null) return conOre;
      const pInizio = giorno(p.dataInizio);
      const pFine = giorno(p.dataRientroEffettiva || p.dataFine);
      return pInizio <= fine && pFine >= inizio;
    });

    return !occupato;
  });
}
