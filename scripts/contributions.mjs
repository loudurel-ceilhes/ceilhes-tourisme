// Ajoute des liens de contribution dans le HTML, sans dépendance JavaScript.
// À exécuter après les générateurs de fiches, avant carnet-catalogue/version-assets.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SITE = 'https://ceilhes-tourisme.fr';
const IGNORE = new Set(['404.html', 'reglage-carte.html']);
const MARKER = /<!-- @contribution -->[\s\S]*?<!-- @\/contribution -->/g;
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function decode(value) {
  const named = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_, entity) => {
    if (!entity.startsWith('#')) return named[entity.toLowerCase()];
    const n = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ' ';
  });
}
const plain = value => decode(value.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
function attributes(source) {
  const out = {};
  for (const m of source.matchAll(/([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[m[1].toLowerCase()] = decode(m[2] ?? m[3]);
  return out;
}
export function liensContribution(url) {
  const query = `fiche=${encodeURIComponent(url)}`;
  return `<!-- @contribution --><div class="contribution-liens"><a href="contribuer.html?${query}&amp;type=correction">Corriger cette fiche</a><a href="contribuer.html?${query}&amp;type=photo">Proposer une photo</a></div><!-- @/contribution -->`;
}

function ancreFiche(attrs, suggestion, ids) {
  if (attrs.id) {
    if (!/^[a-zA-Z0-9_-]+$/.test(attrs.id)) throw new Error('Ancre de fiche invalide');
    return attrs.id;
  }
  if (ids.has(suggestion)) throw new Error(`Identifiant de fiche déjà utilisé : ${suggestion}`);
  ids.add(suggestion);
  return suggestion;
}

function enrichirMonuments(html, page, items, ids) {
  // Périmètre explicite : les listes Mérimée de la seule page patrimoine.
  return html.replace(/<ul\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/ul>/gi, (list, attrsSource, inner) => {
    if (!(attributes(attrsSource).class || '').split(/\s+/).includes('monuments')) return list;
    const body = inner.replace(/<li\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/li>/gi, (whole, liAttrs, content) => {
      const notices = [...content.matchAll(/href="https:\/\/pop\.culture\.gouv\.fr\/notice\/merimee\/(PA\d{8})"/g)];
      const label = plain(content.match(/<b\b[^>]*>([\s\S]*?)<\/b>/i)?.[1] || '').slice(0, 240);
      // La dernière fiche est un ensemble d'objets Palissy, sans référence
      // Mérimée dans les données : conserver une identité éditoriale explicite.
      const sansNotice = !notices.length && label.startsWith('Statues-menhirs du groupe rouergat') && plain(content).includes('Murat-sur-Vèbre')
        ? 'monument-statues-menhirs-murat-sur-vebre' : null;
      if (!label || (notices.length !== 1 && !sansNotice)) return whole;
      const attrs = attributes(liAttrs);
      const id = ancreFiche(attrs, sansNotice || `monument-${notices[0][1].toLowerCase()}`, ids);
      const url = `/${page}#${id}`;
      items.push({url, title:label});
      if (!attrs.id) whole = whole.replace(/^<li\b/i, `<li id="${id}"`);
      return whole.replace(/<\/li>$/i, `${liensContribution(url)}</li>`);
    });
    return `<ul${attrsSource}>${body}</ul>`;
  });
}

function enrichirAssociations(html, page, items, ids) {
  // Un relevé des div équilibrées évite d'insérer un lien dans le sous-bloc
  // « rôle » d'une association. Les autres div ne reçoivent aucune commande.
  const tokens = /<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<(\/?)div\b((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
  const stack = [], cards = [];
  for (const token of html.matchAll(tokens)) {
    if (token[1] || token[2] === undefined) continue;
    if (!token[2]) {
      const attrs = attributes(token[3]);
      stack.push({start:token.index, innerStart:token.index + token[0].length, attrs, target:(attrs.class || '').split(/\s+/).includes('asso')});
    } else {
      const card = stack.pop();
      if (card?.target) cards.push({...card, end:token.index + token[0].length, innerEnd:token.index});
    }
  }
  for (const card of cards.sort((a,b) => b.start-a.start)) {
    let whole = html.slice(card.start,card.end);
    const content = html.slice(card.innerStart,card.innerEnd);
    const label = plain(content.match(/<h4\b[^>]*>([\s\S]*?)<\/h4>/i)?.[1] || '').slice(0,240);
    const slug = label.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    if (!slug) continue;
    const id = ancreFiche(card.attrs,`association-${slug}`,ids);
    const url = `/${page}#${id}`;
    items.push({url,title:label});
    if (!card.attrs.id) whole = whole.replace(/^<div\b/i,`<div id="${id}"`);
    whole = whole.replace(/<\/div>$/i,`${liensContribution(url)}</div>`);
    html = html.slice(0,card.start)+whole+html.slice(card.end);
  }
  return html;
}

export function enrichirPage(source, page) {
  let html = source.replace(MARKER, '');
  const items = [];
  const title = plain(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || page).slice(0, 240);
  items.push({url:`/${page}`, title});
  if (page === 'contribuer.html') return { html, items };
  const ids = new Set([...html.matchAll(/\sid=(?:"([a-zA-Z0-9_-]+)"|'([a-zA-Z0-9_-]+)')/g)].map(m => m[1] || m[2]));
  // Les cartes du guide sont des articles non imbriqués. Ignorer les scripts
  // et commentaires évite de reconnaître des exemples HTML comme des fiches.
  const blocks = /<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<article\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/article>/gi;
  html = html.replace(blocks, (whole, raw, attrsSource, inner) => {
    if (raw || attrsSource === undefined) return whole;
    const attrs = attributes(attrsSource);
    let target;
    try { target = new URL(attrs.id ? `/${page}#${attrs.id}` : attrs['data-carnet-url'] || `/${page}`, SITE); } catch { return whole; }
    if (target.origin !== SITE || target.pathname !== `/${page}` || target.search || target.username || target.password || !ids.has(target.hash.slice(1))) return whole;
    const label = plain(attrs['data-carnet-title'] || inner.match(/<h[2-6]\b[^>]*>([\s\S]*?)<\/h[2-6]>/i)?.[1] || '').slice(0, 240);
    if (!label) return whole;
    // Plusieurs maisons d'un circuit peuvent partager l'ancre de leur secteur.
    // Donner une ancre stable propre à la carte, sans modifier son lien de carnet.
    if (!attrs.id && /^[a-z0-9-]{1,180}$/.test(attrs['data-carnet-id'] || '')) {
      const id = `fiche-${attrs['data-carnet-id']}`;
      if (ids.has(id)) throw new Error(`Identifiant de fiche déjà utilisé : ${id}`);
      ids.add(id);
      whole = whole.replace(/^<article\b/i, `<article id="${id}"`);
      target.hash = id;
    }
    const url = target.pathname + target.hash;
    items.push({url, title:label});
    return whole.replace(/<\/article>$/i, `${liensContribution(url)}</article>`);
  });
  if (page === 'patrimoine.html') html = enrichirMonuments(html,page,items,ids);
  if (page === 'vie-associative.html') html = enrichirAssociations(html,page,items,ids);
  if (!/<footer\b/i.test(html)) throw new Error(`Pied de page absent : ${page}`);
  const links = liensContribution(`/${page}`).replace('Corriger cette fiche', 'Corriger cette page');
  const banner = `<!-- @contribution --><aside class="contribution-page" aria-label="Contribuer au guide"><div><p>Une information à préciser ou une photo de ce lieu à partager ?</p>${links.replace(/<!-- @\/?contribution -->/g, '')}</div></aside><!-- @/contribution -->`;
  html = html.replace(/<footer\b/i, `${banner}<footer`);
  if (!/href="assets\/contributions\.css(?:\?[^"\s]*)?"/.test(html)) html = html.replace('</head>', '<link rel="stylesheet" href="assets/contributions.css">\n</head>');
  return { html, items };
}

export function genererContributions(root = ROOT, {write = true, catalogueOnly = false} = {}) {
  const pages = readdirSync(root).filter(p => /^[a-z0-9-]+\.html$/.test(p) && !IGNORE.has(p)).sort();
  const outputs = pages.map(page => ({page, ...enrichirPage(readFileSync(join(root, page), 'utf8'), page)}));
  const items = new Map([['/', {url:'/', title:'Le guide de Ceilhes-et-Rocozels'}]]);
  for (const output of outputs) for (const item of output.items) {
    const previous = items.get(item.url);
    if (previous && previous.title !== item.title) throw new Error(`Deux titres pour la même fiche : ${item.url}`);
    items.set(item.url, item);
  }
  const data = JSON.stringify({version:1, items:[...items.values()]}).replaceAll('<', '\\u003c');
  const target = outputs.find(item => item.page === 'contribuer.html');
  const marker = /<!-- @contributions-catalogue -->[\s\S]*?<!-- @\/contributions-catalogue -->/;
  if (!target || !marker.test(target.html)) throw new Error('Catalogue de la page de contribution absent');
  target.html = target.html.replace(marker, `<!-- @contributions-catalogue --><script type="application/json" id="contributions-catalogue">${data}</script><!-- @/contributions-catalogue -->`);
  if (write) for (const {page, html} of outputs) {
    if (catalogueOnly && page !== 'contribuer.html') continue;
    const path = join(root, page);
    if (readFileSync(path, 'utf8') !== html) writeFileSync(path, html);
  }
  return {pages:pages.length, fiches:items.size, outputs};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = genererContributions(ROOT, {write:!process.argv.includes('--dry-run'), catalogueOnly:process.argv.includes('--catalogue-only')});
  console.log(`Contributions : ${result.pages} pages, ${result.fiches} destinations connues${process.argv.includes('--dry-run') ? ' (lecture seule)' : ''}.`);
}
