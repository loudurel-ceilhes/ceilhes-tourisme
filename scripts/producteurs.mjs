// Fabrique les fiches producteurs de terroir.html à partir du fichier de
// données data/producteurs.json.
//
// POURQUOI : l'annuaire compte plus de 80 producteurs. Écrits à la main dans
// le HTML, corriger un téléphone ou ajouter une ferme demandait de fouiller
// des centaines de lignes. Désormais, TOUT se passe dans
// data/producteurs.json : une entrée par producteur, lisible, modifiable
// avec n'importe quel éditeur de texte. Ce script transforme le fichier en
// fiches HTML entre les balises <!-- @producteurs --> et
// <!-- @/producteurs --> de terroir.html.
//
// Le visiteur, lui, reçoit toujours une page toute prête : rien ne change
// pour la vitesse ni le référencement. Le site reste 100 % statique.
//
// Netlify lance ce script à chaque publication (voir netlify.toml), et le
// HTML généré est aussi enregistré dans le dépôt : même sans lancer le
// script, la page est complète. Il est idempotent : on peut le relancer
// autant de fois qu'on veut.
//
//   node scripts/producteurs.mjs            # met à jour terroir.html
//   node scripts/producteurs.mjs --dry-run  # montre ce qui serait fait
//
// Champs de chaque producteur (seuls id, nom, picto, lieu et description
// sont obligatoires ; tout le reste peut être null ou absent) :
//   id          identifiant court unique (minuscules-et-traits-d-union)
//   nom         nom affiché
//   picto       l'émoji de la fiche
//   lieu        hameau / commune (+ département entre parenthèses hors 34)
//   description une ou deux phrases, uniquement des faits vérifiés
//   badge       « 🛒 En rayon à L'Esquirol » ou variante, sinon null
//   portrait    { url, libelle } vers un article du journal d'esquirols.fr
//   telephone / email / site / facebook / instagram
//   adresse     adresse postale précise (pour un futur plan, pas affichée)
//   vente       horaires, périodes, marchés — en une phrase
//   labels      ["AB", "AOP", …]
//   sources     adresses web où l'info a été vérifiée (jamais affichées)
//   maj         date de dernière vérification (AAAA-MM-JJ)
//
// Sur la page, on affiche le téléphone et le site — PAS l'email, pour ne pas
// le livrer aux robots collecteurs de spam. Il reste dans le fichier pour
// nous.

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const RACINE = fileURLToPath(new URL('..', import.meta.url))
const DONNEES = new URL('../data/producteurs.json', import.meta.url)
const PAGE = new URL('../terroir.html', import.meta.url)

