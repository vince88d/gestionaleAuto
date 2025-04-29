const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendBookingEmail: (data) => ipcRenderer.send('send-booking-email', data),
  onEmailStatus: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('email-sent-status', listener);

    // Ritorna una funzione per rimuovere il listener
    return () => {
      ipcRenderer.removeListener('email-sent-status', listener);
    };
  },
  readPrenotazioni: () => ipcRenderer.invoke('read-prenotazioni'),
  writePrenotazioni: (data) => ipcRenderer.invoke('write-prenotazioni', data),
  salvaImmagineLocale: (filePath) => ipcRenderer.invoke('salva-immagine-locale', filePath),
  selezionaImmagine: () => ipcRenderer.invoke('seleziona-immagine'),
  
  readVeicoli: () => ipcRenderer.invoke('read-veicoli'),
  writeVeicoli: (data) => ipcRenderer.invoke('write-veicoli', data),
});
