import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { ascoltaAddebiti, salvaAddebiti } from '../lib/firestoreAddebiti';
import { ADDEBITI, addebitiPerForm, validaAddebiti } from '../utils/addebiti';
import { Campo, CampoEuro } from '../components/CampiForm';
import './CatalogoOptional.css';
import './AddebitiRientro.css';

// Scheda "Addebiti al rientro" di Tariffe e optional: i prezzi fissi che il
// gestionale propone, gia' compilati, quando si riceve l'auto. Si possono
// sempre cambiare caso per caso. Il ritardo e' automatico (non c'e' qui).
function AddebitiRientro() {
  const [salvati, setSalvati] = useState(null); // null = in caricamento
  const [form, setForm] = useState(null);
  const [errore, setErrore] = useState('');
  const [tentato, setTentato] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => ascoltaAddebiti(setSalvati, (e) => {
    console.error('Errore lettura addebiti:', e);
    setErrore('Non riesco a leggere i prezzi. Ricarica la pagina.');
  }), []);

  if (errore) return <p className="opt-errore">{errore}</p>;
  if (!salvati) return <p className="opt-nota">Caricamento…</p>;

  const valori = form ?? addebitiPerForm(salvati);
  const errori = tentato ? validaAddebiti(valori) : {};
  const partenza = addebitiPerForm(salvati);
  const cambiato = form !== null && ADDEBITI.some(({ chiave }) => form[chiave] !== partenza[chiave]);

  const salva = async (e) => {
    e.preventDefault();
    setTentato(true);
    if (Object.keys(validaAddebiti(valori)).length > 0) return;
    setSalvando(true);
    try {
      await salvaAddebiti(valori);
      setForm(null);
      setTentato(false);
      toast.success('Prezzi salvati.');
    } catch (err) {
      console.error('Errore salvataggio addebiti:', err);
      toast.error('Prezzi non salvati, riprova.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form className="opt" onSubmit={salva} noValidate aria-label="Addebiti al rientro">
      <section className="opt-box add-box">
        <div className="opt-box-testa">
          <h2 className="opt-box-titolo">Addebiti al rientro</h2>
        </div>
        <p className="opt-nota">
          Si scrivono una volta: quando ricevi l’auto vengono proposti già compilati e li puoi cambiare caso per caso.
        </p>
        <div className="add-campi">
          {ADDEBITI.map(({ chiave, nome, aiuto, unita }) => (
            <Campo key={chiave} id={`add-${chiave}`} titolo={nome} aiuto={aiuto} errore={errori[chiave]}>
              <div className="add-riga">
                <CampoEuro id={`add-${chiave}`} valore={valori[chiave]} onChange={(v) => setForm({ ...valori, [chiave]: v })} invalido={Boolean(errori[chiave])} />
                {unita !== '€' && <span className="add-unita">{unita.replace('€ ', '')}</span>}
              </div>
            </Campo>
          ))}
          <div className="opt-campo">
            <span className="opt-titolo-campo">Ritardo</span>
            <span className="opt-aiuto">
              Automatico: giorni in più × prezzo al giorno della prenotazione, oltre la tolleranza (la decidi in Impostazioni → Orari della sede).
            </span>
            <span className="add-auto">automatico</span>
          </div>
        </div>
        <div className="add-piede">
          <button type="submit" className="opt-btn opt-btn--salva" disabled={!cambiato || salvando}>
            {salvando ? 'Salvo…' : 'Salva'}
          </button>
        </div>
      </section>
    </form>
  );
}

export default AddebitiRientro;
