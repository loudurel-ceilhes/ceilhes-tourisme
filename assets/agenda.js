// Les cartes restent lisibles sans JavaScript ; les filtres sont un complément.
(() => {
  const form = document.getElementById('agenda-filtres');
  if (!form) return;
  const cards = [...document.querySelectorAll('#agenda-list .ev-card')];
  if (!cards.length) return;
  const period = document.getElementById('agenda-periode');
  const commune = document.getElementById('agenda-commune');
  const activity = document.getElementById('agenda-activite');
  const count = document.getElementById('agenda-compteur');
  const empty = document.getElementById('agenda-aucun');
  const detail = document.getElementById('agenda-weekend-detail');

  // Compatibilité avec les cartes déjà publiées avant l'ajout des filtres.
  // Ne pas inventer une date de fin absente des données de l'office.
  const events = [];
  document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
    try {
      const json = JSON.parse(script.textContent);
      events.push(...(json['@graph'] || []).filter(e => e['@type'] === 'Event'));
    } catch { /* Une donnée tierce invalide ne doit pas masquer les cartes. */ }
  });
  const data = cards.map(card => {
    const event = events.find(e => e.name === card.querySelector('h3')?.textContent);
    let dates = [];
    try { dates = JSON.parse(card.dataset.periodes || '[]'); } catch { /* Repli ci-dessous. */ }
    const precise = dates.length > 0;
    if (!dates.length && event?.startDate) dates = [{ debut: event.startDate.slice(0,10), fin: (event.endDate || event.startDate).slice(0,10) }];
    const uncertainEnd = !precise && Boolean(event?.startDate) && !event.endDate;
    const notice = document.createElement('p');
    notice.className = 'agenda-date-incertaine';
    notice.textContent = 'Dates à confirmer auprès de l’organisateur.';
    notice.hidden = true;
    card.querySelector('.ev-body').append(notice);
    return {
      card,
      commune: card.dataset.commune || event?.location?.address?.addressLocality || card.querySelector('.ev-lieu')?.textContent || 'Ceilhes-et-Rocozels',
      activity: card.dataset.activite || card.querySelector('.ev-tag')?.textContent || 'Animation',
      dates, uncertainEnd, notice,
    };
  });
  const options = (select, values) => {
    [...new Set(values)].sort((a,b) => a.localeCompare(b,'fr')).forEach(value => {
      const option = document.createElement('option');
      option.value = value; option.textContent = value; select.append(option);
    });
  };
  options(commune, data.map(e => e.commune));
  options(activity, data.map(e => e.activity));

  // La recherche se retrouve dans l'adresse : periode, commune, activite.
  // Seules les valeurs réellement proposées par les listes sont acceptées.
  const selection = [
    { name: 'periode', select: period, fallback: 'tous' },
    { name: 'commune', select: commune, fallback: 'toutes' },
    { name: 'activite', select: activity, fallback: 'toutes' },
  ];
  function readSelection() {
    const params = new URL(location.href).searchParams;
    for (const { name, select, fallback } of selection) {
      const value = params.get(name);
      select.value = [...select.options].some(option => option.value === value) ? value : fallback;
    }
  }
  function saveSelection() {
    const url = new URL(location.href);
    for (const { name, select, fallback } of selection) {
      if (select.value !== fallback) url.searchParams.set(name, select.value);
      else url.searchParams.delete(name);
    }
    // Ni les paramètres d'un lien d'origine, ni son ancre ne sont effacés.
    if (url.href !== location.href) {
      try { history.replaceState(history.state, '', url); } catch { /* Le filtrage reste disponible. */ }
    }
  }
  const localDay = () => {
    const pieces = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const value = type => pieces.find(p => p.type === type).value;
    return new Date(`${value('year')}-${value('month')}-${value('day')}T00:00:00Z`);
  };
  const weekend = () => {
    const saturday = localDay();
    const day = saturday.getUTCDay();
    saturday.setUTCDate(saturday.getUTCDate() + (day === 0 ? -1 : 6-day));
    const sunday = new Date(saturday); sunday.setUTCDate(sunday.getUTCDate()+1);
    return {from:saturday.toISOString().slice(0,10),to:sunday.toISOString().slice(0,10),saturday,sunday};
  };
  function filter() {
    const dates = weekend();
    let visible = 0;
    let uncertain = 0;
    data.forEach(item => {
      const matches = (commune.value === 'toutes' || item.commune === commune.value) &&
        (activity.value === 'toutes' || item.activity === activity.value) &&
        (period.value === 'tous' || item.dates.some(d => d.debut <= dates.to &&
          (item.uncertainEnd || d.fin >= dates.from)));
      item.card.hidden = !matches;
      item.notice.hidden = !(matches && item.uncertainEnd && period.value === 'weekend');
      if (!item.notice.hidden) uncertain++;
      if (matches) visible++;
    });
    count.textContent = `${visible} rendez-vous affiché${visible > 1 ? 's' : ''} sur ${cards.length}.${uncertain ? ` Pour ${uncertain} d’entre eux, les dates restent à confirmer.` : ''}`;
    empty.hidden = visible !== 0;
    detail.hidden = period.value !== 'weekend';
    const format = new Intl.DateTimeFormat('fr-FR', {day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
    detail.textContent = `Du ${format.format(dates.saturday)} au ${format.format(dates.sunday)}. ${uncertain ? 'Les manifestations sans date de fin connue sont aussi proposées ; vérifiez qu’elles ont lieu ce week-end.' : 'Sélection selon les dates annoncées ; confirmez les horaires auprès de l’organisateur.'}`;
    // Éviter les titres de commune vides tout en conservant les textes de source.
    document.querySelectorAll('#agenda-list .agenda-list').forEach(list => {
      const groupCards = [...list.querySelectorAll('.ev-card')];
      const filtered = period.value !== 'tous' || commune.value !== 'toutes' || activity.value !== 'toutes';
      const hide = filtered && !groupCards.some(c => !c.hidden);
      list.hidden = hide;
      let previous = list.previousElementSibling;
      while (previous && (previous.classList.contains('agenda-titre') || previous.classList.contains('agenda-sous-titre'))) {
        previous.hidden = hide;
        previous = previous.previousElementSibling;
      }
    });
    saveSelection();
  }
  form.addEventListener('submit', e => e.preventDefault());
  form.addEventListener('change', filter);
  form.addEventListener('reset', e => {
    e.preventDefault(); period.value = 'tous'; commune.value = 'toutes'; activity.value = 'toutes'; filter();
  });
  addEventListener('popstate', () => { readSelection(); filter(); });
  readSelection();
  filter();
  form.hidden = false;
})();
