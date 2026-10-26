import { vistaRegistro } from './registroNeopatentati';
import { registroControllo } from './neopatentati';

const adesso = new Date('2026-10-26T09:42:00');
const fai = (veicolo, rilascio, extra = {}) => registroControllo({ veicolo, rilascio, ritiro: '2026-10-26', operatore: 'staff@example.com', adesso, ...extra });
const polo = { targa: 'GH123AB', carburante: 'Benzina', potenzaKw: 70, taraKg: 1400, rapportoLibretto: 47.798 };
const q3 = { targa: 'KL456CD', carburante: 'Benzina', potenzaKw: 110, taraKg: 1700, rapportoLibretto: 66.465 };

describe('vistaRegistro', () => {
  test('senza registro (consegne vecchie) non mostra nulla', () => {
    expect(vistaRegistro(undefined)).toBeNull();
    expect(vistaRegistro(null)).toBeNull();
    expect(vistaRegistro({})).toBeNull();
  });

  test('auto adatta, rapporto dal libretto', () => {
    const v = vistaRegistro(fai(polo, '2025-03-14'));
    expect(v.esito).toMatchObject({ tono: 'ok', titolo: 'Auto adatta ai neopatentati' });
    expect(v.esito.testo).toBe('Rapporto 47,798 kW/t (limite 75) e 70 kW (limite 105 per le autovetture).');
    expect(v.firma).toContain('da staff@example.com');
    expect(v.firma).toMatch(/^Controllato il 26\/10\/2026 alle 09:42/);
    const dati = Object.fromEntries(v.dati.map(([e, val]) => [e, val]));
    expect(dati['Patente rilasciata il']).toBe('14/03/2025');
    expect(dati['Limiti validi fino al']).toBe('14/03/2028');
    expect(dati.Auto).toBe('GH123AB · Autovettura · benzina');
    expect(dati['Da dove viene il rapporto']).toBe('Copiato dal libretto');
    expect(v.velocita).toContain('100 km/h');
    expect(v.regola).toContain('14/12/2024');
  });

  test('auto non adatta: dice quale limite e quale e\' invece nei limiti', () => {
    const v = vistaRegistro(fai(q3, '2025-09-02'));
    expect(v.esito).toMatchObject({ tono: 'no', titolo: 'Auto non adatta ai neopatentati' });
    expect(v.esito.testo).toContain('110 kW, oltre il limite di 105');
    expect(v.esito.testo).toContain('Il rapporto (66,465 kW/t) è invece nei limiti (75).');
  });

  test('rapporto calcolato: mostra il peso usato', () => {
    const v = vistaRegistro(fai({ targa: 'X', carburante: 'Benzina', potenzaKw: 51, taraKg: 992 }, '2025-03-14'));
    const dati = Object.fromEntries(v.dati.map(([e, val]) => [e, val]));
    expect(dati['Da dove viene il rapporto']).toBe('Calcolato dal programma: 51 kW ÷ 1,067 t (massa a vuoto 992 kg + 75 kg del conducente)');
  });

  test('campo G.1: il conducente e\' gia\' compreso', () => {
    const v = vistaRegistro(fai({ targa: 'X', potenzaKw: 55, taraKg: 1173, taraCampo: 'G1' }, '2025-03-14'));
    const dati = Object.fromEntries(v.dati.map(([e, val]) => [e, val]));
    expect(dati['Da dove viene il rapporto']).toContain('conducente già compreso');
  });

  test('cliente non neopatentato: blocco corto, senza dati dell\'auto', () => {
    const v = vistaRegistro(fai(q3, '2018-05-20'));
    expect(v.esito).toMatchObject({ tono: 'neutro', titolo: 'Cliente non neopatentato' });
    expect(v.esito.testo).toContain('20/05/2018');
    expect(v.dati).toEqual([]);
    expect(v.velocita).toBe('');
  });

  test('data patente mancante', () => {
    const v = vistaRegistro(fai(q3, ''));
    expect(v.esito).toMatchObject({ tono: 'nd', titolo: 'Controllo non eseguito' });
    expect(v.firma).toMatch(/^Registrato il/);
    expect(v.dati).toEqual([]);
  });

  test('dati dell\'auto mancanti: da verificare', () => {
    const v = vistaRegistro(fai({ targa: 'Z', carburante: 'Benzina' }, '2025-03-14'));
    expect(v.esito).toMatchObject({ tono: 'nd', titolo: 'Auto da verificare' });
  });

  test('veicolo non soggetto ai limiti (moto): adatta, con il motivo', () => {
    const v = vistaRegistro(fai({ targa: 'M', tipoVeicolo: 'moto' }, '2025-03-14'));
    expect(v.esito.tono).toBe('ok');
    expect(v.esito.testo).toContain('non rientra nei limiti');
  });
});
