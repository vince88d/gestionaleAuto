import { renderHook, act } from '@testing-library/react';
import { useSchedeAperte } from './useSchedeAperte';

beforeEach(() => window.localStorage.clear());

test('parte dalle iniziali, apre/chiude una scheda e tutte insieme', () => {
  const { result } = renderHook(() => useSchedeAperte({ a: true, b: false }));
  expect(result.current.aperta('a')).toBe(true);
  expect(result.current.aperta('b')).toBe(false);
  act(() => result.current.toggle('b')());
  expect(result.current.tutteAperte).toBe(true);
  act(() => result.current.apriChiudiTutte());
  expect(result.current.aperta('a')).toBe(false);
  act(() => result.current.reimposta());
  expect(result.current.aperta('a')).toBe(true);
});

test('con la chiave la scelta si ricorda; senza no', () => {
  const primo = renderHook(() => useSchedeAperte({ a: false }, 'prova'));
  act(() => primo.result.current.toggle('a')());
  const secondo = renderHook(() => useSchedeAperte({ a: false }, 'prova'));
  expect(secondo.result.current.aperta('a')).toBe(true);
  const senza = renderHook(() => useSchedeAperte({ a: false }));
  expect(senza.result.current.aperta('a')).toBe(false);
});

test('le scelte a mano battono le iniziali, che possono cambiare con i dati', () => {
  const { result, rerender } = renderHook(({ ini }) => useSchedeAperte(ini), { initialProps: { ini: { a: false } } });
  rerender({ ini: { a: true } });
  expect(result.current.aperta('a')).toBe(true);
  act(() => result.current.toggle('a')());
  rerender({ ini: { a: false } });
  expect(result.current.aperta('a')).toBe(false);
  act(() => result.current.toggle('a')());
  rerender({ ini: { a: false } });
  expect(result.current.aperta('a')).toBe(true);
});
