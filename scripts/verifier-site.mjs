// Contrôles locaux avant publication, sans réseau et sans modifier le dépôt.
// Usage : node scripts/verifier-site.mjs
// Netlify : node scripts/verifier-site.mjs --publication (résultat déjà généré).
// Un code de sortie non nul empêche de confondre une erreur avec un succès.
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = fileURLToPath(new URL('..', import.meta.url))
const IGNORES = new Set(['.git', '.netlify', 'node_modules', '.claude', '__pycache__', 'test-results'])
const SITE = 'https://ceilhes-tourisme.fr/'
const empreinte = (f, algo = 'sha256') => createHash(algo).update(readFileSync(f)).digest('hex')

function fichiers(racine) {
  const trouves = []
  function lire(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (IGNORES.has(e.name)) continue
      const f = join(dir, e.name)
      if (e.isDirectory()) lire(f)
      else if (e.isFile()) trouves.push(f)
    }
  }
  lire(racine)
  return trouves.sort()
}

function decoder(t) {
  const entites = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: '\u00a0' }
  return t.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (_, n) => {
    if (!n.startsWith('#')) return entites[n.toLowerCase()]
    const code = n[1].toLowerCase() === 'x' ? parseInt(n.slice(2), 16) : Number(n.slice(1))
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '\ufffd'
  })
}

// Les commentaires et le contenu brut des scripts/styles ne sont pas du HTML.
// Les valeurs entre guillemets peuvent contenir des chevrons.
function balises(html) {
  const resultat = []
  const re = /<!--[\s\S]*?-->|<(script|style)\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/\1\s*>|<([a-z][\w:-]*)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/gi
  for (const m of html.matchAll(re)) {
    if (m[0].startsWith('<!--')) continue
    const attributs = {}
    const texte = m[2] ?? m[5]
    for (const a of texte.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      attributs[a[1].toLowerCase()] = decoder(a[2] ?? a[3] ?? a[4] ?? '')
    }
    resultat.push({ nom: (m[1] ?? m[4]).toLowerCase(), attributs, contenu: m[3] ?? '', position: m.index })
  }
  return resultat
}

export function verifierContenu(racine, { versions = false } = {}) {
  racine = resolve(racine)
  const erreurs = []
  const pages = new Map()
  let liens = 0
  const tous = fichiers(racine)
  const erreur = (f, msg) => erreurs.push(`${relative(racine, f)} : ${msg}`)
  for (const f of tous.filter(f => extname(f) === '.html')) {
    const html = readFileSync(f, 'utf8')
    const tags = balises(html)
    const ids = new Set()
    for (const { attributs: a } of tags) {
      if (!a.id) continue
      if (ids.has(a.id)) erreur(f, `identifiant répété #${a.id}`)
      ids.add(a.id)
    }
    if (tags.filter(t => t.nom === 'h1').length !== 1) erreur(f, 'la page doit avoir un titre h1 unique')
    if (!/<title>\s*\S[\s\S]*?<\/title>/i.test(html)) erreur(f, 'titre de page absent')
    pages.set(f, { html, tags, ids })
  }

  function reference(f, brut, { css = false } = {}) {
    if (!brut || /^(?:data:|mailto:|tel:|javascript:|blob:)/i.test(brut)) return
    let url
    try { url = new URL(brut, new URL(relative(racine, f).split(sep).join('/'), SITE)) }
    catch { erreur(f, `adresse invalide : ${brut}`); return }
    if (url.origin !== new URL(SITE).origin) return
    let chemin, ancre
    try { chemin = decodeURIComponent(url.pathname); ancre = decodeURIComponent(url.hash.slice(1)) }
    catch { erreur(f, `adresse mal encodée : ${brut}`); return }
    const cible = resolve(racine, '.' + chemin + (chemin.endsWith('/') ? 'index.html' : ''))
    liens++
    if (!cible.startsWith(racine + sep)) { erreur(f, `adresse hors du site : ${brut}`); return }
    if (!existsSync(cible) || !statSync(cible).isFile()) { erreur(f, `fichier absent : ${brut}`); return }
    // Les fragments SVG désignent parfois un symbole, les fragments médias un temps.
    if (!css && ancre && pages.has(cible) && !pages.get(cible).ids.has(ancre)) erreur(f, `ancre absente : ${brut}`)
    if (versions && dirname(cible) === join(racine, 'assets') && /\.(js|css)$/.test(cible)) {
      if (url.searchParams.get('v') !== empreinte(cible, 'sha1').slice(0, 8)) erreur(f, `empreinte périmée ou absente : ${brut}`)
    }
  }

  function verifierCss(f, contenu) {
    for (const m of contenu.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi)) {
      reference(f, m[1] ?? m[2] ?? m[3], { css: true })
    }
  }

  for (const [f, { tags }] of pages) {
    for (const t of tags) {
      const a = t.attributs
      for (const cle of ['href', 'src', 'poster']) if (cle in a) reference(f, a[cle])
      if (a.srcset) for (const candidat of a.srcset.split(',')) reference(f, candidat.trim().split(/\s+/)[0])
      if (a.style) verifierCss(f, a.style)
      if (t.nom === 'style') verifierCss(f, t.contenu)
      if (t.nom === 'script' && ['application/json', 'application/ld+json'].includes(a.type)) {
        try { JSON.parse(t.contenu) } catch (e) { erreur(f, `bloc ${a.type} invalide (${e.message})`) }
      }
    }
  }
  for (const f of tous.filter(f => extname(f) === '.css')) verifierCss(f, readFileSync(f, 'utf8'))
  for (const f of tous.filter(f => ['.json', '.webmanifest'].includes(extname(f)))) {
    try {
      const json = JSON.parse(readFileSync(f, 'utf8'))
      if (extname(f) === '.webmanifest') for (const icone of json.icons ?? []) reference(f, icone.src)
    } catch (e) { erreur(f, `JSON invalide (${e.message})`) }
  }
  const sitemap = join(racine, 'sitemap.xml')
  if (existsSync(sitemap)) for (const loc of readFileSync(sitemap, 'utf8').matchAll(/<loc>\s*([^<]+)\s*<\/loc>/g)) reference(sitemap, decoder(loc[1].trim()))

  function menu(html) {
    const ul = balises(html).find(t => t.nom === 'ul' && t.attributs.id === 'menu')
    if (!ul) return null
    const fin = html.indexOf('</ul>', ul.position)
    return balises(html.slice(ul.position, fin)).filter(t => t.nom === 'a').map(t => t.attributs.href)
  }
  const modele = menu(pages.get(join(racine, 'index.html'))?.html ?? '')
  if (!modele?.length) erreur(join(racine, 'index.html'), 'menu principal absent')
  for (const [f, { html }] of pages) {
    // Seule la page-outil n'a volontairement pas la navigation publique.
    if (relative(racine, f) === 'reglage-carte.html') continue
    if (JSON.stringify(menu(html)) !== JSON.stringify(modele)) erreur(f, 'menu différent de celui de l’accueil')
  }
  return { erreurs, pages: pages.size, liens }
}

