import {aujourdHuiParis, ajouteJours, rechercher, etatCalendrier} from './marches-calendrier.js';

const form = document.getElementById('marches-sejour');
const donnees = document.getElementById('marches-donnees');
if (form && donnees) {
  const marches = JSON.parse(donnees.textContent).marches;
  const debut = document.getElementById('marches-debut');
  const fin = document.getElementById('marches-fin');
  const commune = document.getElementById('marches-commune');
  const statut = document.getElementById('marches-statut');
  const liste = document.getElementById('marches-resultats');
  const zone = document.getElementById('marches-reponse');
  const detailDate = new Intl.DateTimeFormat('fr-FR', {weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone:'UTC'});
  const element = (tag, text, className) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  function lien(text, url) {
    const a = element('a', text); a.href = url;
    a.target = '_blank'; a.rel = 'noopener'; return a;
  }
  function remplir() {
    const params = new URL(location.href).searchParams;
    const dates = window.SejourDates?.read();
    debut.value = params.get('marche-debut') || dates?.start || aujourdHuiParis();
    fin.value = params.get('marche-fin') || dates?.end || ajouteJours(aujourdHuiParis(), 6);
    commune.value = params.get('marche-commune') || '';
  }
  function actualiserURL() {
    const url = new URL(location.href);
    url.searchParams.delete('debut'); url.searchParams.delete('fin');
    url.searchParams.set('marche-debut', debut.value); url.searchParams.set('marche-fin', fin.value);
    if (commune.value) url.searchParams.set('marche-commune', commune.value); else url.searchParams.delete('marche-commune');
    try { history.replaceState(history.state, '', url); } catch { /* Le résultat reste utilisable. */ }
  }
  function afficher(ecrireURL = true) {
    let resultats;
    try { resultats = rechercher(marches, debut.value, fin.value, commune.value); }
    catch (error) {
      zone.hidden = false; liste.replaceChildren(); statut.textContent = error.message;
      statut.setAttribute('role', 'alert'); return;
    }
    statut.setAttribute('role', 'status');
    const saved = !ecrireURL || !window.SejourDates || window.SejourDates.write({start: debut.value, end: fin.value});
    if (ecrireURL) actualiserURL();
    zone.hidden = false; liste.replaceChildren();
    statut.textContent = resultats.length
      ? `${resultats.length} rendez-vous recensé${resultats.length > 1 ? 's' : ''} pour cette période. Vérifiez le maintien auprès de la source avant de partir.`
      : 'Aucun rendez-vous datable dans notre liste pour cette période et cette commune. Consultez les calendriers à confirmer ci-dessous et l’agenda des sorties.';
    if (!saved) statut.textContent += ' Ces résultats sont affichés, mais le navigateur n’a pas pu conserver vos dates pour les autres pages.';
    let jour = '';
    for (const {date, marche:m} of resultats) {
      if (date !== jour) {
        liste.append(element('h5', detailDate.format(new Date(date + 'T12:00:00Z')), 'marche-date'));
        jour = date;
      }
      const card = element('article', undefined, 'marche-resultat');
      card.append(element('h6', `${m.commune} · ${m.horaires}`));
      card.append(element('p', m.type));
      card.append(element('p', m.lieu));
      card.append(element('p', m.calendrier.confirmation === 'dates-publiees'
        ? `Date publiée pour ${m.calendrier.annee} · à vérifier auprès de l’organisateur`
        : 'Rendez-vous habituel · maintien à confirmer', 'marche-preuve'));
      if (m.note) card.append(element('p', m.note, 'marche-note'));
      const actions = element('p', undefined, 'marche-liens');
      actions.append(lien('Vérifier auprès de la source', m.sourceRelue || m.sources[0]),
        lien('Itinéraire vers le lieu indiqué', `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${m.lieu}, ${m.commune}, France`)}`));
      card.append(actions); liste.append(card);
    }
  }
  remplir(); form.hidden = false;
  document.querySelectorAll('[data-marche-etat]').forEach(el => {
    const marche = marches.find(m => m.id === el.dataset.marcheEtat);
    if (marche) el.textContent = etatCalendrier(marche);
  });
  form.addEventListener('submit', event => { event.preventDefault(); afficher(); });
  document.getElementById('marches-semaine').addEventListener('click', () => {
    debut.value = aujourdHuiParis(); fin.value = ajouteJours(debut.value, 6); commune.value = ''; afficher();
  });
  window.addEventListener('sejour:dates-changed', () => {
    const dates = window.SejourDates.read();
    if (!dates) {
      debut.value = aujourdHuiParis(); fin.value = ajouteJours(debut.value, 6);
      const url = new URL(location.href);
      for (const key of ['debut', 'fin', 'marche-debut', 'marche-fin']) url.searchParams.delete(key);
      try { history.replaceState(history.state, '', url); } catch { /* Les dates affichées restent réinitialisées. */ }
      afficher(false);
    } else {
      debut.value = dates.start; fin.value = dates.end;
      actualiserURL(); afficher(false);
    }
  });
  window.addEventListener('popstate', () => { remplir(); afficher(false); });
  afficher(false);
}
