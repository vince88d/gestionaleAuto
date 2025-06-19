const fs = require('fs');
const path = require('path');
const os = require('os');

// Percorso base dei dati salvati da electron-store
const basePath = path.join(os.homedir(), 'AppData', 'Roaming', 'react-electron');

const filePaths = [
  path.join(basePath, 'veicoli.json'),
  path.join(basePath, 'prenotazioni.json'),
  path.join(basePath, 'clienti.json')
];

filePaths.forEach((file) => {
  if (fs.existsSync(file)) {
    fs.writeFileSync(file, '[]', 'utf-8');
    console.log(`✅ Pulito: ${file}`);
  } else {
    console.warn(`⚠️ File non trovato: ${file}`);
  }
});
const otpPath = path.join(basePath, 'otpConfirmations');

if (fs.existsSync(otpPath)) {
  fs.rmSync(otpPath, { recursive: true, force: true });
  console.log(`🗑️ Cartella OTP eliminata: ${otpPath}`);
} else {
  console.warn(`⚠️ Cartella OTP non trovata: ${otpPath}`);
}