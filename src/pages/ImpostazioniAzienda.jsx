import React, { useState, useEffect, useCallback } from 'react';
import './ImpostazioniAzienda.css';
import {
  Download, KeyRound, Clock, CheckCircle, AlertTriangle, Building2, Save, DatabaseBackup, History, ChevronsUpDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAzienda, salvaAzienda, salvaAspettoAzienda } from '../lib/firestoreAzienda';
import AspettoDocumenti from '../components/AspettoDocumenti';
import SezioneImpostazioni from '../components/SezioneImpostazioni';
import OrariSede from '../components/OrariSede';
import { leggiDatiPerBackup } from '../lib/backupDati';
import {
  AZIENDA_VUOTA, validaAzienda, aziendeUguali, normalizzaAzienda, campiCambiati,
} from '../utils/azienda';
import { nomeFileBackup, riepilogoBackup } from '../utils/backup';

const CAMPI = [
  { nome: 'nome', etichetta: 'Nome azienda', obbligatorio: true, largo: true },
  { nome: 'partitaIva', etichetta: 'Partita IVA / Codice fiscale' },
  { nome: 'telefono', etichetta: 'Telefono', tipo: 'tel' },
  { nome: 'email', etichetta: 'Email', tipo: 'email' },
  { nome: 'pec', etichetta: 'PEC', tipo: 'email' },
  {
    nome: 'emailNotifiche', etichetta: 'Email per gli avvisi del sito', tipo: 'email', largo: true,
    aiuto: "Qui arriva un avviso ogni volta che un cliente prenota e paga dal sito. Se la lasci vuota si usa l'email dell'azienda.",
  },
  { nome: 'indirizzo', etichetta: 'Indirizzo', largo: true },
];
const ETICHETTE = { ...Object.fromEntries(CAMPI.map((c) => [c.nome, c.etichetta])), coloreAccento: 'Colore dei documenti', logo: 'Logo' };

const SEZIONI = ['dati', 'aspetto', 'orari', 'licenza', 'backup', 'recupero'];
const CHIAVE_APERTE = 'impostazioni-sezioni-aperte';
const leggiAperte = () => {
  try {
    const salvato = JSON.parse(window.localStorage.getItem(CHIAVE_APERTE) || '{}');
    return Object.fromEntries(SEZIONI.map((id) => [id, salvato?.[id] === true]));
  } catch {
    return Object.fromEntries(SEZIONI.map((id) => [id, false]));
  }
};

