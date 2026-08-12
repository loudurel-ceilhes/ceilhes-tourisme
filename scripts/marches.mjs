// Fabrique la section « Les marchés du pays » de terroir.html à partir du
// fichier de données data/marches.json — même principe que producteurs.mjs :
// on ne modifie JAMAIS le HTML entre les balises <!-- @marches --> et
// <!-- @/marches -->, on modifie le fichier de données puis on relance :
//
//   node scripts/marches.mjs
//
// Netlify lance ce script à chaque publication (voir netlify.toml).
// Champs de chaque marché : commune, departement, jour, horaires, periode,
// lieu, type, note, saisonnier (true = marché d'été/saison), jourTri (0 =
// lundi … 6 = dimanche, pour l'ordre d'affichage), confiance ("haute" ou
// "moyenne" — une confiance moyenne affiche « à vérifier »), sources, maj.

import { readFile, writeFile } from 'node:fs/promises'

const DONNEES = new URL('../data/marches.json', import.meta.url)
const PAGE = new URL('../terroir.html', import.meta.url)

function echappe(t) {
  return String(t)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

/** Une ligne de marché : commune en gras, puis les détails utiles. */
function ligne(m, avecJour) {
  const bouts = []
  if (avecJour) bouts.push(echappe(m.jour))
  if (m.horaires) bouts.push(echappe(m.horaires))
  if (m.lieu) bouts.push(echappe(m.lieu))
  let texte = `<b>${echappe(m.commune)}</b>${m.departement !== '34' ? ` (${echappe(m.departement)})` : ''} — ${bouts.join(', ')}`
  if (m.saisonnier && m.periode) texte += ` <em>· ${echappe(m.periode)}</em>`
  if (m.confiance === 'moyenne') texte += ' <small>· à vérifier</small>'
  const chez = m.commune === 'Ceilhes-et-Rocozels' ? ' class="chez-nous"' : ''
  return `      <li${chez}>${texte}</li>`
}

async function main() {
  const { marches } = JSON.parse(await readFile(DONNEES, 'utf8'))
  if (!Array.isArray(marches) || marches.length < 5) {
    throw new Error('data/marches.json suspect : on ne touche à rien')
  }

  const annee = marches.filter((m) => !m.saisonnier).sort((a, b) => a.jourTri - b.jourTri)
  const ete = marches.filter((m) => m.saisonnier)
    .sort((a, b) => (b.commune === 'Ceilhes-et-Rocozels') - (a.commune === 'Ceilhes-et-Rocozels') || a.jourTri - b.jourTri)

  const parJour = []
  for (const j of JOURS.keys()) {
    const dm = annee.filter((m) => m.jourTri === j)
    if (!dm.length) continue
    parJour.push(`      <li class="jour"><b>${JOURS[j]}</b></li>`)
    parJour.push(...dm.map((m) => ligne(m, false)))
  }

  const bloc = `<!-- @marches — généré par scripts/marches.mjs depuis data/marches.json : ne pas modifier à la main, modifier le fichier de données -->
    <h4 class="zone-title reveal">Les marchés du pays</h4>
    <p class="zone-sub reveal">Où remplir son panier, jour par jour — et les belles soirées de producteurs de l'été.</p>
    <div class="marches reveal">
      <div class="marches-col">
      <h5>À l'année</h5>
      <ul>
${parJour.join('\n')}
      </ul>
      </div>
      <div class="marches-col">
      <h5>L'été — producteurs &amp; nocturnes</h5>
      <ul>
${ete.map((m) => ligne(m, true)).join('\n')}
      </ul>
      </div>
    </div>
    <!-- @/marches -->`

  let html = await readFile(PAGE, 'utf8')
  if (!html.includes('<!-- @marches')) {
    throw new Error('Balises <!-- @marches --> introuvables dans terroir.html')
  }
  html = html.replace(/<!-- @marches[\s\S]*?<!-- @\/marches -->/, bloc)
  await writeFile(PAGE, html, 'utf8')
  console.log(`terroir.html mis à jour — ${annee.length} marchés à l'année, ${ete.length} saisonniers`)
}

main().catch((e) => {
  console.error('Échec de la génération des marchés :', e.message)
  process.exit(1)
})
