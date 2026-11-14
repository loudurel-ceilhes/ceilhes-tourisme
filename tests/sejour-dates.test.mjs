import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../assets/sejour-dates.js', import.meta.url), 'utf8');
function setup(url = 'https://ceilhes-tourisme.fr/mon-sejour.html', initial = null) {
  const memory = new Map(initial ? [['ceilhes:dates-sejour:v1', JSON.stringify(initial)]] : []);
  const events = [], listeners = {};
  const context = { URL, Date, JSON, Object, Number, location: { href: url }, window: {},
    localStorage: { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) },
    dispatchEvent: event => events.push(event), addEventListener: (name, callback) => listeners[name] = callback,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } } };
  vm.runInNewContext(source, context);
  return { api: context.window.SejourDates, context, memory, events, listeners };
}
const plain = value => JSON.parse(JSON.stringify(value));

test('la période URL est proposée sans écraser les dates conservées', () => {
  const saved = { start: '2026-11-18', end: '2026-11-20' };
  const { api, memory } = setup('https://ceilhes-tourisme.fr/agenda.html?debut=2026-12-18&fin=2026-12-20', saved);
  assert.deepEqual(plain(api.read()), { start: '2026-12-18', end: '2026-12-20' });
  assert.deepEqual(JSON.parse([...memory.values()][0]), saved);
});

test('dates réelles et 31 jours inclusifs, y compris changement d’heure et février bissextile', () => {
  const { api } = setup();
  assert.equal(api.validDate('2027-02-29'), false);
  assert.equal(api.validDate('2028-02-29'), true);
  assert.equal(api.validDate('2026-11-31'), false);
  assert.equal(api.validRange({ start: '2026-03-01', end: '2026-03-31' }), true);
  assert.equal(api.validRange({ start: '2026-03-01', end: '2026-04-01' }), false);
  assert.equal(api.validRange({ start: '2026-12-18', end: '2026-12-17' }), false);
});

test('un stockage refusé conserve la préférence précédente et n’annonce aucune réussite', () => {
  const saved = { start: '2026-11-18', end: '2026-11-20' };
  const { api, context, events } = setup(undefined, saved);
  context.localStorage.setItem = () => { throw Error('Refus'); };
  assert.equal(api.write({ start: '2026-12-18', end: '2026-12-20' }), false);
  assert.deepEqual(plain(api.read()), saved);
  assert.equal(events.length, 0);
});

test('les anciens paramètres invalides ne remplacent pas la préférence, écrire et effacer notifient', () => {
  const saved = { start: '2026-11-18', end: '2026-11-20' };
  const { api, events } = setup('https://ceilhes-tourisme.fr/?debut=2026-11-31&fin=2026-12-02', saved);
  assert.deepEqual(plain(api.read()), saved);
  assert.equal(api.write({ start: '2026-12-18', end: '2026-12-20' }), true);
  assert.equal(events.length, 1);
  assert.equal(api.clear(), true);
  assert.equal(api.read(), null);
  assert.equal(events.length, 2);
});
