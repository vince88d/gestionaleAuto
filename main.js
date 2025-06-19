const { app, BrowserWindow, ipcMain , dialog, session} = require('electron');
const path = require('path');
const nodemailer = require('nodemailer'); 
const fs = require('fs');
const fsPromises = require('fs').promises; 



async function inviaEmailPrenotazione({ bookingData, companyData, allegatoPath }) {
  let transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: companyData.email.trim(),
      pass: companyData.password.trim()
    }
  });

  const emailBody = `
    <h2>Riepilogo Prenotazione</h2>
    <p>Gentile Cliente ${bookingData.cliente},</p>
    <p>Grazie per aver prenotato con noi. Di seguito trovi il riepilogo della tua prenotazione:</p>
    <ul>
      <li><strong>Veicolo:</strong> ${bookingData.veicolo} (${bookingData.targa})</li>
      <li><strong>Periodo:</strong> dal ${bookingData.dataInizio} al ${bookingData.dataFine}</li>
      <li><strong>Prezzo Totale:</strong> ${bookingData.prezzoTotale} €</li>
    </ul>
    <p>In allegato trovi il riepilogo della prenotazione${Array.isArray(allegatoPath) && allegatoPath.length > 1 ? ' e il contratto da firmare' : ''}.</p>
    <p>Per qualsiasi domanda, contattaci.</p>
    <p>Grazie,<br>${companyData.nome || 'La Tua Azienda'}</p>
  `;

  const attachments = Array.isArray(allegatoPath)
    ? allegatoPath.map(path => ({ path }))
    : (allegatoPath ? [{ path: allegatoPath }] : []);

  const mailOptions = {
    from: `"${companyData.nome || 'Noleggio'}" <${companyData.email}>`,
    to: bookingData.emailCliente,
    subject: `Riepilogo Prenotazione Veicolo - ${bookingData.targa}`,
    html: emailBody,
    attachments
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email inviata:', info.messageId);
    return { success: true };
  } catch (error) {
    console.error('Errore invio email:', error);
    return { success: false, message: error.message };
  }
}


if (process.env.NODE_ENV === 'development') {
  try {
    require('electron-reload')(__dirname, {
      electron: require(`${__dirname}/node_modules/electron`)
    });
  } catch (error) {
    console.warn('electron-reload non caricato:', error);
  }
}



const CODICE_RESET_TRIAL = 'RESET14G';

const CODICE_LICENZA_VALIDO = 'XYZ123ABC2024'; // ← Codice fisso che invii manualmente
const licensePath = path.join(app.getPath('userData'), 'license.json');
const trialFilePath = path.join(app.getPath('userData'), 'trial.json');

function verificaTrial() {
  // 🔓 Controllo licenza
if (fs.existsSync(licensePath)) {
  try {
    const licenza = JSON.parse(fs.readFileSync(licensePath, 'utf-8'));
    if (licenza?.unlocked === true && licenza.codice === CODICE_LICENZA_VALIDO) {
      return { status: 'licensed' };
    } else {
      return { status: 'invalid-license' };
    }
  } catch (e) {
    return { status: 'error' };
  }
} else {
  // Se non esiste nessuna licenza, si procede col trial
}

  // 🕒 Trial
  let trialData;
  if (fs.existsSync(trialFilePath)) {
    try {
      trialData = JSON.parse(fs.readFileSync(trialFilePath, 'utf-8'));
    } catch {
      return { status: 'error' };
    }
  } else {
    trialData = {
      firstLaunch: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };
    fs.writeFileSync(trialFilePath, JSON.stringify(trialData, null, 2));
  }

  const now = new Date();
  const firstLaunch = new Date(trialData.firstLaunch);
  const lastUsed = new Date(trialData.lastUsed);
  const giorniUsati = Math.floor((now - firstLaunch) / (1000 * 60 * 60 * 24));

  if (now < lastUsed) return { status: 'date-modified' };
  if (giorniUsati > 14) return { status: 'trial-expired' };

  trialData.lastUsed = now.toISOString();
  fs.writeFileSync(trialFilePath, JSON.stringify(trialData, null, 2));
  return { status: 'trial-ok' };
}

const resetTrial = false; // mettilo a true per forzare il reset

