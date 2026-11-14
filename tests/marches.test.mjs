import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { dateCivile, aujourdHuiParis, ajouteJours, periode, aLieu, rechercher, etatCalendrier } from '../assets/marches-calendrier.js';
const {marches} = JSON.parse(await readFile(new URL('../data/marches.json', import.meta.url)));

test('dates civiles strictes, mois courts et années bissextiles', () => {
  assert.ok(dateCivile('2028-02-29'));
  for (const d of ['2027-02-29','2026-02-30','2026-04-31','2026-1-01','2026-13-01','2026-00-10','2026-01-01T00:00:00Z','',null]) assert.equal(dateCivile(d),null);
  assert.equal(ajouteJours('2026-12-31',1),'2027-01-01');
  assert.equal(ajouteJours('2028-02-28',1),'2028-02-29');
  assert.equal(ajouteJours('2027-02-28',1),'2027-03-01');
});

test('la date initiale suit Paris, y compris changement de jour et heure d’été', () => {
  assert.equal(aujourdHuiParis(new Date('2026-11-14T23:30:00Z')),'2026-11-15');
  assert.equal(aujourdHuiParis(new Date('2026-07-14T22:30:00Z')),'2026-07-15');
  assert.equal(aujourdHuiParis(new Date('2026-03-29T00:30:00Z')),'2026-03-29');
});

test('période inclusive limitée à 31 jours, invalide ou inversée refusée', () => {
  assert.equal(periode('2026-12-20','2027-01-19').length,31);
  assert.deepEqual(periode('2026-11-14','2026-11-14'),['2026-11-14']);
  assert.throws(()=>periode('2026-11-15','2026-11-14'),/fin du séjour/);
  assert.throws(()=>periode('2026-12-20','2027-01-20'),/31 jours/);
  assert.throws(()=>periode('2026-02-30','2026-03-01'),/dates valides/);
});

test('2e jeudi et 5e occurrence du mois : aucune dérive en fin de mois', () => {
  const m={calendrier:{type:'mensuel',regles:[{jour:4,rang:2}]}};
  assert.ok(aLieu(m,'2026-11-12')); assert.ok(!aLieu(m,'2026-11-19'));
  assert.ok(aLieu(m,'2027-01-14')); assert.ok(!aLieu(m,'2027-01-07'));
  m.calendrier.regles[0]={jour:1,rang:5};
  assert.ok(aLieu(m,'2026-11-30')); assert.ok(!aLieu(m,'2026-12-07'));
});

test('les deux rendez-vous mensuels de Lacaune et les samedis des halles ne disparaissent pas', () => {
  const lacaune=marches.find(m=>m.commune==='Lacaune' && m.calendrier.type==='mensuel');
  assert.ok(aLieu(lacaune,'2026-11-20')); assert.ok(aLieu(lacaune,'2026-11-21'));
  assert.ok(!aLieu(lacaune,'2026-11-14'));
  const halles=marches.find(m=>m.commune==='Lamalou-les-Bains' && m.jour.includes('samedi'));
  assert.ok(aLieu(halles,'2026-11-14')); assert.ok(aLieu(halles,'2026-11-19'));
});

test('dates publiées et saisons 2026 ne deviennent jamais des éditions 2027', () => {
  const ceilhes=marches.find(m=>m.commune==='Ceilhes-et-Rocozels');
  assert.ok(aLieu(ceilhes,'2026-07-07')); assert.ok(!aLieu(ceilhes,'2026-07-14'));
  assert.ok(!aLieu(ceilhes,'2027-07-07'));
  for (const m of marches.filter(m=>m.saisonnier)) {
    assert.equal(rechercher([m],'2027-07-01','2027-07-31').length,0,m.id);
  }
  assert.match(etatCalendrier(ceilhes,'2026-11-14'),/Saison 2026 terminée/);
  assert.match(etatCalendrier(ceilhes,'2026-07-01'),/Calendrier 2026 uniquement/);
});

test('les règles mensuelles saisonnières sont bornées et leur 3e mercredi reste estival', () => {
  const lunas=marches.find(m=>m.commune==='Lunas');
  assert.ok(aLieu(lunas,'2026-11-04')); assert.ok(!aLieu(lunas,'2026-11-18'));
  assert.ok(aLieu(lunas,'2026-07-15')); assert.ok(!aLieu(lunas,'2026-12-02'));
});

test('une annonce Avène de 2022 ou 2025 ne produit pas de rendez-vous en 2026', () => {
  const avene=marches.filter(m=>m.commune==='Avène');
  assert.equal(rechercher(avene,'2026-11-01','2026-11-30').length,0);
  assert.ok(avene.every(m=>etatCalendrier(m,'2026-11-14').includes('confirmer')));
});

test('recherche triée par date et commune, filtre et absence de résultat', () => {
  const resultats=rechercher(marches,'2026-11-14','2026-11-16','Bédarieux');
  assert.deepEqual(resultats.map(r=>r.date),['2026-11-14','2026-11-16']);
  assert.equal(rechercher(marches,'2026-11-14','2026-11-16','inconnue').length,0);
});

test('génération complète, stable, sources échappées et JSON non exécutable', async () => {
  const dir=await mkdtemp(join(tmpdir(),'ceilhes-marches-'));
  try {
    for (const d of ['scripts','assets','data']) await mkdir(join(dir,d));
    for (const f of ['scripts/marches.mjs','assets/marches-calendrier.js']) await copyFile(new URL('../'+f,import.meta.url),join(dir,f));
    const data=structuredClone(marches);
    data[0].commune='<img src=x onerror=alert(1)>';
    data[0].note='</script><script>alert(1)</script>';
    await writeFile(join(dir,'data/marches.json'),JSON.stringify({marches:data}));
    await writeFile(join(dir,'terroir.html'),'<main><!-- @marches --><!-- @/marches --></main>');
    const build=async()=>{execFileSync(process.execPath,['scripts/marches.mjs'],{cwd:dir});return readFile(join(dir,'terroir.html'),'utf8');};
    const html=await build();
    assert.equal((html.match(/data-marche-etat=/g)||[]).length,32);
    assert.match(html,/id="marches-sejour" hidden/);
    assert.match(html,/3e samedi du mois/);
    assert.match(html,/Saison 2026 terminée/);
    assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.match(html,/\\u003c\/script>/);
    assert.doesNotMatch(html,/<script>alert\(1\)<\/script>/);
    assert.equal(await build(),html);
    data[0].sources=['javascript:alert(1)'];
    await writeFile(join(dir,'data/marches.json'),JSON.stringify({marches:data}));
    assert.throws(()=>execFileSync(process.execPath,['scripts/marches.mjs'],{cwd:dir,stdio:'pipe'}));
    assert.equal(await readFile(join(dir,'terroir.html'),'utf8'),html);
  } finally { await rm(dir,{recursive:true,force:true}); }
});
