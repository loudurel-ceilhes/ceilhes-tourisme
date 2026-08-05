/**
 * Met à jour l'agenda de ceilhes-tourisme.fr à partir des données ouvertes.
 *
 * D'OÙ VIENNENT LES DONNÉES
 * L'office de tourisme Grand Orb saisit ses événements dans Tourinsoft (le
 * système d'information touristique piloté par Hérault Tourisme). De là, ils
 * partent automatiquement dans DATAtourisme, la base nationale publiée sur
 * data.gouv.fr sous Licence Ouverte 2.0 — donc réutilisable, y compris
 * commercialement, à condition de citer la source.
 *
 * POURQUOI PAS UN ASPIRATEUR DU SITE DE GRAND ORB
 * Deux raisons. D'abord leurs mentions légales l'interdisent explicitement
 * (« ne peuvent être reproduits librement sans l'autorisation expresse de
 * leur auteur »). Ensuite c'est inutile : c'est exactement la même donnée,
 * et un flux structuré ne casse pas le jour où ils refont leur site.
 *
 * ATTRIBUTION — OBLIGATION DE LA LICENCE
 * La page affiche le créateur de la donnée et sa date de mise à jour.
 * Ne jamais retirer ce bloc.
 *
 * USAGE
 *   node scripts/agenda.mjs            met à jour agenda.html
 *   node scripts/agenda.mjs --dry-run  affiche sans rien écrire
 */
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const RACINE = fileURLToPath(new URL('..', import.meta.url))
const PAGE = join(RACINE, 'agenda.html')
const SEC = 'ceilhes-et-rocozels'

/** Jeu de données « fêtes et manifestations » de DATAtourisme. */
const API =
  'https://tabular-api.data.gouv.fr/api/resources/2c6023f2-ffce-4c1a-9728-bdc020e463b5/data/'

/**
 * Les communes retenues, écrites EXACTEMENT comme dans le flux.
 *
 * ⚠️ Ne jamais filtrer sur le seul nom de commune : le flux est national, et
 * une recherche par ressemblance attrape n'importe quoi. Vérifié : « Fayet »
 * remonte Chavaniac-Lafayette (Haute-Loire) et « Clapier » remonte Clapiers,
 * près de Montpellier. D'où le filtrage sur « code postal # nom exact ».
 *
 * Le Clapier (12540) et Fayet (12360) ne publient rien dans DATAtourisme :
 * les ajouter ici ne servirait à rien tant que c'est le cas, mais la ligne
 * peut être décommentée le jour où ils s'y mettent.
 */
const COMMUNES = [
  '34260#Ceilhes-et-Rocozels',
  '34260#Avène',
  '34260#Camplong',
  "34260#Le Bousquet-d'Orb",
  '34650#Lunas',
  '34650#Roqueredonde',
  '34700#Lodève',
  '12360#Camarès',
  '12360#Sylvanès',
  // '12540#Le Clapier',  — aucune fiche publiée à ce jour
  // '12360#Fayet',       — aucune fiche publiée à ce jour
]

/** Codes postaux à interroger, déduits de la liste ci-dessus. */
const CODES = [...new Set(COMMUNES.map((c) => c.split('#')[0]))]

/** La commune du site : ses événements passent toujours en premier. */
const ICI = '34260#Ceilhes-et-Rocozels'

/**
 * Nombre d'événements des communes voisines affichés au maximum.
 *
 * ⚠️ Sans ce découpage, Lodève (musée, cinéma, médiathèque : 54 fiches)
 * remplit la page à elle seule et la féria de Ceilhes disparaît. Or c'est un
 * site sur Ceilhes : ses rendez-vous passent d'abord, toujours et tous.
 */
const MAX_ALENTOURS = 30

/* -------------------------------------------------------------------------- */

const MOIS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
]

/** Devine une étiquette lisible à partir du titre de l'événement. */
function etiquette(nom) {
  const t = nom.toLowerCase()
  const regles = [
    [/concert|musique|chant|bal|zik/, '🎵 Concert'],
    [/marché|producteur/, '🧺 Marché'],
    [/rando|balade|marche|trail|vtt|vélo/, '🥾 Randonnée'],
    [/paddle|canoë|kayak|lac|nautique|baignade/, '🛶 Sur le lac'],
    [/musée|église|patrimoine|visite|histoire/, '🏛️ Patrimoine'],
    [/fête|féria|votive|encierro|feu/, '🎉 Fête'],
    [/théâtre|spectacle|cinéma|conte/, '🎭 Spectacle'],
    [/repas|apéro|dégustation|gourmand|vin/, '🍽️ Gourmand'],
    [/massage|bien-être|yoga/, '💆 Bien-être'],
    [/expo|peintre|art/, '🎨 Exposition'],
    [/vide|brocante|puces/, '🛍️ Brocante'],
  ]
  for (const [re, lib] of regles) if (re.test(t)) return lib
  return '📅 Animation'
}

