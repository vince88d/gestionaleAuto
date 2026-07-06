import React, { useEffect, useState } from 'react';


function AutocompleteClienti({ clienti, onSelect, onInputChange, initialValue = '' }) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    setInputValue(initialValue || '');
  }, [initialValue]);

  const handleChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    if (onInputChange) {
      onInputChange(value);
    }

    if (value.length > 1) {
      const filtered = clienti.filter((cliente) => {
        const fullName = `${cliente.nome} ${cliente.cognome}`.toLowerCase();
        return (
          fullName.includes(value.toLowerCase()) ||
          (cliente.email || '').toLowerCase().includes(value.toLowerCase())
        );
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
        className="autocomplete-input"
        autoComplete="off"
      />
      {suggestions.length > 0 && (
        <ul className="suggestions-list">
          {suggestions.map((cliente, index) => (
            <li
              key={index}
              onClick={() => handleSelect(cliente)}
              className="suggestion-item"
              title="Seleziona cliente"
            >
              <span className="suggestion-name">
                {cliente.nome} {cliente.cognome}
              </span>
              <span className="suggestion-email">{cliente.email}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default AutocompleteClienti;
