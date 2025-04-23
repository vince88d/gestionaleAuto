import { configureStore } from '@reduxjs/toolkit';
import prenotazioniReducer from './prenotazioniSlice';

export const store = configureStore({
  reducer: {
    prenotazioni: prenotazioniReducer,
  },
});
