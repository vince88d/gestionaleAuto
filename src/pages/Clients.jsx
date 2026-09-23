// src/pages/Clients.jsx
import React, { useState, useRef } from 'react';
import './Clients.css';
import ModalEditClient from '../components/ModalEditClient';
import ClientForm from '../components/ClientForm';
import { addCliente, updateCliente, deleteCliente } from '../store/clientiSlice';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { Edit2,Trash2,Info,PlusIcon, Search } from 'lucide-react';
import ModalDettaglioCliente from '../components/ModalDettaglioCliente';
import { creaCliente, aggiornaCliente, eliminaCliente, messaggioErroreCliente } from '../lib/firestoreClienti';
import { preparaCliente, clientePerForm, validaCliente, prenotazioniDelCliente } from '../utils/validaCliente';
import ConfirmDialog from '../components/ConfirmDialog';

const FORM_VUOTO = {
  nome: '',
  cognome: '',
  email: '',
  telefono: '',
  cellulare: '',
  indirizzo: '',
  dataNascita: '',
  luogoNascita: '',
  tipoDocumento: '',
  tipoDocumentoAltro: '',
  documento: '',
  rilasciatoDaDocumento: '',
  rilascioDocumento: '',
  scadenzaDocumento: '',
  codiceFiscale: '',
  patente: '',
  rilasciataDaPatente: '',
  rilascioPatente: '',
  scadenzaPatente: '',
  ragioneSociale: '',
  piva: '',
  pec: '',
  codiceUnivoco: '',
};

// Primo messaggio di errore, da mostrare in un avviso.
const primoErrore = (errori) => Object.values(errori)[0];

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
  const [formData, setFormData] = useState(FORM_VUOTO);
  const [salvando, setSalvando] = useState(false);
  const prenotazioni = useSelector((state) => state.prenotazioni);
  // Modifica con codice fiscale cambiato: si chiede conferma prima di
  // aggiornare anche le prenotazioni del cliente.
  const [cambioCodiceFiscale, setCambioCodiceFiscale] = useState(null);
  
