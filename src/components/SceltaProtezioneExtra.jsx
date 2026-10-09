import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { COPERTURE, euro as euroTondo, prezzoProtezione, protezioneImpostata } from '../utils/protezioni';
import { MODI_PREZZO } from '../utils/optional';
import { pezziLiberi, totaleSceglibile } from '../utils/sceltaExtra';
import './SceltaProtezioneExtra.css';

const euro = (valore) => `${Number(valore || 0).toFixed(2).replace('.', ',')} €`;
const giorniTesto = (g) => `${g} ${g === 1 ? 'giorno' : 'giorni'}`;

// "Danni max 1.200 € · Furto max 1.500 € · Cauzione 500 €"
function Cifre({ f }) {
  return (
    <p className="px-cifre">
      <span>Danni max <b>{euroTondo(f.danni)}</b></span>
      <span>Furto max <b>{euroTondo(f.furto)}</b></span>
      <span>Cauzione <b>{euroTondo(f.cauzione)}</b></span>
    </p>
  );
}

// Quanti pezzi si possono scegliere: il massimo per noleggio, ma non piu' di
// quelli liberi in quelle date (senza contare questa prenotazione).
export const massimoPezzi = (o, occupati) => {
  const liberi = pezziLiberi(o, occupati);
  return liberi === null ? o.maxPerNoleggio : Math.min(o.maxPerNoleggio, liberi);
};

function testoLiberi(o, occupati, conDate) {
  if (!conDate) return { testo: 'Scegli le date per vedere quanti ne restano', classe: '' };
  if (o.pezzi === null) return { testo: 'Senza limite', classe: '' };
  const liberi = pezziLiberi(o, occupati);
  if (liberi === 0) return { testo: 'Tutti prenotati in queste date', classe: 'px-liberi--finiti' };
  const totale = liberi < o.pezzi ? ` (${o.pezzi} in tutto)` : '';
  return {
    testo: `${liberi} ${liberi === 1 ? 'libero' : 'liberi'} in queste date${totale}`,
    classe: liberi <= 1 ? 'px-liberi--pochi' : '',
  };
}

