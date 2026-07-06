// src/pages/Clients.jsx
import React, { useState, useEffect,useRef } from 'react';
import './Clients.css';
import ModalEditClient from '../components/ModalEditClient';
import { setClienti, addCliente, updateCliente, deleteCliente } from '../store/clientiSlice';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { Edit2,Trash2,Info,PlusIcon, Search } from 'lucide-react';
import ModalDettaglioCliente from '../components/ModalDettaglioCliente';
import {setPrenotazioni} from '../store/prenotazioniSlice';
import ConfirmDialog from '../components/ConfirmDialog';

const DOCUMENT_TYPE_OPTIONS = [
  { value: 'CI', label: "Carta d'Identita" },
  { value: 'Patente', label: 'Patente' },
  { value: 'Passaporto', label: 'Passaporto' },
  { value: 'Permesso di soggiorno', label: 'Permesso di soggiorno' },
  { value: 'Tessera sanitaria', label: 'Tessera sanitaria' },
  { value: 'Altro', label: 'Altro' },
];

const DOCUMENT_TYPE_VALUES = DOCUMENT_TYPE_OPTIONS.map((option) => option.value);


function Clients() {  
  const clienti = useSelector((state) => state.clienti);
  const dispatch = useDispatch();
  const[dettaglioCliente, setDettaglioCliente] = useState(null);
  const [isDettaglioOpen, setIsDettaglioOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const[patenteScaduta,setPatenteScaduta] = useState(false);
  const[documentoScaduto,setDocumentoScaduto] = useState(false);
  const [termineRicerca, setTermineRicerca] = useState('');
  const [filtroAttivo, setFiltroAttivo] = useState('');
  const tabellaRef = useRef(null);
  const [clienteDaEliminare, setClienteDaEliminare] = useState(null);
  const [mostraDialogEliminazione, setMostraDialogEliminazione] = useState(false);
  const [mostraFormAggiunta, setMostraFormAggiunta] = useState(false);
  const [paginaClienti, setPaginaClienti] = useState(1);
  const righePerPagina = 10;
  const [formData, setFormData] = useState({
    nome: '',
    cognome: '',
    email: '',
    telefono: '',
    indirizzo: '',
    nazione: '',
    dataNascita: '',
    luogoNascita: '',
    tipoDocumento: '',
    tipoDocumentoAltro: '',
    documento: '',
    scadenzaDocumento: '',
    codiceFiscale: '',
    patente: '',
    piva: '',
    isAzienda: false,
  });
  
const chiediConfermaEliminazione = (cliente) => {
  setClienteDaEliminare(cliente);
  setMostraDialogEliminazione(true);
};

const caricaClienti = async () => {
  try {
    const dati = await window.electronAPI.readClienti();
    const clientiConDanni = (dati || []).map(cliente => ({
      ...cliente,
      storicoDanni: cliente.storicoDanni || []
    }));
    dispatch(setClienti(clientiConDanni));
  } catch (err) {
    console.error("Errore nel caricamento clienti:", err);
  }
};

const clientiFiltrati = clienti.filter(cliente => {
  if (!filtroAttivo) return true;
  const testo = `${cliente.nome} ${cliente.cognome} ${cliente.email} ${cliente.telefono}`.toLowerCase();
  return testo.includes(filtroAttivo);
});

const numeroPagine = Math.ceil(clientiFiltrati.length / righePerPagina);
const clientiDaMostrare = clientiFiltrati.slice(
  (paginaClienti - 1) * righePerPagina,
  paginaClienti * righePerPagina
);


const handleRicerca = (e) => {
  e.preventDefault();
  setFiltroAttivo(termineRicerca.trim().toLowerCase()); 
  setPaginaClienti(1);
  
  // Scroll dopo un piccolo delay per assicurarsi che la tabella sia visibile
  setTimeout(() => {
    if (tabellaRef.current) {
      tabellaRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, 100);
};


    useEffect(() => {
    const caricaPrenotazioni = async () => {
      try {
        const dati = await window.electronAPI.readPrenotazioni();
        dispatch(setPrenotazioni(dati || []));
      } catch (err) {
        console.error("Errore nel caricamento prenotazioni:", err);
      }
    };    

    caricaPrenotazioni();
    caricaClienti();
  }, [dispatch]);

  
 const handleInfo = (cliente) => {
  setDettaglioCliente(cliente);
  setIsDettaglioOpen(true);
 }
 
const handleChange = (e) => {
  const { name, value } = e.target;

  if (name === "scadenzaPatente") {
    const isExpired = new Date(value) < new Date();
    setPatenteScaduta(isExpired);
  }

  if (name === 'tipoDocumento' && value !== 'Altro') {
    setFormData({ ...formData, tipoDocumento: value, tipoDocumentoAltro: '' });
    return;
  }

  setFormData({ ...formData, [name]: value });
};

const normalizzaCodiceFiscale = (value) => (value || '').trim().toUpperCase();

  const handleSubmit = async (e) => {
    e.preventDefault();

    const codiceFiscaleNormalizzato = normalizzaCodiceFiscale(formData.codiceFiscale);
    const patenteNormalizzata = (formData.patente || '').trim();

    if (!patenteNormalizzata) {
      toast.error("Inserisci la patente prima di salvare il cliente.");
      return;
    }

    const codiceFiscaleDuplicato = (clienti || []).some(
      (cliente) => normalizzaCodiceFiscale(cliente.codiceFiscale) === codiceFiscaleNormalizzato
    );

    if (codiceFiscaleDuplicato) {
      toast.error("Esiste gia un cliente con questo codice fiscale.");
      return;
    }

    try {
      const tipoDocumentoFinale =
        formData.tipoDocumento === 'Altro'
          ? (formData.tipoDocumentoAltro || '').trim()
          : formData.tipoDocumento;
      const nuovoCliente = {
        ...formData,
        codiceFiscale: codiceFiscaleNormalizzato,
        patente: patenteNormalizzata,
        tipoDocumento: tipoDocumentoFinale,
        storicoDanni: [],
      };
      const nuovaLista = [...(clienti || []), nuovoCliente];
      
      // Prima salva su disco
      const success = await window.electronAPI.writeClienti(nuovaLista);
      if (!success) {
        throw new Error('Salvataggio fallito');
      }
      // Poi aggiorna lo stato
      dispatch(addCliente(nuovoCliente));
      toast.success("Cliente salvato con successo.");
      
      // Resetta il form
      setFormData({
        nome: '',
        cognome: '',
        email: '',
        telefono: '',
        tipoDocumento: '',
        tipoDocumentoAltro: '',
        documento: '',
        codiceFiscale: '',
        patente: '',
      });
    } catch (err) {
      console.error("Errore salvataggio cliente:", err);
      toast.error("Errore durante il salvataggio del cliente");
    }
  };

 const handleDelete = async () => {
  try {
    const updated = clienti.filter(c => c !== clienteDaEliminare);
    dispatch(deleteCliente(clienti.indexOf(clienteDaEliminare)));
    await window.electronAPI.writeClienti(updated);
    toast.success("Cliente eliminato con successo");
  } catch (err) {
    toast.error("Errore durante l'eliminazione");
  } finally {
    setMostraDialogEliminazione(false);
    setClienteDaEliminare(null);
  }
};

  

  const handleEdit = (index) => {
    const cliente = clienti[index];
    const tipoDocumentoEsistente = cliente.tipoDocumento || '';
    const isTipoPersonalizzato =
      tipoDocumentoEsistente && !DOCUMENT_TYPE_VALUES.includes(tipoDocumentoEsistente);

    setEditingClient({
      ...cliente,
      tipoDocumento: isTipoPersonalizzato ? 'Altro' : tipoDocumentoEsistente,
      tipoDocumentoAltro: isTipoPersonalizzato ? tipoDocumentoEsistente : (cliente.tipoDocumentoAltro || ''),
      index,
    });
    setIsModalOpen(true);
  };


    const isDocumentoScaduto = (dataScadenza) => {
  if (!dataScadenza) return false;
  return new Date(dataScadenza) < new Date();
};

const isPatenteScaduta = (dataScadenza) => {
  if (!dataScadenza) return false;
  return new Date(dataScadenza) < new Date();
};

  const handleSaveEdit = async () => {
    const tipoDocumentoFinale =
      editingClient.tipoDocumento === 'Altro'
        ? (editingClient.tipoDocumentoAltro || '').trim()
        : editingClient.tipoDocumento;
    const updated = {
      nome: editingClient.nome,
      cognome: editingClient.cognome,
      email: editingClient.email,
      telefono: editingClient.telefono,
      tipoDocumento: tipoDocumentoFinale,
      tipoDocumentoAltro: editingClient.tipoDocumento === 'Altro' ? (editingClient.tipoDocumentoAltro || '').trim() : '',
      documento: editingClient.documento,
      scadenzaDocumento: editingClient.scadenzaDocumento,
      rilascioDocumento: editingClient.rilascioDocumento,
      rilasciatoDaDocumento: editingClient.rilasciatoDaDocumento,
      codiceFiscale: editingClient.codiceFiscale,
      patente: editingClient.patente,
      storicoDanni: editingClient.storicoDanni || [],
    };

  
  
    dispatch(updateCliente({ index: editingClient.index, updated }));
    const nuovaLista = [...clienti];
    nuovaLista[editingClient.index] = updated;
  
    await window.electronAPI.writeClienti(nuovaLista); // <- SALVATAGGIO
    setIsModalOpen(false);
  };
  
  return (
    <div className="clienti-container">
      <h1 className="title">Gestione Clienti</h1>
      


      <form onSubmit={handleRicerca} style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
  <div style={{ position: 'relative', flex: 1 }}>
    <Search 
      size={18} 
      style={{
        position: 'absolute',
        top: '50%',
        left: '10px',
        transform: 'translateY(-50%)',
        color: '#888',
        pointerEvents: 'none'
      }} 
    />
    <input
      type="text"
      placeholder="Cerca per nome, cognome, email, targa..."
      value={termineRicerca}
      onChange={(e) => setTermineRicerca(e.target.value)}
      style={{
        width: '100%',
        padding: '0.5rem 0.5rem 0.5rem 2rem', // padding-left aumentato per l'icona
        fontSize: '1rem',
        borderRadius: '6px',
        border: '1px solid #ccc'
      }}
    />
  </div>
  <button type="submit" style={{
    padding: '0.5rem 1rem',
    fontSize: '1rem',
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer'
  }}>
    Cerca
  </button>
</form>

<div style={{ marginBottom: '1rem' }}>
  <button
    onClick={() => setMostraFormAggiunta(prev => !prev)}
    style={{
      padding: '0.5rem 1rem',
      fontSize: '1rem',
      backgroundColor: '#2563eb',
      color: '#fff',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer'
    }}
  >
   {mostraFormAggiunta ? 'Annulla' : (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
    <PlusIcon size={16} />
    Aggiungi Cliente
  </span>
)}
  </button>
</div>

{  mostraFormAggiunta && (
<form onSubmit={handleSubmit} className="client-form">

  {/* DATI CLIENTE */}
  <div className="form-section">
    <h3>Dati Cliente</h3>
    <div className="field-group">
      <input type="text" name="nome" placeholder="Nome" value={formData.nome} onChange={handleChange} required />
      <input type="text" name="cognome" placeholder="Cognome" value={formData.cognome} onChange={handleChange} required />
      <input type="text" name="codiceFiscale" placeholder="Codice Fiscale" value={formData.codiceFiscale} onChange={handleChange} required />
      <input type="text" name="indirizzo" placeholder="Indirizzo" value={formData.indirizzo} onChange={handleChange} />
      <input type="text" name="luogoNascita" placeholder="Luogo di nascita" value={formData.luogoNascita} onChange={handleChange} />
      <input type="date" name="dataNascita" placeholder="Data di nascita" value={formData.dataNascita} onChange={handleChange} />
    </div>
  </div>

  {/* CONTATTI */}
  <div className="form-section">
    <h3>Contatti</h3>
    <div className="field-group">
      <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} required />
      <input type="tel" name="telefono" placeholder="Telefono Fisso" value={formData.telefono} onChange={handleChange} />
      <input type="tel" name="cellulare" placeholder="Cellulare" value={formData.cellulare} onChange={handleChange} />
    </div>
  </div>

 {/* DOCUMENTI */}
<div className="form-section">
  <h3>Documento di Riconoscimento</h3>
  <div className="field-group">
    <div className="field">
      <label>Tipo Documento</label>
      <select name="tipoDocumento" value={formData.tipoDocumento} onChange={handleChange}>
        <option value="">Seleziona...</option>
        <option value="CI">Carta d'Identità</option>
        <option value="Patente">Patente</option>
        <option value="Passaporto">Passaporto</option>
        <option value="Permesso di soggiorno">Permesso di soggiorno</option>
        <option value="Tessera sanitaria">Tessera sanitaria</option>
        <option value="Altro">Altro</option>
      </select>
    </div>

    {formData.tipoDocumento === 'Altro' && (
      <div className="field">
        <label>Specifica Tipo Documento</label>
        <input
          type="text"
          name="tipoDocumentoAltro"
          value={formData.tipoDocumentoAltro || ''}
          onChange={handleChange}
          placeholder="Es. Carta professionale"
        />
      </div>
    )}

    <div className="field">
      <label>Numero Documento</label>
      <input type="text" name="documento" value={formData.documento} onChange={handleChange} />
    </div>

    <div className="field">
      <label>Rilasciato da</label>
      <input type="text" name="rilasciatoDaDocumento" value={formData.rilasciatoDaDocumento || ''} onChange={handleChange} />
    </div>

    <div className="field">
      <label>Data Rilascio</label>
      <input type="date" name="rilascioDocumento" value={formData.rilascioDocumento || ''} onChange={handleChange} />
    </div>

    <div className="field">
      <label>Data Scadenza</label>
      <input type="date" name="scadenzaDocumento" value={formData.scadenzaDocumento || ''} onChange={handleChange} />
      {documentoScaduto && (
  <span className="badge badge-error" style={{ marginTop: '4px' }}>
    ⚠️ Documento Scaduto
  </span>
)}

    </div>
  </div>

  <h3 style={{ marginTop: '1.5rem' }}>Patente di Guida</h3>
  <div className="field-group">
    <div className="field">
      <label>Numero Patente</label>
      <input type="text" name="patente" value={formData.patente} onChange={handleChange} required />
    </div>

    <div className="field">
      <label>Rilasciata da</label>
      <input type="text" name="rilasciataDaPatente" value={formData.rilasciataDaPatente || ''} onChange={handleChange} />
    </div>

    <div className="field">
      <label>Data Rilascio</label>
      <input type="date" name="rilascioPatente" value={formData.rilascioPatente || ''} onChange={handleChange} />
    </div>

    <div className="field">
      <label>Data Scadenza</label>
      <input type="date" name="scadenzaPatente" value={formData.scadenzaPatente || ''} onChange={handleChange} />
      {patenteScaduta && (
  <span className="badge badge-error" style={{ marginTop: '4px' }}>
    ⚠️ Patente scaduta
  </span>
)}

    </div>
  </div>
</div>


  {/* AZIENDA */}
  <div className="form-section">
    <h3>Dati Aziendali</h3>
    <div className="field-group">
      <input type="text" name="ragioneSociale" placeholder="Ragione Sociale" value={formData.ragioneSociale} onChange={handleChange} />
      <input type="text" name="piva" placeholder="Partita IVA" value={formData.piva} onChange={handleChange} />
      <input type="text" name="pec" placeholder="PEC" value={formData.pec} onChange={handleChange} />
      <input type="text" name="codiceUnivoco" placeholder="Codice Univoco SDI" value={formData.codiceUnivoco} onChange={handleChange} />
    </div>
  </div>

  <button type="submit" className="save-btn">Salva Cliente</button>
</form>
)}



  <>
    <table className="client-table" ref={tabellaRef}>
      <thead>
        <tr>
          <th>Nome</th>
          <th>Cognome</th>
          <th>Email</th>
          <th>Telefono</th>
          <th>Patente</th>
          <th>Azioni</th>
        </tr>
      </thead>
      <tbody>
        {clientiDaMostrare.map((cliente, index) => (
            <tr key={index}>
              <td>{cliente.nome}</td>
              <td>{cliente.cognome}</td>
              <td>{cliente.email}</td>
              <td>{cliente.telefono}</td>
              <td>
                {cliente.patente}
                {isPatenteScaduta(cliente.scadenzaPatente) && (
                  <div style={{ color: 'red', fontSize: '0.6rem', marginTop: '4px' }}>
                    doc scaduto
                  </div>
                )}
              </td>
              <td>
                <div className="action-btn-group">
                      <button onClick={() => handleInfo(cliente)} className="action-btn info-btn">
                    <Info size={14} />
                  </button>
                  <button onClick={() => handleEdit(index)} className="action-btn edit-btn">
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => chiediConfermaEliminazione(cliente)}
                    className="action-btn delete-btn"
                  >
                    <Trash2 size={18} />
                  </button>
              
                </div>
              </td>
            </tr>
          ))}
      </tbody>
    </table>

    <div className="pagination">
{[...Array(numeroPagine)].map((_, i) => (
  <button
    key={i}
    className={paginaClienti === i + 1 ? 'active' : ''}
    onClick={() => setPaginaClienti(i + 1)}
  >
    {i + 1}
  </button>
))}
    </div>
  </>



      <ModalEditClient
        show={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveEdit}
        clientData={editingClient || {}}
        setClientData={setEditingClient}
      />
 { dettaglioCliente &&(
  <ModalDettaglioCliente
        show={isDettaglioOpen}
        onClose={() => setIsDettaglioOpen(false)}
        cliente={dettaglioCliente}
      />
 )}
     
 <ConfirmDialog
  open={mostraDialogEliminazione}
  onCancel={() => setMostraDialogEliminazione(false)}
  onConfirm={handleDelete}
  message={`Sei sicuro di voler eliminare il cliente "${clienteDaEliminare?.nome} ${clienteDaEliminare?.cognome}"?`}
/>

    </div>
  );
}

export default Clients;
