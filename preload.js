const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
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

  readClienti: () => ipcRenderer.invoke('readClienti'),
  writeClienti: (data) => ipcRenderer.invoke('writeClienti', data),

  generaContrattoCompleto: (data) => ipcRenderer.invoke('genera-contratto-completo', data),

  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  activateLicense: (code, customerName) => ipcRenderer.invoke('activate-license', { code, customerName }),
  getLicenseStatus: () => ipcRenderer.invoke('get-license-status'),
  getCompanySettings: () => ipcRenderer.invoke('get-company-settings'),
  salvaBackup: (dati) => ipcRenderer.invoke('salva-backup', dati),
  concludiPrenotazione: (data) => ipcRenderer.invoke('concludi-prenotazione', data),
  salvaContrattoPDF: (filePath) => ipcRenderer.invoke('salva-contratto-pdf', filePath),
  selezionaPdfContratto: () => ipcRenderer.invoke('seleziona-pdf-contratto'),

  salvaDocumentiPrenotazione: (data) => ipcRenderer.invoke('salva-documenti-prenotazione', data),
  apriBozzaEmail: (data) => ipcRenderer.invoke('apri-bozza-email', data),
  confermaPrenotazione: (data) => ipcRenderer.invoke('conferma-prenotazione', data),
});
