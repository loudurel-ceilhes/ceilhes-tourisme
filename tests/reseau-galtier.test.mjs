import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { generer, valider, adressePublique } from '../scripts/reseau-galtier.mjs'
const lire = async () => JSON.parse(await readFile(new URL('../data/reseau-producteurs.json', import.meta.url), 'utf8'))

test('annuaire officiel complet, identifiants uniques et fiches accessibles sans JavaScript', async () => {
  const d = await lire(), html = generer(d)
  assert.equal(new Set(d.producteurs.filter(p => p.annuaireId).map(p => p.annuaireId)).size, d.nombreAnnuaire)
  assert.equal((html.match(/<article /g) || []).length, d.producteurs.length)
  assert.doesNotMatch(html, /<article[^>]*\shidden[\s>]/)
  assert.match(html, /id="reseau-filtres"[^>]*hidden/)
  for (const p of d.producteurs) assert.ok(html.includes(`id="${p.id}"`), p.id)
  assert.equal(generer(d), html)
  assert.doesNotMatch(html, /produit\.php\?client=/, 'pas de faux lien public vers le catalogue professionnel')
})

test('un nom ou une URL malveillante reste du texte et ne devient pas du code', async () => {
  const d = await lire(), p = d.producteurs[0]
  p.nom = '<img src=x onerror=alert(1)>'
  p.notesPubliques = '</article><script>alert(1)</script>'
  p.site = 'javascript:alert(1)'
  const html = generer(d)
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/)
  assert.doesNotMatch(html, /<img src=x|<script>alert|href="javascript:/)
  assert.equal(adressePublique('https://identifiant:secret@example.com'), null)
  assert.equal(adressePublique('data:text/html,bad'), null)
})

test('un doublon, un identifiant local invalide ou une donnée privée fait échouer la génération', async () => {
  const d = await lire()
  d.producteurs.push(d.producteurs[0])
  assert.throws(() => valider(d), /répété/)
  d.producteurs.pop()
  d.producteurs[0].email = 'private@example.com'
  assert.throws(() => valider(d), /privée/)
  delete d.producteurs[0].email
  d.producteurs[0].ficheLocale = '" onclick="alert(1)'
  assert.throws(() => valider(d), /Ancre locale/)
})

test('les fiches du guide existant sont réutilisées avec leur ancre stable', async () => {
  const d = await lire()
  const locaux = JSON.parse(await readFile(new URL('../data/producteurs.json', import.meta.url), 'utf8')).zones.flatMap(z => z.producteurs)
  const ids = new Set(locaux.map(p => p.id))
  for (const p of d.producteurs.filter(p => p.ficheLocale)) assert.ok(ids.has(p.ficheLocale), p.nom)
  const html = generer(d)
  assert.match(html, /terroir\.html#l-arc-en-miel/)
  assert.match(html, /Disponibilité à confirmer/)
})


test('la présentation et les adresses publiques restent centrées sur les producteurs', async () => {
  const d = await lire()
  const page = await readFile(new URL('../producteurs-region.html', import.meta.url), 'utf8')
  assert.doesNotMatch(JSON.stringify(d), /galtier/i)
  assert.doesNotMatch(page, /galtier|ramasse/i)
  assert.match(page, /https:\/\/ceilhes-tourisme\.fr\/producteurs-region\.html/)
  assert.match(page, /assets\/reseau-producteurs\.js/)
  assert.equal((page.match(/<article /g) || []).length, d.producteurs.length)
})
