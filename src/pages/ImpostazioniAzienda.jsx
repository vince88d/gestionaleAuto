import React, { useState, useEffect } from 'react';
import './ImpostazioniAzienda.css';
import { Download, KeyRound, Clock } from 'lucide-react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAzienda, salvaAzienda } from '../lib/firestoreAzienda';
import { leggiDatiPerBackup } from '../lib/backupDati';
import {
  AZIENDA_VUOTA, validaAzienda, aziendeUguali, normalizzaAzienda, campiCambiati,
} from '../utils/azienda';
import { nomeFileBackup, riepilogoBackup } from '../utils/backup';

const CAMPI = [
  { nome: 'nome', etichetta: 'Nome azienda', obbligatorio: true },
  { nome: 'partitaIva', etichetta: 'Partita IVA / Codice fiscale' },
  { nome: 'email', etichetta: 'Email', tipo: 'email' },
  { nome: 'pec', etichetta: 'PEC', tipo: 'email' },
  { nome: 'telefono', etichetta: 'Telefono', tipo: 'tel' },
  { nome: 'indirizzo', etichetta: 'Indirizzo' },
];
const ETICHETTE = Object.fromEntries(CAMPI.map((c) => [c.nome, c.etichetta]));

function ImpostazioniAzienda() {
  const { dati: datiSalvati, caricato, errore: erroreLettura } = useAzienda();

  // `base` = i dati da cui e' partita la modifica. Se quelli salvati cambiano
  // (un'altra postazione) mentre si sta scrivendo, e' un conflitto: non si
  // salva sopra in silenzio.
  const [form, setForm] = useState(AZIENDA_VUOTA);
  const [base, setBase] = useState(AZIENDA_VUOTA);
  const [errori, setErrori] = useState({});
  const [salvando, setSalvando] = useState(false);

  const modificato = !aziendeUguali(form, base);
  // Conflitto solo sui campi che si stanno modificando e che un'altra
  // postazione ha cambiato nel frattempo. Durante il salvataggio arriva la
  // nostra stessa modifica: non e' un conflitto.
  const campiInConflitto = salvando ? [] : campiCambiati(base, datiSalvati).filter((c) => campiCambiati(base, form).includes(c));
  const conflitto = campiInConflitto.length > 0;

  // Quando cambiano i dati salvati: i campi che non si stanno modificando
  // prendono subito il valore nuovo (anche a meta' modifica), quelli in
  // modifica restano come li si sta scrivendo.
  useEffect(() => {
    setForm((formAttuale) => {
      const toccati = campiCambiati(base, formAttuale);
      const unito = { ...datiSalvati };
      toccati.forEach((c) => { unito[c] = formAttuale[c]; });
      return unito;
    });
    setBase((baseAttuale) => {
      const nuova = { ...datiSalvati };
      campiCambiati(baseAttuale, form).forEach((c) => { nuova[c] = baseAttuale[c]; });
      return nuova;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datiSalvati]);

  const [licenzaAttiva, setLicenzaAttiva] = useState(false);
  const [codiceLicenza, setCodiceLicenza] = useState('');
  const [preparandoBackup, setPreparandoBackup] = useState(false);

  useEffect(() => {
    window.electronAPI.getLicenseStatus()
      .then((license) => setLicenzaAttiva(license?.status === 'licensed'))
      .catch(() => setLicenzaAttiva(false));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrori((prev) => ({ ...prev, [name]: undefined }));
  };

  const annullaModifiche = () => {
    setForm(datiSalvati);
    setBase(datiSalvati);
    setErrori({});
  };

  // Conflitto: nei campi contesi vincono le proprie modifiche.
  const tieniLeMie = () => setBase((prec) => {
    const nuova = { ...prec };
    campiInConflitto.forEach((c) => { nuova[c] = datiSalvati[c]; });
    return nuova;
  });

  const salvaDati = async () => {
    const trovati = validaAzienda(form);
    setErrori(trovati);
    if (Object.keys(trovati).length > 0) return;

    setSalvando(true);
    try {
      await salvaAzienda(form);
      const salvati = normalizzaAzienda(form);
      setForm(salvati);
      setBase(salvati);
      toast.success('Dati aziendali salvati.');
    } catch (error) {
      console.error('Errore salvataggio dati azienda:', error);
      toast.error('Non riesco a salvare i dati: controlla la connessione e riprova.');
    } finally {
      setSalvando(false);
    }
  };

  const scaricaBackup = async () => {
    setPreparandoBackup(true);
    try {
      const backup = await leggiDatiPerBackup();
      const res = await window.electronAPI.salvaBackup({
        nomeFile: nomeFileBackup(),
        contenuto: JSON.stringify(backup, null, 2),
      });
      if (res.success) {
        toast.success(<div>Backup salvato ({riepilogoBackup(backup)}) in:<br />{res.path}</div>);
      } else if (!res.annullato) {
        toast.error(`Errore salvataggio backup: ${res.error}`);
      }
    } catch (error) {
      console.error('Errore backup:', error);
      toast.error('Non riesco a leggere i dati per il backup: controlla la connessione e riprova.');
    } finally {
      setPreparandoBackup(false);
    }
  };

  const attivaLicenza = async () => {
    const codice = codiceLicenza.trim();
    if (!codice) {
      toast.error('Inserisci un codice di licenza valido.');
      return;
    }

    // Nome gia' salvato, non quello eventualmente in modifica nel form.
    const res = await window.electronAPI.activateLicense(codice, datiSalvati.nome);
    if (res.success) {
      toast.success("Licenza attivata! Riavvia l'app per applicare le modifiche.");
      setLicenzaAttiva(true);
      return;
    }

    toast.error(`Errore attivazione licenza: ${res.error}`);
  };

  return (
    <div className="impostazioni-container">
      <h2>Impostazioni Azienda</h2>
      {erroreLettura && (
        <small className="settings-hint settings-hint-warning">
          Non riesco a leggere i dati dell&apos;azienda: controlla la connessione.
        </small>
      )}
      {conflitto && (
        <div className="settings-hint settings-hint-warning">
          Mentre li modificavi, un&apos;altra postazione ha cambiato anche:{' '}
          {campiInConflitto.map((c) => `${ETICHETTE[c]} (ora "${datiSalvati[c] || 'vuoto'}")`).join(', ')}.
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <button type="button" onClick={annullaModifiche}>Carica i dati nuovi</button>
            <button type="button" onClick={tieniLeMie}>Tieni le mie modifiche</button>
          </div>
        </div>
      )}
      {CAMPI.map(({ nome, etichetta, tipo, obbligatorio }) => (
        <label key={nome}>
          {etichetta}{obbligatorio ? ' *' : ''}
          <input
            name={nome}
            type={tipo || 'text'}
            value={form[nome]}
            onChange={handleChange}
            disabled={!caricato}
          />
          {errori[nome] && <small className="settings-hint settings-hint-warning">{errori[nome]}</small>}
        </label>
      ))}
      <button onClick={salvaDati} disabled={!modificato || conflitto || salvando}>
        {salvando ? 'Salvataggio…' : 'Salva'}
      </button>
      {modificato && (
        <button type="button" onClick={annullaModifiche} disabled={salvando}>Annulla modifiche</button>
      )}

      <hr />

      <h3>Licenza</h3>
      <p style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {licenzaAttiva ? (
          <>
            <KeyRound size={18} color="green" /> <span>Licenza Attiva</span>
          </>
        ) : (
          <>
            <Clock size={18} color="orange" /> <span>Versione di Prova</span>
          </>
        )}
      </p>
      {!licenzaAttiva && (
        <>
          <input
            value={codiceLicenza}
            onChange={(e) => setCodiceLicenza(e.target.value)}
            placeholder="Inserisci codice licenza"
          />
          <button onClick={attivaLicenza} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <KeyRound size={18} /> Attiva Licenza
          </button>
        </>
      )}

      <hr />
      <h3>Backup dei dati</h3>
      <p>
        Scarica in un file una copia di veicoli, prenotazioni, clienti, categorie, tariffe e dati
        dell&apos;azienda. Le foto restano online: nel file ci sono i loro collegamenti.
      </p>
      <button onClick={scaricaBackup} disabled={preparandoBackup} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Download size={18} /> {preparandoBackup ? 'Preparazione…' : 'Scarica backup'}
      </button>
    </div>
  );
}

export default ImpostazioniAzienda;
