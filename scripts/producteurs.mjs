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

// Les filtres s'appuient uniquement sur les produits déjà décrits dans les
// fiches. La recherche libre complète ce classement pour les produits rares.
// Les mots sont délimités après normalisation : « veau » ne doit pas classer
// un « caveau » en viande, ni « jus » reconnaître « jusqu'au ».
const mots = motif => new RegExp(`\\b(?:${motif})\\b`, 'i')
const PRODUITS = [
  ['laitages', 'Fromages & laitages', mots('fromages?|fromageries?|yaourts?|pelardons?|roquefort|perails?|tommes?|beurre|glaces?|lait cru|laits crus')],
  ['miel', 'Miel', mots('miels?|mielleries?|apiculteurs?|apiculture|ruches?|ruchers?')],
  ['viandes', 'Viandes, œufs & poissons', mots('viandes?|charcuteries?|charcutiers?|salaisons?|jambons?|saucisses?|saucissons?|boeufs?|veaux?|agneaux?|porcs?|chevreaux?|volailles?|poulets?|pintades?|oeufs?|truites?|poissons?|escargots?')],
  ['vegetal', 'Fruits, légumes & plantes', mots('fruits?|legumes?|maraichage|maraichers?|maraicheres?|plantes?|safran|olives?|huiles?|lentilles?|pois chiches?|fraises?|abricots?|prunes?|chataignes?|noix')],
  ['douceurs', 'Pains & douceurs', mots('pains?|fournils?|boulangers?|boulangeres?|boulangeries?|biscuits?|biscuiteries?|patisseries?|sorbets?|confitures?|glaces?|macarons?')],
  ['boissons', 'Vins, bières & boissons', mots('vins?|vignes?|cepages?|vignerons?|vigneronnes?|bieres?|brasseries?|limonades?|jus|liqueurs?|pastis|roussanne|mourvedre|terrasses du larzac')],
]

function produits(p) {
  const texte = `${p.nom} ${p.description}`.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replaceAll('œ', 'oe').replaceAll('Œ', 'OE')
  return PRODUITS.filter(([, , motif]) => motif.test(texte)).map(([id]) => id)
}

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

/**
 * Le lien « Itinéraire » : ouvre Google Maps sur l'adresse précise de la
 * ferme. C'est Google qui géolocalise l'adresse au moment du clic, sur
 * l'appareil du visiteur — bien plus précis que notre épingle posée au
 * centre de la commune. Si l'adresse en contient plusieurs (séparées par
 * « ; »), on prend la première ; sans adresse, on cherche « nom, lieu ».
 */
function lienMaps(p) {
  const adr = (p.adresse || '').split(';')[0].trim()
  const requete = adr || `${p.nom}, ${p.lieu}`
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(requete)
}

/** La ligne de contact d'une fiche (téléphone · site · itinéraire). */
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
  morceaux.push(
    `<a href="${echappe(lienMaps(p))}" target="_blank" rel="noopener">🧭 Itinéraire</a>`
  )
  return `\n        <div class="contact">${morceaux.join('<span class="sep"> · </span>')}</div>`
}

/** Une fiche producteur complète. */
function fiche(p) {
  const lignes = [
    `      <article class="prod-card reveal" id="${echappe(p.id)}" data-produits="${produits(p).join(' ')}" data-esquirol="${Boolean(p.badge)}" tabindex="-1">`,
    `        <div class="picto" aria-hidden="true">${echappe(p.picto)}</div>`,
    `        <h4>${echappe(p.nom)}</h4>`,
    `        <div class="where">${echappe(p.lieu)}</div>`,
    `        <p>${echappe(p.description)}</p>${contact(p)}`,
  ]
  if (p.vente) lignes.push(`        <p class="prod-vente"><strong>Pour acheter :</strong> ${echappe(p.vente)}</p>`)
  if (p.labels?.length) lignes.push(`        <p class="prod-labels"><strong>Labels :</strong> ${p.labels.map(echappe).join(' · ')}</p>`)
  if (p.actif === 'incertain') lignes.push('        <p class="prod-confirmation">Activité et coordonnées à confirmer avant de vous déplacer.</p>')
  if (/^\d{4}-\d{2}-\d{2}$/.test(p.maj || '')) {
    const [annee, mois, jour] = p.maj.split('-')
    lignes.push(`        <p class="prod-maj">Fiche mise à jour le <time datetime="${p.maj}">${jour}/${mois}/${annee}</time></p>`)
  }
  const pied = []
  if (p.portrait?.url) {
    pied.push(
      `<a class="portrait" href="${echappe(p.portrait.url)}" target="_blank" rel="noopener">${echappe(p.portrait.libelle || 'Lire son portrait →')}</a>`
    )
  }
  if (p.badge) pied.push(`<span class="tag">${echappe(p.badge)}</span>`)
  if (pied.length) lignes.push(`        ${pied.join('')}`)
  lignes.push('      </article>')
  return lignes.join('\n')
}

