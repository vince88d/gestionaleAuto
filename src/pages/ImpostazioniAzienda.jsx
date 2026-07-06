import React, { useState, useEffect } from 'react';
import './ImpostazioniAzienda.css';
import { Download, Upload, KeyRound, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function ImpostazioniAzienda() {
  const [licenzaAttiva, setLicenzaAttiva] = useState(false);
  const [codiceLicenza, setCodiceLicenza] = useState('');
  const [backupStatus, setBackupStatus] = useState('');
  const [hasSavedPassword, setHasSavedPassword] = useState(false);
  const [azienda, setAzienda] = useState({
    nome: '',
    email: '',
    password: '',
    telefono: '',
    indirizzo: '',
  });

  useEffect(() => {
    const caricaImpostazioni = async () => {
      try {
        const [settings, license] = await Promise.all([
          window.electronAPI.getCompanySettings(),
          window.electronAPI.getLicenseStatus(),
        ]);

        setAzienda({
          nome: settings?.nome || '',
          email: settings?.email || '',
          password: '',
          telefono: settings?.telefono || '',
          indirizzo: settings?.indirizzo || '',
        });
        setHasSavedPassword(Boolean(settings?.hasPassword));
        setLicenzaAttiva(license?.status === 'licensed');
      } catch (error) {
        setLicenzaAttiva(false);
      }
    };

    caricaImpostazioni();
  }, []);

  const esportaBackup = async () => {
    const res = await window.electronAPI.esportaBackup();
    if (res.success) {
      toast.success(`Backup esportato in: ${res.path}`);
    } else {
      toast.error(`Errore: ${res.message || res.error}`);
    }
  };

  const importaBackup = async () => {
    const res = await window.electronAPI.importaBackup();
    if (res.success) {
      toast.success(<div>Backup importato da:<br />{res.path}<br />Riavvia l'app.</div>);
    } else {
      toast.error(`Errore importazione backup: ${res.message}`);
    }
  };

  const handleChange = (e) => {
    setAzienda((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const salvaDati = async () => {
    const res = await window.electronAPI.saveCompanySettings(azienda);
    if (!res.success) {
      toast.error(`Errore salvataggio impostazioni: ${res.error}`);
      return;
    }

    setAzienda((prev) => ({ ...prev, password: '' }));
    setHasSavedPassword(Boolean(res.settings?.hasPassword));
    toast.success('Dati aziendali salvati correttamente!');
  };

  const attivaLicenza = async () => {
    const codice = codiceLicenza.trim();
    if (!codice) {
      toast.error('Inserisci un codice di licenza valido.');
      return;
    }

    const res = await window.electronAPI.activateLicense(codice, azienda.nome);
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
      <input name="nome" value={azienda.nome} onChange={handleChange} placeholder="Nome azienda" />
      <input name="email" value={azienda.email} onChange={handleChange} placeholder="Email azienda" />
      <input
        type="password"
        name="password"
        value={azienda.password}
        onChange={handleChange}
        placeholder="Password email (o app password)"
      />
      {hasSavedPassword && (
        <small className="settings-hint settings-hint-warning">
          Password SMTP già salvata nel sistema. Lascia il campo vuoto per non cambiarla.
        </small>
      )}
      <small className="settings-hint settings-hint-info">
        Per Gmail usa una App Password, non la password normale dell&apos;account.
      </small>
      <input name="telefono" value={azienda.telefono} onChange={handleChange} placeholder="Telefono azienda" />
      <input name="indirizzo" value={azienda.indirizzo} onChange={handleChange} placeholder="Indirizzo azienda" />
      <button onClick={salvaDati}>Salva Impostazioni</button>

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
      <p>Puoi esportare i dati dell'applicazione per conservarli e ripristinarli in caso di problemi.</p>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
        <button onClick={esportaBackup} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Download size={18} /> Esporta Backup
        </button>
        <button onClick={importaBackup} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Upload size={18} /> Importa Backup
        </button>
      </div>

      {backupStatus && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: backupStatus.tipo === 'successo' ? 'green' : 'red',
          }}
        >
          {backupStatus.tipo === 'successo' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{backupStatus.messaggio}</span>
        </div>
      )}
    </div>
  );
}

export default ImpostazioniAzienda;