if (resetTrial) {
  try {
    if (fs.existsSync(trialFilePath)) fs.unlinkSync(trialFilePath);
    if (fs.existsSync(licensePath)) fs.unlinkSync(licensePath);
    console.log("Trial e licenza resettate.");
  } catch (e) {
    console.warn("Errore nel reset della trial/licenza", e);
  }
}


const createWindow = () => {

  const win = new BrowserWindow({   
    width: 1200,
    height: 600,
    frame:true,
    webPreferences: {
      contextIsolation: true, 
      nodeIntegration: false,   
      preload: path.join(__dirname, 'preload.js'),       
    },
  });
 // Menu.setApplicationMenu(null); 
  win.setTitle('Noleggio Veicoli - Versione di Prova')
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
  
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    process.env.NODE_ENV === 'development' 
                        ? "default-src 'self' http://localhost:3000; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
                        : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';"
                ]
            }
        });
    });
    
  // 🔁 Ogni volta che il renderer chiede lo stato della licenza, lo verifichiamo
  ipcMain.handle('get-license-status', () => {
    return verificaTrial();
  });

  cleanTempFiles().catch(console.error);

  // 🪟 Crea la finestra principale
  createWindow();

  // 🖥️ Se non ci sono finestre aperte (macOS), ricreala
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

ipcMain.on('window-minimize', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.minimize();
});

ipcMain.on('window-maximize', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.isMaximized() ? win.unmaximize() : win.maximize();
  }
});

ipcMain.on('window-close', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.close();
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
ipcMain.handle('send-booking-email', async (_, args) => {
  return await inviaEmailPrenotazione(args);
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
const userDataDir   = app.getPath('userData');
const veicoliPath   = path.join(userDataDir, 'veicoli.json');

if (!fs.existsSync(userDataDir)) {
  fs.mkdirSync(userDataDir, { recursive: true });
}

// Lettura veicoli
ipcMain.handle('read-veicoli', async () => {
  try {
    if (!fs.existsSync(veicoliPath)) {
      fs.writeFileSync(veicoliPath, '[]', 'utf-8');
    }
    const data = fs.readFileSync(veicoliPath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Errore lettura veicoli:', err);
    return [];
  }
});


// Scrittura veicoli
ipcMain.handle('write-veicoli', async (_, data) => {
  try {
    fs.writeFileSync(veicoliPath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Errore scrittura veicoli:', err);
    return false;
  }
});

// Lettura e scrittura clienti
ipcMain.handle('writeClienti', async (_, clienti) => {
  const filePath = path.join(app.getPath('userData'), 'clienti.json');
  try {
    // Assicurati che la directory esista
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Scrivi il file
    fs.writeFileSync(filePath, JSON.stringify(clienti, null, 2));
    return true; // Aggiungi un return per conferma
  } catch (e) {
    console.error('Errore salvataggio clienti:', e);
    return false;
  }
});

ipcMain.handle('readClienti', async () => {
  const filePath = path.join(app.getPath('userData'), 'clienti.json');
  try {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    console.error('Errore lettura clienti:', e);
    return [];
  }
});


//Invio OTP
const otpLogPath = path.join(app.getPath('userData'), 'otpConfirmations');
ipcMain.handle('send-otp', async (event, { email, otp, sender }) => {
  const nodemailer = require('nodemailer');

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: sender?.email?.trim(),
      pass: sender?.password?.trim()
    }
  });

  const mailOptions = {
    from: `"${sender?.nome || 'Noleggio'}" <${sender?.email}>`,
    to: email,
    subject: 'Codice di conferma prenotazione',
    text: `Il tuo codice OTP per confermare la prenotazione è: ${otp}`
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (err) {
    console.error("Errore invio OTP:", err);
    return { success: false, error: err.message };
  }
});

if (!fs.existsSync(otpLogPath)) {
  fs.mkdirSync(otpLogPath, { recursive: true });
}

ipcMain.handle('log-otp-confirmation', async (_, logData) => {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `otp_${timestamp}_${logData.codiceFiscale}.json`;
    const filePath = path.join(otpLogPath, fileName);

    fs.writeFileSync(filePath, JSON.stringify(logData, null, 2));
    return { success: true };
  } catch (err) {
    console.error("Errore salvataggio log OTP:", err);
    return { success: false, error: err.message };
  }
});


ipcMain.handle('read-otp-logs', async () => {
  try {
    if (!fs.existsSync(otpLogPath)) return [];

    const files = fs.readdirSync(otpLogPath);
    const logs = files
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const content = fs.readFileSync(path.join(otpLogPath, file), 'utf-8');
        return JSON.parse(content);
      });

    return logs;
  } catch (err) {
    console.error("Errore lettura conferme OTP:", err);
    return [];
  }
});

