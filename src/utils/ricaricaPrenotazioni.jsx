// utils/ricaricaPrenotazioni.js
import { setPrenotazioni } from '../store/prenotazioniSlice';

export const ricaricaPrenotazioni = async (dispatch) => {
  try {
    const dati = await window.electronAPI.readPrenotazioni();
    dispatch(setPrenotazioni(dati));
  } catch (error) {
    console.error("Errore nel caricamento prenotazioni:", error);
  }
};