/**
 * « 2026-08-07<->2026-08-07|… » → la prochaine date à venir, ou null.
 *
 * Subtilité : pour une période DÉJÀ COMMENCÉE mais pas terminée (une
 * exposition de tout l'été, par exemple), on ne renvoie pas sa date de début
 * — qui est passée et ferait afficher « 1er juillet » à quelqu'un qui lit la
 * page en août. On renvoie aujourd'hui : l'événement est en cours.
 */
function prochaineDate(periodes, aujourdhui) {
  if (!periodes) return null
  const dates = []
  for (const bloc of String(periodes).split('|')) {
    const [debut, fin] = bloc.split('<->')
    if (!debut) continue
    const d = new Date(debut + 'T00:00:00Z')
    const f = new Date((fin || debut) + 'T23:59:59Z')
    if (Number.isNaN(d.getTime())) continue
    // Un événement est « à venir » tant que sa date de FIN n'est pas passée.
    if (f >= aujourdhui) dates.push(d < aujourdhui ? aujourdhui : d)
  }
  if (!dates.length) return null
  dates.sort((a, b) => a - b)
  return dates[0]
}

const echappe = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/**
 * Les titres arrivent en CAPITALES SANS ACCENTS dans la source. On les
 * repasse en minuscules, puis on rétablit les noms propres et les sigles :
 * sinon « LAC D'AVENE » devient « lac d'avene », ce qui fait négligé et
 * dessert le référencement (on cherche « lac d'Avène », pas « avene »).
 */
