import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

// Le générateur écrit une page : les essais travaillent uniquement sur une
// copie, pour ne jamais réécrire le contenu du dépôt pendant les contrôles.
async function avecCopie(action, transformer = x => x) {
  const dossier = await mkdtemp(join(tmpdir(), 'ceilhes-producteurs-'))
  try {
    await mkdir(join(dossier, 'scripts'))
    await mkdir(join(dossier, 'data'))
    await copyFile(new URL('../scripts/producteurs.mjs', import.meta.url), join(dossier, 'scripts/producteurs.mjs'))
    const donnees = transformer(JSON.parse(await readFile(new URL('../data/producteurs.json', import.meta.url), 'utf8')))
    await writeFile(join(dossier, 'data/producteurs.json'), JSON.stringify(donnees))
    await writeFile(join(dossier, 'terroir.html'), '<main><!-- @producteurs --><!-- @/producteurs --></main>')
    const generer = async () => {
      execFileSync(process.execPath, ['scripts/producteurs.mjs'], { cwd: dossier })
      return readFile(join(dossier, 'terroir.html'), 'utf8')
    }
    await action({ donnees, generer })
  } finally {
    await rm(dossier, { recursive: true, force: true })
  }
}

test('annuaire complet sans JavaScript, informations de vente et génération stable', async () => {
  await avecCopie(async ({ donnees, generer }) => {
    const producteurs = donnees.zones.flatMap(z => z.producteurs)
    const html = await generer()
    assert.equal((html.match(/<article class="prod-card /g) || []).length, producteurs.length)
    assert.equal((html.match(/class="prod-vente"/g) || []).length, producteurs.filter(p => p.vente).length)
    assert.equal((html.match(/class="prod-maj"/g) || []).length, producteurs.filter(p => p.maj).length)
    assert.equal((html.match(/class="prod-confirmation"/g) || []).length, producteurs.filter(p => p.actif === 'incertain').length)
    assert.match(html, /<form[^>]+id="filtres-producteurs"[^>]+hidden>/)
    assert.doesNotMatch(html, /<article[^>]+\shidden[\s>]/)
    assert.equal(await generer(), html)
  })
})

test('les données contenant du HTML ne deviennent pas des balises ou scripts', async () => {
  await avecCopie(async ({ generer }) => {
    const html = await generer()
    assert.doesNotMatch(html, /<img src=x onerror=/)
    assert.match(html, /&lt;img src=x onerror=/)
    assert.match(html, /\\u003c\/script>/)
    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/)
  }, donnees => {
    const p = donnees.zones[0].producteurs[0]
    p.nom = '</script><script>alert(1)</script>'
    p.vente = '<img src=x onerror=alert(1)>'
    p.labels = ['<img src=x onerror=alert(1)>']
    return donnees
  })
})

function categories(html) {
  return new Map([...html.matchAll(/<article[^>]*\bid="([^"]+)"[^>]*\bdata-produits="([^"]*)"/g)]
    .map(([, id, liste]) => [id, liste.split(' ').filter(Boolean)]))
}

test('les caveaux des domaines viticoles ne sont pas classés en viandes', async () => {
  await avecCopie(async ({ donnees, generer }) => {
    const resultats = categories(await generer())
    for (const nom of ['Mas des Chimères', 'Le Clos du Serres']) {
      const fiche = donnees.zones.flatMap(z => z.producteurs).find(p => p.nom === nom)
      assert.ok(fiche, nom)
      assert.ok(resultats.get(fiche.id).includes('boissons'), nom)
      assert.ok(!resultats.get(fiche.id).includes('viandes'), nom)
    }
  })
})

test('mots entiers, pluriels et ligatures distinguent les produits des fragments de mots', async () => {
  const exemples = [
    ['veau', 'viandes'], ['veaux', 'viandes'], ['porc', 'viandes'], ['porcs', 'viandes'],
    ['pain', 'douceurs'], ['pains', 'douceurs'], ['jus', 'boissons'],
    ['bœufs', 'viandes'], ['œufs', 'viandes'], ['oeufs', 'viandes'],
    ['Caveau : venez jusqu’au porche avec un copain.', null],
  ]
  await avecCopie(async ({ donnees, generer }) => {
    const resultats = categories(await generer())
    const fiches = donnees.zones.flatMap(z => z.producteurs)
    exemples.forEach(([texte, attendu], i) => {
      assert.deepEqual(resultats.get(fiches[i].id), attendu ? [attendu] : [], texte)
    })
  }, donnees => {
    const fiches = donnees.zones.flatMap(z => z.producteurs)
    exemples.forEach(([texte], i) => {
      fiches[i].nom = `Producteur ${i + 1}`
      fiches[i].description = texte
    })
    return donnees
  })
})
