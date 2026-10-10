import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import DatePicker from 'react-datepicker';
import { it } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';
import { Check, Search, UserPlus, Phone, Mail, ShieldCheck, FileWarning } from 'lucide-react';
import ClienteFormModal from './ClienteFormModal';
import SceltaVeicolo from './SceltaVeicolo';
import SceltaProtezioneExtra from './SceltaProtezioneExtra';
import { addCliente } from '../store/clientiSlice';
import { creaCliente, messaggioErroreCliente } from '../lib/firestoreClienti';
import { giorniOccupati, occupantiTranne, pagataSulSito } from '../utils/regolePrenotazione';
import { pezziOccupati, preventivoPrenotazione, scelteIniziali, totaleSceglibile } from '../utils/sceltaExtra';
import { protezioneImpostata, euro as euroTondo } from '../utils/protezioni';
import { normalizzaOptional } from '../utils/optional';
import { prezzoPrenotazione } from '../utils/dashboard';
import { confrontaConListino } from '../utils/prezzoListino';
import { cercaClienti } from '../utils/validaCliente';
import { formattaData, giornoLocale } from '../utils/scadenze';
import {
  DURATE_RAPIDE, dateRapide, giorniDelNoleggio, statoPassi, validaNuovaPrenotazione, datiDaCliente, documentiCompleti,
} from '../utils/nuovaPrenotazione';
import { useOrari } from '../lib/firestoreOrari';
import { ORE_DEL_GIORNO, oraBreve, oraProposta, avvisoFuoriOrario, avvisoGiornoInPiu } from '../utils/orari';
import './BookingForm.css';
import '../styles/Prenotazione.css';
import './NuovaPrenotazione.css';

const CAMPI_VUOTI = {
  cliente: '', telefono: '', emailCliente: '', codiceFiscale: '', patente: '',
  veicolo: '', targa: '', dataInizio: '', dataFine: '', oraInizio: '', oraFine: '', prezzoGiornaliero: '',
};
const nomeVeicolo = (v) => [v?.marca, v?.modello].filter(Boolean).join(' ') || v?.targa || '';
const euro = (valore) => `${Number(valore || 0).toFixed(2).replace('.', ',')} €`;
const dataLunga = (iso) => (iso
  ? new Date(`${iso}T12:00:00`).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'long' })
  : '');
const versoData = (d) => (d ? new Date(`${String(d).slice(0, 10)}T12:00:00`) : null);
const daData = (date) => (date ? giornoLocale(date) : '');
const conOra = (iso, ora) => `${dataLunga(iso)}${ora ? ` alle ${oraBreve(ora)}` : ''}`;

// Ora accanto alla data: ogni 30 minuti, anche fuori orario (al banco si
// puo', con l'avviso sotto). "—" solo per le prenotazioni di prima, senza ora.
function SceltaOra({ valore, onChange, etichetta }) {
  return (
    <label className="np-campo np-campo--ora">
      <span className="np-etichetta">alle</span>
      <select value={valore} onChange={(e) => onChange(e.target.value)} aria-label={etichetta}>
        {!valore && <option value="">—</option>}
        {ORE_DEL_GIORNO.map((o) => <option key={o} value={o}>{oraBreve(o)}</option>)}
      </select>
    </label>
  );
}
// Nomi dei campi per "Manca ancora:" sotto il pulsante.
const NOMI_ERRORI = {
  dataInizio: 'giorno di uscita', dataFine: 'giorno di rientro', targa: 'auto', prezzoGiornaliero: 'prezzo',
  cliente: 'cliente', telefono: 'telefono', emailCliente: 'email', codiceFiscale: 'codice fiscale',
};

