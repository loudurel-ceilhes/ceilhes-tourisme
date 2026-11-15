// Annuaire régional depuis des faits publics : aucune donnée de stock déduite.
// node scripts/reseau-galtier.mjs ; génération locale, sans appel réseau.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export const STATUTS = {
  decouvert: 'Repéré dans la région', contact: 'Découvert avec L’Esquirol',
  recu: 'Déjà proposé à L’Esquirol', commande: 'Découvert avec L’Esquirol', historique: 'Déjà proposé à L’Esquirol',
}
const NATURES = { 'producteur-artisan': 'Producteur ou artisan', collectif: 'Collectif de producteurs', intermediaire: 'Atelier ou distributeur', 'a-preciser': 'Maison de la région' }
const e = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
export function adressePublique(value) {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null } catch { return null }
}
export function valider(donnees) {
  if (!donnees || !Array.isArray(donnees.producteurs)) throw new Error('Registre absent')
  const ids = new Set(), officiels = new Set()
  for (const p of donnees.producteurs) {
    if (!/^(?:producteur-\d+|contact-[a-z0-9-]+)$/.test(p.id) || ids.has(p.id)) throw new Error(`Identifiant invalide ou répété : ${p.id}`)
    ids.add(p.id)
    if (p.annuaireId) { if (officiels.has(String(p.annuaireId))) throw new Error('Identifiant de l’annuaire répété'); officiels.add(String(p.annuaireId)) }
    if (!p.nom || !p.categories?.length || !STATUTS[p.statut] || !NATURES[p.nature]) throw new Error(`Fiche incomplète : ${p.id}`)
    if (p.ficheLocale && !/^[a-z0-9-]+$/.test(p.ficheLocale)) throw new Error('Ancre locale invalide')
    if (['email', 'mail', 'telephone', 'tel', 'prix', 'cout'].some(k => Object.hasOwn(p, k))) throw new Error('Donnée privée interdite dans le registre public')
  }
  if (donnees.nombreAnnuaire !== officiels.size) throw new Error('Le total officiel ne correspond pas aux identifiants uniques')
}
export function generer(donnees) {
  valider(donnees)
  const producteurs = [...donnees.producteurs].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  const cats = [...new Set(producteurs.flatMap(p => p.categories))].sort((a, b) => a.localeCompare(b, 'fr'))
  const deps = [...new Set(producteurs.map(p => p.departement).filter(Boolean))].sort()
  const options = valeurs => valeurs.map(v => `<option value="${e(v)}">${e(v)}</option>`).join('')
  const lignes = [`<p class="reseau-compteur" id="reseau-compteur" role="status" aria-live="polite">${producteurs.length} maisons et producteurs à découvrir.</p>`,
    `<form id="reseau-filtres" class="reseau-filtres" role="search" aria-label="Rechercher un producteur de la région" hidden>
<label>Un nom, une commune ou un produit<input type="search" id="reseau-recherche" name="q" placeholder="Ex. : Roucadel, fromage, Lozère" autocomplete="off" aria-controls="reseau-resultats"></label>
<label>Spécialité<select id="reseau-categorie" name="cat" aria-controls="reseau-resultats"><option value="">Toutes les spécialités</option>${options(cats)}</select></label>
<label>Département<select id="reseau-departement" name="dep" aria-controls="reseau-resultats"><option value="">Tous les départements</option>${options(deps)}</select></label>
<label>Lien avec L’Esquirol<select id="reseau-statut" name="statut" aria-controls="reseau-resultats"><option value="">Toutes les découvertes</option><option value="recu">Déjà proposé à L’Esquirol</option><option value="fiche">Avec une fiche dans le guide</option></select></label>
<button type="reset" class="btn btn-secondary">Tout afficher</button></form>`,
    '<p id="reseau-vide" class="reseau-vide" hidden>Aucune fiche ne correspond. Essayez un autre mot ou choisissez « Tout afficher ».</p>',
    '<div id="reseau-resultats" class="reseau-grille">']
  for (const p of producteurs) {
    const site = adressePublique(p.site)
    const search = `${p.nom} ${p.commune} ${p.departement} ${p.categories.join(' ')} ${p.nature}${p.notesPubliques ? ` ${p.notesPubliques}` : ''}`
    lignes.push(`<article id="${e(p.id)}" class="reseau-fiche" data-reseau-recherche="${e(search)}" data-categories="${e(JSON.stringify(p.categories))}" data-departement="${e(p.departement)}" data-statut="${e(p.statut)}" data-fiche="${Boolean(p.ficheLocale)}">
<p class="reseau-specialite">${e(p.categories.join(' · '))}</p><h2>${e(p.nom)}</h2>
<p class="reseau-lieu">${e([p.commune, p.codePostal].filter(Boolean).join(' · ') || 'Commune à préciser')}</p>
<p>${e(NATURES[p.nature])}</p><p class="reseau-statut">${e(STATUTS[p.statut])}</p>
${p.notesPubliques ? `<p>${e(p.notesPubliques)}</p>` : ''}
${['recu', 'historique'].includes(p.statut) ? '<p class="reseau-disponibilite">Disponibilité à confirmer auprès de L’Esquirol.</p>' : ''}
<div class="reseau-liens">${site ? `<a href="${e(site)}" target="_blank" rel="noopener">Site de cette maison <span class="sr-only">${e(p.nom)}</span> ↗</a>` : ''}${p.ficheLocale ? `<a href="terroir.html#${e(p.ficheLocale)}">Sa fiche dans le guide</a>` : ''}</div>
</article>`)
  }
  lignes.push('</div>')
  return lignes.join('\n')
}
export async function construire(racine = fileURLToPath(new URL('..', import.meta.url))) {
  const donnees = JSON.parse(await readFile(resolve(racine, 'data/reseau-producteurs.json'), 'utf8'))
  const chemin = resolve(racine, 'producteurs-region.html')
  const html = await readFile(chemin, 'utf8')
  const balises = /<!-- @reseau-producteurs -->[\s\S]*?<!-- @\/reseau-producteurs -->/
  if (!balises.test(html)) throw new Error('Balises du répertoire absentes')
  await writeFile(chemin, html.replace(balises, () => `<!-- @reseau-producteurs -->\n${generer(donnees)}\n<!-- @/reseau-producteurs -->`))
  console.log(`Répertoire des producteurs : ${donnees.producteurs.length} fiches, dont ${donnees.nombreAnnuaire} identifiants de l’annuaire officiel.`)
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await construire()
