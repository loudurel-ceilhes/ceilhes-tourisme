// Les fiches sont dans le HTML ; seule la recherche a besoin de JavaScript.
(function () {
  'use strict';
  var form = document.getElementById('reseau-filtres');
  if (!form) return;
  var recherche = document.getElementById('reseau-recherche');
  var categorie = document.getElementById('reseau-categorie');
  var departement = document.getElementById('reseau-departement');
  var statut = document.getElementById('reseau-statut');
  var compteur = document.getElementById('reseau-compteur');
  var vide = document.getElementById('reseau-vide');
  function normaliser(t) { return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/œ/g, 'oe'); }
  var fiches = Array.from(document.querySelectorAll('.reseau-fiche')).map(function (el) {
    return { el: el, recherche: normaliser(el.dataset.reseauRecherche), categories: JSON.parse(el.dataset.categories) };
  });
  function lire() {
    var params = new URLSearchParams(location.search);
    recherche.value = params.get('q') || '';
    [categorie, departement, statut].forEach(function (select) {
      var value = params.get(select.name) || '';
      select.value = Array.from(select.options).some(function (o) { return o.value === value; }) ? value : '';
    });
  }
  function filtrer(ecrire) {
    var mots = normaliser(recherche.value).trim().split(/\s+/).filter(Boolean), nombre = 0;
    fiches.forEach(function (f) {
      var visible = mots.every(function (m) { return f.recherche.includes(m); }) &&
        (!categorie.value || f.categories.includes(categorie.value)) &&
        (!departement.value || f.el.dataset.departement === departement.value) &&
        (!statut.value || (statut.value === 'fiche' ? f.el.dataset.fiche === 'true' : ['recu', 'historique'].includes(f.el.dataset.statut)));
      f.el.hidden = !visible;
      if (visible) nombre++;
    });
    compteur.textContent = nombre + (nombre === 1 ? ' fiche affichée' : ' fiches affichées') + ' sur ' + fiches.length + '.';
    vide.hidden = nombre !== 0;
    if (ecrire) {
      var url = new URL(location.href);
      [recherche, categorie, departement, statut].forEach(function (champ) {
        if (champ.value.trim()) url.searchParams.set(champ.name, champ.value.trim()); else url.searchParams.delete(champ.name);
      });
      history.replaceState(null, '', url);
    }
  }
  form.hidden = false;
  lire(); filtrer(false);
  form.addEventListener('submit', function (event) { event.preventDefault(); filtrer(true); });
  form.addEventListener('input', function () { filtrer(true); });
  form.addEventListener('change', function () { filtrer(true); });
  form.addEventListener('reset', function () { setTimeout(function () { filtrer(true); recherche.focus(); }, 0); });
  window.addEventListener('popstate', function () { lire(); filtrer(false); });
})();
