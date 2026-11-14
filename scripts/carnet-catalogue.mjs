// Répertoire public des idées partageables, extrait des fiches déjà publiées.
// À lancer après les générateurs de contenu, avant version-assets.mjs.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SITE = 'https://ceilhes-tourisme.fr/';
const CATEGORIES = new Set(['Randonnée', 'Adresse', 'Hébergement', 'Producteur', 'Événement', 'Guide']);

function decode(value) {
  const entities = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: '\u00a0' };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (_, entity) => {
    if (!entity.startsWith('#')) return entities[entity.toLowerCase()];
    const point = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '\ufffd';
  });
}

export function publicUrl(value, page) {
  if (typeof value !== 'string' || value.length > 2000) throw new Error('Lien de carnet invalide');
  const url = new URL(value, new URL(page, SITE));
  if (url.username || url.password) throw new Error('Identifiants interdits dans un lien');
  if (url.origin === new URL(SITE).origin && /^\/(?:[a-z0-9-]+\.html)?$/.test(url.pathname)) return url.pathname + url.search + url.hash;
  if (url.origin === 'https://www.sitytrail.com' && url.pathname.startsWith('/fr/trails/')) return url.href;
  throw new Error(`Lien de carnet hors des destinations autorisées : ${value}`);
}

export function cataloguer(pages) {
  const items = new Map();
  for (const [page, html] of pages) {
    const tags = /<!--[\s\S]*?-->|<(script|style)\b((?:"[^"]*"|'[^']*'|[^'">])*)>[\s\S]*?<\/\1\s*>|<([a-z][\w:-]*)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
    for (const tag of html.matchAll(tags)) {
      if (!tag[3]) continue;
      const attrs = {};
      for (const a of tag[4].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[a[1].toLowerCase()] = decode(a[2] ?? a[3] ?? a[4] ?? '');
      if (!('data-carnet-id' in attrs)) continue;
      const item = { id: attrs['data-carnet-id'], title: attrs['data-carnet-title']?.trim(), category: attrs['data-carnet-category'], url: publicUrl(attrs['data-carnet-url'], page) };
      if (tag[3].toLowerCase() === 'a' || !/^[a-z0-9-]{1,180}$/.test(item.id) || !item.title || item.title.length > 200 || !CATEGORIES.has(item.category)) throw new Error(`Fiche de carnet invalide dans ${page}`);
      if (attrs['data-carnet-dates']) {
        const dates = JSON.parse(attrs['data-carnet-dates']);
        if (!Array.isArray(dates) || dates.length > 200 || dates.some(value => typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value + 'T12:00:00Z')) || new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) !== value)) throw new Error(`Dates de carnet invalides dans ${page}`);
        item.dates = [...new Set(dates)].sort();
      }
      const previous = items.get(item.id);
      if (previous && JSON.stringify(previous) !== JSON.stringify(item)) throw new Error(`Identifiant de carnet contradictoire : ${item.id}`);
      items.set(item.id, item);
    }
  }
  return { version: 1, items: [...items.values()].sort((a, b) => a.id.localeCompare(b.id, 'en')) };
}

export function generer(root = ROOT) {
  const pages = readdirSync(root).filter(f => f.endsWith('.html')).sort().map(f => [f, readFileSync(join(root, f), 'utf8')]);
  const data = cataloguer(pages);
  if (!data.items.length) throw new Error('Catalogue de séjour vide');
  const json = JSON.stringify(data).replaceAll('<', '\\u003c');
  const page = join(root, 'mon-sejour.html');
  const before = readFileSync(page, 'utf8');
  const marker = /<!-- @carnet-catalogue -->[\s\S]*?<!-- @\/carnet-catalogue -->/;
  if (!marker.test(before)) throw new Error('Marqueur de catalogue absent de mon-sejour.html');
  const after = before.replace(marker, () => `<!-- @carnet-catalogue -->\n<script type="application/json" id="carnet-catalogue">${json}</script>\n<!-- @/carnet-catalogue -->`);
  if (after !== before) writeFileSync(page, after);
  writeFileSync(join(root, 'data/carnet-catalogue.json'), JSON.stringify(data, null, 2) + '\n');
  if (existsSync(join(root, 'recherche.html'))) {
    const search = indexerRecherche(pages, data);
    const searchPage = join(root, 'recherche.html');
    const previous = readFileSync(searchPage, 'utf8');
    const searchMarker = /<!-- @recherche -->[\s\S]*?<!-- @\/recherche -->/;
    if (!searchMarker.test(previous)) throw new Error('Marqueur de recherche absent');
    writeFileSync(searchPage, previous.replace(searchMarker, () => `<!-- @recherche -->\n<script type="application/json" id="recherche-index">${JSON.stringify(search).replaceAll('<', '\\u003c')}</script>\n<!-- @/recherche -->`));
    writeFileSync(join(root, 'data/recherche.json'), JSON.stringify(search, null, 2) + '\n');
  }
  return data.items.length;
}

export function indexerRecherche(pages, catalog) {
  const keywords = {
    'infos-pratiques.html': 'bus car train gare transports taxi venir accès sans voiture courses manger restaurant',
    'services-essentiels.html': 'toilettes wc eau potable pharmacie santé soins médecin stationnement parking urgence',
    'le-lac.html': 'baignade nager bouloc plage eau',
    'terroir.html': 'marché marchés fromage miel produits producteurs courses',
    'randonnees.html': 'balade marcher promenade forêt randonnée',
    'mon-sejour.html': 'programme planning organiser voyage vacances dates carnet favoris',
    'guide-curistes-avene.html': 'cure thermes location séjour curiste',
  };
  const plain = value => decode(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
  const items = pages.filter(([page, html]) => !['recherche.html', 'reglage-carte.html', '404.html', 'merci.html'].includes(page) && /<html[^>]*lang="fr"/.test(html) && !/name="robots"[^>]*content="[^"]*noindex/i.test(html)).map(([page, html]) => {
    const title = plain(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || html.match(/<title>(.*?)<\/title>/i)?.[1] || page);
    const description = decode(html.match(/<meta\b[^>]*name="description"[^>]*content="([^"]*)"/i)?.[1] || '');
    const headings = [...html.matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi)].map(match => plain(match[1])).join(' ').slice(0, 1800);
    return { title, category: 'Page du guide', url: '/' + page, description, keywords: (keywords[page] || '') + ' ' + headings };
  });
  const dateLabel = value => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value + 'T12:00:00Z'));
  return { version: 1, items: [...items, ...catalog.items.map(({ title, category, url, dates }) => ({ title, category, url,
    description: dates?.length ? 'Dates annoncées : ' + dates.slice(0, 3).map(dateLabel).join(' · ') + (dates.length > 3 ? ' · autres dates sur la fiche.' : '.') : '', keywords: '' }))] };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(`Carnet : ${generer()} idées publiques partageables.`);
