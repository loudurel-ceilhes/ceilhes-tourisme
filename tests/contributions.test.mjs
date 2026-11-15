import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ficheAutorisee, preparerMessage, lienPhoto, AUTORISATION } from '../assets/contributions.js';
import { enrichirPage, genererContributions } from '../scripts/contributions.mjs';
const catalogue = [{url:'/',title:'Le guide'}, {url:'/terroir.html#maison-test',title:'La maison & ses brebis'}];
const correction = {type:'correction',fiche:'/terroir.html#maison-test',nom:'Camille',correction:'Ouverture à 10 h.',source:'Constaté le 15 novembre.'};
const photo = {type:'photo',fiche:'/',credit:'Photo © Camille',legende:'La fontaine, en novembre.',photo:'https://photos.example/image.jpg',autorisation:true,personnes:true};

test('Une contribution n’accepte que les destinations connues du guide', () => {
  assert.equal(ficheAutorisee('https://ceilhes-tourisme.fr/terroir.html#maison-test',catalogue)?.title,catalogue[1].title);
  for (const bad of ['https://evil.example/terroir.html#maison-test','//evil.example/','javascript:alert(1)','https://user@ceilhes-tourisme.fr/','/terroir.html?email=secret#maison-test','/terroir.html#inconnue','/inconnue.html','/../terroir.html#maison-test','/terroir.html%0d%0a','/\\evil.example/','https://ceilhes-tourisme.fr.evil.example/']) {
    assert.equal(ficheAutorisee(bad,catalogue),null,bad);
  }
});
test('Une correction se prépare sans photo, avec destinataire fixe et texte encodé', () => {
  const r = preparerMessage({...correction,nom:'Camille\nBcc: intrus@example.test',correction:'x & body=autre\n<script>alert(1)</script>'},catalogue);
  assert.ok(r.href.startsWith('mailto:lou.durel@gmail.com?subject='));
  const query = new URLSearchParams(r.href.split('?')[1]);
  assert.deepEqual([...query.keys()],['subject','body']);
  assert.match(query.get('body'),/Bcc: intrus/);
  assert.match(query.get('body'),/<script>/);
  assert.doesNotMatch(query.get('subject'),/Bcc:|\r|\n/);
  assert.doesNotMatch(r.body,/Autorisation de publication/);
});
test('Photo : droits, crédit et accès au fichier sont nécessaires', () => {
  assert.match(preparerMessage(photo,catalogue).body,/uniquement sur ceilhes-tourisme.fr/);
  for (const [key,value] of [['autorisation',false],['personnes',false],['credit',''],['legende',''],['photo','']]) {
    assert.throws(()=>preparerMessage({...photo,[key]:value},catalogue));
  }
  assert.match(preparerMessage({...photo,photo:'',pieceJointe:true},catalogue).body,/joindrai la photo/);
  assert.ok(preparerMessage(photo,catalogue).body.includes(AUTORISATION));
  for (const bad of ['http://photos.example/photo','javascript:alert(1)','https://user:pass@example.test/photo','https://example.test/a\nb']) assert.throws(()=>lienPhoto(bad));
});
test('Messages longs : copie complète, jamais de troncature silencieuse', () => {
  const r=preparerMessage({...correction,correction:'é'.repeat(1500)},catalogue);
  assert.equal(r.copierAvant,true);
  assert.equal(new URLSearchParams(r.href.split('?')[1]).has('body'),false);
  assert.ok(r.body.includes('é'.repeat(1500)));
  assert.throws(()=>preparerMessage({...correction,correction:'a'.repeat(1501)},catalogue));
});
const template = body => `<!doctype html><html><head><title>Guide</title></head><body><h1>Nos maisons</h1>${body}<footer>Fin</footer></body></html>`;
test('Liens présents sans JavaScript, titres échappés et génération idempotente', () => {
  const input=template('<article id="maison-test"><h2>La maison &amp; ses brebis</h2><p>Une visite</p></article>');
  const a=enrichirPage(input,'terroir.html');
  assert.match(a.html,/contribuer.html\?fiche=%2Fterroir.html%23maison-test&amp;type=photo/);
  assert.deepEqual(a.items[1],catalogue[1]);
  assert.equal(enrichirPage(a.html,'terroir.html').html,a.html);
  assert.equal((a.html.match(/assets\/contributions.css/g)||[]).length,1);
});
test('Les maisons d’un même secteur obtiennent des ancres distinctes et stables', () => {
  const card=id=>`<article data-carnet-id="${id}" data-carnet-url="circuits.html#avene" data-carnet-title="${id}"><h3>${id}</h3></article>`;
  const a=enrichirPage(template(`<section id="avene">${card('miel')}${card('brebis')}</section>`),'circuits.html');
  assert.deepEqual(a.items.slice(1).map(i=>i.url),['/circuits.html#fiche-miel','/circuits.html#fiche-brebis']);
  assert.equal(enrichirPage(a.html,'circuits.html').html,a.html);
});
test('Aucune carte fictive reconnue dans un script ni lien externe autorisé', () => {
  const input=template('<script type="application/json">{"x":"<article id=\"faux\"><h2>Faux</h2></article>"}</script><article data-carnet-url="https://evil.example/" data-carnet-title="Externe"><h2>Externe</h2></article>');
  assert.equal(enrichirPage(input,'terroir.html').items.length,1);
});
test('Le catalogue et les liens générés se correspondent, hors pages internes', () => {
  const root=mkdtempSync(join(tmpdir(),'contributions-'));
  try {
    writeFileSync(join(root,'terroir.html'),template('<article id="maison-test"><h2>La maison</h2></article>'));
    writeFileSync(join(root,'reglage-carte.html'),template('Interne'));
    writeFileSync(join(root,'contribuer.html'),template('<!-- @contributions-catalogue --><script type="application/json" id="contributions-catalogue">{}</script><!-- @/contributions-catalogue -->'));
    const first=genererContributions(root);
    const before=readFileSync(join(root,'contribuer.html'),'utf8');
    genererContributions(root);
    assert.equal(readFileSync(join(root,'contribuer.html'),'utf8'),before);
    assert.equal(first.fiches,4);
    assert.doesNotMatch(before,/reglage-carte/);
    assert.match(before,/terroir.html#maison-test/);
  } finally {rmSync(root,{recursive:true,force:true});}
});

test('Patrimoine : seulement les notices POP des listes monuments, ancre stable après renommage', () => {
  const official='<a href="https://pop.culture.gouv.fr/notice/merimee/PA00103465">Notice</a>';
  const card=`<li><b>Abbaye de Joncels</b>${official}<span>Description</span></li>`;
  const source=template(`<ul class="monuments reveal">${card}<li><b>Sans notice</b></li></ul><ul>${card}</ul>`);
  const a=enrichirPage(source,'patrimoine.html');
  assert.equal(a.items.length,2);
  assert.equal(a.items[1].url,'/patrimoine.html#monument-pa00103465');
  assert.equal(enrichirPage(a.html,'patrimoine.html').html,a.html);
  const renamed=enrichirPage(a.html.replace('Abbaye de Joncels','Ancienne abbaye'), 'patrimoine.html');
  assert.equal(renamed.items[1].url,a.items[1].url);
  assert.equal(enrichirPage(source,'autre.html').items.length,1);
  const old=enrichirPage(template(`<ul class="monuments"><li id="ancienne-ancre"><b>Abbaye</b>${official}</li></ul>`),'patrimoine.html');
  assert.equal(old.items[1].url,'/patrimoine.html#ancienne-ancre');
});

test('Associations : blocs imbriqués préservés, aucune autre div transformée', () => {
  const source=template('<div class="assos-grid"><div class="asso reveal"><h4>Comité des fêtes</h4><div class="role">Animations</div><p>Rencontres</p></div><div class="guide"><h4>Simple texte</h4></div></div>');
  const a=enrichirPage(source,'vie-associative.html');
  assert.equal(a.items.length,2);
  assert.equal(a.items[1].url,'/vie-associative.html#association-comite-des-fetes');
  assert.match(a.html,/<div class="role">Animations<\/div><p>Rencontres<\/p><!-- @contribution -->/);
  assert.equal(enrichirPage(a.html,'vie-associative.html').html,a.html);
  assert.equal(enrichirPage(source,'autre.html').items.length,1);
});

test('L’ensemble de statues-menhirs conserve une ancre éditoriale sans fausse notice PA', () => {
  const source=template('<ul class="monuments"><li><b>Statues-menhirs du groupe rouergat (Candoubre…)</b> — Murat-sur-Vèbre <span class="mh-desc">Objets Palissy</span></li></ul>');
  const a=enrichirPage(source,'patrimoine.html');
  assert.equal(a.items[1].url,'/patrimoine.html#monument-statues-menhirs-murat-sur-vebre');
  assert.doesNotMatch(a.html,/pop\.culture|monument-pa/);
  assert.equal(enrichirPage(a.html,'patrimoine.html').html,a.html);
});
