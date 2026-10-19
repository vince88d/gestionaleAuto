// Controllo dei campi obbligatori del primo passo della consegna (stato
// dell'auto e documenti del cliente). Funzione pura, testata: restituisce gli
// errori nell'ordine in cui i campi stanno nella finestra, cosi' la finestra
// sa dove portare lo sguardo e cosa scrivere vicino al pulsante.
//   chiedi*: il campo e' richiesto (la prenotazione non ce l'ha gia')
//   danniSenzaDescrizione: punti segnati sullo schema senza scrivere cos'e'
export function erroriConsegna({
  chiediCodiceFiscale = false, codiceFiscaleValido = true,
  chiediPatente = false, patente = '',
  chiediScadenza = false, scadenzaPatente = '',
  chiediRilascio = false, rilascioPatente = '',
  carburante = '', km = '',
  danniSenzaDescrizione = 0,
} = {}) {
  const errori = [];
  if (chiediCodiceFiscale && !codiceFiscaleValido) {
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
