import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { verifierContenu, verifierSite } from '../scripts/verifier-site.mjs'

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'ceilhes-verificateur-test-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const page = (contenu = '') => '<!doctype html><html lang="fr"><head><title>Test</title></head><body><ul id="menu"><li><a href="index.html">Accueil</a></li></ul><h1>Test</h1>' + contenu + '</body></html>'
  const ecrire = (f, contenu) => { mkdirSync(join(dir, f, '..'), { recursive: true }); writeFileSync(join(dir, f), contenu) }
  ecrire('index.html', page('<section id="été">Été</section>'))
  return { dir, page, ecrire }
}

test('ignore les faux liens dans les commentaires et le JavaScript ; décode les ancres', t => {
  const f = fixture(t)
  f.ecrire('index.html', f.page('<section id="été">Été</section><a href="#%C3%A9t%C3%A9">Lire</a><!-- <img src="absente.jpg"> --><script>const exemple = \'<a href="absent.html">\';</script>'))
  assert.deepEqual(verifierContenu(f.dir).erreurs, [])
})

test('signale les fichiers srcset et CSS absents, ainsi que les ancres cassées', t => {
  const f = fixture(t)
  f.ecrire('index.html', f.page('<a href="#absente">Lire</a><img srcset="photo.webp 640w, absente.webp 1000w"><link rel="stylesheet" href="assets/style.css">'))
  f.ecrire('photo.webp', 'fixture')
  f.ecrire('assets/style.css', 'body { background:url(../fond-absent.webp) }')
  const erreurs = verifierContenu(f.dir).erreurs.join('\n')
  assert.match(erreurs, /ancre absente : #absente/)
  assert.match(erreurs, /fichier absent : absente.webp/)
  assert.match(erreurs, /fichier absent : ..\/fond-absent.webp/)
})

test('refuse JSON-LD invalide, identifiants répétés et navigation incohérente', t => {
  const f = fixture(t)
  f.ecrire('autre.html', f.page('<div id="double"></div><div id="double"></div><script type="application/ld+json">{oops}</script>').replace('href="index.html"', 'href="autre.html"'))
  const erreurs = verifierContenu(f.dir).erreurs.join('\n')
  assert.match(erreurs, /identifiant répété #double/)
  assert.match(erreurs, /application\/ld\+json invalide/)
  assert.match(erreurs, /menu différent/)
})

test('détecte une génération instable sans toucher aux sources', t => {
  const f = fixture(t)
  f.ecrire('netlify.toml', '[build]\ncommand = "node scripts/generer.mjs"\n')
  f.ecrire('scripts/generer.mjs', 'import {appendFileSync} from "node:fs"; appendFileSync("index.html", "\\n");')
  const avant = readFileSync(join(f.dir, 'index.html'), 'utf8')
  assert.match(verifierSite(f.dir).erreurs.join('\n'), /génération n’est pas stable/)
  assert.equal(readFileSync(join(f.dir, 'index.html'), 'utf8'), avant)
})

test('refuse une empreinte d’asset périmée dans le résultat publié', t => {
  const f = fixture(t)
  f.ecrire('index.html', f.page('<script src="assets/app.js?v=ancienne"></script>'))
  f.ecrire('assets/app.js', 'console.log("test")')
  assert.deepEqual(verifierContenu(f.dir).erreurs, [])
  assert.match(verifierContenu(f.dir, { versions: true }).erreurs.join('\n'), /empreinte périmée/)
})

test('le contrôle final rend un échec pour un fichier absent ou une empreinte périmée', t => {
  const f = fixture(t)
  f.ecrire('scripts/verifier-site.mjs', readFileSync(new URL('../scripts/verifier-site.mjs', import.meta.url)))
  const lancer = () => spawnSync(process.execPath, ['scripts/verifier-site.mjs', '--publication'], { cwd: f.dir, encoding: 'utf8' })
  f.ecrire('index.html', f.page('<img src="absente.jpg">'))
  let resultat = lancer()
  assert.equal(resultat.status, 1)
  assert.match(resultat.stderr, /fichier absent/)
  f.ecrire('assets/app.js', 'console.log("test")')
  f.ecrire('index.html', f.page('<script src="assets/app.js?v=ancienne"></script>'))
  resultat = lancer()
  assert.equal(resultat.status, 1)
  assert.match(resultat.stderr, /empreinte périmée/)
})

test('le mode publication ne relance jamais les générateurs', t => {
  const f = fixture(t)
  f.ecrire('scripts/verifier-site.mjs', readFileSync(new URL('../scripts/verifier-site.mjs', import.meta.url)))
  f.ecrire('netlify.toml', '[build]\ncommand = "node scripts/generer.mjs"\n')
  f.ecrire('scripts/generer.mjs', 'throw new Error("Ce générateur ne doit pas être exécuté")')
  const resultat = spawnSync(process.execPath, ['scripts/verifier-site.mjs', '--publication'], { cwd: f.dir, encoding: 'utf8' })
  assert.equal(resultat.status, 0, resultat.stderr)
  assert.match(resultat.stdout, /aucune génération relancée/)
})

test('la génération complète accepte le contrôle final sans récursion', t => {
  const f = fixture(t)
  f.ecrire('scripts/verifier-site.mjs', readFileSync(new URL('../scripts/verifier-site.mjs', import.meta.url)))
  f.ecrire('netlify.toml', '[build]\ncommand = "node scripts/generer.mjs && node scripts/verifier-site.mjs --publication"\n')
  f.ecrire('scripts/generer.mjs', '// Génération stable de la fixture.')
  assert.deepEqual(verifierSite(f.dir).erreurs, [])
  // Même un lien cassé créé par la génération doit bloquer le résultat final.
  f.ecrire('scripts/generer.mjs', 'import {appendFileSync} from "node:fs"; appendFileSync("index.html", \'<a href="absent.html">Lien</a>\');')
  assert.throws(() => verifierSite(f.dir), /--publication a échoué[\s\S]*fichier absent/)
})