const REECRITURES = [
  [/\bavene\b/gi, 'Avène'],
  [/\bceilhes\b/gi, 'Ceilhes'],
  [/\brocozels\b/gi, 'Rocozels'],
  [/\bcenomes\b/gi, 'Cénomes'],
  [/\bl'orb\b/gi, 'l’Orb'],
  [/\bbedarieux\b/gi, 'Bédarieux'],
  [/\blodevois\b/gi, 'Lodévois'],
  [/\bsylvanes\b/gi, 'Sylvanès'],
  [/\bsalagou\b/gi, 'Salagou'],
  [/\bvtt\b/gi, 'VTT'],
  [/\bbmx\b/gi, 'BMX'],
  [/\bdj\b/gi, 'DJ'],
  [/\bmonts d'orb\b/gi, 'monts d’Orb'],
]

function joliTitre(nom) {
  let s = String(nom || '').trim()
  if (s === s.toUpperCase()) s = s.charAt(0) + s.slice(1).toLowerCase()
  for (const [re, bon] of REECRITURES) s = s.replace(re, bon)
  // L'apostrophe typographique, cohérente avec le reste du site.
  return s.replace(/'/g, '’')
}

function couper(texte, max = 190) {
  const t = String(texte || '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return t.slice(0, t.lastIndexOf(' ', max)) + '…'
}

/**
 * Récupère toutes les fiches des codes postaux voulus, en suivant la
 * pagination, puis ne garde que les communes de notre liste.
 */
async function recuperer() {
  const retenues = new Set(COMMUNES)
  const tout = []

  for (const code of CODES) {
    let page = 1
    for (;;) {
      const url = `${API}?Code_postal_et_commune__contains=${code}&page_size=100&page=${page}`
      const rep = await fetch(url, {
        headers: { 'User-Agent': 'ceilhes-tourisme.fr (agenda du village)' },
      })
      if (!rep.ok) throw new Error(`DATAtourisme a répondu ${rep.status} pour ${code}`)
      const json = await rep.json()
      const lot = json.data ?? []
      tout.push(...lot.filter((e) => retenues.has(e.Code_postal_et_commune)))
      if (lot.length < 100) break
      page += 1
      if (page > 20) break // garde-fou : jamais de boucle infinie
    }
  }
  return tout
}

/** « 34260#Ceilhes-et-Rocozels » → « Ceilhes-et-Rocozels ». */
const nomCommune = (v) => String(v || '').split('#')[1] || ''

async function main() {
  const essai = process.argv.includes('--dry-run')
  const aujourdhui = new Date()
  aujourdhui.setUTCHours(0, 0, 0, 0)

  const brut = await recuperer()

  const evenements = brut
    .map((e) => ({
      nom: joliTitre(e.Nom_du_POI),
      date: prochaineDate(e.Periodes_regroupees, aujourdhui),
      description: e.Description,
      adresse: e.Adresse_postale,
      commune: nomCommune(e.Code_postal_et_commune),
      codePostal: String(e.Code_postal_et_commune || '').split('#')[0],
      identifiant: e.Code_postal_et_commune,
      lat: e.Latitude,
      lon: e.Longitude,
      createur: e.Createur_de_la_donnee,
      maj: e.Date_de_mise_a_jour,
    }))
    // On ne garde que ce qui est encore à venir : afficher une date passée
    // ne sert à personne, et Google le signale comme une erreur.
    .filter((e) => e.date && e.nom)
    .sort((a, b) => a.date - b.date)

  const ici = evenements.filter((e) => e.identifiant === ICI)
  const alentours = evenements
    .filter((e) => e.identifiant !== ICI)
    .slice(0, MAX_ALENTOURS)

  if (!evenements.length) {
    console.log('Aucun événement à venir dans le flux — la page est laissée telle quelle.')
    return
  }

  /** Fabrique les cartes d'une liste. `avecLieu` : afficher la commune. */
  const enCartes = (liste, avecLieu) =>
    liste
      .map((e) => {
        const j = e.date.getUTCDate()
        const m = MOIS[e.date.getUTCMonth()]
        const id =
          'ev-' +
          e.nom
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 48)
        // La commune n'est utile que pour les alentours : sur les cartes de
        // Ceilhes elle serait répétée à chaque ligne pour rien.
        const lieu = avecLieu ? `\n          <span class="ev-lieu">${echappe(e.commune)}</span>` : ''
        return `      <article class="ev-card reveal" id="${id}">
        <div class="ev-date"><span class="d">${j}</span><span class="m">${m}</span></div>
        <div class="ev-body">
          <span class="ev-tag">${etiquette(e.nom)}</span>${lieu}
          <h3>${echappe(e.nom)}</h3>
          <p>${echappe(couper(e.description))}</p>
        </div>
      </article>`
      })
      .join('\n')

  const cartesIci = enCartes(ici, false)
  const cartesAlentours = enCartes(alentours, true)

  // Balisage Event : c'est lui qui peut faire apparaître les animations
  // directement dans Google, avec leur date.
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [...ici, ...alentours].slice(0, 40).map((e) => ({
      '@type': 'Event',
      name: e.nom,
      startDate: e.date.toISOString().slice(0, 10),
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      description: couper(e.description, 300) || undefined,
      url: `https://ceilhes-tourisme.fr/${SEC}`.replace(`/${SEC}`, '/agenda.html'),
      location: {
        '@type': 'Place',
        name: e.adresse || e.commune,
        address: {
          '@type': 'PostalAddress',
          streetAddress: e.adresse || undefined,
          addressLocality: e.commune,
          postalCode: e.codePostal,
          addressCountry: 'FR',
        },
        geo: e.lat && e.lon
          ? { '@type': 'GeoCoordinates', latitude: e.lat, longitude: e.lon }
          : undefined,
      },
    })),
  }

  const maj = evenements.map((e) => e.maj).filter(Boolean).sort().pop()
  const createur = evenements.find((e) => e.createur)?.createur ?? 'Office de tourisme du Grand Orb'

  const communesAlentours = [...new Set(alentours.map((e) => e.commune))].sort()

  const blocAlentours = alentours.length
    ? `
    <h2 class="agenda-titre">Aux alentours</h2>
    <p class="agenda-sous-titre">Les rendez-vous des villages voisins : ${communesAlentours.join(', ')}.</p>
    <div class="agenda-list">
${cartesAlentours}
    </div>`
    : ''

  const bloc = `<!-- @agenda -->
    <h2 class="agenda-titre">À Ceilhes-et-Rocozels</h2>
    <div class="agenda-list">
${cartesIci || '      <p class="agenda-vide">Pas de rendez-vous annoncé au village pour le moment. Les animations des alentours sont ci-dessous.</p>'}
    </div>${blocAlentours}
    <p class="agenda-attribution">
      ${ici.length} rendez-vous au village et ${alentours.length} aux alentours.
      Source :
      <strong>${echappe(createur)}</strong>, via
      <a href="https://www.datatourisme.fr/" rel="noopener" target="_blank">DATAtourisme</a>
      (Licence Ouverte 2.0)${maj ? ` — donnée mise à jour le ${maj.split('-').reverse().join('/')}` : ''}.
      Cette page se met à jour toute seule, chaque jour.
    </p>
    <script type="application/ld+json">${JSON.stringify(jsonld)}</script>
  <!-- @/agenda -->`

  let html = await readFile(PAGE, 'utf8')

  if (html.includes('<!-- @agenda -->')) {
    html = html.replace(/<!-- @agenda -->[\s\S]*?<!-- @\/agenda -->/, bloc)
  } else {
    // Première exécution : on remplace la liste écrite à la main.
    const re = /<div class="agenda-list">[\s\S]*?<\/div>\s*(?=<div class="agenda-src)/
    if (!re.test(html)) {
      throw new Error("Liste d'événements introuvable dans agenda.html")
    }
    html = html.replace(re, bloc + '\n  ')
  }

  if (essai) {
    console.log(`${ici.length} au village, ${alentours.length} aux alentours :`)
    for (const e of [...ici, ...alentours]) {
      console.log(`  ${e.date.toISOString().slice(0, 10)}  ${(e.commune||'').padEnd(22)} ${e.nom.slice(0,52)}`)
    }
    console.log('\n(--dry-run : agenda.html non modifié)')
    return
  }

  await writeFile(PAGE, html, 'utf8')
  console.log(`agenda.html mis à jour — ${evenements.length} événement(s) à venir, source ${createur}`)
}

main().catch((e) => {
  console.error('Échec de la mise à jour de l’agenda :', e.message)
  process.exit(1)
})
