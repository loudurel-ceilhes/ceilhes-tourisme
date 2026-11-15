import { dateValide, ajouterJours } from './agenda-calendrier.js';

// Le flux fournit des dates civiles, sans horaire structuré : ne jamais extraire
// une heure du descriptif ni convertir ces dates en minuit UTC/Paris.
const compact = day => day.replaceAll('-', '');
const dateLabel = day => new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${day}T00:00:00Z`));
const key = period => `${period.debut}/${period.fin}`;
const validPeriod = period => period && dateValide(period.debut) && dateValide(period.fin) && period.debut <= period.fin;
const clean = value => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');

export function texteICS(value) {
  return clean(value).replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

/** RFC 5545 : 75 octets, espace de continuation compris, sans couper l’UTF-8. */
export function plierLigneICS(value) {
  const encoder = new TextEncoder();
  let line = '', size = 0;
  const lines = [];
  for (const character of value) {
    const bytes = encoder.encode(character).length;
    if (size + bytes > 75) { lines.push(line); line = ' '; size = 1; }
    line += character; size += bytes;
  }
  lines.push(line);
  return lines.join('\r\n');
}

function webUrl(value) {
  if (/[\r\n\u0000]/.test(String(value))) return '';
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}

function preparer(event, period) {
  if (!validPeriod(period) || !/^[a-z0-9_-]{1,160}$/i.test(event?.id || '') || !String(event.title || '').trim()) {
    throw new Error('Le rendez-vous ou sa date est incomplet.');
  }
  const url = webUrl(event.url), source = webUrl(event.source);
  if (!url) throw new Error('Le lien du rendez-vous est invalide.');
  const isPeriod = period.debut !== period.fin;
  const note = isPeriod
    ? 'Période annoncée, enregistrée comme un seul rappel. Les jours et horaires d’ouverture restent à vérifier ; ce rappel ne signifie pas une ouverture quotidienne.'
    : 'Journée entière : horaire précis non renseigné dans les données de l’agenda. Cela ne signifie pas que l’activité dure toute la journée.';
  const description = [
    note, 'Idée de sortie enregistrée ; aucune réservation effectuée.',
    clean(event.description).trim(), event.opening ? clean(event.opening) : '',
    event.provenance ? `Provenance : ${clean(event.provenance)}` : '',
    source ? `Source : ${source}` : '', `Fiche du rendez-vous : ${url}`,
  ].filter(Boolean).join('\n\n');
  return { url, source, description, isPeriod, end: ajouterJours(period.fin, 1) };
}

/** Un fichier = une occurrence (ou une période explicitement choisie), sans RRULE. */
export function creerICS(event, period, instant = new Date()) {
  const info = preparer(event, period);
  if (!(instant instanceof Date) || !Number.isFinite(instant.getTime())) throw new Error('Date de création invalide.');
  const stamp = instant.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ceilhes Tourisme//Idees de sorties//FR',
    'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${event.id}-${compact(period.debut)}@ceilhes-tourisme.fr`, `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compact(period.debut)}`, `DTEND;VALUE=DATE:${compact(info.end)}`,
    `SUMMARY:${texteICS(event.title)}`, `DESCRIPTION:${texteICS(info.description)}`,
    ...(event.location ? [`LOCATION:${texteICS(event.location)}`] : []),
    `URL:${info.url}`, 'STATUS:TENTATIVE', 'TRANSP:TRANSPARENT',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return lines.map(plierLigneICS).join('\r\n') + '\r\n';
}

export function lienGoogleAgenda(event, period) {
  const info = preparer(event, period);
  const url = new URL('https://calendar.google.com/calendar/render');
  url.search = new URLSearchParams({
    action: 'TEMPLATE', text: clean(event.title), dates: `${compact(period.debut)}/${compact(info.end)}`,
    details: info.description, location: clean(event.location), ctz: 'Europe/Paris',
  }).toString();
  return url.href;
}

/** Les filtres choisissent parmi les occurrences d’origine, sans découper une exposition. */
export function occurrencesCalendrier(original, displayed) {
  return original.filter(validPeriod).filter((period, index, all) => all.findIndex(p => key(p) === key(period)) === index)
    .filter(period => displayed.some(p => validPeriod(p) && period.debut <= p.fin && period.fin >= p.debut));
}

