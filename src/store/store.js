import { configureStore } from '@reduxjs/toolkit';
import prenotazioniReducer from './prenotazioniSlice';
import veicoliReducer from './veicoliSlice';

export const store = configureStore({
  reducer: {
    prenotazioni: prenotazioniReducer,
    veicoli:veicoliReducer,
  },
});