function ImpostazioniAzienda() {
  const navigate = useNavigate();
  // Quali schede sono aperte: si ricorda da una volta all'altra (solo su questo computer).
  const [aperte, setAperte] = useState(leggiAperte);
  const cambiaAperte = useCallback((fn) => setAperte((prima) => {
    const dopo = fn(prima);
    try { window.localStorage.setItem(CHIAVE_APERTE, JSON.stringify(dopo)); } catch { /* il ricordo e' facoltativo */ }
    return dopo;
  }), []);
  const toggle = (id) => () => cambiaAperte((a) => ({ ...a, [id]: !a[id] }));
  const tutteAperte = SEZIONI.every((id) => aperte[id]);
  const apriChiudiTutte = () => cambiaAperte(() => Object.fromEntries(SEZIONI.map((id) => [id, !tutteAperte])));
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
    <div className="imp">
      <div className="imp-toolbar">
        <h1 className="imp-titolo">Impostazioni</h1>
        <button type="button" className="imp-btn imp-btn--testo" onClick={apriChiudiTutte}>
          <ChevronsUpDown size={16} aria-hidden="true" /> {tutteAperte ? 'Chiudi tutte' : 'Apri tutte'}
        </button>
      </div>
      <p className="imp-intro">Dati dell&apos;azienda, orari della sede, licenza e copia di sicurezza dei dati.</p>

      <SezioneImpostazioni
        Icona={Building2}
        titolo="Dati dell'azienda"
        riassunto={[datiSalvati.nome, datiSalvati.telefono, datiSalvati.email].filter(Boolean).join(' · ') || 'Nome, partita IVA e contatti'}
        descrizione="Uguali su tutte le postazioni. Il nome compare in alto nel menu e nella Dashboard."
        stato={conflitto ? { testo: "Cambiato da un'altra postazione", tono: 'attenzione' } : modificato ? { testo: 'Modifiche non salvate', tono: 'attenzione' } : null}
        aperta={aperte.dati}
        onToggle={toggle('dati')}
      >
        {erroreLettura && (
          <div className="imp-avviso imp-avviso--errore" role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>Non riesco a leggere i dati dell&apos;azienda: controlla la connessione.</span>
          </div>
        )}
        {conflitto && (
          <div className="imp-avviso" role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            <div>
              <span>
                Mentre li modificavi, un&apos;altra postazione ha cambiato anche:{' '}
                {campiInConflitto.map((c) => `${ETICHETTE[c]} (ora "${datiSalvati[c] || 'vuoto'}")`).join(', ')}.
              </span>
              <div className="imp-avviso-azioni">
                <button type="button" className="imp-btn" onClick={annullaModifiche}>Carica i dati nuovi</button>
                <button type="button" className="imp-btn" onClick={tieniLeMie}>Tieni le mie modifiche</button>
              </div>
            </div>
          </div>
        )}

        <div className="imp-griglia">
          {CAMPI.map(({ nome, etichetta, tipo, obbligatorio, largo, aiuto }) => (
            <label key={nome} className={`imp-campo${largo ? ' imp-campo--largo' : ''}`}>
              <span className="imp-etichetta">{etichetta}{obbligatorio && <span className="imp-obbligatorio"> *</span>}</span>
              <input
                name={nome}
                type={tipo || 'text'}
                className={`imp-input${errori[nome] ? ' imp-input--errore' : ''}`}
                value={form[nome]}
                onChange={handleChange}
                disabled={!caricato}
                aria-invalid={Boolean(errori[nome])}
              />
              {aiuto && <span className="imp-aiuto">{aiuto}</span>}
              {errori[nome] && <span className="imp-errore">{errori[nome]}</span>}
            </label>
          ))}
        </div>

        <div className="imp-piede">
          {modificato && (
            <button type="button" className="imp-btn" onClick={annullaModifiche} disabled={salvando}>
              Annulla modifiche
            </button>
          )}
          <button
            type="button"
            className="imp-btn imp-btn--primario"
            onClick={salvaDati}
            disabled={!modificato || conflitto || salvando}
          >
            <Save size={16} aria-hidden="true" /> {salvando ? 'Salvataggio…' : 'Salva'}
          </button>
        </div>
      </SezioneImpostazioni>

      <AspettoDocumenti dati={datiSalvati} caricato={caricato} onSalva={salvaAspettoAzienda} aperta={aperte.aspetto} onToggle={toggle('aspetto')} />

      <OrariSede aperta={aperte.orari} onToggle={toggle('orari')} />

      <SezioneImpostazioni
        Icona={KeyRound}
        titolo="Licenza"
        riassunto={licenzaAttiva ? 'Licenza di questo computer attiva' : 'Versione di prova: inserisci il codice per attivarla'}
        descrizione="Licenza di questo computer."
        stato={{
          testo: licenzaAttiva ? 'Attiva' : 'Versione di prova',
          tono: licenzaAttiva ? 'ok' : 'attenzione',
          icona: licenzaAttiva ? <CheckCircle size={14} aria-hidden="true" /> : <Clock size={14} aria-hidden="true" />,
        }}
        aperta={aperte.licenza}
        onToggle={toggle('licenza')}
      >
        {!licenzaAttiva && (
          <div className="imp-riga">
            <input
              className="imp-input"
              value={codiceLicenza}
              onChange={(e) => setCodiceLicenza(e.target.value)}
              placeholder="Codice licenza"
              aria-label="Codice licenza"
            />
            <button type="button" className="imp-btn imp-btn--primario" onClick={attivaLicenza}>
              <KeyRound size={16} aria-hidden="true" /> Attiva
            </button>
          </div>
        )}
      </SezioneImpostazioni>

      <SezioneImpostazioni
        Icona={DatabaseBackup}
        titolo="Backup dei dati"
        riassunto="Scarica una copia di tutti i dati in un file"
        descrizione="Scarica in un file una copia di veicoli, prenotazioni, clienti, categorie, tariffe e dati dell'azienda. Le foto restano online: nel file ci sono i loro collegamenti."
        aperta={aperte.backup}
        onToggle={toggle('backup')}
      >
        <div className="imp-piede imp-piede--sinistra">
          <button type="button" className="imp-btn imp-btn--primario" onClick={scaricaBackup} disabled={preparandoBackup}>
            <Download size={16} aria-hidden="true" /> {preparandoBackup ? 'Preparazione…' : 'Scarica backup'}
          </button>
        </div>
      </SezioneImpostazioni>

      <SezioneImpostazioni
        Icona={History}
        titolo="Dati della versione precedente"
        riassunto="Recupera i dati salvati sul computer dalla versione precedente"
        descrizione="Recupera veicoli, prenotazioni, clienti, foto e contratti salvati sul computer dalla versione precedente del gestionale."
        aperta={aperte.recupero}
        onToggle={toggle('recupero')}
      >
        <div className="imp-piede imp-piede--sinistra">
          <button type="button" className="imp-btn" onClick={() => navigate('/recupero-dati')}>
            <History size={16} aria-hidden="true" /> Apri il recupero dati
          </button>
        </div>
      </SezioneImpostazioni>
    </div>
  );
}

export default ImpostazioniAzienda;
