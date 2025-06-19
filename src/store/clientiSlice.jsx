import { createSlice } from '@reduxjs/toolkit';

const clientiSlice = createSlice({
  name: 'clienti',
  initialState: [],
  reducers: {
    setClienti: (state, action) => action.payload,

    addCliente: (state, action) => {
      state.push(action.payload);
    },

    updateCliente: (state, action) => {
      const { index, updated } = action.payload;
      if (index >= 0 && index < state.length) {
        state[index] = updated;
      }
    },

    deleteCliente: (state, action) => {
      state.splice(action.payload, 1);
    }
  }
});

export const { setClienti, addCliente, updateCliente, deleteCliente } = clientiSlice.actions;
export default clientiSlice.reducer;
