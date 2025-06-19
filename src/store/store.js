import { configureStore } from '@reduxjs/toolkit';
import prenotazioniReducer from './prenotazioniSlice';
import veicoliReducer from './veicoliSlice';
import clientiReducer from './clientiSlice';


export const store = configureStore({
  reducer: {
    prenotazioni: prenotazioniReducer,
    veicoli:veicoliReducer,
    clienti:clientiReducer,
  },
});
