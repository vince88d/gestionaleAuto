// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendBookingEmail: (data) => ipcRenderer.send('send-booking-email', data),
  onEmailStatus: (callback) => ipcRenderer.on('email-sent-status', callback)
});
