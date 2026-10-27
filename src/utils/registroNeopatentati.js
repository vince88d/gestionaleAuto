import { formattaData } from './scadenze';
import { tipoPer, testoVelocita } from './neopatentati';

// Il registro del controllo neopatentati (utils/neopatentati.js, registroControllo)
// reso in parole per i dettagli della prenotazione. E' una fotografia del momento
// della consegna: qui si legge soltanto, mai si ricalcola con i dati di oggi.
// Mockup approvato: formiarent-documenti/mockup/gestionale-registro-neopatentati.html

const virgola = (n, cifre = 3) => Number(n).toLocaleString('it-IT', { maximumFractionDigits: cifre });
const dataIt = (g) => (g ? String(g).slice(0, 10).split('-').reverse().join('/') : '—');

function quando(r) {
  if (!r.controllatoIl) return '';
  const d = new Date(r.controllatoIl);
  if (Number.isNaN(d.getTime())) return '';
  const ora = d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  return `${formattaData(d)} alle ${ora}`;
}

function firma(r, verbo) {
  const q = quando(r);
  return [q ? `${verbo} il ${q}` : verbo, r.controllatoDa ? `da ${r.controllatoDa}` : ''].filter(Boolean).join(' ');
}

// Frase sui limiti usati, dai numeri salvati nel registro.
function fraseLimiti(v) {
  const l = v.limiti || {};
  const parti = [];
  if (v.kwPerTonnellata != null && l.kwPerTonnellata != null) parti.push(`rapporto ${virgola(v.kwPerTonnellata)} kW/t (limite ${l.kwPerTonnellata})`);
  if (l.kwMax != null && v.potenzaKw != null) parti.push(`${virgola(v.potenzaKw)} kW (limite ${l.kwMax} per le autovetture)`);
  return parti;
}

function dettaglioNo(v) {
  const l = v.limiti || {};
  const motivi = [];
  if (v.kwPerTonnellata != null && l.kwPerTonnellata != null && v.kwPerTonnellata > l.kwPerTonnellata) {
    motivi.push(`rapporto ${virgola(v.kwPerTonnellata)} kW/t, oltre il limite di ${l.kwPerTonnellata}`);
  }
  if (l.kwMax != null && v.potenzaKw != null && v.potenzaKw > l.kwMax) {
    motivi.push(`${virgola(v.potenzaKw)} kW, oltre il limite di ${l.kwMax} per le autovetture`);
  }
  const frase = motivi.length ? `${motivi.join('; ')}.` : 'Oltre i limiti di legge.';
  // Se solo uno dei due limiti e' superato, dice anche com'e' l'altro.
  const altro = [];
  if (v.kwPerTonnellata != null && l.kwPerTonnellata != null && v.kwPerTonnellata <= l.kwPerTonnellata) altro.push(`Il rapporto (${virgola(v.kwPerTonnellata)} kW/t) è invece nei limiti (${l.kwPerTonnellata}).`);
  if (l.kwMax != null && v.potenzaKw != null && v.potenzaKw <= l.kwMax) altro.push(`La potenza (${virgola(v.potenzaKw)} kW) è invece nei limiti (${l.kwMax}).`);
  return [frase.charAt(0).toUpperCase() + frase.slice(1), ...altro].join(' ');
}

function origineRapporto(v) {
  if (v.fonteRapporto === 'libretto') return 'Copiato dal libretto';
  if (v.fonteRapporto === 'calcolato') {
    if (v.massaUsataKg != null && v.potenzaKw != null) {
      const t = v.massaUsataKg / 1000;
      const aggiunti = v.massaUsataKg - v.taraKg;
      const peso = aggiunti > 0 ? `massa a vuoto ${virgola(v.taraKg)} kg + ${virgola(aggiunti)} kg del conducente` : `massa in ordine di marcia ${virgola(v.taraKg)} kg, conducente già compreso`;
      return `Calcolato dal programma: ${virgola(v.potenzaKw)} kW ÷ ${virgola(t)} t (${peso})`;
    }
    return 'Calcolato dal programma';
  }
  return '—';
}