ipcMain.handle('delete-single-otp-log', async (event, logTimestamp) => {
  try {
    if (!fs.existsSync(otpLogPath)) {
      return { success: true, message: "La cartella dei log non esiste." };
    }

    const files = await fsPromises.readdir(otpLogPath);
    let fileToDelete = null;

    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(otpLogPath, file);
        const content = await fsPromises.readFile(filePath, 'utf-8');
        const logData = JSON.parse(content);

        if (logData.confermatoIl === logTimestamp) {
          fileToDelete = filePath;
          break; // Trovato il file, esci dal ciclo
        }
      }
    }

    if (fileToDelete) {
      await fsPromises.unlink(fileToDelete);
      return { success: true };
    } else {
      return { success: false, message: "Log non trovato." };
    }
  } catch (error) {
    console.error("Errore durante l'eliminazione del singolo log OTP:", error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('clear-otp-logs', async () => {
  try {
    if (fs.existsSync(otpLogPath)) {
      await fsPromises.rm(otpLogPath, { recursive: true, force: true });
    }
    return { success: true };
  } catch (error) {
    console.error("Errore durante la cancellazione della cartella dei log OTP:", error);
    return { success: false, message: error.message };
  }
});


// generare pdf
const { PDFDocument } = require('pdf-lib');

ipcMain.handle('genera-contratto-completo', async (_, { riepilogoBuffer }) => {
  try {
    const riepilogoDoc = await PDFDocument.load(riepilogoBuffer);
    
    // Percorso contratto caricato dall'utente
    const contrattoDir = path.join(app.getPath('userData'), 'pdf');
    const contrattoPath = path.join(contrattoDir, 'contratto_completo.pdf');
    
    if (!fs.existsSync(contrattoPath)) {
      return { 
        success: false, 
        error: 'Nessun contratto caricato. Per favore, carica un modello di contratto PDF prima di procedere.' 
      };
    }

    const contrattoBytes = await fs.promises.readFile(contrattoPath);
    const contrattoDoc = await PDFDocument.load(contrattoBytes);

    const mergedPdf = await PDFDocument.create();
    
    // Aggiungi prima il riepilogo
    const riepilogoPages = await mergedPdf.copyPages(riepilogoDoc, riepilogoDoc.getPageIndices());
    riepilogoPages.forEach(p => mergedPdf.addPage(p));
    
    // Poi aggiungi il contratto
    const contrattoPages = await mergedPdf.copyPages(contrattoDoc, contrattoDoc.getPageIndices());
    contrattoPages.forEach(p => mergedPdf.addPage(p));

    // Salva il PDF unito
    const finalPdfBytes = await mergedPdf.save();
    const finalPath = path.join(contrattoDir, `contratto_firmato_${Date.now()}.pdf`);
    await fs.promises.writeFile(finalPath, finalPdfBytes);

    return { success: true, path: finalPath };
  } catch (err) {
    console.error("Errore generazione contratto completo:", err);
    return { success: false, error: err.message };
  }
});

// Salva licenza 

ipcMain.handle('salva-licenza', async (_, licenza) => {
  try {
    if (
      !licenza ||
      licenza.codice !== CODICE_LICENZA_VALIDO ||
      licenza.unlocked !== true
    ) {
      return { success: false, error: 'Codice licenza non valido' };
    }

    fs.writeFileSync(licensePath, JSON.stringify(licenza, null, 2));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});


ipcMain.handle('read-file', async (_, fileName) => {
  try {
    const fullPath = path.join(app.getPath('userData'), fileName);
    if (!fs.existsSync(fullPath)) return null;
    const content = fs.readFileSync(fullPath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    return null;
  }
});

ipcMain.handle('reset-trial', async (_, codice) => {
  if (codice !== CODICE_RESET_TRIAL) {
    return { success: false, message: 'Codice errato' };
  }

  try {
    const trialData = {
      firstLaunch: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
    };
    fs.writeFileSync(trialFilePath, JSON.stringify(trialData, null, 2));
    
    // Rimuovi la licenza solo se esiste
    if (fs.existsSync(licensePath)) {
      fs.unlinkSync(licensePath);
    }

    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
});

// --- Nuovo codice per esportare e importare backup ---
const archiver = require('archiver');

ipcMain.handle('esporta-backup', async () => {
  try {
    const userDataDir = app.getPath('userData');
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Esporta Backup',
      defaultPath: `backup-noleggio-${Date.now()}.zip`,
      filters: [{ name: 'Backup ZIP', extensions: ['zip'] }]
    });

    if (canceled || !filePath) return { success: false, message: 'Backup annullato' };

    const output = fs.createWriteStream(filePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return await new Promise((resolve, reject) => {
      archive.pipe(output);

      fs.readdirSync(userDataDir).forEach(file => {
        const fullPath = path.join(userDataDir, file);
        if (file !== 'backup') archive.file(fullPath, { name: file });
      });

      output.on('close', () => {
        resolve({ success: true, path: filePath });
      });

      archive.on('error', err => {
        reject({ success: false, error: err.message });
      });

      archive.finalize();
    });

  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Importa backup da file ZIP
const unzipper = require('unzipper');

ipcMain.handle('importa-backup', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Seleziona il file di backup',
      filters: [{ name: 'Backup ZIP', extensions: ['zip'] }],
      properties: ['openFile']
    });

    if (canceled || !filePaths.length) {
      return { success: false, message: 'Operazione annullata dall\'utente.' };
    }

    const backupPath = filePaths[0];
    const userDataDir = app.getPath('userData');

    // Estrai il contenuto del file ZIP nella directory userData
    await fs.createReadStream(backupPath)
      .pipe(unzipper.Extract({ path: userDataDir }))
      .promise();

    return { success: true, path: backupPath };
  } catch (err) {
    console.error('Errore durante l\'importazione del backup:', err);
    return { success: false, message: err.message };
  }
});

// Concludi prenotazione
ipcMain.handle('concludi-prenotazione', async (_event, dati) => {
  const prenotazioniFile = path.join(app.getPath('userData'), 'prenotazioni.json');

  try {
    if (!fs.existsSync(prenotazioniFile)) return { success: false, message: 'File mancante' };

    const prenotazioni = JSON.parse(fs.readFileSync(prenotazioniFile, 'utf-8'));
    const index = prenotazioni.findIndex(p => p.id === dati.idPrenotazione);

    if (index === -1) return { success: false, message: 'Prenotazione non trovata' };

    // ✅ Aggiunge descrizione, stato riparazione, foto danni
    prenotazioni[index].descrizioneDanno = dati.descrizione;
    prenotazioni[index].daRiparare = dati.daRiparare;
    prenotazioni[index].fotoDanni = dati.fotoDanni || [];
    prenotazioni[index].status = 'completata';

    fs.writeFileSync(prenotazioniFile, JSON.stringify(prenotazioni, null, 2));
    return { success: true };
  } catch (err) {
    console.error('Errore salvataggio danni:', err);
    return { success: false, message: err.message };
  }
});


ipcMain.handle('salva-contratto-pdf', async (_, filePathOriginale) => {
  try {
    const destinazione = path.join(app.getPath('userData'), 'pdf', 'contratto_completo.pdf');
    fs.mkdirSync(path.dirname(destinazione), { recursive: true });
    fs.copyFileSync(filePathOriginale, destinazione);
    return { success: true };
  } catch (e) {
    return { success: false, message: e.message };
  }
});


ipcMain.handle('seleziona-pdf-contratto', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });

  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0]; // <-- percorso completo del file PDF
});




