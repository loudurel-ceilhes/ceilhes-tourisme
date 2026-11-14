// Génère les listes lisibles sans JavaScript et le calendrier de séjour depuis
// data/marches.json. Ne pas modifier le bloc @marches à la main.
import { readFile, writeFile } from 'node:fs/promises';
import { dateCivile, etatCalendrier } from '../assets/marches-calendrier.js';

const DONNEES = new URL('../data/marches.json', import.meta.url);
const PAGE = new URL('../terroir.html', import.meta.url);
const echappe = t => String(t).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const dateTexte = t => new Intl.DateTimeFormat('fr-FR', {day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(dateCivile(t));

function valider(marches) {
  if (!Array.isArray(marches) || marches.length < 5) throw new Error('Liste de marchés incomplète');
  const ids = new Set();
  for (const m of marches) {
    if (!/^[a-z0-9-]+$/.test(m.id || '') || ids.has(m.id)) throw new Error('Identifiant de marché invalide ou en double');
    ids.add(m.id);
    if (!m.commune || !m.jour || !dateCivile(m.maj) || !m.sources?.length) throw new Error(`Fiche incomplète : ${m.id}`);
    for (const source of [...m.sources, ...(m.sourceRelue ? [m.sourceRelue] : [])]) {
      const url = new URL(source);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error(`Source invalide : ${m.id}`);
    }
    const c = m.calendrier;
    if (!c || !['hebdomadaire','mensuel','dates','a-confirmer'].includes(c.type)) throw new Error(`Calendrier inconnu : ${m.id}`);
    if (c.annee && (!Number.isInteger(c.annee) || c.annee < 2000 || c.annee > 2099)) throw new Error(`Année invalide : ${m.id}`);
    if (['debut','fin'].some(k => c[k] && !dateCivile(c[k])) || (c.debut && c.fin && c.debut > c.fin)) throw new Error(`Bornes invalides : ${m.id}`);
    const jourValide = j => Number.isInteger(j) && j >= 0 && j <= 6;
    if (c.type === 'hebdomadaire' && (!c.jours?.length || !c.jours.every(jourValide))) throw new Error(`Jours invalides : ${m.id}`);
    if (c.type === 'mensuel' && (!c.regles?.length || !c.regles.every(r => jourValide(r.jour) && Number.isInteger(r.rang) && r.rang >= 1 && r.rang <= 5 && (!r.mois || r.mois.every(n => Number.isInteger(n) && n >= 1 && n <= 12))))) throw new Error(`Récurrence invalide : ${m.id}`);
    if (c.type === 'dates' && (!c.dates?.length || !c.dates.every(d => dateCivile(d) && (!c.annee || d.startsWith(`${c.annee}-`))))) throw new Error(`Dates invalides : ${m.id}`);
    if (m.saisonnier && c.type !== 'a-confirmer' && (!c.annee || (c.type !== 'dates' && (!c.debut || !c.fin)))) throw new Error(`Saison non bornée : ${m.id}`);
    if (c.type !== 'a-confirmer' && !['habitude','dates-publiees'].includes(c.confirmation)) throw new Error(`Statut absent : ${m.id}`);
  }
}

function ligne(m, reference) {
  const source = m.sourceRelue || m.sources[0];
  const route = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(`${m.lieu}, ${m.commune}, France`);
  return `<li id="${m.id}"${m.commune === 'Ceilhes-et-Rocozels' ? ' class="chez-nous"' : ''}><b>${echappe(m.commune)}</b> (${echappe(m.departement)}) — ${echappe(m.jour)}, ${echappe(m.horaires)}<br>${echappe(m.lieu)}${m.saisonnier ? `<br><em>${echappe(m.periode)}</em>` : ''}
        <span class="marche-reference" data-marche-etat="${m.id}">${echappe(etatCalendrier(m, reference))} — état au ${dateTexte(reference)}.</span>
        ${m.calendrier.motif ? `<span class="marche-reference">${echappe(m.calendrier.motif)}</span>` : ''}
        <span class="marche-source"><a href="${echappe(source)}" target="_blank" rel="noopener">Vérifier le calendrier</a> · <a href="${echappe(route)}" target="_blank" rel="noopener">Itinéraire vers le lieu indiqué</a><br>Fiche revue le ${dateTexte(m.maj)}${m.confiance === 'moyenne' ? ' · informations à confirmer' : ''}.</span></li>`.replace(/[ \t]+\n/g, '\n');
}

async function main() {
  const {marches} = JSON.parse(await readFile(DONNEES, 'utf8'));
  valider(marches);
  const reference = marches.map(m => m.maj).sort().at(-1);
  const annee = marches.filter(m => !m.saisonnier).sort((a,b) => a.jourTri - b.jourTri);
  const saisons = marches.filter(m => m.saisonnier).sort((a,b) => (b.commune === 'Ceilhes-et-Rocozels') - (a.commune === 'Ceilhes-et-Rocozels') || a.jourTri - b.jourTri);
  const communes = [...new Set(marches.map(m => m.commune))].sort((a,b) => a.localeCompare(b,'fr'));
  const bloc = `<!-- @marches — généré par scripts/marches.mjs depuis data/marches.json : ne pas modifier à la main, modifier le fichier de données -->
    <h4 id="marches-du-pays" class="zone-title reveal">Les marchés du pays</h4>
    <p class="zone-sub reveal">Un panier pour le gîte, une rencontre avec les producteurs ou une soirée gourmande : choisissez les dates de votre séjour.</p>
    <div class="marches-outil">
      <h5>Quel marché pendant mon séjour ?</h5>
      <p class="marches-aide" id="marches-aide">Jusqu’à 31 jours, dates incluses. Les rendez-vous habituels sont calculés à partir des jours annoncés ; ils peuvent changer les jours fériés ou selon la météo. Une date publiée concerne uniquement sa saison. Vérifiez le maintien auprès de l’organisateur avant le départ.</p>
      <form id="marches-sejour" hidden aria-describedby="marches-aide">
        <div class="marches-champs">
          <label>Du <input id="marches-debut" name="marche-debut" type="date" required></label>
          <label>Au <input id="marches-fin" name="marche-fin" type="date" required></label>
          <label>Commune <select id="marches-commune" name="marche-commune"><option value="">Toutes les communes</option>${communes.map(c => `<option>${echappe(c)}</option>`).join('')}</select></label>
          <button type="submit">Trouver les marchés</button>
          <button id="marches-semaine" class="marches-secondaire" type="button">Les 7 prochains jours</button>
        </div>
      </form>
      <noscript><p>Le choix des dates nécessite JavaScript. Retrouvez tous les jours habituels, saisons connues et liens de confirmation dans les listes ci-dessous.</p></noscript>
      <div id="marches-reponse" hidden><p id="marches-statut" role="status" aria-live="polite"></p><div id="marches-resultats"></div></div>
      <p class="marches-aide">Les événements ponctuels figurent aussi dans <a href="agenda.html">l’agenda des sorties</a>. Pour les courses à Ceilhes, consultez les <a href="https://esquirols.fr/ceilhes.html#horaires">jours d’ouverture de L’Esquirol</a>.</p>
    </div>
    <div class="marches reveal">
      <div class="marches-col"><h5>Les rendez-vous habituels</h5><ul>
${annee.map(m => ligne(m, reference)).join('\n')}
      </ul></div>
      <div class="marches-col"><h5>Les saisons publiées et calendriers à confirmer</h5><p>Les dates d’une saison passée ne sont pas reconduites l’année suivante. Les prochaines éditions sont annoncées par les organisateurs.</p><ul>
${saisons.map(m => ligne(m, reference)).join('\n')}
      </ul></div>
    </div>
    <script type="application/json" id="marches-donnees">${JSON.stringify({marches}).replaceAll('<','\\u003c')}</script>
    <!-- @/marches -->`;
  let html = await readFile(PAGE,'utf8');
  if (!html.includes('<!-- @marches')) throw new Error('Balises @marches introuvables');
  html = html.replace(/<!-- @marches[\s\S]*?<!-- @\/marches -->/, bloc);
  await writeFile(PAGE, html);
  console.log(`terroir.html mis à jour — ${marches.length} marchés, sélecteur de séjour et listes sans JavaScript`);
}
main().catch(e => { console.error('Échec de la génération des marchés :', e.message); process.exit(1); });