const chiediConfermaEliminazione = (cliente) => {
  setClienteDaEliminare(cliente);
  setMostraDialogEliminazione(true);
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


  // Clienti e prenotazioni arrivano in tempo reale da App.js.

  
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

  // Nuovo cliente: solo il suo documento (prima si riscrivevano tutti i
  // clienti e si cancellavano quelli creati da un'altra postazione).
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (salvando) return;
    const nuovo = preparaCliente(formData);
    const errori = validaCliente(nuovo, clienti);
    if (Object.keys(errori).length > 0) {
      toast.error(primoErrore(errori));
      return;
    }
    setSalvando(true);
    try {
      const salvato = await creaCliente(nuovo);
      dispatch(addCliente(salvato));
      toast.success(`Cliente ${salvato.nome} ${salvato.cognome} salvato.`);
      setFormData(FORM_VUOTO);
      setPatenteScaduta(false);
      setMostraFormAggiunta(false);
    } catch (err) {
      console.error("Errore salvataggio cliente:", err);
      toast.error(messaggioErroreCliente(err, "Errore durante il salvataggio del cliente"));
    } finally {
      setSalvando(false);
    }
  };

  const handleDelete = async () => {
    const cliente = clienteDaEliminare;
    setMostraDialogEliminazione(false);
    setClienteDaEliminare(null);
    if (!cliente?.id) return;
    try {
      await eliminaCliente(cliente.id);
      dispatch(deleteCliente(cliente.id));
      toast.success("Cliente eliminato.");
    } catch (err) {
      console.error("Errore eliminazione cliente:", err);
      toast.error("Errore durante l'eliminazione");
    }
  };

  // Si apre il cliente cliccato (prima si usava la sua posizione nella
  // pagina, che con la ricerca o dalla pagina 2 era quella di un altro).
  const handleEdit = (cliente) => {
    setEditingClient(clientePerForm(cliente));
    setIsModalOpen(true);
  };

  const isPatenteScaduta = (dataScadenza) => {
    if (!dataScadenza) return false;
    return new Date(dataScadenza) < new Date();
  };

  const salvaModifica = async (aggiornato, originale, prenotazioniDaAggiornare = []) => {
    setSalvando(true);
    try {
      const campi = await aggiornaCliente(originale.id, aggiornato, {
        prenotazioniDaAggiornare: prenotazioniDaAggiornare.map((p) => p.id),
      });
      dispatch(updateCliente({ id: originale.id, ...campi }));
      toast.success(
        prenotazioniDaAggiornare.length > 0
          ? `Cliente salvato; aggiornate anche ${prenotazioniDaAggiornare.length} prenotazioni.`
          : 'Cliente salvato.'
      );
      setIsModalOpen(false);
      setEditingClient(null);
    } catch (err) {
      console.error("Errore modifica cliente:", err);
      toast.error(messaggioErroreCliente(err, "Modifiche non salvate, riprova."));
    } finally {
      setSalvando(false);
    }
  };

  // Modifica: salva TUTTI i campi del form (prima se ne salvava solo una
  // parte e si perdevano indirizzo, scadenza patente, dati aziendali...).
  const handleSaveEdit = async () => {
    if (salvando || !editingClient) return;
    const originale = clienti.find((c) => c.id === editingClient.id);
    if (!originale) {
      toast.error('Il cliente non esiste più: forse è stato eliminato da un\'altra postazione.');
      return;
    }
    const aggiornato = preparaCliente(editingClient);
    const errori = validaCliente(aggiornato, clienti, originale.id);
    if (Object.keys(errori).length > 0) {
      toast.error(primoErrore(errori));
      return;
    }
    const collegate = aggiornato.codiceFiscale !== (originale.codiceFiscale || '').toUpperCase()
      ? prenotazioniDelCliente(originale.codiceFiscale, prenotazioni)
      : [];
    if (collegate.length > 0) {
      setCambioCodiceFiscale({ aggiornato, originale, collegate });
      return;
    }
    await salvaModifica(aggiornato, originale);
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
  <ClientForm
    formData={formData}
    onChange={handleChange}
    onSubmit={handleSubmit}
    patenteScaduta={patenteScaduta}
    documentoScaduto={documentoScaduto}
  />
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
        {filtroAttivo && clientiFiltrati.length === 0 && (
          <tr>
            <td colSpan={6} style={{ textAlign: 'center', padding: '1.5rem', color: '#888' }}>
              Nessun cliente trovato.
            </td>
          </tr>
        )}
        {clientiDaMostrare.map((cliente) => (
            <tr key={cliente.id}>
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
                  <button onClick={() => handleEdit(cliente)} className="action-btn edit-btn">
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
  message={`Sei sicuro di voler eliminare il cliente "${clienteDaEliminare?.nome} ${clienteDaEliminare?.cognome}"? Le sue prenotazioni restano.`}
  confirmLabel="Elimina"
  tone="danger"
/>

 <ConfirmDialog
  open={cambioCodiceFiscale !== null}
  onCancel={() => setCambioCodiceFiscale(null)}
  onConfirm={() => {
    const { aggiornato, originale, collegate } = cambioCodiceFiscale;
    setCambioCodiceFiscale(null);
    salvaModifica(aggiornato, originale, collegate);
  }}
  title="Cambiare il codice fiscale?"
  message={cambioCodiceFiscale
    ? `${cambioCodiceFiscale.collegate.length === 1 ? 'C\'è 1 prenotazione' : `Ci sono ${cambioCodiceFiscale.collegate.length} prenotazioni`} con il vecchio codice fiscale (${cambioCodiceFiscale.originale.codiceFiscale}). Le aggiorno con quello nuovo (${cambioCodiceFiscale.aggiornato.codiceFiscale}), così lo storico noleggi resta del cliente.`
    : ''}
  confirmLabel="Aggiorna tutto"
/>

    </div>
  );
}

export default Clients;
