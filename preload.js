const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendBookingEmail: (data) => ipcRenderer.invoke('send-booking-email', data),
  sendOtp: (data) => ipcRenderer.invoke('send-otp', data),
  logOtpConfirmation: (data) => ipcRenderer.invoke('log-otp-confirmation', data),
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

  readOtpLogs: () => ipcRenderer.invoke('read-otp-logs'),
    deleteSingleOtpLog: (logTimestamp) => ipcRenderer.invoke('delete-single-otp-log', logTimestamp),
  clearOtpLogs: () => ipcRenderer.invoke('clear-otp-logs'),
    minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

    salvaLicenza: (data) => ipcRenderer.invoke('salva-licenza', data),
  readFile: (fileName) => ipcRenderer.invoke('read-file', fileName),
  getLicenseStatus: () => ipcRenderer.invoke('get-license-status'),
  resetTrial: (codice) => ipcRenderer.invoke('reset-trial', codice),
  esportaBackup: () => ipcRenderer.invoke('esporta-backup'),
  importaBackup:()=>ipcRenderer.invoke('importa-backup'),
  concludiPrenotazione: (data) => ipcRenderer.invoke('concludi-prenotazione', data),
  salvaContrattoPDF: (filePath) => ipcRenderer.invoke('salva-contratto-pdf', filePath),
 selezionaPdfContratto: () => ipcRenderer.invoke('seleziona-pdf-contratto'),

 confermaPrenotazione: (data) => ipcRenderer.invoke('conferma-prenotazione', data),
  
});
