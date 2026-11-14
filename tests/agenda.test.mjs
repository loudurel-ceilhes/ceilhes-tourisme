import test from 'node:test'
import assert from 'node:assert/strict'
import { dateParis, periodesAVenir, preparerEvenements, rendreCartes, donneesStructurees, identifiantEvenement, contactsEvenement, urlWeb } from '../scripts/agenda.mjs'

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

test('le détail conserve le descriptif complet, le lieu et le téléphone après le résumé', () => {
  const description = 'Une visite du village et de son histoire. '.repeat(8) + '\nRendez-vous à 15h. Réservations au 04 67 23 43 38.'
  const [e] = preparerEvenements([{
    Nom_du_POI: 'VISITE DU VILLAGE', Description: description,
    Periodes_regroupees: '2026-11-17', Code_postal_et_commune: '34260#Avène',
    Adresse_postale: 'Place de la mairie', Contacts_du_POI: '#|Office#https://example.org/visite?jour=17&mois=11',
    URI_ID_du_POI: 'https://data.datatourisme.fr/32/visite', Date_de_mise_a_jour: '2026-11-12',
  }], '2026-11-14')
  const html = rendreCartes([e], true)
  assert.ok(html.includes(description.replace(/[ \t]+$/gm, '')))
  assert.match(html, /<details class="ev-details">/)
  assert.match(html, /Place de la mairie · 34260 Avène/)
  assert.match(html, /href="tel:\+33467234338"/)
  assert.match(html, /href="https:\/\/example.org\/visite\?jour=17&amp;mois=11"/)
  assert.match(html, /datetime="2026-11-12"/)
  assert.match(html, /data-carnet-category="Événement"/)
})

test('les contacts sont validés et les téléphones dédoublonnés sans prendre les dates', () => {
  const contacts = contactsEvenement({
    contacts: 'Visite#https://example.org/visite#reserver|javascript:alert(1)|https://user:secret@example.org/',
    description: 'Le 17/11/2026. 04 67 23 43 38 ou +33 4 67 23 43 38. Téléphone : 06.12.34.56.78.',
  })
  assert.deepEqual(contacts.telephones, [
    {href:'tel:+33467234338', libelle:'04 67 23 43 38'},
    {href:'tel:+33612345678', libelle:'06 12 34 56 78'},
  ])
  assert.deepEqual(contacts.liens, ['https://example.org/visite#reserver'])
  for (const value of ['javascript:alert(1)', 'data:text/html,<script>', '//example.org', 'https://user:password@example.org']) {
    assert.equal(urlWeb(value), '')
  }
})

test('le résumé s’arrête à une phrase avant le numéro, qui reste intégral dans les détails', () => {
  const description = "Les Amis du haut Pays d'Orb vous proposent des visites commentées du village d'Avène. Rendez-vous devant l'Office de Tourisme Grand Orb à Avène. Participation 3€/personne, réservations au 04 67 95 70 91"
  const [e] = preparerEvenements([{
    Nom_du_POI:'Visite', Description:description, Periodes_regroupees:'2026-11-17',
    Code_postal_et_commune:'34260#Avène',
  }], '2026-11-14')
  const html = rendreCartes([e], true)
  const resume = html.match(/<p>(.*?)<\/p>/s)[1]
  assert.ok(resume.endsWith('à Avène.'))
  assert.ok(!resume.includes('réservations au 04'))
  assert.ok(html.includes('réservations au 04 67 95 70 91'))
})

test('le lien d’un événement dépend de son identifiant source et reste stable après réorganisation', () => {
  const [e] = preparerEvenements([{
    Nom_du_POI: 'Concert', Description:'Musique', Periodes_regroupees:'2026-11-17',
    Code_postal_et_commune:'34260#Avène', URI_ID_du_POI:'https://data.datatourisme.fr/32/concert',
  }], '2026-11-14')
  const id = identifiantEvenement(e)
  assert.equal(id, identifiantEvenement({...e, nom:'Concert renommé', debut:'2026-11-18'}))
  assert.notEqual(id, identifiantEvenement({...e, sourceUri:'https://data.datatourisme.fr/32/autre'}))
  assert.match(rendreCartes([{...e, sourceUri:'https://data.datatourisme.fr/32/autre'}, e], true), new RegExp(`id="${id}"`))
  assert.equal(donneesStructurees([e])['@graph'][0].url, 'https://ceilhes-tourisme.fr/agenda.html#' + id)
})
