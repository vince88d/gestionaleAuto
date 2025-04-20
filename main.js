const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const nodemailer = require('nodemailer'); // Già presente

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 600,
    webPreferences: {
      contextIsolation: false, // Attenzione: questo è meno sicuro. In futuro, considera l'uso di un preload script.
      nodeIntegration: true,   // Permette al renderer di accedere alle API di Node.js (ma usiamo IPC per sicurezza).
      preload: path.join(__dirname, 'preload.js') // L'approccio moderno e sicuro
    },
  });

  win.loadFile(path.join(__dirname, 'build', 'index.html'));

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

  // Configura il transporter di Nodemailer
  // !!! SOSTITUISCI CON I TUOI DATI SMTP REALI O USA UN SERVIZIO EMAIL DI TERZE PARTI PIÙ AVANZATO !!!
  // Esempi di configurazione:
  // Per Gmail (richiede app password se 2FA è attivo):
  /*
  let transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'la-tua-email@gmail.com',
      pass: 'la-tua-app-password' // Usa una password per app, non la password normale!
    }
  });
  */
  // Per un server SMTP generico:
  let transporter = nodemailer.createTransport({
    host: 'smtp.iltuoserver.com', // Esempio: smtp.gmail.com, smtp.outlook.com, etc.
    port: 587, // Porta standard per TLS/STARTTLS
    secure: false, // true per 465 (SSL), false per altre porte (TLS/STARTTLS)
    auth: {
      user: companyData.email || 'email-di-default@esempio.com', // Usa l'email aziendale salvata
      pass: 'LA_PASSWORD_EMAIL_AZIENDALE', // !!! NON HARDCODARE CREDENZIALI SENSIBILI COSÌ IN UN'APP DISTRIBUITA !!!
                                           // Considera di chiedere all'utente le credenziali o usarle in modo più sicuro.
    },
    tls: {
        // Non rifiutare certificati auto-firmati. Sconsigliato in produzione senza una ragione valida.
        // rejectUnauthorized: false
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