// Che cosa mostrare. Torna null se la prenotazione non ha il registro (consegne
// fatte prima di questa funzione).
// { esito: {tono, icona, titolo, testo}, firma, dati: [[etichetta, valore, intera?]], velocita, regola }
export function vistaRegistro(r) {
  if (!r || typeof r !== 'object') return null;
  const v = r.veicolo || {};
  const limiti = fraseLimiti(v);
  let esito;
  let conDatiAuto = false;

  if (r.esito === 'data-patente-mancante') {
    esito = { tono: 'nd', icona: 'alert', titolo: 'Controllo non eseguito', testo: 'Mancava la data di rilascio della patente, quindi non si è potuto sapere se il cliente è neopatentato.' };
  } else if (r.esito === 'non-applicabile') {
    esito = { tono: 'neutro', icona: 'shield', titolo: 'Cliente non neopatentato', testo: r.rilascioPatente ? `Patente rilasciata il ${dataIt(r.rilascioPatente)}: i limiti non si applicano.` : 'I limiti non si applicano.' };
  } else if (r.esito === 'si') {
    conDatiAuto = true;
    const nonSoggetto = limiti.length === 0;
    esito = {
      tono: 'ok', icona: 'check', titolo: 'Auto adatta ai neopatentati',
      testo: nonSoggetto ? `${tipoPer(v.tipoVeicolo).etichetta}: non rientra nei limiti di potenza per i neopatentati.` : `${limiti.join(' e ').replace(/^./, (c) => c.toUpperCase())}.`,
    };
  } else if (r.esito === 'no') {
    conDatiAuto = true;
    esito = { tono: 'no', icona: 'x', titolo: 'Auto non adatta ai neopatentati', testo: dettaglioNo(v) };
  } else if (r.esito === 'nd') {
    conDatiAuto = true;
    esito = { tono: 'nd', icona: 'alert', titolo: 'Auto da verificare', testo: 'Nella scheda del veicolo mancavano la potenza o il rapporto potenza/tara, quindi il controllo non è stato possibile.' };
  } else {
    return null;
  }

  const dati = [];
  if (r.esito !== 'data-patente-mancante' && r.esito !== 'non-applicabile') {
    dati.push(['Patente rilasciata il', dataIt(r.rilascioPatente)]);
    dati.push(['Limiti validi fino al', dataIt(r.finoAl)]);
  }
  if (conDatiAuto) {
    const alim = v.carburante ? ` · ${String(v.carburante).toLowerCase()}` : '';
    dati.push(['Auto', `${v.targa || '—'} · ${tipoPer(v.tipoVeicolo).etichetta}${alim}`]);
    dati.push(['Potenza', v.potenzaKw != null ? `${virgola(v.potenzaKw)} kW` : '—']);
    dati.push(['Rapporto potenza/tara', v.kwPerTonnellata != null ? `${virgola(v.kwPerTonnellata)} kW/t` : '—']);
    dati.push(['Da dove viene il rapporto', origineRapporto(v), v.fonteRapporto === 'calcolato']);
  }

  const vel = r.limiteVelocita;
  const velocita = vel && vel.soggetto && vel.finoAl ? testoVelocita(vel.finoAl) : '';

  const regola = r.versioneRegola
    ? `Regola usata: limiti per i neopatentati in vigore dal ${dataIt(r.versioneRegola.inVigoreDal)}, aggiornata al ${dataIt(r.versioneRegola.aggiornatoAl)}. Controllo di supporto: la verifica finale resta del noleggiatore.`
    : '';

  return {
    esito,
    firma: firma(r, r.esito === 'data-patente-mancante' ? 'Registrato' : 'Controllato'),
    dati,
    velocita,
    regola,
  };
}
