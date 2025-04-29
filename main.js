const { app, BrowserWindow, ipcMain , dialog} = require('electron');
const path = require('path');
const nodemailer = require('nodemailer'); 
const fs = require('fs');


try {
  require('electron-reload')(__dirname, {
    electron: require(`${__dirname}/node_modules/electron`)
  });
} catch (error) {
  console.warn('electron-reload non caricato:', error);
}

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 600,
    webPreferences: {
      contextIsolation: true, // Attenzione: questo è meno sicuro. In futuro, considera l'uso di un preload script.
      nodeIntegration: false,   // Permette al renderer di accedere alle API di Node.js (ma usiamo IPC per sicurezza).
      preload: path.join(__dirname, 'preload.js'), // L'approccio moderno e sicuro
      webSecurity:false,
    },
  });
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:3000'); // 👈 In sviluppo carica localhost
    win.webContents.openDevTools(); // (opzionale) Apro i DevTools
  } else {
    win.loadFile(path.join(__dirname, 'build', 'index.html')); // 👈 In produzione carica la build
  }

  win.webContents.on('did-finish-load', () => {
    console.log('Finestra caricata con successo');
  });

  win.on('unresponsive', () => {
    console.log('La finestra non è più responsiva!');
  });

  win.on('closed', () => {
    console.log('Finestra chiusa');
  });

  // Salva un riferimento alla finestra per poter inviare messaggi di risposta
  global.mainWindow = win; // O un altro meccanismo per accedere alla finestra
};

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', (event) => {
  // Non preveniamo la chiusura qui se vogliamo che l'app si chiuda
  // event.preventDefault();
  console.log("L'app si sta chiudendo.");
});

// --- Nuovo codice per la gestione email tramite IPC ---

ipcMain.on('send-booking-email', async (event, { bookingData, companyData }) => {
  console.log('Received request to send email for booking:', bookingData.cliente);

  console.log('PASSWORD:', `"${companyData.password}"`);

  // Per un server SMTP generico:
  let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: companyData.email.trim(),
      pass: companyData.password.trim()
    }
  });
  
  

  // Costruisci il corpo dell'email
  const emailBody = `
    <h2>Riepilogo Prenotazione</h2>
    <p>Gentile Cliente ${bookingData.cliente},</p>
    <p>Grazie per aver prenotato con noi. Di seguito trovi il riepilogo della tua prenotazione:</p>
    <ul>
      <li><strong>Veicolo:</strong> ${bookingData.veicolo} (${bookingData.targa})</li>
      <li><strong>Periodo:</strong> dal ${bookingData.dataInizio} al ${bookingData.dataFine}</li>
      <li><strong>Prezzo Totale:</strong> ${bookingData.prezzoTotale} €</li>
      <li><strong>Codice Fiscale:</strong> ${bookingData.codiceFiscale}</li>
      <li><strong>Patente:</strong> ${bookingData.patente}</li>
    </ul>
    
    ${bookingData.schedaVeicolo ? `
    <h3>Dettagli Scheda Veicolo Iniziale:</h3>
    <p><strong>Carburante Iniziale:</strong> ${bookingData.schedaVeicolo.carburante || 'N/A'}</p>
    <p><strong>KM Iniziali:</strong> ${bookingData.schedaVeicolo.kmIniziali || 'N/A'}</p>
    <p><strong>Danni Segnalati:</strong> ${bookingData.schedaVeicolo.danni || 'Nessuno'}</p>
    <p><strong>Accessori Presenti:</strong>
      ${Object.entries(bookingData.schedaVeicolo.accessori || {})
          .filter(([key, value]) => value)
          .map(([key, value]) => key)
          .join(', ') || 'Nessuno'
      }
    </p>
    ` : ''}

    <p>Per qualsiasi domanda, contattaci.</p>
    <p>Grazie,</p>
    <p>${companyData.nome || 'La Tua Azienda'}</p>
    <p>Email: ${companyData.email || 'N/A'}</p>
    <p>Telefono: ${companyData.telefono || 'N/A'}</p>
    <p>Indirizzo: ${companyData.indirizzo || 'N/A'}</p>
  `;


  // Definisci le opzioni dell'email
  let mailOptions = {
    from: `"${companyData.nome || 'La Tua Azienda'}" <${companyData.email || 'email-di-default@esempio.com'}>`, // Mittente
    to: bookingData.emailCliente, // Destinatario (l'email del cliente)
    subject: `Riepilogo Prenotazione Veicolo - ${bookingData.targa}`, // Oggetto
    html: emailBody // Corpo in formato HTML
  };

  // Invia l'email
  try {
    let info = await transporter.sendMail(mailOptions);
    console.log('Message sent: %s', info.messageId);
    // Invia feedback al renderer
    event.reply('email-sent-status', { success: true, message: 'Email inviata con successo!' });
    // Se hai salvato la window in una variabile globale
    // if (global.mainWindow) {
    //   global.mainWindow.webContents.send('email-sent-status', { success: true, message: 'Email inviata con successo!' });
    // }

  } catch (error) {
    console.error('Error sending email:', error);
    // Invia feedback di errore al renderer
     event.reply('email-sent-status', { success: false, message: 'Errore nell\'invio dell\'email.' });
    // Se hai salvato la window in una variabile globale
    // if (global.mainWindow) {
    //   global.mainWindow.webContents.send('email-sent-status', { success: false, message: 'Errore nell\'invio dell\'email.' });
    // }
  }
});

const prenotazioniPath = path.join(app.getPath('userData'), 'prenotazioni.json');

// Leggi prenotazioni
ipcMain.handle('read-prenotazioni', async () => {
  try {
    if (!fs.existsSync(prenotazioniPath)) return [];
    const data = fs.readFileSync(prenotazioniPath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Errore lettura file:', err);
    return [];
  }
});

// Salva prenotazioni
ipcMain.handle('write-prenotazioni', async (event, prenotazioni) => {
  try {
    fs.writeFileSync(prenotazioniPath, JSON.stringify(prenotazioni, null, 2));
    return true;
  } catch (err) {
    console.error('Errore scrittura file:', err);
    return false;
  }

  
});

const immaginiPath = path.join(app.getPath('userData'), 'images');
if (!fs.existsSync(immaginiPath)) fs.mkdirSync(immaginiPath, { recursive: true });

ipcMain.handle('salva-immagine-locale', async (event, filePathOriginale) => {
  try {
    const estensione = path.extname(filePathOriginale);
    const nomeFile = `${Date.now()}${estensione}`;
    const destinazione = path.join(immaginiPath, nomeFile);

    fs.copyFileSync(filePathOriginale, destinazione);

    return `file://${destinazione}`; // Percorso utilizzabile nel src dell'immagine
  } catch (error) {
    console.error('Errore salvataggio immagine:', error);
    return null;
  }
});

ipcMain.handle('seleziona-immagine', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }]
  });

  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths;
});


// Percorso file veicoli.json
const veicoliPath = path.join(__dirname, 'data', 'veicoli.json');

// Lettura veicoli
ipcMain.handle('read-veicoli', async () => {
  try {
    if (!fs.existsSync(veicoliPath)) {
      fs.writeFileSync(veicoliPath, '[]');
    }
    const data = fs.readFileSync(veicoliPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Errore lettura veicoli:', error);
    return [];
  }
});

// Scrittura veicoli
ipcMain.handle('write-veicoli', async (_, data) => {
  try {
    fs.writeFileSync(veicoliPath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Errore scrittura veicoli:', error);
    return false;
  }
});