export function installerCalendrier(card, periods) {
  const container = card.querySelector('.ev-details-contenu');
  if (!container || !card.id || !periods.some(validPeriod)) return null;
  const event = {
    id: card.id, title: card.querySelector('h3')?.textContent || '',
    url: `https://ceilhes-tourisme.fr/agenda.html#${encodeURIComponent(card.id)}`,
    description: card.querySelector('.ev-description')?.textContent || '',
    location: (card.querySelector('.ev-adresse')?.textContent || card.dataset.commune || '').replace(/^Lieu annoncé\s*:\s*/, ''),
    source: card.querySelector('.ev-source a')?.href || '',
    provenance: card.querySelector('.ev-source')?.textContent.replace(/\. Confirmez les horaires[\s\S]*$/, '').trim() || '',
    opening: card.querySelector('.ev-ouverture')?.textContent || '',
  };
  const section = document.createElement('section'); section.className = 'ev-calendrier';
  const heading = document.createElement('h4'); heading.id = `${card.id}-calendrier-titre`; heading.textContent = 'Dans mon calendrier';
  section.setAttribute('aria-labelledby', heading.id);
  const label = document.createElement('label'); label.htmlFor = `${card.id}-calendrier-date`; label.textContent = 'Date ou période à ajouter';
  const select = document.createElement('select'); select.id = label.htmlFor;
  const help = document.createElement('p'); help.id = `${card.id}-calendrier-aide`;
  select.setAttribute('aria-describedby', help.id);
  const actions = document.createElement('div'); actions.className = 'ev-contacts';
  const download = document.createElement('a'); download.className = 'ev-calendrier-ics'; download.href = '#';
  const google = document.createElement('a'); google.className = 'ev-calendrier-google'; google.textContent = 'Ouvrir dans Google Agenda'; google.target = '_blank'; google.rel = 'noopener';
  const status = document.createElement('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const formats = document.createElement('p'); formats.className = 'ev-calendrier-formats';
  formats.textContent = 'Le fichier .ics s’importe dans Apple Calendrier, Outlook ou Google Agenda. L’ajout se termine dans votre application ; il ne crée pas de réservation.';
  actions.append(download, google); section.append(heading, label, select, help, actions, formats, status); container.append(section);
  let available = [], blobUrl = '';
  function chosen() { return available.find(p => key(p) === select.value); }
  function refresh() {
    const period = chosen();
    status.textContent = '';
    if (!period) return;
    const isPeriod = period.debut !== period.fin;
    download.textContent = isPeriod ? 'Ajouter la période (.ics)' : 'Ajouter cette date (.ics)';
    help.textContent = isPeriod
      ? 'Un seul rappel couvrira la période annoncée. Les jours et horaires d’ouverture restent à vérifier.'
      : 'Ajout en journée entière : horaire précis à confirmer. L’activité ne dure pas nécessairement toute la journée.';
    google.href = lienGoogleAgenda(event, period);
    google.setAttribute('aria-label', `${isPeriod ? 'Ajouter cette période' : 'Ajouter cette date'} dans Google Agenda (nouvel onglet)`);
    download.download = `${event.id}-${period.debut}.ics`;
  }
  select.addEventListener('change', refresh);
  download.addEventListener('click', action => {
    try {
      const period = chosen();
      if (!period) throw new Error('Choisissez une date.');
      const file = new Blob([creerICS(event, period)], { type: 'text/calendar;charset=utf-8' });
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      blobUrl = URL.createObjectURL(file); download.href = blobUrl;
      status.textContent = 'Fichier calendrier préparé. Ouvrez-le dans votre application pour terminer l’ajout.';
    } catch {
      action.preventDefault(); status.textContent = 'Le fichier ne peut pas être préparé ici. Les dates et coordonnées restent disponibles dans cette fiche.';
    }
  });
  addEventListener('pagehide', () => { if (blobUrl) URL.revokeObjectURL(blobUrl); });
  const update = displayed => {
    const next = occurrencesCalendrier(periods, displayed);
    section.hidden = next.length === 0;
    if (next.map(key).join('|') === available.map(key).join('|')) return;
    const previous = select.value; available = next;
    select.replaceChildren(...available.map(period => {
      const option = document.createElement('option'); option.value = key(period);
      option.textContent = period.debut === period.fin ? `Le ${dateLabel(period.debut)}` : `Période du ${dateLabel(period.debut)} au ${dateLabel(period.fin)}`;
      return option;
    }));
    if (available.some(p => key(p) === previous)) select.value = previous;
    refresh();
  };
  update(periods);
  return { update };
}
