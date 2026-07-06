const { app, BrowserWindow, ipcMain, dialog, session, shell } = require('electron');
const path = require('path');
const nodemailer = require('nodemailer');
const fs = require('fs');
const fsPromises = require('fs').promises;
const crypto = require('crypto');
const keytar = require('keytar');
const archiver = require('archiver');
const unzipper = require('unzipper');
const { PDFDocument } = require('pdf-lib');
require('update-electron-app');

const SMTP_PASSWORD_SERVICE = 'gestionaleAuto.smtp';
const SMTP_PASSWORD_ACCOUNT = 'default';
const LICENSE_SALT = 'gestionaleAuto-license-v1';
const LICENSE_SECRET = '9f9f2525f0d8f1308e5ea44cf3b9c85184767f0dbfda8cf2a5545e4ecf3a18bb';
const LEGACY_LICENSE_HASH = crypto
  .createHash('sha256')
  .update(`XYZ123ABC2024|${LICENSE_SALT}`)
  .digest('hex');

const userDataDir = app.getPath('userData');
const licensePath = path.join(userDataDir, 'license.json');
const trialFilePath = path.join(userDataDir, 'trial.json');
const installIdPath = path.join(userDataDir, 'install-id.json');
const companySettingsPath = path.join(userDataDir, 'company-settings.json');
const prenotazioniPath = path.join(userDataDir, 'prenotazioni.json');
const veicoliPath = path.join(userDataDir, 'veicoli.json');
const clientiPath = path.join(userDataDir, 'clienti.json');
const immaginiPath = path.join(userDataDir, 'images');

ensureDirectoryExists(userDataDir);
ensureDirectoryExists(immaginiPath);

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    return fallback;
  }
}

function writeJsonFile(filePath, data) {
  ensureDirectoryExists(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function normalizeLicenseCode(code = '') {
  return String(code).trim().replace(/\s+/g, '').toUpperCase();
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function getOrCreateInstallId() {
  if (fs.existsSync(installIdPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(installIdPath, 'utf-8'));
      if (parsed?.installId) {
        return parsed.installId;
      }
    } catch (error) {
      console.warn('Install ID non leggibile, ne genero uno nuovo.', error);
    }
  }

  const installId = crypto.randomBytes(16).toString('hex');
  writeJsonFile(installIdPath, { installId });
  return installId;
}

function createLicenseSignature(payload) {
  return crypto
    .createHmac('sha256', LICENSE_SECRET)
    .update([payload.installId, payload.activatedAt, payload.customerName || ''].join('|'))
    .digest('hex');
}

function isLicenseCodeValid(code) {
  return sha256(`${normalizeLicenseCode(code)}|${LICENSE_SALT}`) === LEGACY_LICENSE_HASH;
}

function readCompanySettings() {
  const stored = readJsonFile(companySettingsPath, {});

  return {
    nome: stored.nome || '',
    email: stored.email || '',
    telefono: stored.telefono || '',
    indirizzo: stored.indirizzo || '',
  };
}

async function getCompanySettingsForRenderer() {
  const settings = readCompanySettings();
  const password = await keytar.getPassword(SMTP_PASSWORD_SERVICE, SMTP_PASSWORD_ACCOUNT);

  return {
    ...settings,
    hasPassword: Boolean(password),
  };
}

async function getCompanyEmailConfig() {
  const settings = readCompanySettings();
  const password = await keytar.getPassword(SMTP_PASSWORD_SERVICE, SMTP_PASSWORD_ACCOUNT);

  if (!settings.email || !password) {
    return null;
  }

  return {
    ...settings,
    password,
  };
}

function formatEmailError(error) {
  const rawMessage = error?.message || 'Errore invio email';

  if (
    rawMessage.includes('Application-specific password required') ||
    rawMessage.includes('InvalidSecondFactor')
  ) {
    return 'Accesso Gmail non riuscito: devi usare una App Password di Google nelle impostazioni azienda, non la password normale dell\'account.';
  }

  if (rawMessage.includes('Invalid login')) {
    return 'Accesso SMTP non riuscito. Verifica email aziendale e password SMTP nelle impostazioni.';
  }

  return rawMessage;
}

function sanitizeFileName(value = '') {
  return String(value)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, '_')
    .trim() || 'documento';
}

async function inviaEmailPrenotazione({ bookingData, allegatoPath }) {
  const companyData = await getCompanyEmailConfig();
  if (!companyData) {
    return {
      success: false,
      message: 'Configurazione email aziendale incompleta. Controlla email e password SMTP nelle impostazioni.',
    };
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: companyData.email.trim(),
      pass: companyData.password.trim(),
    },
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
    ? allegatoPath.map((attachmentPath) => ({ path: attachmentPath }))
    : (allegatoPath ? [{ path: allegatoPath }] : []);

  const mailOptions = {
    from: `"${companyData.nome || 'Noleggio'}" <${companyData.email}>`,
    to: bookingData.emailCliente,
    subject: `Riepilogo Prenotazione Veicolo - ${bookingData.targa}`,
    html: emailBody,
    attachments,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email inviata:', info.messageId);
    return { success: true };
  } catch (error) {
    console.error('Errore invio email:', error);
    return { success: false, message: formatEmailError(error) };
  }
}

function verificaTrial() {
  if (fs.existsSync(licensePath)) {
    try {
      const licenza = JSON.parse(fs.readFileSync(licensePath, 'utf-8'));
      const expectedInstallId = getOrCreateInstallId();
      const expectedSignature = createLicenseSignature({
        installId: licenza.installId,
        activatedAt: licenza.activatedAt,
        customerName: licenza.customerName,
      });

      if (
        licenza?.unlocked === true &&
        licenza.installId === expectedInstallId &&
        licenza.signature === expectedSignature
      ) {
        return { status: 'licensed' };
      }

      return { status: 'invalid-license' };
    } catch (error) {
      return { status: 'error' };
    }
  }

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
      lastUsed: new Date().toISOString(),
    };
    writeJsonFile(trialFilePath, trialData);
  }

  const now = new Date();
  const firstLaunch = new Date(trialData.firstLaunch);
  const lastUsed = new Date(trialData.lastUsed);
  const giorniUsati = Math.floor((now - firstLaunch) / (1000 * 60 * 60 * 24));

  if (now < lastUsed) return { status: 'date-modified' };
  if (giorniUsati > 14) return { status: 'trial-expired' };

  trialData.lastUsed = now.toISOString();
  writeJsonFile(trialFilePath, trialData);
  return { status: 'trial-ok' };
}

