// Une sélection personnelle conservée dans ce navigateur, partageable à la demande.
// Les fiches et leurs liens restent consultables sans ce complément JavaScript.
(() => {
  const KEY = 'ceilhes:mon-sejour:v1';
  const LIMIT = 60;
  const categories = new Set(['Randonnée', 'Adresse', 'Hébergement', 'Producteur', 'Événement', 'Guide']);
  const entries = [];
  let notice = '';
  let undo = null;
  let feedbackTimer;
  let refreshTransfer = () => {};
  const dates = window.SejourDates;
  const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(new Date(value + 'T12:00:00Z').getTime()) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
  const dateLabel = value => new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value + 'T12:00:00Z'));
  const catalog = new Map();
  let catalogReady = false;
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
    const clean = { id, title: title.trim(), category, url };
    if (validDay(item.day)) clean.day = item.day;
    if (Array.isArray(item.dates) && item.dates.length <= 200 && item.dates.every(validDay)) clean.dates = [...new Set(item.dates)].sort();
    return clean;
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
    const ordered = [...items].sort((a, b) => (a.day || '9999').localeCompare(b.day || '9999'));
    let section = null;
    ordered.forEach(item => {
      const day = item.day || '';
      if (day !== section) {
        if (ordered.some(i => i.day)) {
          const group = element('li', undefined, 'carnet-jour-titre');
          group.append(element('h2', day ? dateLabel(day) : 'À organiser'));
          list.append(group);
        }
        section = day;
      }
      const row = element('li', undefined, 'carnet-fiche');
      row.dataset.ideaId = item.id;
      const body = element('div');
      body.append(element('p', item.category, 'carnet-categorie'));
      const heading = element('h2');
      const link = element('a', item.title);
      link.href = item.url;
      heading.append(link);
      body.append(heading);
      const printable = item.url.startsWith('/') ? 'https://ceilhes-tourisme.fr' + item.url : item.url;
      body.append(element('p', printable, 'carnet-url'));
      const planning = element('div', undefined, 'carnet-affectation');
      const label = element('label', 'Ma journée (facultatif)');
      const input = element('input');
      input.type = 'date';
      input.value = item.day || '';
      input.setAttribute('aria-label', `Journée prévue pour ${item.title}`);
      label.append(input);
      planning.append(label);
      input.addEventListener('change', () => {
        const chosenDay = input.value;
        if (chosenDay && !validDay(chosenDay)) return;
        const next = items.map(entry => {
          if (entry.id !== item.id) return entry;
          const updated = { ...entry }; delete updated.day;
          if (chosenDay) updated.day = chosenDay;
          return updated;
        });
        change(next, chosenDay ? `Journée choisie : ${dateLabel(chosenDay)}.` : 'Cette idée reste dans votre carnet, sans journée choisie.');
      });
      body.append(planning);
      const range = dates?.read();
      const knownDates = catalog.get(item.id)?.dates;
      if (item.day && range && (item.day < range.start || item.day > range.end)) body.append(element('p', 'Cette journée est en dehors de vos dates de séjour. Votre choix est conservé.', 'carnet-incompatibilite'));
      if (item.day && knownDates?.length && !knownDates.includes(item.day)) body.append(element('p', 'Cet événement n’est pas annoncé à la journée choisie. Consultez ses dates avant de vous déplacer.', 'carnet-incompatibilite'));
      else if (!item.day && range && knownDates?.length && !knownDates.some(day => day >= range.start && day <= range.end)) body.append(element('p', 'Aucune date annoncée pour cet événement pendant votre séjour.', 'carnet-incompatibilite'));
      const removeButton = element('button', 'Retirer', 'carnet-retirer');
      removeButton.type = 'button';
      removeButton.setAttribute('aria-label', `Retirer ${item.title} du carnet`);
      removeButton.addEventListener('click', () => remove(item.id, true));
      row.append(body, removeButton);
      list.append(row);
    });
    refreshTransfer();
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
    const rangeStart = document.getElementById('carnet-debut');
    const rangeEnd = document.getElementById('carnet-fin');
    const rangeFeedback = document.getElementById('carnet-dates-retour');
    function refreshRange() {
      const range = dates?.read();
      rangeStart.value = range?.start || '';
      rangeEnd.value = range?.end || '';
      const query = range ? `?debut=${range.start}&fin=${range.end}` : '';
      document.getElementById('carnet-agenda-dates').href = 'agenda.html' + (range ? query + '&periode=sejour' : '');
      document.getElementById('carnet-marches-dates').href = 'terroir.html' + query + '#marches-du-pays';
      rangeFeedback.textContent = range ? `Du ${dateLabel(range.start)} au ${dateLabel(range.end)}. Ces dates sont proposées dans l’agenda et les marchés.` : 'Vous pouvez garder vos idées sans fixer de dates.';
    }
    document.getElementById('carnet-dates-form').addEventListener('submit', event => {
      event.preventDefault();
      const range = { start: rangeStart.value, end: rangeEnd.value };
      if (!dates?.validRange(range)) { rangeFeedback.textContent = 'Choisissez une période valide, dans l’ordre, de 31 jours maximum.'; return; }
      if (!dates.write(range)) { rangeFeedback.textContent = 'Le navigateur n’a pas pu enregistrer ces dates. Les dates précédentes sont conservées.'; return; }
      // Une ancienne URL ne doit pas reprendre le dessus au rechargement.
      const url = new URL(location.href); url.searchParams.delete('debut'); url.searchParams.delete('fin');
      history.replaceState(history.state, '', url);
      refreshRange(); render();
    });
    document.getElementById('carnet-dates-effacer').addEventListener('click', () => {
      if (!dates?.clear()) { rangeFeedback.textContent = 'Le navigateur n’a pas pu effacer vos dates.'; return; }
      const url = new URL(location.href); url.searchParams.delete('debut'); url.searchParams.delete('fin'); history.replaceState(history.state, '', url);
      refreshRange(); render();
    });
    addEventListener('sejour:dates-changed', () => {
      const url = new URL(location.href); url.searchParams.delete('debut'); url.searchParams.delete('fin');
      try { history.replaceState(history.state, '', url); } catch { /* Le programme affiché reste à jour. */ }
      refreshRange(); render();
    });
    refreshRange();
    document.getElementById('carnet-imprimer').addEventListener('click', () => {
      try { window.print(); } catch { say('Utilisez la fonction Imprimer de votre navigateur.'); }
    });
    document.getElementById('carnet-annuler').addEventListener('click', () => {
      if (!undo || items.length >= LIMIT) return;
      const next = items.filter(item => item.id !== undo.item.id);
      next.splice(Math.min(undo.index, next.length), 0, undo.item);
      if (change(next, 'La dernière idée retirée a été remise dans votre carnet.', null)) count.focus();
    });

    const sharePanel = document.getElementById('carnet-partage');
    const shareLink = document.getElementById('carnet-lien');
    const shareFeedback = document.getElementById('carnet-partage-retour');
    const importFeedback = document.getElementById('carnet-import-retour');
    const fileInput = document.getElementById('carnet-fichier');
    const preview = document.getElementById('carnet-apercu');
    const previewList = document.getElementById('carnet-apercu-liste');
    const previewSummary = document.getElementById('carnet-apercu-resume');
    const importButton = document.getElementById('carnet-importer');
    let incoming = null;

    try {
      const data = JSON.parse(document.getElementById('carnet-catalogue').textContent);
      if (data.version !== 1 || !Array.isArray(data.items) || !data.items.length) throw new Error('catalogue');
      for (const source of data.items) {
        const item = valid(source);
        if (!item || catalog.has(item.id)) throw new Error('catalogue');
        catalog.set(item.id, item);
      }
      catalogReady = true;
    } catch {
      importFeedback.textContent = 'Le partage est momentanément indisponible. Vous pouvez toujours consulter et imprimer votre carnet.';
    }

    function selectedPublic() {
      return items.map(item => catalog.has(item.id) ? { ...catalog.get(item.id), ...(item.day ? { day: item.day } : {}) } : null).filter(Boolean)
        .sort((a, b) => (a.day || '9999').localeCompare(b.day || '9999'));
    }

    function parseIds(ids) {
      if (!Array.isArray(ids) || !ids.length || ids.length > LIMIT || ids.some(id => typeof id !== 'string' || !/^[a-z0-9-]{1,180}$/.test(id))) throw new Error('format');
      return [...new Set(ids)];
    }

    function planFor(chosen) {
      const plan = {};
      const stay = dates?.read();
      if (stay) plan.stay = stay;
      const days = Object.fromEntries(chosen.filter(item => item.day).map(item => [item.id, item.day]));
      if (Object.keys(days).length) plan.days = days;
      return plan;
    }

    function readPlan(plan, ids) {
      if (!plan || typeof plan !== 'object' || Array.isArray(plan)) throw new Error('plan');
      const clean = {};
      if (plan.stay !== undefined) {
        if (!dates?.validRange(plan.stay)) throw new Error('dates');
        clean.stay = { start: plan.stay.start, end: plan.stay.end };
      }
      if (plan.days !== undefined) {
        if (!plan.days || typeof plan.days !== 'object' || Array.isArray(plan.days) || Object.keys(plan.days).length > LIMIT) throw new Error('jours');
        clean.days = {};
        for (const [id, day] of Object.entries(plan.days)) {
          if (!ids.includes(id) || !validDay(day)) throw new Error('jour');
          clean.days[id] = day;
        }
      }
      return clean;
    }

    function renderPreview() {
      if (!incoming) return;
      preview.hidden = false;
      previewList.replaceChildren();
      incoming.recognized.forEach(item => {
        const row = element('li');
        const link = element('a', `${item.title} · ${item.category}`);
        link.href = item.url;
        row.append(link);
        if (incoming.plan.days?.[item.id]) row.append(element('span', ` · ${dateLabel(incoming.plan.days[item.id])}`));
        previewList.append(row);
      });
      const additions = incoming.recognized.filter(item => !items.some(saved => saved.id === item.id));
      const duplicates = incoming.recognized.length - additions.length;
      const lines = [`${incoming.recognized.length} idée${incoming.recognized.length > 1 ? 's' : ''} reconnue${incoming.recognized.length > 1 ? 's' : ''}.`];
      if (incoming.missing) lines.push(`${incoming.missing} référence${incoming.missing > 1 ? 's' : ''} ancienne${incoming.missing > 1 ? 's' : ''} ou inconnue${incoming.missing > 1 ? 's' : ''} ${incoming.missing > 1 ? 'n’ont' : 'n’a'} pas pu être retrouvée${incoming.missing > 1 ? 's' : ''}.`);
      if (duplicates) lines.push(`${duplicates} idée${duplicates > 1 ? 's sont déjà présentes' : ' est déjà présente'} dans votre carnet.`);
      const dated = incoming.recognized.filter(item => incoming.plan.days?.[item.id] && !items.find(saved => saved.id === item.id)?.day).length;
      if (dated) lines.push(`${dated} idée(s) recevront la journée proposée. Les journées déjà choisies sont conservées.`);
      if (incoming.plan.stay) lines.push(dates?.read() ? 'Vos dates de séjour actuelles seront conservées.' : `Dates proposées : du ${dateLabel(incoming.plan.stay.start)} au ${dateLabel(incoming.plan.stay.end)}.`);
      if (items.length + additions.length > LIMIT) lines.push(`La limite est de ${LIMIT} idées. Retirez d’abord ${items.length + additions.length - LIMIT} idée(s) de votre carnet pour pouvoir ajouter cette sélection.`);
      else if (additions.length) lines.push(`${additions.length} idée${additions.length > 1 ? 's seront ajoutées' : ' sera ajoutée'}, sans retirer votre sélection actuelle.`);
      previewSummary.textContent = lines.join(' ');
      importButton.disabled = (!additions.length && !dated && !(incoming.plan.stay && !dates?.read())) || !incoming.recognized.length || items.length + additions.length > LIMIT;
    }

    function offer(ids, plan = {}) {
      const unique = parseIds(ids);
      const recognized = unique.map(id => catalog.get(id)).filter(Boolean);
      incoming = { recognized, missing: unique.length - recognized.length, plan: readPlan(plan, unique) };
      renderPreview();
      document.getElementById('carnet-apercu-titre').focus();
    }

    function readHash() {
      if (!catalogReady || !location.hash.startsWith('#carnet=')) return;
      try {
        if (location.hash.length > 24000) throw new Error('format');
        const params = new URLSearchParams(location.hash.slice(1));
        const plan = {};
        if (params.has('sejour')) {
          const stay = params.get('sejour').split(',');
          if (stay.length !== 2) throw new Error('dates');
          plan.stay = { start: stay[0], end: stay[1] };
        }
        if (params.has('jours')) {
          const days = params.get('jours').split(',').map(value => value.split(':'));
          if (days.some(pair => pair.length !== 2)) throw new Error('jours');
          plan.days = Object.fromEntries(days);
        }
        offer(params.get('carnet').split(','), plan);
        importFeedback.textContent = '';
      } catch {
        incoming = null;
        preview.hidden = true;
        importFeedback.textContent = 'Ce lien de carnet est invalide ou contient trop d’idées. Votre sélection reste inchangée.';
      }
    }

    function clearPreview() {
      incoming = null;
      preview.hidden = true;
      if (location.hash.startsWith('#carnet=')) history.replaceState(null, '', location.pathname + location.search);
    }

    refreshTransfer = () => {
      const disabled = !catalogReady || !selectedPublic().length;
      for (const id of ['carnet-partager', 'carnet-exporter', 'carnet-hors-ligne']) document.getElementById(id).disabled = disabled;
      fileInput.disabled = !catalogReady;
      // Un ancien lien affiché ne doit pas être confondu avec la sélection modifiée.
      if (!sharePanel.hidden) {
        const chosen = selectedPublic();
        const plan = planFor(chosen);
        let fragment = chosen.map(item => item.id).join(',');
        if (plan.stay) fragment += '&sejour=' + plan.stay.start + ',' + plan.stay.end;
        if (plan.days) fragment += '&jours=' + Object.entries(plan.days).map(([id, day]) => id + ':' + day).join(',');
        shareLink.value = chosen.length ? 'https://ceilhes-tourisme.fr/mon-sejour.html#carnet=' + fragment : '';
        shareFeedback.textContent = items.length > chosen.length ? `${items.length - chosen.length} ancienne(s) idée(s) ne figurent plus dans le guide et ne sont pas incluses dans le partage.` : '';
        document.getElementById('carnet-copier').disabled = !chosen.length;
      }
      renderPreview();
    };

    document.getElementById('carnet-partager').addEventListener('click', () => {
      sharePanel.hidden = false;
      refreshTransfer();
      shareLink.focus();
      shareLink.select();
    });
    document.getElementById('carnet-copier').addEventListener('click', async () => {
      try {
        if (!shareLink.value || !navigator.clipboard?.writeText) throw new Error('clipboard');
        await navigator.clipboard.writeText(shareLink.value);
        shareFeedback.textContent = 'Lien copié. Vous pouvez le coller dans votre message.';
      } catch {
        shareLink.focus();
        shareLink.select();
        shareFeedback.textContent = 'La copie automatique est indisponible. Copiez le lien sélectionné avec le menu de votre appareil.';
      }
    });

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file || !catalogReady) return;
      try {
        if (file.size > 32768) throw new Error('size');
        const data = JSON.parse(await file.text());
        if (!data || data.format !== 'ceilhes-mon-sejour' || data.version !== 2) throw new Error('format');
        offer(data.ids, { ...(data.stay !== undefined ? { stay: data.stay } : {}), ...(data.days !== undefined ? { days: data.days } : {}) });
        importFeedback.textContent = 'Fichier lu. Vérifiez les idées ci-dessous avant de les ajouter.';
      } catch {
        incoming = null;
        preview.hidden = true;
        importFeedback.textContent = 'Ce fichier ne correspond pas à un carnet exporté, dépasse 32 Ko ou contient trop d’idées. Votre sélection reste inchangée.';
      } finally { fileInput.value = ''; }
    });
    importButton.addEventListener('click', () => {
      if (!incoming) return;
      const additions = incoming.recognized.filter(item => !items.some(saved => saved.id === item.id));
      if (importButton.disabled || items.length + additions.length > LIMIT) return;
      const proposal = incoming.plan;
      const next = [...items, ...additions].map(item => item.day || !proposal.days?.[item.id] ? item : { ...item, day: proposal.days[item.id] });
      if (change(next, `${additions.length} idée(s) ajoutée(s) à votre carnet.`, null)) {
        const datesSaved = !proposal.stay || dates?.read() || dates?.write(proposal.stay);
        clearPreview();
        importFeedback.textContent = 'Les idées et les journées proposées ont été ajoutées à votre carnet. Votre sélection et vos journées précédentes sont conservées.' + (datesSaved ? '' : ' Le navigateur n’a pas pu conserver les dates du séjour ; vous pouvez les saisir dans « Mes dates » ci-dessous.');
        count.focus();
      }
    });
    document.getElementById('carnet-import-annuler').addEventListener('click', () => {
      clearPreview();
      importFeedback.textContent = 'Aucune idée ajoutée. Votre sélection reste inchangée.';
      fileInput.focus();
    });

    function download(content, type, filename) {
      const url = URL.createObjectURL(new Blob([content], { type }));
      const link = element('a');
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    document.getElementById('carnet-exporter').addEventListener('click', () => {
      const chosen = selectedPublic();
      if (!chosen.length) return;
      const data = { format: 'ceilhes-mon-sejour', version: 2, ids: chosen.map(item => item.id), ...planFor(chosen) };
      download(JSON.stringify(data, null, 2) + '\n', 'application/json', 'mon-sejour-ceilhes.json');
      say('Fichier de carnet préparé. Les anciennes idées absentes du guide ne sont pas exportées.');
    });

    const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    document.getElementById('carnet-hors-ligne').addEventListener('click', () => {
      const chosen = selectedPublic();
      if (!chosen.length) return;
      const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' }).format(new Date());
      const cards = chosen.map(item => {
        const url = item.url.startsWith('/') ? 'https://ceilhes-tourisme.fr' + item.url : item.url;
        const day = item.day ? `<p><strong>${escape(dateLabel(item.day))}</strong></p>` : '';
        const known = item.dates?.length ? `<p>Dates annoncées : ${item.dates.slice(0, 5).map(value => escape(dateLabel(value))).join(' · ')}${item.dates.length > 5 ? ' · autres dates sur la fiche' : ''}.</p>` : '';
        const mismatch = item.day && item.dates?.length && !item.dates.includes(item.day) ? '<p>Attention : cet événement n’est pas annoncé à la journée choisie.</p>' : '';
        return `<li><p class="category">${escape(item.category)}</p><h2>${escape(item.title)}</h2>${day}${known}${mismatch}<p><a href="${escape(url)}">Ouvrir la fiche en ligne</a></p><p class="url">${escape(url)}</p></li>`;
      }).join('\n');
      const stay = dates?.read();
      const programme = stay ? `<p>Séjour prévu du ${escape(dateLabel(stay.start))} au ${escape(dateLabel(stay.end))}.</p>` : '';
      const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Mon séjour à Ceilhes — copie hors ligne</title><style>:root{--foret:#244836;--blanc:#fff;--pierre:#dcd8ca}body{font:17px/1.6 system-ui,sans-serif;max-width:48rem;margin:2rem auto;padding:0 1rem;background:var(--blanc);color:var(--foret)}h1{line-height:1.2}h2{font-size:1.3rem;margin:.3rem 0}ul{list-style:none;padding:0}li{border:1px solid var(--pierre);border-radius:.5rem;padding:1rem;margin:1rem 0;break-inside:avoid}a{color:inherit}.category{font-size:.85rem;margin:0}.url{font-size:.8rem;overflow-wrap:anywhere}@media print{body{margin:0}}</style></head><body><h1>Mon séjour à Ceilhes</h1>${programme}<p>Copie téléchargée le ${escape(date)} · ${chosen.length} idée(s).</p><p>Cette liste se lit sans connexion. Les liens vers les fiches demandent un accès à Internet. Vérifiez avant votre départ les dates, ouvertures et conditions d’accès : cette copie n’est pas actualisée automatiquement et ne constitue pas une réservation.</p><ul>${cards}</ul><p>Pour une copie papier, utilisez la fonction Imprimer de votre navigateur.</p><p><a href="https://ceilhes-tourisme.fr/mon-sejour.html">Retrouver le guide en ligne</a></p></body></html>`;
      download(html, 'text/html;charset=utf-8', 'mon-sejour-ceilhes-hors-ligne.html');
      say('Copie hors ligne préparée. Retrouvez-la dans les téléchargements de votre appareil.');
    });

    addEventListener('hashchange', readHash);
    readHash();
  }
  addEventListener('storage', event => {
    if (event.key !== KEY && event.key !== null) return;
    try { items = decode(event.newValue); undo = null; render(); }
    catch { /* Une mise à jour invalide ne remplace pas la sélection en cours. */ }
  });
  render();
})();
