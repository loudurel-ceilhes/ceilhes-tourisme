// Une navigation commune ; les contenus des pages restent en HTML autonome.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const racine = dirname(dirname(fileURLToPath(import.meta.url)))
const liens = [
  ['mon-sejour.html', 'Mon séjour'], ['recherche.html', 'Rechercher'],
  ['agenda.html', 'Agenda'],
  ['le-lac.html', 'Le lac'], ['l-orb.html', "L’Orb"],
  ['randonnees.html', 'Randonnées'], ['nature.html', 'Nature'],
  ['terroir.html', 'Terroir'], ['producteurs-region.html', 'Producteurs'],
  ['patrimoine.html', 'Patrimoine'], ['alentours.html', 'Alentours'],
  ['vie-associative.html', 'Vie du village'],
  ['hebergeurs.html', 'Hébergeurs'], ['galerie.html', 'Galerie'],
  ['infos-pratiques.html', 'Infos'],
]
const guides = [
  ['guide-curistes-avene.html', 'Séjour des curistes'],
  ['circuits-producteurs.html', 'Circuits de producteurs'],
  ['petites-balades.html', 'Petites balades'],
  ['bienvenue.html', 'Bien préparer son arrivée'],
  ['kit-hebergeurs.html', 'Kit pour les hébergeurs'],
  ['services-essentiels.html', 'Services essentiels'],
]

export function navigation(page) {
  const lien = ([url, label]) => `<a href="${url}"${page === url ? ' class="active" aria-current="page"' : ''}>${label}</a>`
  return `<nav id="nav" aria-label="Navigation principale">
  <a href="index.html" class="logo">Ceilhes<span>-et-</span>Rocozels</a>
  <button class="burger" id="burger" type="button" aria-label="Ouvrir le menu" aria-controls="menu" aria-expanded="false"><span></span><span></span><span></span></button>
  <ul id="menu">
${liens.map(item => `    <li>${lien(item)}</li>`).join('\n')}
    <li><details class="nav-guides"><summary>Guides pratiques</summary><div class="nav-guides-list">
${guides.map(item => `      ${lien(item)}`).join('\n')}
    </div></details></li>
  </ul>
</nav>`
}

export function genererNavigation(root = racine) {
  let count = 0
  for (const page of readdirSync(root).filter(p => p.endsWith('.html') && p !== 'reglage-carte.html')) {
    const path = join(root, page), before = readFileSync(path, 'utf8')
    const pattern = /<nav\b(?=[^>]*\bid="nav")[^>]*>[\s\S]*?<\/nav>/
    if (!pattern.test(before)) throw new Error(`Navigation absente : ${page}`)
    const after = before.replace(pattern, () => navigation(page))
    if (before !== after) writeFileSync(path, after)
    count++
  }
  return count
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`Navigation commune : ${genererNavigation()} pages.`)
}
