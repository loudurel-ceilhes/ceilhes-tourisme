// Dates civiles : les calculs restent identiques quel que soit le fuseau du visiteur.
export const MAX_JOURS = 31;
const JOUR = 86400000;

export function dateCivile(value) {
  if (typeof value !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export function aujourdHuiParis(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Paris', year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(date);
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

export function ajouteJours(value, nombre) {
  const date = dateCivile(value);
  if (!date || !Number.isInteger(nombre)) throw new Error('Date invalide');
  return new Date(date.getTime() + nombre * JOUR).toISOString().slice(0, 10);
}

export function periode(debut, fin) {
  const a = dateCivile(debut), b = dateCivile(fin);
  if (!a || !b) throw new Error('Choisissez deux dates valides.');
  const jours = Math.round((b - a) / JOUR) + 1;
  if (jours < 1) throw new Error('La fin du séjour doit suivre son début.');
  if (jours > MAX_JOURS) throw new Error(`Choisissez une période de ${MAX_JOURS} jours maximum.`);
  return Array.from({length:jours}, (_, i) => ajouteJours(debut, i));
}

export function aLieu(marche, value) {
  const date = dateCivile(value), c = marche.calendrier;
  if (!date || !c || c.type === 'a-confirmer') return false;
  if (c.annee && date.getUTCFullYear() !== c.annee) return false;
  if ((c.debut && value < c.debut) || (c.fin && value > c.fin)) return false;
  if (c.type === 'dates') return c.dates.includes(value);
  if (c.type === 'hebdomadaire') return c.jours.includes(date.getUTCDay());
  if (c.type === 'mensuel') return c.regles.some(r => r.jour === date.getUTCDay()
    && r.rang === Math.ceil(date.getUTCDate() / 7)
    && (!r.mois || r.mois.includes(date.getUTCMonth() + 1)));
  return false;
}

export function rechercher(marches, debut, fin, commune = '') {
  return periode(debut, fin).flatMap(date => marches
    .filter(m => (!commune || m.commune === commune) && aLieu(m, date))
    .sort((a,b) => a.commune.localeCompare(b.commune, 'fr'))
    .map(marche => ({date, marche})));
}

export function etatCalendrier(marche, reference = aujourdHuiParis()) {
  const c = marche.calendrier;
  if (!c || c.type === 'a-confirmer') return 'Dates à confirmer auprès de l’organisateur';
  const derniere = c.fin || (c.type === 'dates' ? [...c.dates].sort().at(-1) : null);
  if (derniere && reference > derniere) return `Saison ${c.annee} terminée · prochaine saison à confirmer`;
  return c.annee ? `Calendrier ${c.annee} uniquement` : 'Rendez-vous habituel · à confirmer avant le départ';
}