// Domanda 4 della finestra "Nuova prenotazione": protezione (Base inclusa o
// Totale a pagamento) ed extra con − e +. Per le prenotazioni pagate sul sito
// mostra solo quello che il cliente ha scelto (non si cambia da qui).
function SceltaProtezioneExtra({
  categoria, protezione, sceltaProtezione, onProtezione, catalogo, quantita, onQuantita,
  giorni, occupati, conDate, sito, salvata, attiva,
}) {
  if (sito) {
    const p = salvata?.protezione;
    const righe = Array.isArray(salvata?.optional) ? salvata.optional.filter((r) => r?.quantita > 0) : [];
    return (
      <section className="np-sezione">
        <h3 className="np-sezione-titolo"><span className="np-numero">4.</span> Protezione ed extra</h3>
        <p className="np-aiuto">Scelti e pagati dal cliente sul sito: non si cambiano da qui.</p>
        {p || righe.length > 0 ? (
          <ul className="px-elenco">
            {p && (
              <li>
                <b>Protezione {p.tipo === 'totale' ? 'Totale' : 'Base'}</b>
                {p.tipo === 'totale' ? ` · ${euro(p.prezzo)}` : ' (inclusa)'}
                {typeof p.danni === 'number' && ` · danni max ${euroTondo(p.danni)}`}
                {typeof p.furto === 'number' && ` · furto max ${euroTondo(p.furto)}`}
              </li>
            )}
            {righe.map((r) => <li key={r.id}><b>{r.nome} × {r.quantita}</b> · {euro(r.totale)}</li>)}
          </ul>
        ) : (
          <p className="np-aiuto">Prenotazione fatta prima delle protezioni: nessuna scelta salvata.</p>
        )}
      </section>
    );
  }

  const impostata = protezioneImpostata(protezione);
  const conTotale = impostata && totaleSceglibile(protezione);
  const coperte = conTotale ? COPERTURE.filter(([k]) => protezione.totale.copre[k]).map(([, n]) => n.toLowerCase()) : [];
  const elencoCoperte = coperte.join(', ').replace(/, ([^,]*)$/, ' e $1');

  return (
    <section className={`np-sezione ${attiva ? 'np-sezione--attiva' : ''}`}>
      <h3 className="np-sezione-titolo"><span className="np-numero">4.</span> Protezione ed extra</h3>

      {!categoria ? (
        <p className="np-aiuto">Scegli prima l'auto: la protezione dipende dalla categoria.</p>
      ) : !impostata ? (
        <p className="px-avviso">
          <b>{categoria}: protezione e cauzione non impostate.</b> Puoi prenotare lo stesso, ma la prenotazione resta
          senza franchigie né cauzione. Impostale in Tariffe e optional → Protezioni e cauzione.
        </p>
      ) : (
        <>
          <p className="px-sotto">Protezione · {categoria}</p>
          <div className={`px-protezioni ${conTotale ? '' : 'px-protezioni--una'}`} role="radiogroup" aria-label="Protezione">
            <label className={`px-scheda ${sceltaProtezione === 'base' ? 'px-scheda--scelta' : ''}`}>
              <input type="radio" name="np-protezione" checked={sceltaProtezione === 'base'} onChange={() => onProtezione('base')} />
              <span className="px-nome">Base</span>
              <span className="px-prezzo">Inclusa <span>· 0 € in più</span></span>
              <Cifre f={protezione.base} />
            </label>
            {conTotale && (
              <label className={`px-scheda ${sceltaProtezione === 'totale' ? 'px-scheda--scelta' : ''}`}>
                <input type="radio" name="np-protezione" checked={sceltaProtezione === 'totale'} onChange={() => onProtezione('totale')} />
                <span className="px-nome">Totale</span>
                <span className="px-prezzo">
                  +{euroTondo(protezione.totale.prezzoGiorno)} al giorno
                  {giorni > 0 && <span> · {euroTondo(prezzoProtezione(protezione, giorni))} per {giorniTesto(giorni)}</span>}
                </span>
                <Cifre f={protezione.totale} />
                {coperte.length > 0 && <span className="px-copre">✓ Copre anche {elencoCoperte}</span>}
              </label>
            )}
          </div>
        </>
      )}

      {catalogo.length > 0 && (
        <>
          <p className="px-sotto">Extra <span className="np-facoltativo">(facoltativi)</span></p>
          <ul className="px-extra">
            {catalogo.map((o) => {
              const q = quantita[o.id] || 0;
              const massimo = conDate ? massimoPezzi(o, occupati) : o.maxPerNoleggio;
              const liberi = testoLiberi(o, occupati, conDate);
              const esaurito = conDate && massimo <= 0 && q === 0;
              const info = [
                `${euroTondo(o.prezzo)} ${MODI_PREZZO[o.modo]}`,
                o.massimo ? `massimo ${euroTondo(o.massimo)}` : '',
                o.maxPerNoleggio > 1 ? `fino a ${o.maxPerNoleggio}` : '',
              ].filter(Boolean).join(' · ');
              return (
                <li key={o.id}>
                  <span className="px-extra-testi">
                    <span className="px-extra-nome">
                      {o.nome}
                      {o.fuoriElenco ? <span className="px-banco">Non più in elenco</span> : !o.sulSito && <span className="px-banco">Solo al banco</span>}
                    </span>
                    <span className="px-extra-info">{info}</span>
                    {!o.fuoriElenco && <span className={`px-liberi ${liberi.classe}`}>{liberi.testo}</span>}
                  </span>
                  {esaurito ? (
                    <span className="px-esaurito">ESAURITO</span>
                  ) : (
                    <span className="px-passi" role="group" aria-label={`Quantità di ${o.nome}`}>
                      <button type="button" onClick={() => onQuantita(o.id, q - 1)} disabled={q <= 0} aria-label={`Togli ${o.nome}`}>
                        <Minus size={18} aria-hidden="true" />
                      </button>
                      <output className={q > 0 ? 'si' : ''} aria-live="polite">{q}</output>
                      <button type="button" onClick={() => onQuantita(o.id, q + 1)} disabled={q >= massimo} aria-label={`Aggiungi ${o.nome}`}>
                        <Plus size={18} aria-hidden="true" />
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="np-aiuto">Gli extra «Solo al banco» non si vedono sul sito. L'elenco e i prezzi si cambiano in Tariffe e optional.</p>
        </>
      )}
    </section>
  );
}

export default SceltaProtezioneExtra;
