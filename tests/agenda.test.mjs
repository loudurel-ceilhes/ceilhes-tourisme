import test from 'node:test'
import assert from 'node:assert/strict'
import { dateParis, periodesAVenir, preparerEvenements, rendreCartes, donneesStructurees } from '../scripts/agenda.mjs'

test('le jour civil suit Paris, y compris autour de minuit et en été', () => {
  assert.equal(dateParis(new Date('2026-11-13T23:30:00Z')), '2026-11-14')
  assert.equal(dateParis(new Date('2026-07-01T22:30:00Z')), '2026-07-02')
})

test('une exposition en cours conserve son vrai début et sa fin', () => {
  const [e] = preparerEvenements([{
    Nom_du_POI: 'EXPOSITION', Periodes_regroupees: '2026-07-01<->2026-08-31',
    Code_postal_et_commune: '34260#Ceilhes-et-Rocozels',
  }], '2026-08-10')
  assert.equal(e.debut, '2026-07-01')
  assert.equal(e.fin, '2026-08-31')
  assert.equal(e.dateTri, '2026-08-10')
  assert.equal(e.enCours, true)
  const html = rendreCartes([e], false)
  assert.match(html, /En cours jusqu’au/)
  assert.match(html, /datetime="2026-08-31"/)
  const json = donneesStructurees([e])['@graph'][0]
  assert.equal(json.startDate, '2026-07-01')
  assert.equal(json.endDate, '2026-08-31')
})

test('un rendez-vous du jour est conservé ; les périodes passées ou invalides sont exclues', () => {
  assert.deepEqual(periodesAVenir('2026-11-13<->2026-11-13|2026-11-14<->2026-11-14|2026-02-30<->2026-11-14|2026-11-16<->2026-11-15', '2026-11-14'), [
    { debut:'2026-11-14',fin:'2026-11-14' },
  ])
})

test('les occurrences suivantes retenues par le filtre sont aussi visibles sur la carte', () => {
  const [e] = preparerEvenements([{
    Nom_du_POI:'MARCHÉ', Periodes_regroupees:'2026-11-10<->2026-11-10|2026-11-17<->2026-11-17|2026-11-21<->2026-11-22',
    Code_postal_et_commune:'34260#Ceilhes-et-Rocozels',
  }], '2026-11-14')
  assert.equal(e.periodes.length,2)
  assert.equal(e.debut,'2026-11-17')
  assert.deepEqual(donneesStructurees([e])['@graph'].map(e => e.startDate), ['2026-11-17','2026-11-21'])
  // Vérifie le texte affiché, pas les dates cachées dans data-periodes.
  const visible = rendreCartes([e],false).replace(/<[^>]*>/g, ' ')
  assert.match(visible, /Le\s+17 novembre 2026/)
  assert.match(visible, /Du\s+21 novembre 2026\s+au\s+22 novembre 2026/)
})

test('les noms et descriptions ne peuvent pas injecter du HTML dans une carte', () => {
  const [e] = preparerEvenements([{
    Nom_du_POI:'<img src=x onerror=alert(1)>', Description:'<script>alert(1)</script>',
    Periodes_regroupees:'2026-11-14', Code_postal_et_commune:'34260#<img>',
  }], '2026-11-14')
  const html = rendreCartes([e],true)
  assert.ok(!html.includes('<img'))
  assert.ok(!html.includes('<script>'))
})
