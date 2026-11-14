// Les quinze traces restent toutes lisibles sans JavaScript. Les durées
// viennent des fiches affichées, pas d'une estimation de difficulté.
(() => {
  const form = document.getElementById('rando-filtres');
  if (!form) return;
  const type = document.getElementById('rando-type');
  const duree = document.getElementById('rando-duree');
  const compteur = document.getElementById('rando-compteur');
  const vide = document.getElementById('rando-aucun');
  const table = document.querySelector('#toutes-randos .rtable-wrap');
  const target = document.getElementById('toutes-randos');
  const rows = [...table.querySelectorAll('tbody tr')];
  const retour = document.getElementById('rando-partage-retour');
  const manuel = document.getElementById('rando-lien-manuel');
  const lien = document.getElementById('rando-lien');
  const allowed = select => [...select.options].map(option => option.value);
  const types = allowed(type), durees = allowed(duree);

  function lireAdresse() {
    const params = new URL(location.href).searchParams;
    type.value = types.includes(params.get('type')) ? params.get('type') : '';
    duree.value = durees.includes(params.get('duree')) ? params.get('duree') : '';
  }
  function adresseSelection() {
    const url = new URL(location.href);
    for (const [key, value] of [['type', type.value], ['duree', duree.value]]) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    url.hash = 'toutes-randos';
    return url;
  }
  function afficher() {
    let total = 0;
    for (const row of rows) {
      const minutes = Number(row.dataset.minutes);
      const jours = Number(row.dataset.jours);
      const durationMatches = !duree.value ||
        (duree.value === '2h' && jours === 1 && minutes <= 120) ||
        (duree.value === '4h' && jours === 1 && minutes <= 240) ||
        (duree.value === 'journee' && jours === 1 && minutes > 240) ||
        (duree.value === 'itinerance' && jours > 1);
      row.hidden = !((!type.value || row.dataset.type === type.value) && durationMatches);
      if (!row.hidden) total++;
    }
    compteur.textContent = `${total} trace${total > 1 ? 's' : ''} sur ${rows.length}`;
    vide.hidden = total !== 0;
    table.hidden = total === 0;
    retour.textContent = '';
    manuel.hidden = true;
  }
  function selectionner() {
    afficher();
    const url = adresseSelection();
    if (url.href !== location.href) history.pushState(null, '', url);
  }
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('change', selectionner);
  form.addEventListener('reset', event => {
    event.preventDefault(); type.value = ''; duree.value = ''; selectionner();
  });
  addEventListener('popstate', () => { lireAdresse(); afficher(); });

  document.querySelectorAll('[data-trace-type]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      type.value = link.dataset.traceType; duree.value = '';
      selectionner();
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'start' });
    });
  });
  document.querySelector('[data-petites-balades]')?.addEventListener('click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    // Un filtre précédent ne doit pas laisser la cible de ce raccourci cachée.
    document.querySelector('.filter-chips [data-lv="facile"]')?.click();
  });
  document.getElementById('rando-partager').addEventListener('click', async () => {
    const url = adresseSelection().href;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('copie indisponible');
      await navigator.clipboard.writeText(url);
      retour.textContent = 'Le lien vers cette sélection est copié.';
    } catch {
      manuel.hidden = false; lien.value = url; lien.focus(); lien.select();
      retour.textContent = 'Copiez le lien ci-dessous pour partager cette sélection.';
    }
  });
  lireAdresse(); afficher(); form.hidden = false;
})();