if (process.env.NODE_ENV === 'development') {
  try {
    require('electron-reload')(__dirname, {
      electron: require(`${__dirname}/node_modules/electron`),
    });
  } catch (error) {
    console.warn('electron-reload non caricato:', error);
  }
}

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 600,
    frame: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.removeMenu();
  win.setMenuBarVisibility(false);

  win.setTitle('Noleggio Veicoli - Versione di Prova');
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, 'build', 'index.html'));
  }

  win.webContents.on('did-finish-load', () => {
    console.log('Finestra caricata con successo');
  });

  win.on('unresponsive', () => {
    console.log('La finestra non Ã¨ piÃ¹ responsiva!');
  });

  win.on('closed', () => {
    console.log('Finestra chiusa');
  });

  global.mainWindow = win;
};

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const csp = process.env.NODE_ENV === 'development'
      ? "default-src 'self' http://localhost:3000; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' http://localhost:3000 https://api.ipify.org;"
      : "default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self' https://api.ipify.org";

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      },
    });
  });

  ipcMain.handle('get-license-status', () => verificaTrial());

  ipcMain.handle('activate-license', async (_, { code, customerName }) => {
    if (!isLicenseCodeValid(code)) {
      return { success: false, error: 'Codice licenza non valido' };
    }

    const payload = {
      unlocked: true,
      installId: getOrCreateInstallId(),
      activatedAt: new Date().toISOString(),
      customerName: (customerName || '').trim(),
    };

    payload.signature = createLicenseSignature(payload);
    writeJsonFile(licensePath, payload);
    return { success: true };
  });

  ipcMain.handle('get-company-settings', async () => getCompanySettingsForRenderer());

  ipcMain.handle('save-company-settings', async (_, data) => {
    try {
      const sanitized = {
        nome: (data?.nome || '').trim(),
        email: (data?.email || '').trim(),
        telefono: (data?.telefono || '').trim(),
        indirizzo: (data?.indirizzo || '').trim(),
      };

      writeJsonFile(companySettingsPath, sanitized);

      if (typeof data?.password === 'string') {
        const password = data.password.trim();
        if (password) {
          await keytar.setPassword(SMTP_PASSWORD_SERVICE, SMTP_PASSWORD_ACCOUNT, password);
        }
      }

      return { success: true, settings: await getCompanySettingsForRenderer() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  cleanTempFiles().catch(console.error);
  createWindow();

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

app.on('before-quit', () => {
  console.log("L'app si sta chiudendo.");
});

ipcMain.handle('read-prenotazioni', async () => {
  try {
    return readJsonFile(prenotazioniPath, []);
  } catch (error) {
    console.error('Errore lettura file:', error);
    return [];
  }
});

ipcMain.handle('write-prenotazioni', async (_, prenotazioni) => {
  try {
    writeJsonFile(prenotazioniPath, prenotazioni);
    return true;
  } catch (error) {
    console.error('Errore scrittura file:', error);
    return false;
  }
});

ipcMain.handle('salva-immagine-locale', async (_, filePathOriginale) => {
  try {
    const estensione = path.extname(filePathOriginale);
    const nomeFile = `${Date.now()}${estensione}`;
    const destinazione = path.join(immaginiPath, nomeFile);

    fs.copyFileSync(filePathOriginale, destinazione);
    return `file://${destinazione}`;
  } catch (error) {
    console.error('Errore salvataggio immagine:', error);
    return null;
  }
});

ipcMain.handle('seleziona-immagine', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
  });

  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths;
});

ipcMain.handle('read-veicoli', async () => {
  try {
    if (!fs.existsSync(veicoliPath)) {
      writeJsonFile(veicoliPath, []);
    }
    return readJsonFile(veicoliPath, []);
  } catch (error) {
    console.error('Errore lettura veicoli:', error);
    return [];
  }
});

ipcMain.handle('write-veicoli', async (_, data) => {
  try {
    writeJsonFile(veicoliPath, data);
    return true;
  } catch (error) {
    console.error('Errore scrittura veicoli:', error);
    return false;
  }
});

ipcMain.handle('writeClienti', async (_, clienti) => {
  try {
    writeJsonFile(clientiPath, clienti);
    return true;
  } catch (error) {
    console.error('Errore salvataggio clienti:', error);
    return false;
  }
});

ipcMain.handle('readClienti', async () => {
  try {
    return readJsonFile(clientiPath, []);
  } catch (error) {
    console.error('Errore lettura clienti:', error);
    return [];
  }
});

ipcMain.handle('genera-contratto-completo', async (_, { riepilogoBuffer }) => {
  try {
    const riepilogoDoc = await PDFDocument.load(riepilogoBuffer);
    const contrattoDir = path.join(userDataDir, 'pdf');
    const contrattoPath = path.join(contrattoDir, 'contratto_completo.pdf');

    if (!fs.existsSync(contrattoPath)) {
      return {
        success: false,
        error: 'Nessun contratto caricato. Per favore, carica un modello di contratto PDF prima di procedere.',
      };
    }

    const contrattoBytes = await fsPromises.readFile(contrattoPath);
    const contrattoDoc = await PDFDocument.load(contrattoBytes);
    const mergedPdf = await PDFDocument.create();

    const riepilogoPages = await mergedPdf.copyPages(riepilogoDoc, riepilogoDoc.getPageIndices());
    riepilogoPages.forEach((page) => mergedPdf.addPage(page));

    const contrattoPages = await mergedPdf.copyPages(contrattoDoc, contrattoDoc.getPageIndices());
    contrattoPages.forEach((page) => mergedPdf.addPage(page));

    ensureDirectoryExists(contrattoDir);
    const finalPdfBytes = await mergedPdf.save();
    const finalPath = path.join(contrattoDir, `contratto_firmato_${Date.now()}.pdf`);
    await fsPromises.writeFile(finalPath, finalPdfBytes);

    return { success: true, path: finalPath };
  } catch (error) {
    console.error('Errore generazione contratto completo:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('esporta-backup', async () => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Esporta Backup',
      defaultPath: `backup-noleggio-${Date.now()}.zip`,
      filters: [{ name: 'Backup ZIP', extensions: ['zip'] }],
    });

    if (canceled || !filePath) {
      return { success: false, message: 'Backup annullato' };
    }

    const output = fs.createWriteStream(filePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    return await new Promise((resolve, reject) => {
      archive.pipe(output);

      fs.readdirSync(userDataDir).forEach((file) => {
        const fullPath = path.join(userDataDir, file);
        if (file !== 'backup') archive.file(fullPath, { name: file });
      });

      output.on('close', () => resolve({ success: true, path: filePath }));
      archive.on('error', (error) => reject({ success: false, error: error.message }));
      archive.finalize();
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('importa-backup', async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Seleziona il file di backup',
      filters: [{ name: 'Backup ZIP', extensions: ['zip'] }],
      properties: ['openFile'],
    });

    if (canceled || !filePaths.length) {
      return { success: false, message: "Operazione annullata dall'utente." };
    }

    const backupPath = filePaths[0];
    await fs.createReadStream(backupPath)
      .pipe(unzipper.Extract({ path: userDataDir }))
      .promise();

    return { success: true, path: backupPath };
  } catch (error) {
    console.error("Errore durante l'importazione del backup:", error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('concludi-prenotazione', async (_, dati) => {
  try {
    if (!fs.existsSync(prenotazioniPath)) {
      return { success: false, message: 'File mancante' };
    }

    const prenotazioni = readJsonFile(prenotazioniPath, []);
    const index = prenotazioni.findIndex((prenotazione) => prenotazione.id === dati.idPrenotazione);

    if (index === -1) {
      return { success: false, message: 'Prenotazione non trovata' };
    }

    prenotazioni[index].descrizioneDanno = dati.descrizione;
    prenotazioni[index].daRiparare = dati.daRiparare;
    prenotazioni[index].fotoDanni = dati.fotoDanni || [];
    prenotazioni[index].status = 'completata';

    writeJsonFile(prenotazioniPath, prenotazioni);
    return { success: true };
  } catch (error) {
    console.error('Errore salvataggio danni:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('salva-contratto-pdf', async (_, filePathOriginale) => {
  try {
    const destinazione = path.join(userDataDir, 'pdf', 'contratto_completo.pdf');
    ensureDirectoryExists(path.dirname(destinazione));
    fs.copyFileSync(filePathOriginale, destinazione);
    return { success: true };
  } catch (error) {
    return { success: false, message: error.message };
  }
});

ipcMain.handle('seleziona-pdf-contratto', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });

  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('salva-documenti-prenotazione', async (_, data) => {
  try {
    const booking = data?.prenotazione || {};
    const cliente = sanitizeFileName(booking.cliente || 'cliente');
    const targa = sanitizeFileName(booking.targa || 'veicolo');
    const riepilogoBuffer = Buffer.from(data.riepilogoPdf || []);
    const contrattoBuffer = data.contrattoPdf ? Buffer.from(data.contrattoPdf) : null;

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Salva riepilogo prenotazione',
      defaultPath: `Riepilogo_${cliente}_${targa}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });

    if (canceled || !filePath) {
      return { success: false, cancelled: true };
    }

    await fsPromises.writeFile(filePath, riepilogoBuffer);
    const savedPaths = [filePath];

    if (contrattoBuffer) {
      const contractName = sanitizeFileName(
        data.nomeContratto ? path.parse(data.nomeContratto).name : `Contratto_${cliente}_${targa}`
      );
      const contractPath = path.join(path.dirname(filePath), `${contractName}.pdf`);
      await fsPromises.writeFile(contractPath, contrattoBuffer);
      savedPaths.push(contractPath);
    }

    return { success: true, paths: savedPaths };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('apri-bozza-email', async (_, data) => {
  try {
    const to = encodeURIComponent(data?.to || '');
    const subject = encodeURIComponent(data?.subject || '');
    const body = encodeURIComponent(data?.body || '');
    const mailtoUrl = `mailto:${to}?subject=${subject}&body=${body}`;

    await shell.openExternal(mailtoUrl);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('conferma-prenotazione', async (_, data) => {
  try {
    const bookingInput = data.prenotazione || {};
    const bookingId = bookingInput.id || crypto.randomUUID();
    const bookingRecord = {
      ...bookingInput,
      id: bookingId,
      status: bookingInput.status || 'attiva',
      schedaVeicolo: bookingInput.schedaVeicolo || {},
      contrattoFirmato: bookingInput.contrattoFirmato || null,
      confermatoIl: new Date().toISOString(),
      ipConferma: data.ip || null,
    };

    const prenotazioni = readJsonFile(prenotazioniPath, []);
    const existingIndex = prenotazioni.findIndex((prenotazione) => prenotazione.id === bookingId);
    if (existingIndex === -1) {
      prenotazioni.push(bookingRecord);
    } else {
      prenotazioni[existingIndex] = {
        ...prenotazioni[existingIndex],
        ...bookingRecord,
      };
    }
    writeJsonFile(prenotazioniPath, prenotazioni);

    const clienti = readJsonFile(clientiPath, []);
    const indexCliente = clienti.findIndex(
      (cliente) =>
        cliente.codiceFiscale?.toUpperCase() === bookingRecord.codiceFiscale?.toUpperCase()
    );

    if (indexCliente !== -1) {
      clienti[indexCliente].contratti = clienti[indexCliente].contratti || [];
      clienti[indexCliente].contratti.push({
        contratto: null,
        data: new Date().toISOString(),
        targa: bookingRecord.targa,
      });
      writeJsonFile(clientiPath, clienti);
    }

    return { success: true, booking: bookingRecord };
  } catch (error) {
    console.error('Errore conferma prenotazione:', error);
    return { success: false, message: error.message };
  }
});

async function cleanTempFiles() {
  const tempDir = path.join(userDataDir, 'temp_pdf');
  if (!fs.existsSync(tempDir)) {
    return;
  }

  const files = await fsPromises.readdir(tempDir);
  const now = Date.now();

  for (const file of files) {
    const filePath = path.join(tempDir, file);
    const stat = await fsPromises.stat(filePath);
    if (now - stat.mtimeMs > 24 * 60 * 60 * 1000) {
      await fsPromises.unlink(filePath);
    }
  }
}
