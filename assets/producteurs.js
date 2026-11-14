// L'annuaire reste complet sans ce script. Les filtres sont ajoutés seulement
// lorsque leurs commandes sont prêtes ; une panne du fond de carte n'interrompt
// jamais la recherche dans les fiches locales.
(() => {
  const annuaire = document.getElementById('annuaire-producteurs');
  if (!annuaire) return;
  const form = document.getElementById('filtres-producteurs');
  const recherche = document.getElementById('recherche-producteurs');
  const produit = document.getElementById('produit-producteurs');
  const zone = document.getElementById('zone-producteurs');
  const esquirol = document.getElementById('esquirol-producteurs');
  const compte = document.getElementById('compte-producteurs');
  const vide = document.getElementById('aucun-producteur');
  const groupes = [...annuaire.querySelectorAll('.prod-zone')];
  const normaliser = texte => texte.toLocaleLowerCase('fr').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replaceAll('œ', 'oe').replaceAll('æ', 'ae');
  const fiches = [...annuaire.querySelectorAll('.prod-card')].map(element => ({
    element,
    texte: normaliser(element.textContent),
    produits: element.dataset.produits.split(' '),
    zone: element.closest('.prod-zone').dataset.zone,
  }));
  let mettreAJourCarte = () => {};

  // Une sélection se partage en copiant l'adresse : q, produit, zone,
  // esquirol=1. Les autres paramètres et l'ancre appartiennent au visiteur.
  function lireSelection() {
    const params = new URL(location.href).searchParams;
    const optionValide = (select, valeur) => [...select.options].some(option => option.value === valeur);
    recherche.value = params.get('q') || '';
    produit.value = optionValide(produit, params.get('produit')) ? params.get('produit') : '';
    zone.value = optionValide(zone, params.get('zone')) ? params.get('zone') : '';
    esquirol.checked = params.get('esquirol') === '1';
  }

  function enregistrerSelection() {
    const url = new URL(location.href);
    const valeurs = { q: recherche.value, produit: produit.value, zone: zone.value, esquirol: esquirol.checked ? '1' : '' };
    for (const [nom, valeur] of Object.entries(valeurs)) {
      if (valeur) url.searchParams.set(nom, valeur);
      else url.searchParams.delete(nom);
    }
    // Remplacer l'adresse ne crée pas une étape de navigation par frappe.
    // Le filtrage continue même si le navigateur interdit l'historique local.
    if (url.href !== location.href) {
      try { history.replaceState(history.state, '', url); } catch { /* Adresse inchangée, fiches utilisables. */ }
    }
  }

  function filtrer() {
    const mots = normaliser(recherche.value).trim().split(/\s+/).filter(Boolean);
    let total = 0;
    for (const fiche of fiches) {
      const visible = mots.every(mot => fiche.texte.includes(mot))
        && (!produit.value || fiche.produits.includes(produit.value))
        && (!zone.value || fiche.zone === zone.value)
        && (!esquirol.checked || fiche.element.dataset.esquirol === 'true');
      fiche.element.hidden = !visible;
      if (visible) total++;
    }
    for (const groupe of groupes) groupe.hidden = !groupe.querySelector('.prod-card:not([hidden])');
    compte.textContent = `${total} producteur${total > 1 ? 's' : ''} sur ${fiches.length}`;
    vide.hidden = total !== 0;
    mettreAJourCarte(new Set(fiches.filter(f => !f.element.hidden).map(f => f.element.id)));
    enregistrerSelection();
  }

  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', filtrer);
  form.addEventListener('change', filtrer);
  form.addEventListener('reset', event => {
    // Rétablir les champs avant le filtrage, sans dépendre du moment où le
    // navigateur exécute l'action par défaut de l'événement reset.
    event.preventDefault();
    recherche.value = '';
    produit.value = '';
    zone.value = '';
    esquirol.checked = false;
    filtrer();
  });
  form.hidden = false;
  lireSelection();
  filtrer();

  // Un lien partagé vers une ferme reste utilisable après une recherche.
  function revelerAncre() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const fiche = fiches.find(f => f.element.id === id);
    if (fiche?.element.hidden) {
      form.reset();
      queueMicrotask(() => {
        fiche.element.focus({ preventScroll: true });
        fiche.element.scrollIntoView({ block: 'start' });
      });
    }
  }
  revelerAncre();
  addEventListener('hashchange', revelerAncre);
  addEventListener('popstate', () => {
    lireSelection();
    filtrer();
    revelerAncre();
  });

  const blocCarte = document.getElementById('bloc-carte-producteurs');
  const etatCarte = document.getElementById('etat-carte-producteurs');
  function messageCarte(texte) {
    etatCarte.textContent = texte;
    etatCarte.hidden = !texte;
  }
  if (!blocCarte) return;
  if (!window.L) {
    messageCarte('La carte est indisponible. Les fiches et leurs liens « Itinéraire » restent accessibles ci-dessous.');
    return;
  }

  try {
    const donnees = JSON.parse(document.getElementById('donnees-carte').textContent);
    blocCarte.hidden = false;
    const carte = L.map('carte-prod', { scrollWheelZoom: false }).setView([43.78, 3.1], 10);
    const fond = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(carte);
    let erreursTuiles = false;
    fond.on('loading', () => { erreursTuiles = false; });
    fond.on('tileerror', () => {
      erreursTuiles = true;
      messageCarte('Le fond de carte ne charge pas. Retrouvez les producteurs dans la liste et utilisez leurs liens « Itinéraire ».');
    });
    fond.on('load', () => { if (!erreursTuiles) messageCarte(''); });

    const marqueurs = L.layerGroup().addTo(carte);
    const parPoint = new Map();
    for (const repere of donnees.reperes) {
      if (!Array.isArray(repere.gps) || !repere.gps.every(Number.isFinite)) continue;
      const cle = repere.gps.join(',');
      if (!parPoint.has(cle)) parPoint.set(cle, []);
      parPoint.get(cle).push(repere);
    }
    const entrees = [];
    // Construire les infobulles avec textContent évite d'interpréter les noms
    // et coordonnées comme du HTML. Les liens externes acceptent HTTP(S) seul.
    function lien(parent, texte, adresse) {
      if (!adresse) return;
      let url;
      try { url = new URL(adresse); } catch { return; }
      if (!['https:', 'http:', 'tel:'].includes(url.protocol)) return;
      const a = document.createElement('a');
      a.textContent = texte;
      a.href = url.href;
      if (url.protocol !== 'tel:') { a.target = '_blank'; a.rel = 'noopener'; }
      parent.append(a, document.createElement('br'));
    }
    for (const groupe of parPoint.values()) {
      groupe.forEach((r, i) => {
        let [lat, lng] = r.gps;
        if (groupe.length > 1) {
          const angle = 2 * Math.PI * i / groupe.length;
          lat += 0.006 * Math.cos(angle);
          lng += 0.006 * Math.sin(angle) / Math.cos(lat * Math.PI / 180);
        }
        const epingle = document.createElement('span');
        epingle.className = 'prod-epingle';
        epingle.style.backgroundColor = donnees.couleurs[r.zone];
        const icone = L.divIcon({ className: '', html: epingle, iconSize: [22, 22], iconAnchor: [11, 22] });
        const popup = document.createElement('div');
        popup.className = 'popup-fiche';
        const nom = document.createElement('b');
        nom.textContent = `${r.picto} ${r.nom}`;
        popup.append(nom, document.createElement('br'), document.createTextNode(r.lieu), document.createElement('br'));
        if (r.tel) {
          const chiffres = r.tel.replace(/\D/g, '');
          lien(popup, `Téléphoner : ${r.tel}`, 'tel:' + (chiffres.startsWith('0') ? '+33' + chiffres.slice(1) : chiffres));
        }
        lien(popup, 'Site du producteur', r.site);
        lien(popup, 'Itinéraire', r.maps);
        const versFiche = document.createElement('a');
        versFiche.href = '#' + r.id;
        versFiche.textContent = 'Voir la fiche ↓';
        versFiche.addEventListener('click', () => {
          carte.closePopup();
          document.getElementById(r.id)?.focus({ preventScroll: true });
        });
        popup.append(versFiche);
        const marqueur = L.marker([lat, lng], { icon: icone, title: r.nom, alt: r.nom }).bindPopup(popup);
        entrees.push({ id: r.id, marqueur, point: [lat, lng] });
      });
    }
    mettreAJourCarte = ids => {
      marqueurs.clearLayers();
      const visibles = entrees.filter(e => ids.has(e.id));
      blocCarte.hidden = visibles.length === 0;
      for (const entree of visibles) marqueurs.addLayer(entree.marqueur);
      if (visibles.length) {
        carte.invalidateSize();
        carte.fitBounds(visibles.map(e => e.point), { padding: [30, 30], maxZoom: 13 });
      } else if (ids.size) {
        messageCarte('Ces résultats ne sont pas localisés sur la carte. Consultez leurs fiches ci-dessous.');
      } else {
        messageCarte('');
      }
    };
    filtrer();
  } catch {
    blocCarte.hidden = true;
    messageCarte('La carte est indisponible. Les fiches et leurs liens « Itinéraire » restent accessibles ci-dessous.');
  }
})();
