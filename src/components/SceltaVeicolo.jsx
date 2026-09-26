import React, { useMemo, useState } from 'react';
import { Car, Search } from 'lucide-react';
import { statoVeicoloNelPeriodo } from '../utils/regolePrenotazione';

const ETICHETTA_STATO = {
  libero: 'Libero',
  occupato: 'Occupato',
  'categoria-piena': 'Categoria piena',
  sospeso: 'Sospeso',
  'da-verificare': '',
};

const NON_SCEGLIBILI = ['occupato', 'categoria-piena', 'sospeso'];
const SENZA_CATEGORIA = 'Senza categoria';
const nomeVeicolo = (v) => [v.marca, v.modello].filter(Boolean).join(' ') || v.targa;

// Scelta del veicolo nel form di prenotazione: categorie con quanti veicoli
// sono liberi nelle date scelte, ricerca, e schede con foto, targa, prezzo e
// disponibilita'. Prima era un menu a tendina con tutta la flotta.
function SceltaVeicolo({
  veicoli = [],
  targaScelta,
  onScegli,
  inizio,
  fine,
  prenotazioni = [],
  holds = [],
  idEscluso,
  targaIniziale,
}) {
  const [cerca, setCerca] = useState('');
  const [mostraTutti, setMostraTutti] = useState(false);
  const [categoria, setCategoria] = useState(
    () => veicoli.find((v) => v.targa === (targaScelta || targaIniziale))?.categoria || 'tutte'
  );

  // Stato di ogni veicolo nelle date scelte. Quello gia' assegnato a questa
  // prenotazione resta sempre sceglibile.
  const conStato = useMemo(() => veicoli.map((v) => {
    const stato = statoVeicoloNelPeriodo({ veicolo: v, inizio, fine, veicoli, prenotazioni, holds, idEscluso });
    return { veicolo: v, stato: v.targa === targaIniziale ? 'libero' : stato };
  }), [veicoli, inizio, fine, prenotazioni, holds, idEscluso, targaIniziale]);

  const dateScelte = conStato.length > 0 && conStato[0].stato !== 'da-verificare';
  const categorie = useMemo(() => {
    const perNome = new Map();
    conStato.forEach(({ veicolo, stato }) => {
      const nome = veicolo.categoria || SENZA_CATEGORIA;
      const c = perNome.get(nome) || { nome, totale: 0, liberi: 0 };
      c.totale += 1;
      if (!NON_SCEGLIBILI.includes(stato)) c.liberi += 1;
      perNome.set(nome, c);
    });
    return [...perNome.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
  }, [conStato]);

  const parole = cerca.toLowerCase().split(/\s+/).filter(Boolean);
  const inCategoria = conStato.filter(({ veicolo }) =>
    categoria === 'tutte' || (veicolo.categoria || SENZA_CATEGORIA) === categoria);
  const trovati = inCategoria.filter(({ veicolo }) => {
    const testo = [veicolo.marca, veicolo.modello, veicolo.targa, veicolo.colore].filter(Boolean).join(' ').toLowerCase();
    return parole.every((p) => testo.includes(p));
  });
  const nonDisponibili = trovati.filter(({ stato, veicolo }) =>
    NON_SCEGLIBILI.includes(stato) && veicolo.targa !== targaScelta);
  const visibili = (mostraTutti ? trovati : trovati.filter((t) => !nonDisponibili.includes(t)))
    .sort((a, b) => {
      const peso = (s) => (s === 'libero' || s === 'da-verificare' ? 0 : 1);
      return peso(a.stato) - peso(b.stato) || nomeVeicolo(a.veicolo).localeCompare(nomeVeicolo(b.veicolo), 'it');
    });
  const liberiTotali = categorie.reduce((n, c) => n + c.liberi, 0);

  return (
    <div className="sv">
      <div className="sv-categorie" role="tablist" aria-label="Categoria">
        {[{ nome: 'tutte', etichetta: 'Tutte', liberi: liberiTotali, totale: conStato.length }, ...categorie.map((c) => ({ ...c, etichetta: c.nome }))]
          .map((c) => (
            <button
              key={c.nome}
              type="button"
              role="tab"
              aria-selected={categoria === c.nome}
              className={`sv-categoria ${categoria === c.nome ? 'sv-categoria--attiva' : ''} ${dateScelte && c.liberi === 0 ? 'sv-categoria--piena' : ''}`}
              onClick={() => setCategoria(c.nome)}
            >
              {c.etichetta}
              <span className="sv-conto">{dateScelte ? `${c.liberi} liberi` : c.totale}</span>
            </button>
          ))}
      </div>

      <div className="sv-barra">
        <label className="sv-cerca">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={cerca}
            onChange={(e) => setCerca(e.target.value)}
            placeholder="Cerca modello o targa…"
            aria-label="Cerca veicolo"
          />
        </label>
        {nonDisponibili.length > 0 && (
          <button type="button" className="pz-link" onClick={() => setMostraTutti((v) => !v)}>
            {mostraTutti ? 'Nascondi i non disponibili' : `Mostra anche i ${nonDisponibili.length} non disponibili`}
          </button>
        )}
      </div>

      {!dateScelte && <p className="pz-aiuto">Scegli prima le date: vedrai quali veicoli sono liberi.</p>}

      <div className="sv-lista" role="radiogroup" aria-label="Veicolo">
        {visibili.length === 0 ? (
          <p className="sv-vuoto">
            {trovati.length === 0
              ? 'Nessun veicolo trovato.'
              : 'Nessun veicolo libero in queste date per questa categoria.'}
          </p>
        ) : visibili.map(({ veicolo, stato }) => {
          const scelto = veicolo.targa === targaScelta;
          const bloccato = NON_SCEGLIBILI.includes(stato) && !scelto;
          return (
            <button
              key={veicolo.targa}
              type="button"
              role="radio"
              aria-checked={scelto}
              disabled={bloccato}
              className={`sv-veicolo ${scelto ? 'sv-veicolo--scelto' : ''}`}
              onClick={() => onScegli(veicolo)}
              title={bloccato ? `${nomeVeicolo(veicolo)}: ${ETICHETTA_STATO[stato].toLowerCase()} in queste date` : nomeVeicolo(veicolo)}
            >
              <span className="sv-foto">
                {veicolo.immagine ? <img src={veicolo.immagine} alt="" /> : <Car size={22} aria-hidden="true" />}
              </span>
              <span className="sv-testo">
                <span className="sv-nome">{nomeVeicolo(veicolo)}</span>
                <span className="sv-dettagli">
                  <span className="sv-targa">{veicolo.targa}</span>
                  {categoria === 'tutte' && veicolo.categoria && <span>{veicolo.categoria}</span>}
                </span>
              </span>
              <span className="sv-destra">
                {veicolo.prezzo ? <span className="sv-prezzo">€ {Number(veicolo.prezzo).toLocaleString('it-IT')}<small>/g</small></span> : null}
                {ETICHETTA_STATO[stato] && <span className={`sv-stato sv-stato--${stato}`}>{ETICHETTA_STATO[stato]}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default SceltaVeicolo;
