// Une sélection personnelle conservée uniquement dans ce navigateur.
// Les fiches et leurs liens restent consultables sans ce complément JavaScript.
(() => {
  const KEY = 'ceilhes:mon-sejour:v1';
  const LIMIT = 60;
  const categories = new Set(['Randonnée', 'Adresse', 'Hébergement', 'Producteur', 'Événement']);
  const entries = [];
  let notice = '';
  let undo = null;
  let feedbackTimer;
  const area = document.getElementById('carnet-contenu');
  const list = document.getElementById('carnet-liste');
  const count = document.getElementById('carnet-compteur');
  const empty = document.getElementById('carnet-vide');
  const warning = document.getElementById('carnet-stockage');
  const controls = document.getElementById('carnet-actions');
  const feedback = document.createElement('p');
  feedback.className = 'carnet-retour';
  feedback.setAttribute('role', 'status');
  document.body.append(feedback);

  function safeUrl(value) {
    if (typeof value !== 'string' || value.length > 2000) return null;
    try {
      const url = new URL(value, location.href);
      if (url.username || url.password) return null;
      if (url.origin === location.origin || url.origin === 'https://ceilhes-tourisme.fr') {
        if (!/^\/(?:[a-z0-9-]+\.html)?$/.test(url.pathname)) return null;
        return url.pathname + url.search + url.hash;
      }
      // Les traces du tableau pointent directement vers leur fiche SityTrail.
      if (url.origin === 'https://www.sitytrail.com' && url.pathname.startsWith('/fr/trails/')) return url.href;
    } catch { /* Une donnée invalide n'est jamais transformée en lien. */ }
    return null;
  }

  function valid(item) {
    if (!item || typeof item !== 'object') return null;
    const { id, title, category } = item;
    const url = safeUrl(item.url);
    if (typeof id !== 'string' || !/^[a-z0-9-]{1,180}$/.test(id) ||
        typeof title !== 'string' || !title.trim() || title.length > 200 ||
        !categories.has(category) || !url) return null;
    return { id, title: title.trim(), category, url };
  }

  function decode(raw) {
    if (raw === null) return [];
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || !Array.isArray(data.items)) throw new Error('format');
    const ids = new Set();
    return data.items.slice(0, LIMIT).map(valid).filter(item => {
      if (!item || ids.has(item.id)) return false;
      ids.add(item.id);
      return true;
    });
  }

  let items = [];
  try { items = decode(localStorage.getItem(KEY)); }
  catch (error) {
    if (error instanceof SyntaxError || error.message === 'format') {
      notice = 'Votre ancien carnet est illisible. Vous pouvez commencer une nouvelle sélection.';
    } else {
      notice = "Ce navigateur ne permet pas d'enregistrer un carnet. Vous pouvez utiliser les programmes imprimables de l'accueil.";
    }
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify({ version: 1, items })); return true; }
    catch {
      notice = "Le navigateur n'a pas pu enregistrer ce changement. Votre carnet précédent est conservé.";
      return false;
    }
  }

  function say(text) {
    clearTimeout(feedbackTimer);
    feedback.textContent = text;
    feedbackTimer = setTimeout(() => { feedback.textContent = ''; }, 8000);
  }

  function change(next, message, nextUndo = undo) {
    const previous = items;
    items = next;
    if (!persist()) {
      items = previous;
      render();
      say(notice);
      return false;
    }
    undo = nextUndo;
    notice = '';
    render();
    say(message);
    return true;
  }

  function element(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }

  function remove(id, focusNext = false) {
    const index = items.findIndex(item => item.id === id);
    if (index < 0) return;
    const removed = { item: items[index], index };
    const updated = change(items.filter(item => item.id !== id), `${removed.item.title} a été retiré du carnet.`, removed);
    if (updated && focusNext) (list.querySelectorAll('button')[Math.min(index, items.length - 1)] || document.getElementById('carnet-annuler')).focus();
  }

  function render() {
    entries.forEach(({ button, item }) => {
      const saved = items.some(saved => saved.id === item.id);
      button.setAttribute('aria-pressed', String(saved));
      button.textContent = saved ? 'Dans mon séjour · retirer' : 'Ajouter à mon séjour';
      button.setAttribute('aria-label', `${saved ? 'Retirer de' : 'Ajouter à'} mon séjour : ${item.title}`);
    });
    document.querySelectorAll('[data-carnet-count]').forEach(el => { el.textContent = String(items.length); });
    if (!area) return;
    area.hidden = false;
    document.getElementById('carnet-sans-js').hidden = true;
    count.textContent = `${items.length} idée${items.length > 1 ? 's' : ''} dans votre carnet`;
    empty.hidden = items.length !== 0;
    controls.hidden = items.length === 0;
    warning.textContent = notice;
    warning.hidden = !notice;
    document.getElementById('carnet-annulation').hidden = !undo;
    list.replaceChildren();
    items.forEach(item => {
      const row = element('li', undefined, 'carnet-fiche');
      const body = element('div');
      body.append(element('p', item.category, 'carnet-categorie'));
      const heading = element('h2');
      const link = element('a', item.title);
      link.href = item.url;
      heading.append(link);
      body.append(heading);
      const printable = item.url.startsWith('/') ? 'https://ceilhes-tourisme.fr' + item.url : item.url;
      body.append(element('p', printable, 'carnet-url'));
      const removeButton = element('button', 'Retirer', 'carnet-retirer');
      removeButton.type = 'button';
      removeButton.setAttribute('aria-label', `Retirer ${item.title} du carnet`);
      removeButton.addEventListener('click', () => remove(item.id, true));
      row.append(body, removeButton);
      list.append(row);
    });
  }

  document.querySelectorAll('[data-carnet-id]').forEach(card => {
    const item = valid({ id: card.dataset.carnetId, title: card.dataset.carnetTitle,
      category: card.dataset.carnetCategory, url: card.dataset.carnetUrl });
    if (!item || card.matches('a')) return;
    const button = element('button', undefined, 'carnet-ajouter');
    button.type = 'button';
    button.addEventListener('click', () => {
      if (items.some(saved => saved.id === item.id)) { remove(item.id); return; }
      if (items.length >= LIMIT) { say(`Votre carnet contient déjà ${LIMIT} idées. Retirez-en une avant d'en ajouter une autre.`); return; }
      change([...items, item], `${item.title} a été ajouté à votre séjour.`, null);
    });
    (card.querySelector('.ev-body') || card).append(button);
    entries.push({ item, button });
  });

  if (area) {
    document.getElementById('carnet-imprimer').addEventListener('click', () => {
      try { window.print(); } catch { say('Utilisez la fonction Imprimer de votre navigateur.'); }
    });
    document.getElementById('carnet-annuler').addEventListener('click', () => {
      if (!undo || items.length >= LIMIT) return;
      const next = items.filter(item => item.id !== undo.item.id);
      next.splice(Math.min(undo.index, next.length), 0, undo.item);
      if (change(next, 'La dernière idée retirée a été remise dans votre carnet.', null)) count.focus();
    });
  }
  addEventListener('storage', event => {
    if (event.key !== KEY && event.key !== null) return;
    try { items = decode(event.newValue); undo = null; render(); }
    catch { /* Une mise à jour invalide ne remplace pas la sélection en cours. */ }
  });
  render();
})();
