import test from 'node:test';
import assert from 'node:assert/strict';
import { creerICS, texteICS, plierLigneICS, lienGoogleAgenda, occurrencesCalendrier } from '../assets/calendrier-ics.js';

const event = { id:'ev-0123456789abcdef', title:'Visite à Avène', description:'Rendez-vous à 15h dans le descriptif, sans horaire structuré.', location:'Place de la mairie · 34260 Avène', url:'https://ceilhes-tourisme.fr/agenda.html#ev-0123456789abcdef', source:'https://data.datatourisme.fr/32/visite', provenance:'Office de tourisme du Grand Orb' };
const instant = new Date('2026-11-15T12:34:56Z');
const unfold = text => text.replace(/\r\n[ \t]/g, '');
const property = (text, name) => unfold(text).split('\r\n').find(line => line.startsWith(name+':'))?.slice(name.length+1);

test('une date certaine sans heure devient une journée entière, fin exclusive et indication explicite', () => {
  const text = creerICS(event,{debut:'2026-11-17',fin:'2026-11-17'},instant);
  assert.match(text,/DTSTART;VALUE=DATE:20261117\r\nDTEND;VALUE=DATE:20261118/);
  assert.match(text,/DTSTAMP:20261115T123456Z/);
  assert.match(unfold(text),/Journée entière : horaire précis non renseigné/);
  assert.match(unfold(text),/aucune réservation effectuée/);
  assert.match(text,/STATUS:TENTATIVE\r\nTRANSP:TRANSPARENT/);
  assert.equal(property(text,'LOCATION'),event.location);
  assert.equal(property(text,'URL'),event.url);
  assert.match(unfold(text),/Source : https:\/\/data.datatourisme.fr\/32\/visite/);
  assert.ok(!text.includes('DTSTART:20261117T150000'));
  assert.ok(!text.includes('ATTENDEE')&&!text.includes('ORGANIZER'));
});

test('les dates civiles restent exactes autour des changements d’heure de Paris et aux limites de mois', () => {
  for (const [day,end] of [['2026-03-29','20260330'],['2026-10-25','20261026'],['2028-02-29','20280301'],['2026-12-31','20270101']]) {
    const text=creerICS(event,{debut:day,fin:day},instant);
    assert.equal(property(text,'DTSTART;VALUE=DATE'),day.replaceAll('-',''));
    assert.equal(property(text,'DTEND;VALUE=DATE'),end);
    assert.ok(!text.includes('TZID=')); // VALUE=DATE est civil et indépendant de tout décalage UTC.
    const url=new URL(lienGoogleAgenda(event,{debut:day,fin:day}));
    assert.equal(url.searchParams.get('ctz'),'Europe/Paris');
    assert.equal(url.searchParams.get('dates'),day.replaceAll('-','')+'/'+end);
  }
});

test('une période d’exposition reste un seul événement couvrant sa période annoncée', () => {
  const text=creerICS(event,{debut:'2026-11-02',fin:'2027-02-28'},instant);
  assert.equal((text.match(/BEGIN:VEVENT/g)||[]).length,1);
  assert.match(text,/DTSTART;VALUE=DATE:20261102\r\nDTEND;VALUE=DATE:20270301/);
  assert.match(unfold(text),/ne signifie pas une ouverture quotidienne/);
  assert.ok(!text.includes('RRULE')&&!text.includes('RDATE'));
});

test('identifiant stable après renommage et correction de fin, différent pour chaque occurrence', () => {
  const period={debut:'2026-11-17',fin:'2026-11-17'};
  const first=property(creerICS(event,period,instant),'UID');
  assert.equal(first,property(creerICS({...event,title:'Nouveau nom'},{...period,fin:'2026-11-18'},new Date('2026-11-16T00:00:00Z')),'UID'));
  assert.notEqual(first,property(creerICS(event,{debut:'2026-11-24',fin:'2026-11-24'},instant),'UID'));
});

test('échappement des textes, injection de propriétés impossible et pliage UTF-8 sur 75 octets', () => {
  assert.equal(texteICS('Été, lac; sentier\\pont\r\nSuite\rFin'),'Été\\, lac\\; sentier\\\\pont\\nSuite\\nFin');
  const title='Été 🌿 à Avène, sentier; '.repeat(12)+'\r\nATTENDEE:mailto:intrus@example.org';
  const text=creerICS({...event,title,description:'Un chemin\\un lac\nUne sortie; calme, été.'},{debut:'2026-11-17',fin:'2026-11-17'},instant);
  for(const line of text.split('\r\n')) assert.ok(Buffer.byteLength(line,'utf8')<=75,`${Buffer.byteLength(line)} octets`);
  assert.equal(property(text,'SUMMARY'),texteICS(title));
  assert.ok(!unfold(text).split('\r\n').some(line=>line.startsWith('ATTENDEE:')));
  assert.ok(!text.includes('\ufffd'));
  assert.equal(unfold(plierLigneICS('é'.repeat(80)+'🌿')),'é'.repeat(80)+'🌿');
  assert.ok(text.endsWith('END:VCALENDAR\r\n'));
  assert.equal(text.replaceAll('\r\n','').includes('\n'),false);
});

test('les dates impossibles, inversées et les liens non web sont refusés', () => {
  for(const period of [{debut:'2026-02-29',fin:'2026-03-01'},{debut:'2026-11-17T15:00',fin:'2026-11-17'},{debut:'2026-11-18',fin:'2026-11-17'}]) assert.throws(()=>creerICS(event,period,instant));
  for(const url of ['javascript:alert(1)','https://user:pass@example.org','https://example.org/\r\nATTENDEE:a']) assert.throws(()=>creerICS({...event,url},{debut:'2026-11-17',fin:'2026-11-17'},instant));
  assert.throws(()=>creerICS({...event,id:'id\nUID:intrus'},{debut:'2026-11-17',fin:'2026-11-17'},instant));
});

test('Google Agenda reçoit seulement la date choisie, le lieu et les indications, sans lien de réservation exécuté', () => {
  const url=new URL(lienGoogleAgenda(event,{debut:'2026-11-24',fin:'2026-11-24'}));
  assert.equal(url.origin,'https://calendar.google.com');
  assert.equal(url.searchParams.get('action'),'TEMPLATE');
  assert.equal(url.searchParams.get('dates'),'20261124/20261125');
  assert.equal(url.searchParams.get('text'),event.title);
  assert.equal(url.searchParams.get('location'),event.location);
  assert.ok(url.searchParams.get('details').includes(event.url));
  assert.ok(url.searchParams.get('details').includes('aucune réservation effectuée'));
});

test('le filtre conserve les dates originales et ne fabrique pas une ouverture quotidienne', () => {
  const first={debut:'2026-11-17',fin:'2026-11-17'},second={debut:'2026-11-24',fin:'2026-11-24'};
  assert.deepEqual(occurrencesCalendrier([first,second,second],[second]),[second]);
  const exhibition={debut:'2026-11-02',fin:'2027-02-28'};
  assert.deepEqual(occurrencesCalendrier([exhibition],[second]),[exhibition]);
  assert.deepEqual(occurrencesCalendrier([first,second],[]),[]);
});