ipcMain.handle('conferma-prenotazione', async (_, data) => {
  try {
    const riepilogoBuffer = Buffer.from(data.riepilogoPdf);
    const contrattoBuffer = data.contrattoPdf ? Buffer.from(data.contrattoPdf) : null;

    const tempDir = path.join(app.getPath('userData'), 'temp_pdf');
    await fs.promises.mkdir(tempDir, { recursive: true });

    const riepilogoPath = path.join(tempDir, `riepilogo_${Date.now()}.pdf`);
    await fs.promises.writeFile(riepilogoPath, riepilogoBuffer);

    let contrattoPath = null;
    if (contrattoBuffer && data.nomeContratto) {
      contrattoPath = path.join(tempDir, data.nomeContratto);
      await fs.promises.writeFile(contrattoPath, contrattoBuffer);
    }

    const allegati = [riepilogoPath];
    if (data.inviaContratto && contrattoPath) {
      allegati.push(contrattoPath);
    }

    const emailResult = await inviaEmailPrenotazione({
      bookingData: data.prenotazione,
      companyData: data.azienda,
      allegatoPath: allegati
    });

    if (!emailResult.success) {
      throw new Error(emailResult.message || "Errore nell'invio dell'email");
    }

    // Leggi e aggiorna prenotazioni
    const prenotazioniFile = path.join(app.getPath('userData'), 'prenotazioni.json');
    const prenotazioni = fs.existsSync(prenotazioniFile)
      ? JSON.parse(fs.readFileSync(prenotazioniFile, 'utf-8'))
      : [];

    const index = prenotazioni.findIndex(p => p.id === data.prenotazione.id);
    if (index !== -1) {
      prenotazioni[index].contrattoFirmato = contrattoPath || riepilogoPath;
      prenotazioni[index].confermatoIl = new Date().toISOString();
      fs.writeFileSync(prenotazioniFile, JSON.stringify(prenotazioni, null, 2));
    }

    // Leggi e aggiorna clienti
    const clientiFile = path.join(app.getPath('userData'), 'clienti.json');
    const clienti = fs.existsSync(clientiFile)
      ? JSON.parse(fs.readFileSync(clientiFile, 'utf-8'))
      : [];

    const indexCliente = clienti.findIndex(
      c => c.codiceFiscale?.toUpperCase() === data.prenotazione.codiceFiscale?.toUpperCase()
    );

    if (indexCliente !== -1) {
      clienti[indexCliente].contrattoFirmato = contrattoPath || riepilogoPath;
      clienti[indexCliente].contratti = clienti[indexCliente].contratti || [];
      clienti[indexCliente].contratti.push({
        contratto: contrattoPath || riepilogoPath,
        data: new Date().toISOString(),
        targa: data.prenotazione.targa
      });
      fs.writeFileSync(clientiFile, JSON.stringify(clienti, null, 2));
    }

    // Salva log OTP
    const otpLogPath = path.join(app.getPath('userData'), 'otpConfirmations');
    await fs.promises.mkdir(otpLogPath, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `otp_${timestamp}_${data.prenotazione.codiceFiscale}.json`;
    const otpFilePath = path.join(otpLogPath, fileName);

    const logOtp = {
      cliente: data.prenotazione.cliente,
      codiceFiscale: data.prenotazione.codiceFiscale,
      email: data.prenotazione.emailCliente,
      targa: data.prenotazione.targa,
      dataInizio: data.prenotazione.dataInizio,
      dataFine: data.prenotazione.dataFine,
      prezzoTotale: data.prenotazione.prezzoTotale,
      otpUsato: data.otp,
      confermatoIl: new Date().toISOString(),
      ip: data.ip
    };

    fs.writeFileSync(otpFilePath, JSON.stringify(logOtp, null, 2));

    return { success: true };
  } catch (err) {
    console.error('Errore conferma prenotazione:', err);
    return { success: false, message: err.message };
  }
});

// Crea directory se non esiste
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Pulisci file temporanei più vecchi di 24 ore
async function cleanTempFiles() {
  const tempDir = path.join(app.getPath('userData'), 'temp_pdf');
  if (fs.existsSync(tempDir)) {
    const files = await fs.promises.readdir(tempDir);
    const now = Date.now();
    
    for (const file of files) {
      const filePath = path.join(tempDir, file);
      const stat = await fs.promises.stat(filePath);
      if (now - stat.mtimeMs > 24 * 60 * 60 * 1000) { // 24 ore
        await fs.promises.unlink(filePath);
      }
    }
  }
}

