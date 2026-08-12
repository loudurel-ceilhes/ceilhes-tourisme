// Fabrique la section « Le patrimoine protégé du pays » de patrimoine.html à
// partir du fichier de données data/monuments.json — même principe que
// producteurs.mjs et marches.mjs : on ne modifie JAMAIS le HTML entre les
// balises <!-- @monuments --> et <!-- @/monuments -->, on modifie le fichier
// de données puis on relance :
//
//   node scripts/monuments.mjs
//
// Netlify lance ce script à chaque publication (voir netlify.toml).
// Chaque monument : nom, commune, departement, protection (« classé MH » ou
// « inscrit MH »), annee, merimee (référence PAxxxxxxxx de la base Mérimée
// du ministère de la Culture — sert au lien vers la notice officielle),
// description, groupe (clé du bloc d'affichage), sources, maj.
//
// Les monuments du groupe « village » ne sont PAS affichés ici : les églises
// de Ceilhes et de Rocozels ont déjà leur récit détaillé plus haut dans la
// page. Ils restent dans le fichier pour mémoire.

import { readFile, writeFile } from 'node:fs/promises'

const DONNEES = new URL('../data/monuments.json', import.meta.url)
const PAGE = new URL('../patrimoine.html', import.meta.url)

function echappe(t) {
  return String(t)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function ligne(m) {
  const badge = m.protection.startsWith('classé')
    ? '<span class="mh classe">Classé</span>'
    : '<span class="mh">Inscrit</span>'
  const notice = m.merimee
    ? ` <a href="https://pop.culture.gouv.fr/notice/merimee/${echappe(m.merimee)}" target="_blank" rel="noopener" title="Notice officielle (base Mérimée)">notice ↗</a>`
    : ''
  return `      <li><b>${echappe(m.nom)}</b> — ${echappe(m.commune)}${m.departement !== '34' ? ` (${echappe(m.departement)})` : ''} ${badge} <em>${echappe(m.annee)}</em>${notice}<br><span class="mh-desc">${echappe(m.description)}</span></li>`
}

async function main() {
  const { groupes, monuments } = JSON.parse(await readFile(DONNEES, 'utf8'))
  if (!Array.isArray(monuments) || monuments.length < 5) {
    throw new Error('data/monuments.json suspect : on ne touche à rien')
  }

  const blocs = []
  for (const [cle, titre] of Object.entries(groupes)) {
    if (cle === 'village') continue // déjà racontés plus haut dans la page
    const dm = monuments.filter((m) => m.groupe === cle)
    if (!dm.length) continue
    blocs.push(`    <h3 class="reveal" style="margin-top:2.2rem">${echappe(titre)}</h3>
    <ul class="monuments reveal">
${dm.map(ligne).join('\n')}
    </ul>`)
  }

  const bloc = `<!-- @monuments — généré par scripts/monuments.mjs depuis data/monuments.json : ne pas modifier à la main, modifier le fichier de données -->
    <div class="section-head reveal" style="margin-top:3.5rem">
      <div class="kicker">Base Mérimée</div>
      <h2>Le patrimoine protégé du pays</h2>
      <div class="line"></div>
    </div>
    <p class="reveal" style="font-weight:300;max-width:720px">Autour du village, une trentaine d'édifices sont protégés au titre des Monuments historiques — recensés ici depuis la base Mérimée du ministère de la Culture, avec lien vers chaque notice officielle.</p>
${blocs.join('\n')}
    <!-- @/monuments -->`

  let html = await readFile(PAGE, 'utf8')
  if (!html.includes('<!-- @monuments')) {
    throw new Error('Balises <!-- @monuments --> introuvables dans patrimoine.html')
  }
  html = html.replace(/<!-- @monuments[\s\S]*?<!-- @\/monuments -->/, bloc)
  await writeFile(PAGE, html, 'utf8')
  console.log(`patrimoine.html mis à jour — ${monuments.filter((m) => m.groupe !== 'village').length} monuments affichés`)
}

main().catch((e) => {
  console.error('Échec de la génération des monuments :', e.message)
  process.exit(1)
})