/** Une zone : titre, sous-titre, grille de fiches. */
function zone(z, i) {
  return [
    `    <div class="prod-zone" data-zone="${i}">`,
    `    <h4 class="zone-title reveal">${echappe(z.titre)}</h4>`,
    `    <p class="zone-sub reveal">${echappe(z.sousTitre)}</p>`,
    '    <div class="prod-grid">',
    ...z.producteurs.map(fiche),
    '    </div>',
    '    </div>',
  ].join('\n')
}

function filtres(zones, total) {
  return `    <form class="prod-filtres" id="filtres-producteurs" role="search" aria-label="Rechercher un producteur" hidden>
      <div class="prod-champs">
        <label for="recherche-producteurs">Un nom, un produit, une commune
          <input id="recherche-producteurs" name="recherche" type="search" placeholder="Ex. : fromage, Avène, La Part du Loup" autocomplete="off" aria-controls="resultats-producteurs">
        </label>
        <label for="produit-producteurs">Produit
          <select id="produit-producteurs" name="produit" aria-controls="resultats-producteurs">
            <option value="">Tous les produits</option>
${PRODUITS.map(([id, nom]) => `            <option value="${id}">${echappe(nom)}</option>`).join('\n')}
          </select>
        </label>
        <label for="zone-producteurs">Autour de…
          <select id="zone-producteurs" name="zone" aria-controls="resultats-producteurs">
            <option value="">Tous les secteurs</option>
${zones.map((z, i) => `            <option value="${i}">${echappe(z.titre.split('—')[0].trim())}</option>`).join('\n')}
          </select>
        </label>
      </div>
      <div class="prod-options">
        <label class="prod-checkbox"><input type="checkbox" name="esquirol" id="esquirol-producteurs"> En rayon à L'Esquirol</label>
        <button type="reset">Effacer les filtres</button>
      </div>
      <div class="prod-result-nav">
        <p id="compte-producteurs" role="status" aria-live="polite" aria-atomic="true">${total} producteurs</p>
        <a href="#resultats-producteurs">Voir les fiches ↓</a>
      </div>
    </form>
    <p class="prod-conseil">Avant de partir, appelez pour confirmer l'ouverture et les produits disponibles. Les horaires peuvent évoluer selon la saison.</p>`
}

/**
 * La carte des producteurs : le conteneur, la légende, et les données des
 * repères dans un bloc JSON que assets/producteurs.js lit pour poser les épingles.
 * Un producteur sans champ
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
        maps: lienMaps(p),
      })
    }
  })
  if (!reperes.length) return ''
  const legende = zones
    .map((z) => `      <span><span class="dot" style="background:${z.couleur}"></span> ${echappe(z.titre.split('—')[0].trim())}</span>`)
    .join('\n')
  return `    <p id="etat-carte-producteurs" class="prod-carte-note" role="status" hidden></p>
    <div class="prod-carte" id="bloc-carte-producteurs" hidden>
    <div id="carte-prod" aria-label="Carte des producteurs" role="region"></div>
    <div class="map-legend">
${legende}
    </div>
    <p class="prod-carte-note">Les repères peuvent être approximatifs ou écartés pour rester lisibles. Utilisez le lien « Itinéraire » de la fiche pour préparer votre trajet.</p>
    </div>
    <script type="application/json" id="donnees-carte">${JSON.stringify({ couleurs: zones.map((z) => z.couleur), reperes }).replaceAll('<', '\\u003c')}</script>`
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
    <div id="annuaire-producteurs">
${filtres(zones, total)}
${carte(zones)}

    <div id="resultats-producteurs" tabindex="-1">
${zones.map(zone).join('\n\n')}
    </div>
    <p id="aucun-producteur" class="prod-vide" hidden>Aucun producteur ne correspond à ces critères. Essayez un autre mot ou effacez les filtres.</p>
    </div>
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
