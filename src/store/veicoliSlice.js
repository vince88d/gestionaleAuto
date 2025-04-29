import { createSlice } from '@reduxjs/toolkit';

const initialState = [];

const veicoliSlice = createSlice({
  name: 'veicoli',
  initialState,
  reducers: {
    setVeicoli(state, action) {
      return action.payload;
    },
    addVeicolo(state, action) {
      state.push(action.payload);
    },
    updateVeicolo(state, action) {
      const index = state.findIndex(v => v.id === action.payload.id);
      if (index !== -1) {
        state[index] = action.payload;
      }
    },
    deleteVeicolo(state, action) {
      return state.filter(v => v.id !== action.payload);
    },
  },
});

export const { setVeicoli, addVeicolo, updateVeicolo, deleteVeicolo } = veicoliSlice.actions;
export default veicoliSlice.reducer;
