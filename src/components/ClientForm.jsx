import React from 'react';
import '../pages/Clients.css';

function ClientForm({ formData, onChange, onSubmit, patenteScaduta = false, documentoScaduto = false, submitLabel = 'Salva Cliente' }) {
  return (
    <form onSubmit={onSubmit} className="client-form">

      {/* DATI CLIENTE */}
      <div className="form-section">
        <h3>Dati Cliente</h3>
        <div className="field-group">
          <input type="text" name="nome" placeholder="Nome" value={formData.nome} onChange={onChange} required />
          <input type="text" name="cognome" placeholder="Cognome" value={formData.cognome} onChange={onChange} required />
          <input type="text" name="codiceFiscale" placeholder="Codice Fiscale" value={formData.codiceFiscale} onChange={onChange} required />
          <input type="text" name="indirizzo" placeholder="Indirizzo" value={formData.indirizzo} onChange={onChange} />
          <input type="text" name="luogoNascita" placeholder="Luogo di nascita" value={formData.luogoNascita} onChange={onChange} />
          <input type="date" name="dataNascita" placeholder="Data di nascita" value={formData.dataNascita} onChange={onChange} />
        </div>
      </div>

      {/* CONTATTI */}
      <div className="form-section">
        <h3>Contatti</h3>
        <div className="field-group">
          <input type="email" name="email" placeholder="Email" value={formData.email} onChange={onChange} required />
          <input type="tel" name="telefono" placeholder="Telefono Fisso" value={formData.telefono} onChange={onChange} />
          <input type="tel" name="cellulare" placeholder="Cellulare" value={formData.cellulare} onChange={onChange} />
        </div>
      </div>

      {/* DOCUMENTI */}
      <div className="form-section">
        <h3>Documento di Riconoscimento</h3>
        <div className="field-group">
          <div className="field">
            <label>Tipo Documento</label>
            <select name="tipoDocumento" value={formData.tipoDocumento} onChange={onChange}>
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
                onChange={onChange}
                placeholder="Es. Carta professionale"
              />
            </div>
          )}

          <div className="field">
            <label>Numero Documento</label>
            <input type="text" name="documento" value={formData.documento} onChange={onChange} />
          </div>

          <div className="field">
            <label>Rilasciato da</label>
            <input type="text" name="rilasciatoDaDocumento" value={formData.rilasciatoDaDocumento || ''} onChange={onChange} />
          </div>

          <div className="field">
            <label>Data Rilascio</label>
            <input type="date" name="rilascioDocumento" value={formData.rilascioDocumento || ''} onChange={onChange} />
          </div>

          <div className="field">
            <label>Data Scadenza</label>
            <input type="date" name="scadenzaDocumento" value={formData.scadenzaDocumento || ''} onChange={onChange} />
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
            <input type="text" name="patente" value={formData.patente} onChange={onChange} required />
          </div>

          <div className="field">
            <label>Rilasciata da</label>
            <input type="text" name="rilasciataDaPatente" value={formData.rilasciataDaPatente || ''} onChange={onChange} />
          </div>

          <div className="field">
            <label>Data Rilascio</label>
            <input type="date" name="rilascioPatente" value={formData.rilascioPatente || ''} onChange={onChange} />
          </div>

          <div className="field">
            <label>Data Scadenza</label>
            <input type="date" name="scadenzaPatente" value={formData.scadenzaPatente || ''} onChange={onChange} />
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
          <input type="text" name="ragioneSociale" placeholder="Ragione Sociale" value={formData.ragioneSociale} onChange={onChange} />
          <input type="text" name="piva" placeholder="Partita IVA" value={formData.piva} onChange={onChange} />
          <input type="text" name="pec" placeholder="PEC" value={formData.pec} onChange={onChange} />
          <input type="text" name="codiceUnivoco" placeholder="Codice Univoco SDI" value={formData.codiceUnivoco} onChange={onChange} />
        </div>
      </div>

      <button type="submit" className="save-btn">{submitLabel}</button>
    </form>
  );
}

export default ClientForm;
