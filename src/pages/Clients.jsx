// src/pages/Clients.jsx
import React, { useState } from 'react';
import './Clients.css';
import ModalEditClient from '../components/ModalEditClient';

function Clients() {
  const [clienti, setClienti] = useState([]);
  const [formData, setFormData] = useState({
    nome: '',
    cognome: '',
    email: '',
    telefono: '',
    documento: ''
  });

  const [editingClient, setEditingClient] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setClienti([...clienti, formData]);
    setFormData({
      nome: '',
      cognome: '',
      email: '',
      telefono: '',
      documento: ''
    });
  };

  const handleDelete = (index) => {
    const updated = clienti.filter((_, i) => i !== index);
    setClienti(updated);
  };

  const handleEdit = (index) => {
    setEditingClient({ ...clienti[index], index });
    setIsModalOpen(true);
  };

  const handleSaveEdit = () => {
    const updated = [...clienti];
    updated[editingClient.index] = {
      nome: editingClient.nome,
      cognome: editingClient.cognome,
      email: editingClient.email,
      telefono: editingClient.telefono,
      documento: editingClient.documento
    };
    setClienti(updated);
    setIsModalOpen(false);
  };

  return (
    <div className="clienti-container">
      <h1 className="title">Gestione Clienti</h1>

      <form onSubmit={handleSubmit} className="client-form">
        <input type="text" name="nome" placeholder="Nome" value={formData.nome} onChange={handleChange} required />
        <input type="text" name="cognome" placeholder="Cognome" value={formData.cognome} onChange={handleChange} required />
        <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} required />
        <input type="tel" name="telefono" placeholder="Telefono" value={formData.telefono} onChange={handleChange} required />
        <input type="text" name="documento" placeholder="Numero Documento" value={formData.documento} onChange={handleChange} required />
        <button type="submit">Aggiungi Cliente</button>
      </form>

      <table className="client-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Cognome</th>
            <th>Email</th>
            <th>Telefono</th>
            <th>Documento</th>
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>
          {clienti.map((cliente, index) => (
            <tr key={index}>
              <td>{cliente.nome}</td>
              <td>{cliente.cognome}</td>
              <td>{cliente.email}</td>
              <td>{cliente.telefono}</td>
              <td>{cliente.documento}</td>
              <td>
                <button onClick={() => handleEdit(index)} className="edit-btn">Modifica</button>
                <button onClick={() => handleDelete(index)} className="delete-btn">Elimina</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ModalEditClient
        show={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveEdit}
        clientData={editingClient || {}}
        setClientData={setEditingClient}
      />
    </div>
  );
}

export default Clients;
