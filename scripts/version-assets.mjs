// Colle une empreinte du contenu à l'adresse du style et du script :
// `styles.css` devient `styles.css?v=8f3c1a20`.
//
// POURQUOI (vécu) : un navigateur qui a gardé `styles.css` en mémoire ne
// redemande pas le fichier. Il continue d'afficher l'ancien style pendant des
// jours. Concrètement, la galerie affichait des photos étirées quatre fois en
// hauteur alors que la correction était en ligne depuis longtemps — parce que
// le navigateur appliquait encore la feuille de style d'avant.
//
// Et on ne peut pas « annuler » un cache déjà posé : le navigateur ne
// redemande rien avant l'expiration. La seule issue est de changer l'ADRESSE
// du fichier. L'empreinte vient du contenu : elle ne bouge que si le fichier a
// vraiment changé, donc le cache reste efficace tout en devenant impossible à
// servir périmé.
//
// Netlify lance ce script à chaque publication (voir netlify.toml). Il est
// idempotent : on peut le relancer autant de fois qu'on veut.

import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = fileURLToPath(new URL('..', import.meta.url))
const DOSSIERS_IGNORES = new Set(['node_modules', '.git', 'images', 'scripts', '.claude', '.github'])

/** Empreinte de chaque fichier de style ou de script, par chemin relatif. */
function empreintes() {
  const carte = new Map()
  for (const f of readdirSync(join(RACINE, 'assets'))) {
    if (!/\.(css|js)$/.test(f)) continue
    const contenu = readFileSync(join(RACINE, 'assets', f))
    carte.set(`assets/${f}`, createHash('sha1').update(contenu).digest('hex').slice(0, 8))
  }
  return carte
}

function pages(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    if (DOSSIERS_IGNORES.has(e)) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) pages(p, acc)
    else if (e.endsWith('.html')) acc.push(p)
  }
  return acc
}

// Attrape `assets/styles.css`, avec ou sans `?v=…` déjà présent.
const ADRESSE = /(["'])((?:\.\/|\/)?)(assets\/[^"'?]+\.(?:css|js))(?:\?[^"']*)?(["'])/g

const versions = empreintes()
if (!versions.size) {
  console.error('Aucun fichier de style ou de script trouvé dans assets/ — arrêt.')
  process.exit(1)
}

let modifiees = 0
for (const f of pages(RACINE)) {
  const avant = readFileSync(f, 'utf8')
  const apres = avant.replace(ADRESSE, (tout, q1, prefixe, chemin, q2) => {
    const v = versions.get(chemin)
    return v ? `${q1}${prefixe}${chemin}?v=${v}${q2}` : tout
  })
  if (apres !== avant) {
    writeFileSync(f, apres)
    modifiees++
  }
}

console.log(
  `Empreintes posées sur ${modifiees} page(s) : ` +
    [...versions].map(([f, v]) => `${f.split('/').pop()}?v=${v}`).join(', ')
)
