import React, { useState } from 'react';


function AutocompleteClienti({ clienti, onSelect }) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  const handleChange = (e) => {
    const value = e.target.value;
    setInputValue(value);

    if (value.length > 1) {
      const filtered = clienti.filter((cliente) => {
        const fullName = `${cliente.nome} ${cliente.cognome}`.toLowerCase();
        return fullName.includes(value.toLowerCase()) || cliente.email.toLowerCase().includes(value.toLowerCase());
      });
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  const handleSelect = (cliente) => {
    setInputValue(`${cliente.nome} ${cliente.cognome}`);
    setSuggestions([]);
    onSelect(cliente);
  };

  return (
    <div className="autocomplete-container">
      <input
        type="text"
        placeholder="Cerca cliente..."
        value={inputValue}
        onChange={handleChange}
      />
      {suggestions.length > 0 && (
        <ul className="suggestions-list">
          {suggestions.map((cliente, index) => (
            <li key={index} onClick={() => handleSelect(cliente)}>
              {cliente.nome} {cliente.cognome} - {cliente.email}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default AutocompleteClienti;
