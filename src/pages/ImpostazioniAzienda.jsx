import React, { useState, useEffect } from 'react';
import './ImpostazioniAzienda.css';
import { Download,Upload,KeyRound, Clock,CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';


function ImpostazioniAzienda() {
  const [licenzaAttiva, setLicenzaAttiva] = useState(false);
  const [codiceLicenza, setCodiceLicenza] = useState('');
  const [backupStatus, setBackupStatus] = useState('');
  const [azienda, setAzienda] = useState({
    nome: '',
    email: '',
    password: '',
    telefono: '',
    indirizzo: '',
  });
 



  useEffect(() => {
  const datiSalvati = JSON.parse(localStorage.getItem('datiAzienda'));
  if (datiSalvati) {
    setAzienda(datiSalvati);
  }
  // Verifica licenza attiva
  window.electronAPI.readFile('license.json').then(data => {
   if (data && data.unlocked === true && data.codice === 'XYZ123ABC2024') {
  setLicenzaAttiva(true);
} else {
  setLicenzaAttiva(false);
}

  }).catch(() => setLicenzaAttiva(false));
}, []);
 



const esportaBackup = async () => {
  const res = await window.electronAPI.esportaBackup();
  if (res.success) {
    toast.success( `Backup esportato in: ${res.path}` );
  } else {
    toast.error( `Errore: ${res.message || res.error}` );
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
    setAzienda({ ...azienda, [e.target.name]: e.target.value });
  };

  const salvaDati = () => {
    const pulito = { ...azienda, password: azienda.password.replace(/\s/g, '') };
    localStorage.setItem('datiAzienda', JSON.stringify(pulito));
    
    toast.success('Dati aziendali salvati correttamente!');
  };


  const attivaLicenza = async () => {
  const codice = codiceLicenza.trim();

  if (!codice) {
    toast.error('Inserisci un codice di licenza valido.');
    return;
  }

  if (codice === 'RESET14G') {
    const result = await window.electronAPI.resetTrial(codice);
    if (result.success) {
      toast.success("Trial resettato! Riavvia l'app.");
    } else {
      toast.error("Errore nel reset: " + result.message);
    }    
    return;
  }

  // ❗ Verifica che sia una licenza valida
  if (codice !== 'XYZ123ABC2024') {
     toast.error('Codice licenza non valido.');
    return;
  }

  const payload = {
    unlocked: true,
    attivatoIl: new Date().toISOString(),
    codice: codice,
    cliente: azienda.nome
  };

  const res = await window.electronAPI.salvaLicenza(payload);
  if (res.success) {
    toast.success('Licenza attivata! Riavvia l’app per applicare le modifiche.');
    setLicenzaAttiva(true);
  } else {
    toast.error('Errore attivazione licenza: ' + res.error);
  }
};


  return (
    <div className="impostazioni-container">

      <h2>Impostazioni Azienda</h2>
      <input name="nome" value={azienda.nome} onChange={handleChange} placeholder="Nome azienda" />
      <input name="email" value={azienda.email} onChange={handleChange} placeholder="Email azienda" />
      <input type="password" name="password" value={azienda.password} onChange={handleChange} placeholder="Password email (o app password)"/>
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
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: backupStatus.tipo === 'successo' ? 'green' : 'red' }}>
    {backupStatus.tipo === 'successo' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
    <span>{backupStatus.messaggio}</span>
  </div>
)}


    </div>
  );
}

export default ImpostazioniAzienda;
