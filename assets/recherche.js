// Recherche locale dans les pages et les fiches déjà publiées, sans service tiers.
(() => {
  const form = document.getElementById('recherche-form');
  const input = document.getElementById('recherche-q');
  const output = document.getElementById('recherche-resultats');
  const status = document.getElementById('recherche-statut');
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  let items;
  try {
    const data = JSON.parse(document.getElementById('recherche-index').textContent);
    if (data.version !== 1 || !Array.isArray(data.items)) throw new Error('index');
    items = data.items.filter(item => {
      if (!item || typeof item.title !== 'string' || typeof item.url !== 'string') return false;
      try {
        const url = new URL(item.url, location.href);
        return !url.username && !url.password && ((url.origin === location.origin && /^\/[a-z0-9-]+\.html$/.test(url.pathname)) ||
          (url.origin === 'https://www.sitytrail.com' && url.pathname.startsWith('/fr/trails/')));
      } catch { return false; }
    }).map(item => ({ ...item, titleIndex: normalize(item.title), textIndex: normalize([item.title, item.category, item.description, item.keywords].join(' ')) }));
  } catch {
    status.textContent = 'La recherche est momentanément indisponible. Les liens directs ci-dessous restent accessibles.';
    return;
  }
  function show(updateUrl = true) {
    const query = input.value.trim().slice(0, 100);
    if (updateUrl) {
      const url = new URL(location.href);
      if (query) url.searchParams.set('q', query); else url.searchParams.delete('q');
      history.replaceState(history.state, '', url);
    }
    output.replaceChildren();
    const stop = new Set(['le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'en', 'au', 'aux', 'pour']);
    const words = normalize(query).split(' ').filter(word => word && !stop.has(word));
    if (!words.length) { status.textContent = 'Saisissez un lieu, un produit ou une activité.'; return; }
    const matches = items.filter(item => words.every(word => item.textIndex.includes(word)))
      .map(item => ({ item, score: words.reduce((total, word) => total + (item.titleIndex.includes(word) ? 3 : 1), 0) }))
      .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, 'fr'));
    status.textContent = matches.length ? `${matches.length} résultat${matches.length > 1 ? 's' : ''}${matches.length > 30 ? ' — les 30 premiers sont affichés. Précisez votre recherche pour affiner.' : '.'}` : 'Aucun résultat. Essayez un autre mot, ou utilisez les liens directs ci-dessous.';
    for (const { item } of matches.slice(0, 30)) {
      const row = document.createElement('li');
      const heading = document.createElement('h2');
      const link = document.createElement('a'); link.href = item.url; link.textContent = item.title; heading.append(link);
      const category = document.createElement('p'); category.className = 'recherche-categorie'; category.textContent = item.category;
      row.append(category, heading);
      if (item.description) { const description = document.createElement('p'); description.textContent = item.description; row.append(description); }
      output.append(row);
    }
  }
  function restore() { input.value = new URL(location.href).searchParams.get('q')?.slice(0, 100) || ''; show(false); }
  form.addEventListener('submit', event => { event.preventDefault(); show(); });
  addEventListener('popstate', restore);
  restore();
})();
