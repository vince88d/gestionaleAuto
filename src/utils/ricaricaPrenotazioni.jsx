// utils/ricaricaPrenotazioni.js
import { setPrenotazioni } from '../store/prenotazioniSlice';
import { readPrenotazioni } from '../lib/firestorePrenotazioni';

export const ricaricaPrenotazioni = async (dispatch) => {
  try {
    const dati = await readPrenotazioni();
    dispatch(setPrenotazioni(dati));
  } catch (error) {
    console.error("Errore nel caricamento prenotazioni:", error);
  }
};
