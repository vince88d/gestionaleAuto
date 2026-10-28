import { scorriAlPrimoErrore } from './scorriAlPrimoErrore';

describe('scorriAlPrimoErrore', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); document.body.innerHTML = ''; });

  test('scorre fino al primo errore in ordine di pagina e mette il cursore nel suo campo', () => {
    document.body.innerHTML = `
      <form>
        <label class="pz-campo"><input id="a" /></label>
        <label class="pz-campo" id="c1"><input id="b" /><span class="pz-errore">Manca la data</span></label>
        <label class="pz-campo" id="c2"><input id="c" /><span class="pz-errore">Manca il nome</span></label>
      </form>`;
    document.getElementById('c1').scrollIntoView = jest.fn();
    document.getElementById('c2').scrollIntoView = jest.fn();
    scorriAlPrimoErrore(document.querySelector('form'));
    jest.runAllTimers();
    expect(document.getElementById('c1').scrollIntoView).toHaveBeenCalled();
    expect(document.getElementById('c2').scrollIntoView).not.toHaveBeenCalled();
    expect(document.activeElement.id).toBe('b');
  });

  test('nei campi data scorre ma non mette il cursore (si aprirebbe il calendario)', () => {
    document.body.innerHTML = '<label class="np-campo" id="d"><div class="react-datepicker-wrapper"><input id="data" /></div><span class="np-errore">Scegli il giorno</span></label>';
    document.getElementById('d').scrollIntoView = jest.fn();
    scorriAlPrimoErrore();
    jest.runAllTimers();
    expect(document.getElementById('d').scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement.id).not.toBe('data');
  });

  test('senza errori non fa nulla e non va in errore', () => {
    document.body.innerHTML = '<form><input id="a" /></form>';
    expect(() => { scorriAlPrimoErrore(document.querySelector('form')); jest.runAllTimers(); }).not.toThrow();
  });

  test('funziona anche per i campi delle Impostazioni (opt-campo)', () => {
    document.body.innerHTML = '<div class="opt-campo" id="x"><input id="p" /><span class="opt-errore-campo">Scrivi il prezzo</span></div>';
    document.getElementById('x').scrollIntoView = jest.fn();
    scorriAlPrimoErrore();
    jest.runAllTimers();
    expect(document.getElementById('x').scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement.id).toBe('p');
  });
});
