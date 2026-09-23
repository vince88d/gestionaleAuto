import { createSlice } from '@reduxjs/toolkit';

// I clienti si cercano per id, non per posizione nell'elenco: con la ricerca
// o la pagina 2 la posizione nella tabella non e' quella nello store, e si
// modificava il cliente sbagliato.
const clientiSlice = createSlice({
  name: 'clienti',
  initialState: [],
  reducers: {
    setClienti: (state, action) => action.payload,

    addCliente: (state, action) => {
      if (!state.some((c) => c.id === action.payload.id)) state.push(action.payload);
    },

    // payload: { id, ...campi da unire }
    updateCliente: (state, action) => {
      const index = state.findIndex((c) => c.id === action.payload.id);
      if (index !== -1) state[index] = { ...state[index], ...action.payload };
    },

    // payload: id del cliente
    deleteCliente: (state, action) => state.filter((c) => c.id !== action.payload),
  },
});

export const { setClienti, addCliente, updateCliente, deleteCliente } = clientiSlice.actions;
export default clientiSlice.reducer;
