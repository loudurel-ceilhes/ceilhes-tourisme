// Le gardien des liens : vérifie que tous les liens du site répondent encore.
//
// POURQUOI : le site cite plus de trois cents adresses extérieures (sites de
// producteurs, offices de tourisme, notices de monuments…). Ces adresses
// vieillissent : un producteur change de site, un office déplace sa page.
// Sans surveillance, les visiteurs découvrent les liens morts avant nous.
//
// CE QUE FAIT LE SCRIPT :
//   1. il ramasse tous les liens des pages HTML (href/src extérieurs, liens
//      internes entre pages) et des fichiers de données (champ « site » des
//      producteurs, notices Mérimée des monuments…) ;
//   2. il teste chaque adresse extérieure (une requête, un nouvel essai en
//      cas d'échec) — sauf les domaines qui refusent les robots (Facebook,
//      Instagram, Pages Jaunes…), signalés « à vérifier à la main » ;
//   3. il vérifie que chaque lien interne pointe vers un fichier existant ;
//   4. il écrit un rapport JSON sur la sortie standard et rend un code de
//      sortie 0 dans tous les cas — c'est l'action GitHub (voir
//      .github/workflows/gardien-liens.yml) qui décide quoi faire du rapport.
//
// GitHub lance ce script chaque lundi matin. En cas de liens cassés, un
// signalement (« issue ») est ouvert sur le dépôt avec la liste : il suffit
// alors de demander à Claude de réparer.
//
//   node scripts/gardien-liens.mjs            # tout vérifier (long)
//   node scripts/gardien-liens.mjs --liste    # seulement lister les liens
//   node scripts/gardien-liens.mjs --interne  # seulement les liens internes
//
// ⚠️ Depuis certains environnements (dont les sessions Claude), les requêtes
// sortantes sont filtrées : tout paraîtrait « cassé ». Ce script est fait
// pour tourner sur GitHub, pas en local — sauf --liste et --interne.

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const RACINE = fileURLToPath(new URL('..', import.meta.url))

// Domaines qui bloquent les robots : les tester donnerait de fausses alertes.
const DOMAINES_FRAGILES = [
  'facebook.com', 'instagram.com', 'pagesjaunes.fr', 'linkedin.com',
  'tripadvisor.', 'booking.com', 'societe.com', 'kompass.com', 'yelp.',
]

const PAGES_OUTILS = new Set(['reglage-carte.html'])

/** Tous les liens du site : { url -> [emplacements] } et liens internes. */
function ramasser() {
  const externes = new Map()
  const internes = []
  const note = (carte, cle, ou) => {
    if (!carte.has(cle)) carte.set(cle, [])
    if (!carte.get(cle).includes(ou)) carte.get(cle).push(ou)
  }

  for (const f of readdirSync(RACINE)) {
    if (!f.endsWith('.html')) continue
    const html = readFileSync(join(RACINE, f), 'utf8')
    for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const brut = m[1].replaceAll('&amp;', '&')
      if (brut.startsWith('http://') || brut.startsWith('https://')) {
        note(externes, brut, f)
      } else if (/^[a-z0-9-]+\.html/.test(brut)) {
        internes.push({ cible: brut.split(/[#?]/)[0], depuis: f })
      }
    }
  }

  for (const f of ['producteurs.json', 'marches.json', 'monuments.json']) {
    const chemin = join(RACINE, 'data', f)
    if (!existsSync(chemin)) continue
    const donnees = JSON.parse(readFileSync(chemin, 'utf8'))
    const visite = (o, ou) => {
      if (Array.isArray(o)) return o.forEach((v) => visite(v, ou))
      if (o && typeof o === 'object') {
        const nom = o.nom || ou
        for (const [k, v] of Object.entries(o)) {
          // les « sources » servent à la vérification interne, pas aux
          // visiteurs : on ne les surveille pas pour limiter le bruit.
          if (k === 'sources' || k === 'gpsSource') continue
          if (typeof v === 'string' && v.startsWith('http')) {
            note(externes, v, `data/${f} (${nom})`)
          } else visite(v, nom)
        }
      }
    }
    visite(donnees, f)
  }
  return { externes, internes }
}

function domaine(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

/** Teste une adresse : « ok », « casse », « douteux » (robot refusé). */
async function tester(url) {
  for (let essai = 0; essai < 2; essai++) {
    try {
      const rep = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(20000),
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; gardien-liens; +https://ceilhes-tourisme.fr)' },
      })
      if (rep.ok) return { etat: 'ok' }
      if ([401, 403, 429, 503].includes(rep.status)) return { etat: 'douteux', detail: `HTTP ${rep.status} (peut-être un refus de robot)` }
      if (essai) return { etat: 'casse', detail: `HTTP ${rep.status}` }
    } catch (e) {
      if (essai) return { etat: 'casse', detail: String(e.cause?.code || e.name || e.message) }
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
}

async function main() {
  const args = new Set(process.argv.slice(2))
  const { externes, internes } = ramasser()

  // Liens internes : une simple existence de fichier.
  const internesCasses = internes.filter(({ cible }) => !existsSync(join(RACINE, cible)))

  if (args.has('--liste')) {
    console.log(`${externes.size} liens extérieurs, ${internes.length} liens internes`)
    for (const [url, ou] of externes) console.log(`  ${url}  ←  ${ou.join(', ')}`)
    return
  }
  if (args.has('--interne')) {
    console.log(JSON.stringify({ internesCasses }, null, 2))
    return
  }

  const casses = [], douteux = [], nonVerifiables = []
  // Par domaine, en série ; domaines différents en petit parallèle.
  const parDomaine = new Map()
  for (const [url, ou] of externes) {
    const d = domaine(url)
    if (DOMAINES_FRAGILES.some((f) => d.includes(f))) {
      nonVerifiables.push({ url, ou })
      continue
    }
    if (!parDomaine.has(d)) parDomaine.set(d, [])
    parDomaine.get(d).push({ url, ou })
  }
  const files = [...parDomaine.values()]
  let fait = 0
  const total = files.reduce((n, f) => n + f.length, 0)
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (files.length) {
      const file = files.shift()
      for (const { url, ou } of file) {
        const r = await tester(url)
        fait++
        if (fait % 25 === 0) console.error(`… ${fait}/${total}`)
        if (r.etat === 'casse') casses.push({ url, ou, detail: r.detail })
        else if (r.etat === 'douteux') douteux.push({ url, ou, detail: r.detail })
      }
    }
  }))

  console.log(JSON.stringify({
    verifie: total,
    internesCasses,
    casses,
    douteux,
    nonVerifiables: nonVerifiables.length,
  }, null, 2))
}

main().catch((e) => { console.error('Échec du gardien des liens :', e); process.exit(1) })
