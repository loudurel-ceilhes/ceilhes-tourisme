// Petit serveur local pour regarder le site avant de le publier.
//
// À quoi ça sert : ouvrir le site sur son ordinateur, exactement comme il
// s'affichera en ligne, sans rien envoyer sur Internet. On voit les erreurs
// AVANT que les visiteurs les voient.
//
//   node scripts/serve.mjs       puis ouvrir http://localhost:8788
//
// Aucune dépendance : uniquement ce qui est fourni avec Node.

import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = fileURLToPath(new URL('..', import.meta.url))
const PORT = Number(process.env.PORT) || 8788

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

createServer(async (req, res) => {
  // On ne garde que le chemin : le « ? » et le « # » ne désignent pas un fichier.
  let chemin = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  if (chemin.endsWith('/')) chemin += 'index.html'

  // Verrou : `normalize` résout les « .. », et on refuse tout ce qui sortirait
  // du dossier du site. Sans ça, une adresse bricolée lirait n'importe quel
  // fichier de l'ordinateur.
  const fichier = join(RACINE, normalize(chemin))
  if (!fichier.startsWith(RACINE.endsWith(sep) ? RACINE : RACINE + sep)) {
    res.writeHead(403).end('Interdit')
    return
  }

  try {
    const infos = await stat(fichier)
    if (infos.isDirectory()) throw new Error('dossier')
    const contenu = await readFile(fichier)
    res.writeHead(200, {
      'Content-Type': TYPES[extname(fichier).toLowerCase()] || 'application/octet-stream',
      // En local on ne garde jamais de copie : on veut voir sa dernière modification.
      'Cache-Control': 'no-store',
    })
    res.end(contenu)
  } catch {
    try {
      const page404 = await readFile(join(RACINE, '404.html'))
      res.writeHead(404, { 'Content-Type': TYPES['.html'] }).end(page404)
    } catch {
      res.writeHead(404, { 'Content-Type': TYPES['.html'] }).end('<h1>Page introuvable</h1>')
    }
  }
}).listen(PORT, () => {
  console.log(`Site visible sur http://localhost:${PORT} — Ctrl+C pour arrêter.`)
})
