import { collection, getDocs } from 'firebase/firestore';
import { db } from '../components/firebase';

// Cosa c'e' gia' su Firebase, per non sovrascriverlo: id e targhe dei
// veicoli, id di prenotazioni e clienti.
export async function leggiEsistentiPerRecupero() {
  const [veicoli, prenotazioni, clienti] = await Promise.all(
    ['veicoli', 'prenotazioni', 'clienti'].map((nome) => getDocs(collection(db, nome))),
  );
  return {
    veicoli: veicoli.docs.map((d) => ({ id: d.id, targa: d.data().targa || '' })),
    prenotazioni: prenotazioni.docs.map((d) => d.id),
    clienti: clienti.docs.map((d) => d.id),
  };
}

// Dati che la versione precedente teneva nella memoria interna del programma
// invece che nei file (i dati dell'azienda). Leggibili solo sullo stesso
// computer. La vecchia password dell'email (in chiaro) viene tolta.
export function leggiMemoriaInterna() {
  try {
    const grezzo = window.localStorage.getItem('datiAzienda');
    if (!grezzo) return null;
    const { password: _password, ...datiAzienda } = JSON.parse(grezzo) || {};
    return { datiAzienda };
  } catch {
    return null;
  }
}
