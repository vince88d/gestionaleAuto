import { createSlice } from '@reduxjs/toolkit';

const prenotazioniSlice = createSlice({
  name: 'prenotazioni',
  initialState: [],
  reducers: {
    setPrenotazioni: (state, action) => action.payload,
    // Se c'e' gia' la sostituisce: l'elenco in tempo reale (App.js,
    // ascoltaPrenotazioni) riceve la prenotazione appena scritta prima che il
    // salvataggio finisca, e aggiungerla di nuovo la mostrava due volte.
    addPrenotazione: (state, action) => {
      const index = state.findIndex((p) => p.id === action.payload.id);
      if (index !== -1) state[index] = action.payload;
      else state.push(action.payload);
    },
    updatePrenotazione: (state, action) => {
      const index = state.findIndex(p => p.id === action.payload.id);
      if (index !== -1) {
        state[index] = action.payload;
      }
    },
    deletePrenotazione: (state, action) => {
      return state.filter(p => p.id !== action.payload);
    },
  },
});

export const {
  setPrenotazioni,
  addPrenotazione,
  updatePrenotazione,
  deletePrenotazione,
} = prenotazioniSlice.actions;

export default prenotazioniSlice.reducer;
