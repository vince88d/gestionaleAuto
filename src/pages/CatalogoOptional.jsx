import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Plus, Pencil, X } from 'lucide-react';
import { ascoltaOptional, salvaOptional, togliOptional } from '../lib/firestoreOptional';
import {
  OPTIONAL_VUOTO, validaOptional, testoPrezzo, esempioPrezzo, ordinaOptional,
} from '../utils/optional';
import ConfirmDialog from '../components/ConfirmDialog';
import './CatalogoOptional.css';

// Dal catalogo salvato ai campi del form (numeri come testo, vuoti per "nessuno").
const perForm = (o) => ({
  id: o.id,
  nome: o.nome,
  descrizione: o.descrizione,
  modo: o.modo,
  prezzo: String(o.prezzo ?? ''),
  massimo: o.massimo ? String(o.massimo) : '',
  maxPerNoleggio: String(o.maxPerNoleggio ?? 1),
  pezzi: o.pezzi === null || o.pezzi === undefined ? '' : String(o.pezzi),
  sulSito: o.sulSito !== false,
});

// Scheda "Optional" della pagina Tariffe e optional: l'elenco degli extra a
// pagamento (seggiolino, catene...) lo decide lo staff. A destra il riquadro
// per aggiungere o modificare.
function CatalogoOptional() {
  const [elenco, setElenco] = useState([]);
  const [caricato, setCaricato] = useState(false);
  const [errore, setErrore] = useState('');
  const [form, setForm] = useState(null); // null = riquadro chiuso
  const [tentato, setTentato] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [daTogliere, setDaTogliere] = useState(null);

  useEffect(() => ascoltaOptional(
    (dati) => { setElenco(dati); setCaricato(true); },
    (err) => {
      console.error('Errore lettura optional:', err);
      setErrore('Non riesco a leggere gli optional. Controlla la connessione e riprova.');
      setCaricato(true);
    },
  ), []);

  const ordinati = useMemo(() => ordinaOptional(elenco), [elenco]);
  const errori = form ? validaOptional(form, elenco, form.id || null) : {};
  const mostra = (campo) => tentato && errori[campo];
  const aggiorna = (campi) => setForm((f) => ({ ...f, ...campi }));

  // Se l'optional aperto viene tolto da un'altra postazione, il riquadro si chiude.
  useEffect(() => {
    if (form?.id && caricato && !elenco.some((o) => o.id === form.id)) {
      setForm(null);
      toast.info('Questo optional è stato tolto da un\'altra postazione.');
    }
  }, [elenco, form?.id, caricato]);

  const apri = (o) => { setForm(o ? perForm(o) : { ...OPTIONAL_VUOTO }); setTentato(false); };

  const salva = async (e) => {
    e.preventDefault();
    setTentato(true);
    if (Object.keys(errori).length > 0) return;
    setSalvando(true);
    try {
      await salvaOptional(form);
      toast.success(form.id ? `${form.nome.trim()} aggiornato.` : `${form.nome.trim()} aggiunto agli optional.`);
      setForm(null);
    } catch (err) {
      console.error('Errore salvataggio optional:', err);
      toast.error('Optional non salvato, riprova.');
    } finally {
      setSalvando(false);
    }
  };

  const confermaTogli = async () => {
    const o = daTogliere;
    setDaTogliere(null);
    try {
      await togliOptional(o.id);
      if (form?.id === o.id) setForm(null);
      toast.success(`${o.nome} tolto dall'elenco.`);
    } catch (err) {
      console.error('Errore rimozione optional:', err);
      toast.error('Non sono riuscito a toglierlo, riprova.');
    }
  };

  if (errore) return <p className="opt-errore">{errore}</p>;
  if (!caricato) return <p className="opt-nota">Caricamento…</p>;

  return (
    <div className={`opt ${form ? 'opt--con-riquadro' : ''}`}>
      <section className="opt-box">
        <div className="opt-box-testa">
          <h2 className="opt-box-titolo">Optional a pagamento</h2>
          <button type="button" className="opt-btn opt-btn--primario" onClick={() => apri(null)}>
            <Plus size={18} aria-hidden="true" /> Aggiungi optional
          </button>
        </div>

        {ordinati.length === 0 ? (
          <p className="opt-vuoto">
            Nessun optional ancora. Aggiungi quelli che offrite: per esempio seggiolino, catene, navigatore.
          </p>
        ) : (
          <table className="opt-tabella">
            <thead>
              <tr>
                <th>Optional</th>
                <th>Prezzo</th>
                <th>Pezzi</th>
                <th>Sul sito</th>
                <th aria-label="Azioni" />
              </tr>
            </thead>
            <tbody>
              {ordinati.map((o) => (
                <tr key={o.id} className={form?.id === o.id ? 'opt-riga--aperta' : ''}>
                  <td>
                    <span className="opt-nome">{o.nome}</span>
                    <span className="opt-sotto">
                      {[o.descrizione, `max ${o.maxPerNoleggio} per noleggio`].filter(Boolean).join(' · ')}
                    </span>
                  </td>
                  <td>{testoPrezzo(o)}</td>
                  <td>{o.pezzi === null ? 'senza limite' : o.pezzi}</td>
                  <td>
                    <span className={`opt-etichetta ${o.sulSito ? 'opt-etichetta--si' : ''}`}>
                      {o.sulSito ? 'Sì' : 'Solo al banco'}
                    </span>
                  </td>
                  <td className="opt-azioni">
                    <button type="button" className="opt-btn" onClick={() => apri(o)}>
                      <Pencil size={15} aria-hidden="true" /> Modifica
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="opt-nota">
          Il prezzo pagato resta salvato in ogni prenotazione: se cambi il listino, le prenotazioni già fatte non cambiano.
        </p>
      </section>

      {form && (
        <form className="opt-riquadro" onSubmit={salva} noValidate aria-label={form.id ? `Modifica ${form.nome}` : 'Nuovo optional'}>
          <div className="opt-riquadro-testa">
            <h2 className="opt-box-titolo">{form.id ? `Modifica: ${form.nome || 'optional'}` : 'Nuovo optional'}</h2>
            <button type="button" className="opt-chiudi" onClick={() => setForm(null)} aria-label="Chiudi">
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <label className={`opt-campo ${mostra('nome') ? 'opt-campo--errore' : ''}`}>
            <span>Nome</span>
            <input value={form.nome} onChange={(e) => aggiorna({ nome: e.target.value })} placeholder="Es. Seggiolino bambino" />
            {mostra('nome') && <span className="opt-errore-campo" role="alert">{errori.nome}</span>}
          </label>

          <label className="opt-campo">
            <span>Descrizione breve <em>(si vede sul sito)</em></span>
            <input value={form.descrizione} onChange={(e) => aggiorna({ descrizione: e.target.value })} placeholder="Es. 0–4 anni, omologato" maxLength={80} />
          </label>

          <fieldset className="opt-modo">
            <legend>Come si paga</legend>
            {[['giorno', 'Al giorno'], ['noleggio', 'A noleggio']].map(([valore, testo]) => (
              <label key={valore} className={`opt-scelta ${form.modo === valore ? 'opt-scelta--attiva' : ''}`}>
                <input type="radio" name="opt-modo" value={valore} checked={form.modo === valore} onChange={() => aggiorna({ modo: valore })} />
                {testo}
              </label>
            ))}
          </fieldset>

          <div className="opt-griglia">
            <label className={`opt-campo ${mostra('prezzo') ? 'opt-campo--errore' : ''}`}>
              <span>Prezzo (€)</span>
              <input type="number" min="0" step="0.01" value={form.prezzo} onChange={(e) => aggiorna({ prezzo: e.target.value })} />
              {mostra('prezzo') && <span className="opt-errore-campo" role="alert">{errori.prezzo}</span>}
            </label>
            {form.modo === 'giorno' && (
              <label className={`opt-campo ${mostra('massimo') ? 'opt-campo--errore' : ''}`}>
                <span>Tetto di spesa per noleggio (€)</span>
                <small className="opt-aiuto">Il cliente non paga mai più di così, anche per noleggi lunghi. Vuoto = nessun tetto.</small>
                <input type="number" min="0" step="0.01" value={form.massimo} onChange={(e) => aggiorna({ massimo: e.target.value })} placeholder="nessuno" />
                {mostra('massimo') && <span className="opt-errore-campo" role="alert">{errori.massimo}</span>}
              </label>
            )}
            <label className={`opt-campo ${mostra('maxPerNoleggio') ? 'opt-campo--errore' : ''}`}>
              <span>Quanti può prenderne un cliente</span>
              <small className="opt-aiuto">Per ogni noleggio, es. 2 seggiolini al massimo.</small>
              <input type="number" min="1" step="1" value={form.maxPerNoleggio} onChange={(e) => aggiorna({ maxPerNoleggio: e.target.value })} />
              {mostra('maxPerNoleggio') && <span className="opt-errore-campo" role="alert">{errori.maxPerNoleggio}</span>}
            </label>
            <label className={`opt-campo ${mostra('pezzi') ? 'opt-campo--errore' : ''}`}>
              <span>Quanti ne avete in totale</span>
              <small className="opt-aiuto">In magazzino, per tutti i clienti. Vuoto = senza limite.</small>
              <input type="number" min="0" step="1" value={form.pezzi} onChange={(e) => aggiorna({ pezzi: e.target.value })} placeholder="senza limite" />
              {mostra('pezzi') && <span className="opt-errore-campo" role="alert">{errori.pezzi}</span>}
            </label>
          </div>

          <label className="opt-spunta">
            <input type="checkbox" checked={form.sulSito} onChange={(e) => aggiorna({ sulSito: e.target.checked })} />
            Lo può scegliere il cliente sul sito
          </label>

          {esempioPrezzo(form) && <p className="opt-esempio">{esempioPrezzo(form)}</p>}

          <div className="opt-riquadro-piede">
            <button type="button" className="opt-btn opt-btn--largo" onClick={() => setForm(null)} disabled={salvando}>Annulla</button>
            <button type="submit" className="opt-btn opt-btn--largo opt-btn--salva" disabled={salvando}>
              {salvando ? 'Salvo…' : 'Salva'}
            </button>
          </div>
          {form.id && (
            <button type="button" className="opt-togli" onClick={() => setDaTogliere(form)}>Togli dall&apos;elenco</button>
          )}
        </form>
      )}

      <ConfirmDialog
        open={Boolean(daTogliere)}
        onCancel={() => setDaTogliere(null)}
        onConfirm={confermaTogli}
        title={`Togliere ${daTogliere?.nome || ''}?`}
        message="Non sarà più proposto, né qui né sul sito. Le prenotazioni già fatte che lo hanno restano come sono."
        cancelLabel="Tienilo"
        confirmLabel="Togli dall'elenco"
        tone="danger"
      />
    </div>
  );
}

export default CatalogoOptional;
