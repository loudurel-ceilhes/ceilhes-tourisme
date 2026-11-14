// Dates civiles partagées par la génération et les filtres de l’agenda.
export function dateValide(value) {
  return typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(`${value}T00:00:00Z`))
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function ajouterJours(value, number) {
  if (!dateValide(value) || !Number.isInteger(number)) throw new Error('Date invalide');
  return new Date(Date.parse(`${value}T00:00:00Z`) + number * 86400000).toISOString().slice(0, 10);
}
export function joursFeries(year) {
  // Fêtes nationales françaises ; pas de jour local ajouté sans source.
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4;
  const f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30;
  const i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451);
  const month=Math.floor((h+l-7*m+114)/31),day=(h+l-7*m+114)%31+1;
  const easter=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  return new Set(['01-01','05-01','05-08','07-14','08-15','11-01','11-11','12-25'].map(s=>`${year}-${s}`)
    .concat([1,39,50].map(n=>ajouterJours(easter,n))));
}
export function ouvertCeJour(day, opening) {
  if (!dateValide(day)) return false;
  if (!opening || day < opening.from || day > opening.through) return true;
  const d=new Date(`${day}T00:00:00Z`);
  return opening.weekdays.includes(d.getUTCDay()) && !(opening.closedHolidays && joursFeries(d.getUTCFullYear()).has(day));
}
export function periodesChoisies(periods, from, to, opening) {
  if (!dateValide(from) || !dateValide(to) || from > to || Date.parse(to)-Date.parse(from) > 30*86400000) return [];
  const result=[];
  for (const period of periods) {
    const first=period.debut > from ? period.debut : from;
    const last=period.fin < to ? period.fin : to;
    if (!dateValide(first) || !dateValide(last) || first > last) continue;
    let run=null;
    for (let day=first;day<=last;day=ajouterJours(day,1)) {
      if (ouvertCeJour(day,opening)) {
        if (run) run.fin=day;
        else {run={debut:day,fin:day};result.push(run);}
      } else run=null;
    }
  }
  return result.filter((p,i,all)=>all.findIndex(q=>q.debut===p.debut&&q.fin===p.fin)===i);
}
export function ouvertureConnue(opening, from, to) {
  return Boolean(opening && opening.from <= from && opening.through >= to);
}
