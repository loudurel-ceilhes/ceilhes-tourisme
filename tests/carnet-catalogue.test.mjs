import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cataloguer, generer, publicUrl } from '../scripts/carnet-catalogue.mjs';

const card = (id = 'idee-1', title = 'Le Bouloc &amp; le village', url = 'randonnees.html#balade-bouloc') => `<article data-carnet-id="${id}" data-carnet-title="${title}" data-carnet-category="Randonnée" data-carnet-url="${url}"></article>`;

test('catalogue public : entités décodées, doublons identiques fusionnés, scripts et commentaires exclus', () => {
  const data = cataloguer([['randonnees.html', card() + card() + `<!-- ${card('cache')} --><script>${card('script')}</script>`]]);
  assert.deepEqual(data.items, [{ id: 'idee-1', title: 'Le Bouloc & le village', category: 'Randonnée', url: '/randonnees.html#balade-bouloc' }]);
});

test('un identifiant contradictoire et les destinations non publiques bloquent la génération', () => {
  assert.throws(() => cataloguer([['a.html', card() + card('idee-1', 'Autre titre')]]), /contradictoire/);
  assert.throws(() => cataloguer([['a.html', card('id invalide')]]), /invalide/);
  for (const url of ['javascript:alert(1)', 'https://exemple.org/', '/assets/script.js', 'https://secret:motdepasse@ceilhes-tourisme.fr/']) {
    assert.throws(() => publicUrl(url, 'a.html'));
  }
  assert.equal(publicUrl('https://www.sitytrail.com/fr/trails/42', 'a.html'), 'https://www.sitytrail.com/fr/trails/42');
});

test('le catalogue intégré ne peut pas fermer son script JSON et la génération est stable', () => {
  const root = mkdtempSync(join(tmpdir(), 'carnet-'));
  try {
    mkdirSync(join(root, 'data'));
    writeFileSync(join(root, 'a.html'), card('texte', '&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt;'));
    writeFileSync(join(root, 'mon-sejour.html'), '<!-- @carnet-catalogue -->\n<!-- @/carnet-catalogue -->');
    assert.equal(generer(root), 1);
    const first = readFileSync(join(root, 'mon-sejour.html'), 'utf8');
    assert.equal((first.match(/<\/script>/g) || []).length, 1);
    assert.ok(first.includes('\\u003c/script>'));
    generer(root);
    assert.equal(readFileSync(join(root, 'mon-sejour.html'), 'utf8'), first);
  } finally { rmSync(root, { recursive: true, force: true }); }
});


test('une étape de guide conserve sa catégorie publique et refuse une catégorie libre', () => {
  const guide = card('guide-arrivee', 'Préparer son arrivée', 'guide-curistes-avene.html#arrivee').replace('data-carnet-category="Randonnée"', 'data-carnet-category="Guide"');
  const item = cataloguer([['guide-curistes-avene.html', guide]]).items[0];
  assert.equal(item.category, 'Guide');
  assert.equal(item.url, '/guide-curistes-avene.html#arrivee');
  assert.throws(() => cataloguer([['guide-curistes-avene.html', guide.replace('data-carnet-category="Guide"', 'data-carnet-category="Catégorie inconnue"')]]), /invalide/);
});
