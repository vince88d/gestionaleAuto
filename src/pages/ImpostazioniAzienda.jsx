import React, { useState, useEffect } from 'react';
import './ImpostazioniAzienda.css';

function ImpostazioniAzienda() {
  const [azienda, setAzienda] = useState({
    nome: '',
    email: '',
    telefono: '',
    indirizzo: '',
  });

  useEffect(() => {
    const datiSalvati = JSON.parse(localStorage.getItem('datiAzienda'));
    if (datiSalvati) {
      setAzienda(datiSalvati);
    }
  }, []);

  const handleChange = (e) => {
    setAzienda({ ...azienda, [e.target.name]: e.target.value });
  };

  const salvaDati = () => {
    localStorage.setItem('datiAzienda', JSON.stringify(azienda));
    alert('Dati aziendali salvati correttamente!');
  };

  return (
    <div className="impostazioni-container">
      <h2>Impostazioni Azienda</h2>
      <input name="nome" value={azienda.nome} onChange={handleChange} placeholder="Nome azienda" />
      <input name="email" value={azienda.email} onChange={handleChange} placeholder="Email azienda" />
      <input name="telefono" value={azienda.telefono} onChange={handleChange} placeholder="Telefono azienda" />
      <input name="indirizzo" value={azienda.indirizzo} onChange={handleChange} placeholder="Indirizzo azienda" />
      <button onClick={salvaDati}>Salva Impostazioni</button>
    </div>
  );
}

export default ImpostazioniAzienda;
