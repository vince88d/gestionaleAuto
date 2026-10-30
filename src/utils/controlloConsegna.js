// Controllo dei campi obbligatori del primo passo della consegna (stato
// dell'auto e documenti del cliente). Funzione pura, testata: restituisce gli
// errori nell'ordine in cui i campi stanno nella finestra, cosi' la finestra
// sa dove portare lo sguardo e cosa scrivere vicino al pulsante.
//   chiedi*: il campo e' richiesto (la prenotazione non ce l'ha gia')
//   danniSenzaDescrizione: punti segnati sullo schema senza scrivere cos'e'
//   senzaCodiceFiscale: cliente straniero, al posto del codice fiscale servono
//     data e luogo di nascita e documento d'identita' (tipo e numero)
//   copiaCartacea: presa copia cartacea dei documenti: non bloccano codice
//     fiscale, documento d'identita' e nascita. La patente resta obbligatoria.
export function erroriConsegna({
  senzaCodiceFiscale = false, copiaCartacea = false,
  dataNascita = '', luogoNascita = '', tipoDocumento = '', tipoDocumentoAltro = '', documento = '',
  chiediCodiceFiscale = false, codiceFiscaleValido = true,
  chiediPatente = false, patente = '',
  chiediScadenza = false, scadenzaPatente = '',
  chiediRilascio = false, rilascioPatente = '',
  carburante = '', km = '',
  danniSenzaDescrizione = 0,
} = {}) {
  const errori = [];
  if (senzaCodiceFiscale) {
    if (!copiaCartacea) {
      if (!dataNascita) errori.push({ campo: 'dataNascita', nome: 'data di nascita', messaggio: 'Scrivi la data di nascita.' });
      if (!String(luogoNascita || '').trim()) errori.push({ campo: 'luogoNascita', nome: 'luogo di nascita', messaggio: 'Scrivi il luogo di nascita.' });
      if (!tipoDocumento) errori.push({ campo: 'tipoDocumento', nome: 'tipo di documento', messaggio: 'Scegli il tipo di documento d\'identità.' });
      else if (tipoDocumento === 'Altro' && !String(tipoDocumentoAltro || '').trim()) {
        errori.push({ campo: 'tipoDocumentoAltro', nome: 'tipo di documento', messaggio: 'Scrivi quale documento è.' });
      }
      if (!String(documento || '').trim()) errori.push({ campo: 'documento', nome: 'numero del documento', messaggio: 'Scrivi il numero del documento d\'identità.' });
    }
  } else if (chiediCodiceFiscale && !codiceFiscaleValido && !copiaCartacea) {
    errori.push({ campo: 'codiceFiscale', nome: 'codice fiscale', messaggio: 'Scrivi il codice fiscale: 16 lettere e numeri.' });
  }
  if (chiediPatente && !String(patente || '').trim()) {
    errori.push({ campo: 'patente', nome: 'numero patente', messaggio: 'Scrivi il numero della patente.' });
  }
  if (chiediScadenza && !scadenzaPatente) {
    errori.push({ campo: 'scadenzaPatente', nome: 'scadenza patente', messaggio: 'Scegli la scadenza della patente.' });
  }
  if (chiediRilascio && !rilascioPatente) {
    errori.push({ campo: 'rilascioPatente', nome: 'data di rilascio della patente', messaggio: 'Scrivi la data di rilascio della patente (serve per i limiti dei neopatentati).' });
  }
  if (!carburante) {
    errori.push({ campo: 'carburante', nome: 'carburante', messaggio: 'Scegli il livello del carburante.' });
  }
  const numero = Number(km);
  if (km === '' || km === null || km === undefined || Number.isNaN(numero) || numero < 0) {
    errori.push({ campo: 'km', nome: 'km', messaggio: 'Scrivi i km del contachilometri.' });
  }
  if (danniSenzaDescrizione > 0) {
    errori.push({ campo: 'danni', nome: 'descrizione dei danni', messaggio: 'Scrivi cos\'è ogni danno segnato sullo schema.' });
  }
  return errori;
}

// «Manca: carburante e km» / «Controlla: ...» per la barra in fondo.
export function riassuntoErrori(errori = []) {
  if (errori.length === 0) return '';
  const nomi = errori.map((e) => e.nome);
  const elenco = nomi.length === 1 ? nomi[0] : `${nomi.slice(0, -1).join(', ')} e ${nomi[nomi.length - 1]}`;
  return `Manca: ${elenco}`;
}

// Dati d'identita' della consegna: quello che l'operatore ha scritto qui vince,
// poi la prenotazione, poi il cliente in anagrafica.
export function identitaConsegna({ prenotazione = {}, cliente = null, documenti = {} } = {}) {
  const valore = (campo) => documenti[campo] ?? prenotazione?.[campo] ?? cliente?.[campo] ?? '';
  const senza = documenti.senzaCodiceFiscale ?? (prenotazione?.senzaCodiceFiscale === true || cliente?.senzaCodiceFiscale === true);
  return {
    senzaCodiceFiscale: senza === true,
    dataNascita: valore('dataNascita'),
    luogoNascita: valore('luogoNascita'),
    tipoDocumento: valore('tipoDocumento'),
    tipoDocumentoAltro: documenti.tipoDocumentoAltro || '',
    documento: valore('documento'),
    nazionalita: valore('nazionalita'),
    copiaCartacea: documenti.copiaCartacea === true,
  };
}