function executerGenerateurs(copie) {
  const configuration = readFileSync(join(copie, 'netlify.toml'), 'utf8')
  const commande = configuration.match(/^\s*command\s*=\s*"([^"]+)"/m)?.[1]
  if (!commande) throw new Error('commande de publication absente de netlify.toml')
  for (const etape of commande.split('&&').map(s => s.trim())) {
    const script = etape.match(/^node (scripts\/[a-z0-9-]+\.mjs)$/)?.[1]
    // Le contrôle final ne relance pas la génération : pas de récursion.
    const args = etape === 'node scripts/verifier-site.mjs --publication'
      ? ['scripts/verifier-site.mjs', '--publication']
      : script && script !== 'scripts/verifier-site.mjs' ? [script] : null
    if (!args) throw new Error(`commande de publication non prise en charge par ce contrôle : ${etape}`)
    const r = spawnSync(process.execPath, args, { cwd: copie, encoding: 'utf8', timeout: 60000 })
    if (r.error || r.status !== 0) throw new Error(`${args.join(' ')} a échoué : ${r.error?.message ?? r.stderr ?? r.stdout}`)
  }
}

export function verifierSite(racine = RACINE) {
  racine = resolve(racine)
  const avant = verifierContenu(racine)
  if (avant.erreurs.length) return avant
  const copie = mkdtempSync(join(tmpdir(), 'ceilhes-verification-'))
  try {
    cpSync(racine, copie, { recursive: true, filter: source => !relative(racine, source).split(sep).some(p => IGNORES.has(p)) })
    executerGenerateurs(copie)
    const genere = verifierContenu(copie, { versions: true })
    const empreintes = new Map(fichiers(copie).map(f => [relative(copie, f), empreinte(f)]))
    executerGenerateurs(copie)
    const second = fichiers(copie)
    if (second.length !== empreintes.size || second.some(f => empreintes.get(relative(copie, f)) !== empreinte(f))) {
      genere.erreurs.push('La génération n’est pas stable : le deuxième passage change encore des fichiers.')
    }
    return genere
  } finally {
    rmSync(copie, { recursive: true, force: true })
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2)
    if (args.length && (args.length !== 1 || args[0] !== '--publication')) throw new Error('Usage : node scripts/verifier-site.mjs [--publication]')
    const publication = args[0] === '--publication'
    const resultat = publication ? verifierContenu(RACINE, { versions: true }) : verifierSite()
    if (resultat.erreurs.length) {
      console.error(resultat.erreurs.map(e => `✗ ${e}`).join('\n'))
      process.exitCode = 1
    } else {
      console.log(`✓ ${resultat.pages} pages, ${resultat.liens} références locales : fichiers, ancres, JSON et menus valides.`)
      console.log(publication
        ? '✓ Résultat de publication et empreintes valides ; aucune génération relancée.'
        : '✓ Génération Netlify et empreintes vérifiées dans une copie temporaire ; deuxième passage identique.')
      console.log('Le dépôt n’a pas été modifié. Les liens extérieurs et les interactions au navigateur sont des contrôles séparés.')
    }
  } catch (e) {
    console.error(`Échec de la vérification : ${e.message}`)
    process.exitCode = 1
  }
}