/** Échappe ce qui doit l'être dans du HTML. */
function echappe(t) {
  return String(t)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** Un téléphone « 06 12 34 56 78 » vers un lien cliquable tel:+33612345678. */
function lienTel(t) {
  const chiffres = t.replace(/\D/g, '')
  const inter = chiffres.startsWith('0') ? '+33' + chiffres.slice(1) : chiffres
  return `tel:${inter}`
}

/** Le nom de domaine seul, pour afficher un lien court et propre. */
function domaine(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** La ligne de contact d'une fiche (téléphone · site), si on a de quoi. */
function contact(p) {
  const morceaux = []
  if (p.telephone) {
    morceaux.push(`<a href="${lienTel(p.telephone)}">📞 ${echappe(p.telephone)}</a>`)
  }
  if (p.site) {
    morceaux.push(
      `<a href="${echappe(p.site)}" target="_blank" rel="noopener">🌐 ${echappe(domaine(p.site))}</a>`
    )
  }
  if (!morceaux.length) return ''
  return `\n        <div class="contact">${morceaux.join('<span class="sep"> · </span>')}</div>`
}

/** Une fiche producteur complète. */
function fiche(p) {
  const lignes = [
    `      <div class="prod-card reveal" id="${echappe(p.id)}">`,
    `        <div class="picto">${p.picto}</div>`,
    `        <h4>${echappe(p.nom)}</h4>`,
    `        <div class="where">${echappe(p.lieu)}</div>`,
    `        <p>${echappe(p.description)}</p>${contact(p)}`,
  ]
  const pied = []
  if (p.portrait?.url) {
    pied.push(
      `<a class="portrait" href="${echappe(p.portrait.url)}" target="_blank" rel="noopener">${echappe(p.portrait.libelle || 'Lire son portrait →')}</a>`
    )
  }
  if (p.badge) pied.push(`<span class="tag">${echappe(p.badge)}</span>`)
  if (pied.length) lignes.push(`        ${pied.join('')}`)
  lignes.push('      </div>')
  return lignes.join('\n')
}

/** Une zone : titre, sous-titre, grille de fiches. */
function zone(z) {
  return [
    `    <h4 class="zone-title reveal">${echappe(z.titre)}</h4>`,
    `    <p class="zone-sub reveal">${echappe(z.sousTitre)}</p>`,
    '    <div class="prod-grid">',
    ...z.producteurs.map(fiche),
    '    </div>',
  ].join('\n')
}

/**
 * La carte des producteurs : le conteneur, la légende, et les données des
 * repères dans un bloc JSON que assets/script.js lit pour poser les épingles
 * (voir « Carte des producteurs » dans script.js). Un producteur sans champ
 * gps n'apparaît simplement pas sur la carte.
 */
function carte(zones) {
  const reperes = []
  zones.forEach((z, i) => {
    for (const p of z.producteurs) {
      if (!Array.isArray(p.gps) || p.gps.length !== 2) continue
      reperes.push({
        id: p.id,
        nom: p.nom,
        picto: p.picto,
        lieu: p.lieu,
        zone: i,
        gps: p.gps,
        approx: p.gpsPrecision !== 'exacte',
        tel: p.telephone || null,
        site: p.site || null,
      })
    }
  })
  if (!reperes.length) return ''
  const legende = zones
    .map((z) => `      <span><span class="dot" style="background:${z.couleur}"></span> ${echappe(z.titre.split('—')[0].trim())}</span>`)
    .join('\n')
  return `    <div id="carte-prod" class="reveal" aria-label="Carte des producteurs"></div>
    <div class="map-legend reveal">
${legende}
    </div>
    <p class="reveal" style="text-align:center;font-size:.8rem;font-weight:300;margin-top:.6rem">Chaque repère est placé sur sa commune — appelez avant de prendre la route, les fermes sont parfois à l'écart du village.</p>
    <script type="application/json" id="donnees-carte">${JSON.stringify({ couleurs: zones.map((z) => z.couleur), reperes })}</script>`
}

async function main() {
  const essai = process.argv.includes('--dry-run')
  const { zones } = JSON.parse(await readFile(DONNEES, 'utf8'))

  // Garde-fous : mieux vaut échouer bruyamment que publier une page vide.
  const ids = new Set()
  let total = 0
  for (const z of zones) {
    if (!z.titre || !Array.isArray(z.producteurs)) throw new Error('Zone mal formée dans producteurs.json')
    for (const p of z.producteurs) {
      for (const champ of ['id', 'nom', 'picto', 'lieu', 'description']) {
        if (!p[champ]) throw new Error(`« ${p.nom || p.id || '?'} » : champ « ${champ} » manquant`)
      }
      if (ids.has(p.id)) throw new Error(`Identifiant en double : ${p.id}`)
      ids.add(p.id)
      total++
    }
  }
  if (total < 10) throw new Error(`Seulement ${total} producteurs : fichier suspect, on ne touche à rien`)

  const bloc = `<!-- @producteurs — généré par scripts/producteurs.mjs depuis data/producteurs.json : ne pas modifier à la main, modifier le fichier de données -->
${carte(zones)}

${zones.map(zone).join('\n\n')}
    <!-- @/producteurs -->`

  let html = await readFile(PAGE, 'utf8')
  if (!html.includes('<!-- @producteurs')) {
    throw new Error('Balises <!-- @producteurs --> introuvables dans terroir.html')
  }
  html = html.replace(/<!-- @producteurs[\s\S]*?<!-- @\/producteurs -->/, bloc)

  if (essai) {
    console.log(`${zones.length} zones, ${total} producteurs :`)
    for (const z of zones) console.log(`  - ${z.titre} : ${z.producteurs.length}`)
    console.log('\n(--dry-run : terroir.html non modifié)')
    return
  }

  await writeFile(PAGE, html, 'utf8')
  console.log(`terroir.html mis à jour — ${total} producteurs dans ${zones.length} zones`)
}

main().catch((e) => {
  console.error('Échec de la génération des producteurs :', e.message)
  process.exit(1)
})