// Finestra "Nuova prenotazione" (e "Modifica"). Una sola finestra con tre
// domande nell'ordine in cui le fa chi sta al banco: quando, quale auto, chi.
// A destra il riepilogo sempre visibile con il totale e il pulsante di conferma.
// Codice fiscale, patente ed email si possono lasciare vuoti: si completano
// alla consegna. Da qualunque strada si arrivi (menu, calendario, scheda
// dell'auto, ricerca della Dashboard) quello gia' scelto arriva compilato.
function BookingForm({
  onSubmit,
  initialValues,
  availableVehicles = [],
  veicoli = [],
  holds = [],
  clienti = [],
  prenotazioni = [],
  salvando = false,
  onAnnulla,
  onModificato,
  // Protezioni per categoria e catalogo degli optional (vedi lib/useExtra.js).
  protezioni = {},
  catalogo = [],
}) {
  const dispatch = useDispatch();
  const bookingId = initialValues?.id;
  const sito = pagataSulSito(initialValues);
  const oggi = giornoLocale();
  const orari = useOrari();
  // Tolleranza al rientro: quella salvata sulla prenotazione, altrimenti quella di Impostazioni.
  const tolleranza = initialValues?.tolleranzaMinuti ?? orari?.tolleranzaMinuti ?? 0;

  const [dati, setDati] = useState(CAMPI_VUOTI);
  const datiIniziali = useRef(CAMPI_VUOTI);
  // 'cerca' (nessun cliente), 'scelto' (scheda del cliente), 'nuovo' (campi da scrivere)
  const [modoCliente, setModoCliente] = useState('cerca');
  const [cerca, setCerca] = useState('');
  const [conDocumenti, setConDocumenti] = useState(false);
  const [cambiaPrezzo, setCambiaPrezzo] = useState(false);
  const [tentato, setTentato] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const campoCerca = useRef(null);
  const comboRef = useRef(null);
  const [aperta, setAperta] = useState(false);
  const [versoAlto, setVersoAlto] = useState(false);
  const [evidenziato, setEvidenziato] = useState(0);
  // Domanda 4: protezione scelta ed extra (id -> quantita').
  const [scelte, setScelte] = useState(() => scelteIniziali(null));
  const scelteDiPartenza = useRef(scelte);

  // Si riparte da quello che arriva (nuova vuota, con data/auto, o modifica).
  useEffect(() => {
    const iniziali = { ...CAMPI_VUOTI };
    Object.keys(CAMPI_VUOTI).forEach((k) => {
      if (initialValues?.[k] != null) iniziali[k] = String(initialValues[k]);
    });
    iniziali.dataInizio = iniziali.dataInizio.slice(0, 10);
    iniziali.dataFine = iniziali.dataFine.slice(0, 10);
    if (iniziali.targa && !iniziali.prezzoGiornaliero) {
      const v = veicoli.find((x) => x.targa === iniziali.targa);
      if (v?.prezzo) iniziali.prezzoGiornaliero = String(v.prezzo);
    }
    setDati(iniziali);
    datiIniziali.current = iniziali;
    setModoCliente(iniziali.cliente ? 'scelto' : 'cerca');
    setConDocumenti(Boolean(iniziali.codiceFiscale || iniziali.patente));
    setCerca('');
    setCambiaPrezzo(false);
    setTentato(false);
    const iniziali4 = scelteIniziali(initialValues);
    setScelte(iniziali4);
    scelteDiPartenza.current = iniziali4;
    // veicoli: solo per il listino iniziale, non deve riazzerare il form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues]);

  const aggiorna = (campi) => setDati((d) => ({ ...d, ...campi }));

  // Nuova prenotazione arrivata con le date gia' scelte (calendario, Dashboard):
  // appena ci sono gli orari si propone l'ora, senza contarla come modifica.
  useEffect(() => {
    if (!orari || bookingId) return;
    setDati((d) => {
      const ore = {};
      if (d.dataInizio && !d.oraInizio) ore.oraInizio = oraProposta(orari, d.dataInizio);
      if (d.dataFine && !d.oraFine) ore.oraFine = ore.oraInizio || d.oraInizio || oraProposta(orari, d.dataFine);
      if (!Object.keys(ore).length) return d;
      if (datiIniziali.current.dataInizio === d.dataInizio && datiIniziali.current.dataFine === d.dataFine) {
        datiIniziali.current = { ...datiIniziali.current, ...ore };
      }
      return { ...d, ...ore };
    });
  }, [orari, bookingId, dati.dataInizio, dati.dataFine]);

  // Scegliendo il giorno: se l'ora manca si propone (rientro alla stessa ora dell'uscita).
  const scegliInizio = (data) => aggiorna({
    dataInizio: data,
    ...(dati.dataFine && data > dati.dataFine ? { dataFine: '' } : {}),
    ...(data && !dati.oraInizio ? { oraInizio: oraProposta(orari, data) } : {}),
  });
  const scegliFine = (data) => aggiorna({
    dataFine: data,
    ...(data && !dati.oraFine ? { oraFine: dati.oraInizio || oraProposta(orari, data) } : {}),
  });
  const scegliRapida = (chiave) => {
    const date = dateRapide(chiave, dati.dataInizio, oggi);
    const oraInizio = dati.oraInizio || oraProposta(orari, date.dataInizio);
    aggiorna({ ...date, oraInizio, oraFine: dati.oraFine || oraInizio });
  };

  // Toccato qualcosa rispetto a come si e' aperto? (per chiedere conferma alla chiusura)
  const modificato = Object.keys(CAMPI_VUOTI).some((k) => dati[k] !== datiIniziali.current[k]) || cerca.trim() !== ''
    || JSON.stringify(scelte) !== JSON.stringify(scelteDiPartenza.current);
  useEffect(() => { onModificato?.(modificato); }, [modificato, onModificato]);

  // Veicoli sceglibili: quelli dell'elenco piu' quello gia' assegnato (in modifica).
  const veicoliSelezionabili = useMemo(() => {
    const elenco = availableVehicles.map((v) => veicoli.find((x) => x.targa === v.targa) || v);
    if (initialValues?.targa && !elenco.some((v) => v.targa === initialValues.targa)) {
      elenco.push({ targa: initialValues.targa, modello: initialValues.veicolo || 'Veicolo selezionato', prezzo: initialValues.prezzoGiornaliero || '' });
    }
    return elenco;
  }, [availableVehicles, veicoli, initialValues]);

  const veicoloScelto = veicoliSelezionabili.find((v) => v.targa === dati.targa);
  const giorni = giorniDelNoleggio({ ...dati, tolleranzaMinuti: tolleranza });
  const avvisoUscita = dati.dataInizio ? avvisoFuoriOrario(orari, dati.dataInizio, dati.oraInizio) : null;
  const avvisoRientro = dati.dataFine ? avvisoFuoriOrario(orari, dati.dataFine, dati.oraFine) : null;
  const giornoInPiu = orari ? avvisoGiornoInPiu(dati, tolleranza) : null;
  const passi = statoPassi(dati);
  const errori = validaNuovaPrenotazione(dati);
  const mostraErrore = (campo) => tentato && errori[campo];
  // Protezione della categoria dell'auto scelta ed extra (anche quelli tolti
  // dall'elenco ma gia' salvati su questa prenotazione).
  const categoria = (veicoloScelto && (veicoli.find((x) => x.targa === veicoloScelto.targa) || veicoloScelto).categoria) || '';
  const protezione = categoria ? protezioni[categoria] : undefined;
  const sceltaProtezione = scelte.sceltaProtezione === 'totale' && protezioneImpostata(protezione) && totaleSceglibile(protezione)
    ? 'totale' : 'base';
  const elencoExtra = useMemo(() => {
    const salvati = (Array.isArray(initialValues?.optional) ? initialValues.optional : [])
      .filter((r) => r?.id && !catalogo.some((o) => o.id === r.id))
      .map((r) => ({ ...normalizzaOptional({ ...r, maxPerNoleggio: r.quantita, pezzi: '' }), id: r.id, fuoriElenco: true }));
    return [...catalogo].sort((a, b) => a.nome.localeCompare(b.nome, 'it')).concat(salvati);
  }, [catalogo, initialValues]);
  const conDate = giorni > 0;
  const occupati = useMemo(() => pezziOccupati({
    occupanti: occupantiTranne(prenotazioni, bookingId, oggi),
    holds,
    inizio: dati.dataInizio,
    fine: dati.dataFine,
  }), [prenotazioni, bookingId, oggi, holds, dati.dataInizio, dati.dataFine]);
  const preventivo = sito ? null : preventivoPrenotazione({
    prezzoGiornaliero: dati.prezzoGiornaliero,
    giorni,
    protezione,
    sceltaProtezione,
    catalogo,
    sceltaOptional: scelte.sceltaOptional,
    optionalSalvati: initialValues?.optional,
    occupati,
  });
  const cambiaQuantita = (id, q) => setScelte((x) => {
    const sceltaOptional = { ...x.sceltaOptional };
    if (q > 0) sceltaOptional[id] = q; else delete sceltaOptional[id];
    return { ...x, sceltaOptional };
  });
  // Della prenotazione del sito valgono le scelte pagate.
  const protezioneMostrata = sito ? initialValues?.protezione : preventivo?.protezione;
  const totale = sito ? prezzoPrenotazione(initialValues) : (preventivo?.prezzoTotale ?? giorni * (parseFloat(dati.prezzoGiornaliero) || 0));
  const confrontoListino = confrontaConListino(dati.prezzoGiornaliero, veicoloScelto?.prezzo);

  // Giorni gia' occupati dall'auto scelta (se si arriva con l'auto gia' decisa).
  const giorniBloccati = giorniOccupati({ targa: dati.targa, prenotazioni, idEscluso: bookingId })
    .map((g) => new Date(`${g}T12:00:00`));

  const scegliVeicolo = (v) => aggiorna({
    targa: v.targa,
    veicolo: v.modello || nomeVeicolo(v),
    // Il listino si applica quando si cambia auto; un prezzo del sito non cambia.
    ...(sito ? {} : { prezzoGiornaliero: v.prezzo ? String(v.prezzo) : dati.prezzoGiornaliero }),
  });

  const scegliCliente = (c) => {
    aggiorna(datiDaCliente(c));
    setModoCliente('scelto');
    setConDocumenti(false);
    setCerca('');
    setAperta(false);
  };

  const clientiTrovati = useMemo(
    () => (cerca.trim().length >= 2 ? cercaClienti(clienti, cerca, prenotazioni).slice(0, 6) : []),
    [clienti, cerca, prenotazioni],
  );

  const tendinaAperta = aperta && cerca.trim().length >= 2;

  // Si apre verso il basso; verso l'alto se sotto, nella parte visibile della
  // finestra, non c'e' posto (la sezione cliente e' l'ultima).
  const apriTendina = () => {
    const campo = comboRef.current;
    const contenitore = campo?.closest('.np-corpo');
    if (campo && contenitore) {
      const c = campo.getBoundingClientRect();
      const v = contenitore.getBoundingClientRect();
      const sotto = v.bottom - c.bottom;
      setVersoAlto(sotto < 300 && c.top - v.top > sotto);
    }
    setAperta(true);
  };

  const tastiRicerca = (e) => {
    // Invio nella ricerca non deve mai confermare la prenotazione.
    if (e.key === 'Enter') e.preventDefault();
    if (!tendinaAperta) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setEvidenziato((i) => Math.min(i + 1, clientiTrovati.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setEvidenziato((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (clientiTrovati[evidenziato]) scegliCliente(clientiTrovati[evidenziato]);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setAperta(false);
    }
  };

  // Il cliente scelto e' in anagrafica? (per "documenti completi")
  const clienteInAnagrafica = clienti.find(
    (c) => dati.codiceFiscale && (c.codiceFiscale || '').toUpperCase() === dati.codiceFiscale.toUpperCase(),
  );
  const documentiOk = documentiCompleti(clienteInAnagrafica || dati);

  const nuovoClienteDaRicerca = () => {
    // Quello scritto nella ricerca diventa il nome, o il telefono se sono numeri.
    const testo = cerca.trim();
    const sonoNumeri = /^[+\d\s]{6,}$/.test(testo);
    aggiorna({
      cliente: sonoNumeri ? '' : testo, telefono: sonoNumeri ? testo : '', emailCliente: '', codiceFiscale: '', patente: '',
    });
    setModoCliente('nuovo');
  };

  const salvaNuovoCliente = async (nuovoCliente) => {
    try {
      const salvato = await creaCliente(nuovoCliente);
      dispatch(addCliente(salvato));
      toast.success(`Cliente ${salvato.nome} ${salvato.cognome} aggiunto.`);
      scegliCliente(salvato);
      setShowAddClient(false);
    } catch (error) {
      console.error('Errore salvataggio cliente:', error);
      toast.error(messaggioErroreCliente(error, 'Errore durante il salvataggio del cliente'));
    }
  };

  const invia = (e) => {
    e.preventDefault();
    setTentato(true);
    if (Object.keys(errori).length > 0 || preventivo?.errore) return;
    onSubmit({
      // Domanda 4: le scelte (il prezzo lo ricalcola controllaPrenotazione).
      sceltaProtezione,
      sceltaOptional: scelte.sceltaOptional,
      ...dati,
      // La tolleranza usata per contare i giorni resta sulla prenotazione (come il sito).
      ...(dati.oraInizio && dati.oraFine ? { tolleranzaMinuti: tolleranza } : {}),
      cliente: dati.cliente.trim().replace(/\s+/g, ' '),
      telefono: dati.telefono.trim(),
      emailCliente: dati.emailCliente.trim(),
      codiceFiscale: dati.codiceFiscale.trim().toUpperCase(),
      patente: dati.patente.trim().toUpperCase(),
    });
  };

  const Passo = ({ numero, fatto, testo }) => {
    const attivo = passi.attivo === numero && !fatto;
    return (
      <li className={`np-passo ${fatto ? 'np-passo--fatto' : ''} ${attivo ? 'np-passo--attivo' : ''}`}>
        <span className="np-passo-numero" aria-hidden="true">{fatto ? <Check size={15} strokeWidth={3} /> : numero}</span>
        {testo}
        {fatto && <span className="np-nascosto"> (fatto)</span>}
      </li>
    );
  };

  const erroriElenco = Object.keys(errori).map((k) => NOMI_ERRORI[k] || k);

  return (
    <form onSubmit={invia} className="pz pz-form np" noValidate>
      <header className="pz-testa np-testa">
        <h2 className="pz-titolo np-titolo">{bookingId ? 'Modifica prenotazione' : 'Nuova prenotazione'}</h2>
        <ol className="np-passi" aria-label="Passaggi">
          <Passo numero={1} fatto={passi.quando} testo="Quando" />
          <li className="np-passi-linea" aria-hidden="true" />
          <Passo numero={2} fatto={passi.auto} testo="Quale auto" />
          <li className="np-passi-linea" aria-hidden="true" />
          <Passo numero={3} fatto={passi.chi && !errori.telefono} testo="Chi la prende" />
          <li className="np-passi-linea" aria-hidden="true" />
          {/* Facoltativa: e' "da fare" solo dopo le prime tre. */}
          <li className={`np-passo ${passi.quando && passi.auto && passi.chi ? 'np-passo--attivo' : ''}`}>
            <span className="np-passo-numero" aria-hidden="true">4</span>
            Protezione ed extra
          </li>
        </ol>
      </header>

      <div className="np-corpo">
        <div className="np-colonna">
          {/* 1. Quando */}
          <section className={`np-sezione ${passi.attivo === 1 ? 'np-sezione--attiva' : ''}`}>
            <h3 className="np-sezione-titolo"><span className="np-numero">1.</span> Quando?</h3>
            <div className="np-date">
              <div className="np-ora">
              <label className={`np-campo ${mostraErrore('dataInizio') ? 'np-campo--errore' : ''}`}>
                <span className="np-etichetta">Esce il</span>
                <DatePicker
                  locale={it}
                  selected={versoData(dati.dataInizio)}
                  onChange={(d) => scegliInizio(daData(d))}
                  minDate={bookingId ? null : versoData(oggi)}
                  excludeDates={giorniBloccati}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="gg/mm/aaaa"
                />
                {mostraErrore('dataInizio') && <span className="np-errore" role="alert">{errori.dataInizio}</span>}
              </label>
              <SceltaOra valore={dati.oraInizio} onChange={(o) => aggiorna({ oraInizio: o })} etichetta="Ora di uscita" />
              </div>
              <div className="np-ora">
              <label className={`np-campo ${mostraErrore('dataFine') ? 'np-campo--errore' : ''}`}>
                <span className="np-etichetta">Rientra il</span>
                <DatePicker
                  locale={it}
                  selected={versoData(dati.dataFine)}
                  onChange={(d) => scegliFine(daData(d))}
                  minDate={versoData(dati.dataInizio) || (bookingId ? null : versoData(oggi))}
                  excludeDates={giorniBloccati}
                  openToDate={versoData(dati.dataFine) || versoData(dati.dataInizio) || undefined}
                  dateFormat="dd/MM/yyyy"
                  placeholderText="gg/mm/aaaa"
                />
                {mostraErrore('dataFine') && <span className="np-errore" role="alert">{errori.dataFine}</span>}
              </label>
              <SceltaOra valore={dati.oraFine} onChange={(o) => aggiorna({ oraFine: o })} etichetta="Ora di rientro" />
              </div>
              {giorni > 0 && (
                <span className="np-giorni">{giorni} {giorni === 1 ? 'giorno' : 'giorni'}</span>
              )}
            </div>
            {(avvisoUscita || avvisoRientro || giornoInPiu) && (
              <div className="np-avviso-ora" role="status">
                {[avvisoUscita, avvisoRientro].filter(Boolean).map((t) => (
                  <p key={t}><b>{t}</b> Puoi lasciarlo se sei d'accordo con il cliente.</p>
                ))}
                {giornoInPiu && (
                  <p>
                    {giornoInPiu.testo}{' '}
                    {!sito && (
                      <button type="button" className="np-link" onClick={() => aggiorna({ oraFine: dati.oraInizio })}>
                        Rientro alle {oraBreve(dati.oraInizio)}
                      </button>
                    )}
                  </p>
                )}
              </div>
            )}
            <div className="np-rapide">
              <span>Scelta rapida{dati.dataInizio ? ` dal ${formattaData(dati.dataInizio)}` : ' da oggi'}:</span>
              {DURATE_RAPIDE.map((d) => (
                <button
                  key={d.chiave}
                  type="button"
                  className="np-chip"
                  onClick={() => scegliRapida(d.chiave)}
                >
                  {d.etichetta}
                </button>
              ))}
            </div>
          </section>

          {/* 2. Quale auto */}
          <section className={`np-sezione ${passi.attivo === 2 ? 'np-sezione--attiva' : ''} ${mostraErrore('targa') ? 'np-sezione--errore' : ''}`}>
            <h3 className="np-sezione-titolo"><span className="np-numero">2.</span> Quale auto?</h3>
            <SceltaVeicolo
              veicoli={veicoliSelezionabili}
              targaScelta={dati.targa}
              targaIniziale={initialValues?.targa}
              onScegli={scegliVeicolo}
              inizio={dati.dataInizio}
              fine={dati.dataFine}
              prenotazioni={prenotazioni}
              holds={holds}
              idEscluso={bookingId}
              giorni={giorni}
            />
            {mostraErrore('targa') && <span className="np-errore" role="alert">{errori.targa}</span>}
          </section>

          {/* 3. Chi la prende */}
          <section className={`np-sezione ${passi.attivo === 3 && !passi.chi ? 'np-sezione--attiva' : ''} ${mostraErrore('cliente') ? 'np-sezione--errore' : ''}`}>
            <h3 className="np-sezione-titolo"><span className="np-numero">3.</span> Chi la prende?</h3>

            {modoCliente === 'cerca' && (
              <>
                <label className="np-campo" htmlFor="np-cerca-cliente">
                  <span className="np-etichetta">Cerca il cliente per nome, telefono o codice fiscale</span>
                </label>
                {/* Tendina sopra il contenuto (non sposta la finestra), come i
                    suggerimenti di un motore di ricerca: frecce + Invio, Esc chiude. */}
                <div className="np-combo" ref={comboRef}>
                  <span className="np-cerca">
                    <Search size={18} aria-hidden="true" />
                    <input
                      id="np-cerca-cliente"
                      ref={campoCerca}
                      type="search"
                      role="combobox"
                      aria-expanded={tendinaAperta}
                      aria-controls="np-tendina-clienti"
                      aria-autocomplete="list"
                      aria-activedescendant={tendinaAperta && evidenziato >= 0 ? `np-cliente-${evidenziato}` : undefined}
                      value={cerca}
                      onChange={(e) => { setCerca(e.target.value); setEvidenziato(0); apriTendina(); }}
                      onFocus={apriTendina}
                      onBlur={() => setTimeout(() => setAperta(false), 150)}
                      onKeyDown={tastiRicerca}
                      placeholder="Es. Rossi, 333 1234567…"
                      autoComplete="off"
                    />
                  </span>
                  {tendinaAperta && (
                    <ul
                      id="np-tendina-clienti"
                      role="listbox"
                      aria-label="Clienti trovati"
                      className={`np-tendina ${versoAlto ? 'np-tendina--sopra' : ''}`}
                    >
                      {clientiTrovati.map((c, i) => (
                        <li
                          key={c.id || c.codiceFiscale}
                          id={`np-cliente-${i}`}
                          role="option"
                          aria-selected={i === evidenziato}
                          className={`np-opzione ${i === evidenziato ? 'np-opzione--attiva' : ''}`}
                          onMouseDown={(e) => { e.preventDefault(); scegliCliente(c); }}
                          onMouseEnter={() => setEvidenziato(i)}
                        >
                          <span className="np-risultato-nome">{c.nome} {c.cognome}</span>
                          <span className="np-risultato-info">{c.telefono || c.cellulare || c.email || ''}</span>
                          {documentiCompleti(c) && <span className="np-ok"><ShieldCheck size={15} aria-hidden="true" /> Documenti completi</span>}
                        </li>
                      ))}
                      {clientiTrovati.length === 0 && (
                        <li className="np-opzione np-opzione--vuota" role="presentation">
                          Nessun cliente trovato con «{cerca.trim()}».
                        </li>
                      )}
                    </ul>
                  )}
                </div>
                <button type="button" className="np-risultato np-risultato--nuovo" onClick={nuovoClienteDaRicerca}>
                  <UserPlus size={18} aria-hidden="true" />
                  {cerca.trim() && clientiTrovati.length === 0
                    ? `Aggiungi «${cerca.trim()}» come cliente nuovo`
                    : 'È un cliente nuovo: scrivi nome e telefono'}
                </button>
                {mostraErrore('cliente') && <span className="np-errore" role="alert">{errori.cliente}</span>}
              </>
            )}

            {modoCliente === 'scelto' && (
              <div className="np-cliente">
                <div className="np-cliente-testi">
                  <span className="np-cliente-nome">{dati.cliente}</span>
                  <span className="np-cliente-info">
                    {dati.telefono && <span><Phone size={14} aria-hidden="true" /> {dati.telefono}</span>}
                    {dati.emailCliente && <span><Mail size={14} aria-hidden="true" /> {dati.emailCliente}</span>}
                  </span>
                  {documentiOk ? (
                    <span className="np-ok"><ShieldCheck size={15} aria-hidden="true" /> Documenti completi</span>
                  ) : (
                    <span className="np-da-fare"><FileWarning size={15} aria-hidden="true" /> Codice fiscale e patente si completano alla consegna</span>
                  )}
                  {mostraErrore('telefono') && <span className="np-errore" role="alert">{errori.telefono}</span>}
                </div>
                <div className="np-cliente-azioni">
                  <button type="button" className="np-link" onClick={() => setModoCliente('nuovo')}>Correggi i dati</button>
                  <button
                    type="button"
                    className="np-link"
                    onClick={() => {
                      aggiorna({ cliente: '', telefono: '', emailCliente: '', codiceFiscale: '', patente: '' });
                      setModoCliente('cerca');
                      setTimeout(() => campoCerca.current?.focus(), 0);
                    }}
                  >
                    Cambia cliente
                  </button>
                </div>
              </div>
            )}

            {modoCliente === 'nuovo' && (
              <div className="np-nuovo">
                <div className="np-griglia">
                  <label className={`np-campo np-intera ${mostraErrore('cliente') ? 'np-campo--errore' : ''}`}>
                    <span className="np-etichetta">Nome e cognome</span>
                    <input value={dati.cliente} onChange={(e) => aggiorna({ cliente: e.target.value })} placeholder="Es. Mario Rossi" autoComplete="off" />
                    {mostraErrore('cliente') && <span className="np-errore" role="alert">{errori.cliente}</span>}
                  </label>
                  <label className={`np-campo ${mostraErrore('telefono') ? 'np-campo--errore' : ''}`}>
                    <span className="np-etichetta">Telefono</span>
                    <input type="tel" value={dati.telefono} onChange={(e) => aggiorna({ telefono: e.target.value })} placeholder="Es. 333 1234567" autoComplete="off" />
                    {mostraErrore('telefono') && <span className="np-errore" role="alert">{errori.telefono}</span>}
                  </label>
                  <label className={`np-campo ${mostraErrore('emailCliente') ? 'np-campo--errore' : ''}`}>
                    <span className="np-etichetta">Email <span className="np-facoltativo">(facoltativa)</span></span>
                    <input type="email" value={dati.emailCliente} onChange={(e) => aggiorna({ emailCliente: e.target.value })} placeholder="nome@esempio.it" autoComplete="off" />
                    {mostraErrore('emailCliente') && <span className="np-errore" role="alert">{errori.emailCliente}</span>}
                  </label>
                  {conDocumenti ? (
                    <>
                      <label className={`np-campo ${mostraErrore('codiceFiscale') ? 'np-campo--errore' : ''}`}>
                        <span className="np-etichetta">Codice fiscale <span className="np-facoltativo">(facoltativo)</span></span>
                        <input value={dati.codiceFiscale} onChange={(e) => aggiorna({ codiceFiscale: e.target.value })} maxLength={16} style={{ textTransform: 'uppercase' }} placeholder="Es. RSSMRA80A01H501U" autoComplete="off" />
                        {mostraErrore('codiceFiscale') && <span className="np-errore" role="alert">{errori.codiceFiscale}</span>}
                      </label>
                      <label className="np-campo">
                        <span className="np-etichetta">Numero patente <span className="np-facoltativo">(facoltativo)</span></span>
                        <input value={dati.patente} onChange={(e) => aggiorna({ patente: e.target.value })} style={{ textTransform: 'uppercase' }} placeholder="Es. AB1234567" autoComplete="off" />
                      </label>
                    </>
                  ) : (
                    <button type="button" className="np-link np-intera" onClick={() => setConDocumenti(true)}>
                      + Hai già codice fiscale e patente? Aggiungili ora
                    </button>
                  )}
                </div>
                <p className="np-aiuto">
                  Codice fiscale e patente non servono adesso: li chiede la consegna, e lì il cliente entra in anagrafica.
                </p>
                <div className="np-cliente-azioni">
                  <button type="button" className="np-link" onClick={() => setModoCliente('cerca')}>← Cerca tra i clienti</button>
                  <button type="button" className="np-link" onClick={() => setShowAddClient(true)}>Scheda completa in anagrafica</button>
                </div>
              </div>
            )}
          </section>

          {/* 4. Protezione ed extra */}
          <SceltaProtezioneExtra
            categoria={categoria}
            protezione={protezione}
            sceltaProtezione={sceltaProtezione}
            onProtezione={(tipo) => setScelte((x) => ({ ...x, sceltaProtezione: tipo }))}
            catalogo={elencoExtra}
            quantita={scelte.sceltaOptional}
            onQuantita={cambiaQuantita}
            giorni={giorni}
            occupati={occupati}
            conDate={conDate}
            sito={sito}
            salvata={initialValues}
            attiva={passi.quando && passi.auto && passi.chi}
          />
        </div>

        {/* Riepilogo sempre visibile */}
        <aside className="np-riepilogo" aria-label="Riepilogo">
          <h3 className="np-riepilogo-titolo">Riepilogo</h3>
          <dl className="np-dati">
            <div>
              <dt>Quando</dt>
              <dd>{giorni > 0 ? `da ${conOra(dati.dataInizio, dati.oraInizio)} a ${conOra(dati.dataFine, dati.oraFine)} · ${giorni} ${giorni === 1 ? 'giorno' : 'giorni'}` : <span className="np-vuoto">da scegliere</span>}</dd>
            </div>
            <div>
              <dt>Auto</dt>
              <dd>{veicoloScelto ? `${nomeVeicolo(veicoloScelto)} · ${veicoloScelto.targa}` : <span className="np-vuoto">da scegliere</span>}</dd>
            </div>
            <div>
              <dt>Cliente</dt>
              <dd className="np-capitalizza">{dati.cliente.trim() || <span className="np-vuoto">da scegliere</span>}</dd>
            </div>
          </dl>

          <div className="np-prezzi">
            {sito ? (
              <p className="np-aiuto">Pagata sul sito: il prezzo resta quello pagato.</p>
            ) : (
              <>
                <div className="np-riga-prezzo">
                  <span>{dati.prezzoGiornaliero ? `${euro(dati.prezzoGiornaliero)} × ${giorni || '—'} ${giorni === 1 ? 'giorno' : 'giorni'}` : 'Prezzo al giorno'}</span>
                  <button type="button" className="np-link" onClick={() => setCambiaPrezzo((x) => !x)}>
                    {cambiaPrezzo ? 'Fatto' : 'Cambia prezzo'}
                  </button>
                </div>
                {(cambiaPrezzo || mostraErrore('prezzoGiornaliero')) && (
                  <label className={`np-campo ${mostraErrore('prezzoGiornaliero') ? 'np-campo--errore' : ''}`}>
                    <span className="np-etichetta">Prezzo concordato al giorno (€)</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={dati.prezzoGiornaliero}
                      onChange={(e) => aggiorna({ prezzoGiornaliero: e.target.value })}
                    />
                    {mostraErrore('prezzoGiornaliero') && <span className="np-errore" role="alert">{errori.prezzoGiornaliero}</span>}
                  </label>
                )}
                {confrontoListino.stato !== 'nessuno' && confrontoListino.stato !== 'uguale' && (
                  <p className="np-aiuto">
                    Listino {euro(confrontoListino.listino)} al giorno · concordato {confrontoListino.stato === 'sopra' ? '+' : ''}{euro(confrontoListino.differenza)}
                  </p>
                )}
              </>
            )}
            {!sito && preventivo?.protezione && (
              <div className="np-riga-prezzo">
                <span>Protezione {preventivo.protezione.tipo === 'totale' ? 'Totale' : 'Base'}</span>
                <span>{preventivo.protezione.tipo === 'totale' ? euro(preventivo.protezione.prezzo) : 'inclusa'}</span>
              </div>
            )}
            {!sito && (preventivo?.optional || []).map((o) => (
              <div className="np-riga-prezzo" key={o.id}>
                <span>{o.nome} × {o.quantita}</span>
                <span>{euro(o.totale)}</span>
              </div>
            ))}
            <div className="np-totale">
              <span>Totale</span>
              <span>{euro(totale)}</span>
            </div>
            {typeof protezioneMostrata?.cauzione === 'number' && (
              <p className="px-cauzione">
                <span className="px-cauzione-riga">
                  <b>Cauzione da bloccare al ritiro</b>
                  <b className="px-cifra">{euroTondo(protezioneMostrata.cauzione)}</b>
                </span>
                {typeof protezioneMostrata.danni === 'number' && (
                  <>{protezioneMostrata.danni === 0
                    ? 'In caso di danno il cliente non paga nulla.'
                    : <>In caso di danno il cliente paga al massimo <span className="px-cifra">{euroTondo(protezioneMostrata.danni)}</span>.</>}</>
                )}
              </p>
            )}
            {preventivo?.errore && <p className="np-manca" role="alert">{preventivo.errore}</p>}
          </div>

          <button type="submit" className="np-conferma" disabled={salvando}>
            {salvando ? 'Salvataggio…' : bookingId ? 'Salva modifiche' : 'Conferma prenotazione'}
          </button>
          {tentato && erroriElenco.length > 0 ? (
            <p className="np-manca" role="alert">Manca ancora: {erroriElenco.join(', ')}.</p>
          ) : (
            !bookingId && dati.dataInizio && (
              <p className="np-dopo">Il {formattaData(dati.dataInizio)} la trovi in Dashboard, sotto «Da consegnare al cliente».</p>
            )
          )}
          {onAnnulla && (
            <button type="button" className="np-annulla" onClick={onAnnulla} disabled={salvando}>Annulla</button>
          )}
        </aside>
      </div>

      <ClienteFormModal
        isOpen={showAddClient}
        clienti={clienti}
        onClose={() => setShowAddClient(false)}
        onSalva={salvaNuovoCliente}
        sopra
      />
    </form>
  );
}

export default BookingForm;
