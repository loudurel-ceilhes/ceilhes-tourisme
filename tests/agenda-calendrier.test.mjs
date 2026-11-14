import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dateValide, joursFeries, periodesChoisies } from '../assets/agenda-calendrier.js'
import { ouvertureEvenement, preparerEvenements, rendreCartes, donneesPubliques } from '../scripts/agenda.mjs'
import { instantaneCenomes, evenementsCenomes } from '../scripts/agenda-cenomes.mjs'

const source='https://data.datatourisme.fr/32/e1202df1-7ede-3f39-9aa4-50156f240733'
const rules=JSON.parse(await readFile(new URL('../data/agenda-ouvertures.json',import.meta.url),'utf8')).events
const description='Fermé mardi après midi, samedi, dimanche et les jours fériés.'
const opening=ouvertureEvenement({URI_ID_du_POI:source,Description:description},rules)

test('une fermeture sourcée exclut les week-ends, Noël et le jour de l’an',()=>{
  const periods=[{debut:'2026-11-02',fin:'2027-02-28'}]
  assert.deepEqual(periodesChoisies(periods,'2026-11-14','2026-11-15',opening),[])
  assert.deepEqual(periodesChoisies(periods,'2026-12-24','2026-12-27',opening),[{debut:'2026-12-24',fin:'2026-12-24'}])
  assert.deepEqual(periodesChoisies(periods,'2027-01-01','2027-01-03',opening),[])
})
test('une description modifiée ne conserve pas aveuglément une ancienne fermeture',()=>{
  assert.equal(ouvertureEvenement({URI_ID_du_POI:source,Description:'Ouvert samedi et dimanche.'},rules),null)
  assert.equal(ouvertureEvenement({URI_ID_du_POI:'https://example.org/other',Description:description},rules),null)
})
test('les jours mobiles et les dates civiles sont corrects',()=>{
  const holidays=joursFeries(2027)
  for(const day of ['2027-03-29','2027-05-06','2027-05-17'])assert.ok(holidays.has(day))
  assert.equal(dateValide('2026-02-29'),false);assert.equal(dateValide('2028-02-29'),true)
  assert.deepEqual(periodesChoisies([{debut:'2026-11-01',fin:'2027-01-01'}],'2026-11-01','2026-12-02',opening),[])
})
test('les occurrences hors période sont exclues et les plages bornées à la sélection',()=>{
  assert.deepEqual(periodesChoisies([{debut:'2026-11-02',fin:'2026-11-02'},{debut:'2026-11-15',fin:'2026-11-15'},{debut:'2026-11-22',fin:'2026-11-22'}],'2026-11-14','2026-11-15'),[{debut:'2026-11-15',fin:'2026-11-15'}])
})
test('longue liste repliée nativement et toutes les occurrences restent dans le HTML',()=>{
  const [event]=preparerEvenements([{Nom_du_POI:'Marché',Periodes_regroupees:'2026-11-14|2026-11-15|2026-11-16|2026-11-17|2026-11-18',Code_postal_et_commune:'34700#Lodève'}],'2026-11-14')
  const html=rendreCartes([event],true)
  assert.match(html,/<details class="ev-autres-dates"><summary>Voir les 2 autres dates<\/summary>/)
  assert.match(html,/data-carnet-dates=/)
  assert.equal((html.match(/<li class="ev-periode">/g)||[]).length,5)
  const [period]=preparerEvenements([{Nom_du_POI:'Expo',Periodes_regroupees:'2026-11-14<->2027-01-01'}],'2026-11-14')
  assert.ok(!rendreCartes([period],true).includes('data-carnet-dates='))
})
test('Cénomes garde la date exceptionnelle et la provenance, sans heure ou tarif inventé',()=>{
  const data={version:1,timezone:'Europe/Paris',updated:'2026-11-14',menus:[],events:[{date:'2026-12-18',service:'soir',title:'Moules-frites de décembre',dishes:['Exception du 18 décembre'],priceEur:null}],recurringEvents:[{id:'moules',rule:'last',weekday:5,service:'soir',title:'Moules-frites',dishes:['Moules-frites'],priceEur:null,startsOn:'2026-11-14',excludedDates:['2026-12-25']},{id:'raclette',rule:'first',weekday:5,service:'soir',title:'Raclette',dishes:['Raclette'],priceEur:null,startsOn:'2026-11-14'}]}
  const snap=instantaneCenomes(data,'2026-11-15'),events=evenementsCenomes(snap,'2026-11-15')
  assert.ok(events.some(e=>e.debut==='2026-11-27'))
  assert.ok(events.some(e=>e.debut==='2026-12-04'))
  assert.equal(events.filter(e=>e.debut==='2026-12-18').length,1)
  assert.ok(!events.some(e=>e.debut==='2026-12-25'))
  assert.ok(events.every(e=>e.commune==='Cénomes / Montagnol'&&!e.description.includes('18 €')))
  assert.match(events.find(e=>e.debut==='2026-12-18').bookingUrl,/date=2026-12-18&service=soir#rendez-vous-2026-12-18-soir$/)
  assert.match(rendreCartes(events,true),/Programme de L’Esquirol Cénomes/)
  assert.throws(()=>evenementsCenomes({...snap,sha256:'faux'},'2026-11-15'))
  const priced=structuredClone(data);priced.events[0].priceEur=29
  const pricedEvent=evenementsCenomes(instantaneCenomes(priced,'2026-11-15'),'2026-11-15').find(e=>e.debut==='2026-12-18')
  assert.match(rendreCartes([pricedEvent],true),/29,00/)
})
test('l’instantané ne conserve que les champs publics utilisés',()=>{
  assert.deepEqual(donneesPubliques([{Nom_du_POI:'Sortie',Champ_non_utilise:'inconnu',Description:'Texte'}]),[{Nom_du_POI:'Sortie',Description:'Texte'}])
})
