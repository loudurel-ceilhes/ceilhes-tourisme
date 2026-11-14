// Dates facultatives, communes aux marchés, à l'agenda et au carnet.
// Aucune requête ni donnée personnelle ; l'URL n'est jamais modifiée ici.
(() => {
  const KEY = 'ceilhes:dates-sejour:v1';
  const DAY = 86400000;
  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T12:00:00Z');
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function validRange(value) {
    return !!value && validDate(value.start) && validDate(value.end) && value.start <= value.end &&
      (new Date(value.end + 'T12:00:00Z') - new Date(value.start + 'T12:00:00Z')) / DAY < 31;
  }
  function clean(value) { return validRange(value) ? { start: value.start, end: value.end } : null; }
  function stored() {
    try { return clean(JSON.parse(localStorage.getItem(KEY))); } catch { return null; }
  }
  const params = new URL(location.href).searchParams;
  let current = clean({ start: params.get('debut'), end: params.get('fin') }) || stored();
  function announce() { dispatchEvent(new CustomEvent('sejour:dates-changed', { detail: read() })); }
  function read() { return current ? { ...current } : null; }
  function write(value) {
    const next = clean(value);
    if (!next) return false;
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { return false; }
    const changed = JSON.stringify(current) !== JSON.stringify(next);
    current = next;
    if (changed) announce();
    return true;
  }
  function clear() {
    try { localStorage.removeItem(KEY); } catch { return false; }
    current = null;
    announce();
    return true;
  }
  window.SejourDates = Object.freeze({ read, write, clear, validDate, validRange });
  addEventListener('storage', event => {
    if (event.key === KEY || event.key === null) { current = stored(); announce(); }
  });
})();
