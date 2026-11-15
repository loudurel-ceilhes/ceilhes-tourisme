// Préparation locale d'un courriel : aucun envoi, stockage ou téléchargement.
export const SITE = 'https://ceilhes-tourisme.fr';
export const DESTINATAIRE = 'lou.durel@gmail.com';
export const AUTORISATION = 'Je suis l’auteur de cette photo ou dispose de son autorisation. J’autorise gratuitement sa publication uniquement sur ceilhes-tourisme.fr, avec le crédit indiqué, et son redimensionnement ou recadrage léger. Cette autorisation ne couvre ni un autre site ni une campagne publicitaire.';
export const PERSONNES = 'J’ai l’accord des personnes reconnaissables pour cette publication ; pour un enfant, celui de son représentant légal. Si personne n’est reconnaissable, cette confirmation ne s’applique pas.';

function texte(value, maximum, label, required = false) {
  if (typeof value !== 'string' || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new Error(`${label} : vérifiez le texte et sa longueur.`);
  const clean = value.trim();
  if (required && !clean) throw new Error(`${label} : ce renseignement est nécessaire.`);
  return clean;
}

export function ficheAutorisee(value, catalogue) {
  if (typeof value !== 'string' || value.length > 600 || /[\s\\%]/.test(value) || value.startsWith('//')) return null;
  try {
    const url = new URL(value || '/', SITE);
    if (url.origin !== SITE || url.username || url.password || url.search || !/^\/(?:[a-z0-9-]+\.html)?$/.test(url.pathname) || (url.hash && !/^#[a-zA-Z0-9_-]+$/.test(url.hash))) return null;
    // Accepter une URL absolue du guide ou un chemin, jamais un protocole masqué.
    if (value && !value.startsWith('/') && !value.startsWith(`${SITE}/`) && !/^[a-z0-9-]+\.html(?:#[a-zA-Z0-9_-]+)?$/.test(value)) return null;
    const path = url.pathname + url.hash;
    if (value && ![path, path.slice(1), SITE + path].includes(value)) return null;
    const item = catalogue.find(item => item.url === url.pathname + url.hash);
    return item ? { title: texte(item.title, 240, 'Titre', true), url: SITE + item.url } : null;
  } catch { return null; }
}

export function lienPhoto(value) {
  const clean = texte(value, 1000, 'Lien de la photo');
  if (!clean) return '';
  if (/[\s\\]/.test(clean)) throw new Error('Le lien de la photo doit être une adresse HTTPS complète.');
  let url;
  try { url = new URL(clean); } catch { throw new Error('Le lien de la photo doit être une adresse HTTPS complète.'); }
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) throw new Error('Le lien de la photo doit être une adresse HTTPS sans identifiant ni mot de passe.');
  return url.href;
}

export function preparerMessage(data, catalogue) {
  const fiche = ficheAutorisee(data.fiche, catalogue);
  if (!fiche) throw new Error('Choisissez une page ou une fiche existante de ceilhes-tourisme.fr, sans paramètres supplémentaires.');
  if (!['correction', 'photo'].includes(data.type)) throw new Error('Choisissez une correction ou une proposition de photo.');
  const nom = texte(data.nom || '', 100, 'Votre nom');
  const lignes = ['Bonjour Lou,', '', `Je souhaite ${data.type === 'photo' ? 'proposer une photo pour' : 'corriger une information sur'} :`, fiche.title, fiche.url, ''];
  if (data.type === 'correction') {
    lignes.push('Information à corriger :', texte(data.correction, 1500, 'Correction', true));
    const source = texte(data.source || '', 500, 'Source ou date du constat');
    if (source) lignes.push('', 'Source ou date du constat :', source);
  } else {
    const credit = texte(data.credit, 140, 'Auteur et crédit', true);
    const legende = texte(data.legende, 600, 'Lieu et sujet de la photo', true);
    const lien = lienPhoto(data.photo || '');
    if (!lien && !data.pieceJointe) throw new Error('Ajoutez un lien vers la photo ou indiquez que vous la joindrez au courriel.');
    if (data.autorisation !== true || data.personnes !== true) throw new Error('Confirmez les autorisations de publication de la photo.');
    lignes.push('Photo proposée :', lien || 'Je joindrai la photo directement à ce courriel.', '', 'Lieu, sujet et date si connue :', legende, '', 'Auteur et crédit à afficher :', credit, '', 'Autorisation de publication :', AUTORISATION, '', 'Personnes reconnaissables :', PERSONNES);
  }
  if (nom) lignes.push('', 'Nom du contributeur :', nom);
  lignes.push('', 'Je comprends que cette proposition sera vérifiée avant toute publication.');
  const body = lignes.join('\n');
  // Le sujet provient exclusivement du catalogue public, sans retour de ligne.
  const subject = `[Guide de Ceilhes] ${data.type === 'photo' ? 'Photo' : 'Correction'} — ${fiche.title.replace(/[\r\n\t]/g, ' ').slice(0, 120)}`;
  const base = `mailto:${DESTINATAIRE}?subject=${encodeURIComponent(subject)}`;
  const complet = `${base}&body=${encodeURIComponent(body)}`;
  // Certains logiciels tronquent les longues URL mailto : ne jamais tronquer le message.
  const copierAvant = complet.length > 7000;
  return { body, subject, href: copierAvant ? base : complet, copierAvant };
}

export function monterContributions(doc = document) {
  const form = doc.getElementById('contribution-form');
  if (!form) return;
  const status = doc.getElementById('contribution-statut');
  let catalogue;
  try {
    catalogue = JSON.parse(doc.getElementById('contributions-catalogue').textContent).items;
    if (!Array.isArray(catalogue) || !catalogue.length) throw new Error();
  } catch {
    status.textContent = 'Le formulaire ne peut pas être préparé. Vous pouvez écrire directement à l’adresse ci-dessous.';
    return;
  }
  const field = id => doc.getElementById(`contribution-${id}`);
  const preview = field('apercu'), message = field('message'), mail = field('courriel');
  const params = new URL(location.href).searchParams;
  const requested = params.get('fiche');
  const context = ficheAutorisee(requested || '/', catalogue);
  field('fiche').value = context ? context.url : SITE + '/';
  function contexte() {
    const item = ficheAutorisee(field('fiche').value, catalogue);
    field('contexte').textContent = item ? `Votre proposition concerne : ${item.title}.` : 'Cette adresse ne correspond pas encore à une fiche connue du guide.';
  }
  field('fiche').addEventListener('input', contexte);
  contexte();
  if (requested && !context) status.textContent = 'Le lien de fiche fourni n’est pas reconnu. Retrouvez la fiche dans le guide ou indiquez son adresse ci-dessous.';
  if (params.get('type') === 'photo') field('type-photo').checked = true;
  const type = () => field('type-photo').checked ? 'photo' : 'correction';
  function mode() {
    for (const name of ['photo', 'correction']) {
      const group = field(`groupe-${name}`);
      group.hidden = type() !== name;
      group.disabled = group.hidden;
    }
  }
  function invalidate() { preview.hidden = true; mail.removeAttribute('href'); status.textContent = ''; }
  form.addEventListener('input', invalidate);
  form.addEventListener('change', () => { mode(); invalidate(); });
  form.addEventListener('submit', event => {
    event.preventDefault();
    invalidate();
    try {
      const prepared = preparerMessage({
        type: type(), fiche: field('fiche').value, nom: field('nom').value,
        correction: field('correction').value, source: field('source').value,
        credit: field('credit').value, legende: field('legende').value, photo: field('photo').value,
        pieceJointe: field('piece-jointe').checked, autorisation: field('autorisation').checked, personnes: field('personnes').checked,
      }, catalogue);
      message.value = prepared.body;
      mail.href = prepared.href;
      field('message-long').hidden = !prepared.copierAvant;
      preview.hidden = false;
      status.textContent = 'Message préparé sur cet appareil. Rien n’a été envoyé.';
      field('apercu-titre').focus();
    } catch (error) { status.textContent = error.message; status.focus(); }
  });
  field('copier').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(message.value);
      status.textContent = 'Message copié. Collez-le dans votre courriel puis envoyez-le depuis votre messagerie.';
    } catch {
      message.focus(); message.select();
      status.textContent = 'Le message est sélectionné : utilisez la commande Copier de votre appareil.';
    }
  });
  mail.addEventListener('click', () => { status.textContent = 'Vérifiez le message dans votre messagerie, joignez la photo si nécessaire, puis envoyez-le. Ce site ne confirme pas l’envoi.'; });
  mode();
  form.hidden = false;
}

if (typeof document !== 'undefined') monterContributions();
