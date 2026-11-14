// Les quatre programmes restent lisibles sans JavaScript. Les onglets et
// l'impression d'un seul programme sont des compléments de confort.
(() => {
  const section = document.getElementById('idees-sejour');
  if (!section) return;
  const choices = section.querySelector('.sejour-choix');
  const buttons = [...choices.querySelectorAll('button')];
  const programmes = [...section.querySelectorAll('.sejour-parcours article')];
  const print = document.getElementById('imprimer-programme');
  const share = document.getElementById('partager-programme');
  const feedback = document.getElementById('sejour-partage-retour');
  const manual = document.getElementById('sejour-lien-manuel');
  const link = document.getElementById('sejour-lien');
  let selected = 0;

  function programmeUrl() {
    const url = new URL(location.href);
    url.hash = programmes[selected].id;
    return url;
  }

  function choose(index, focus = false, remember = false) {
    selected = index;
    buttons.forEach((button, i) => {
      button.setAttribute('aria-selected', String(i === index));
      button.tabIndex = i === index ? 0 : -1;
      programmes[i].hidden = i !== index;
    });
    feedback.textContent = '';
    manual.hidden = true;
    if (focus) buttons[index].focus();
    if (remember) {
      const url = programmeUrl();
      // Le lien conserve les autres paramètres et ne fait pas sauter la page.
      if (url.href !== location.href) history.pushState(history.state, '', url);
    }
  }

  function restore(scroll = false) {
    const index = programmes.findIndex(programme => '#' + programme.id === location.hash);
    choose(index < 0 ? 0 : index);
    // Une ancre peut viser un programme encore masqué au moment du clic.
    if (scroll && index >= 0) programmes[index].scrollIntoView({ block: 'start' });
  }

  choices.setAttribute('role', 'tablist');
  buttons.forEach((button, index) => {
    const programme = programmes[index];
    button.id = 'choix-' + button.dataset.programme;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', programme.id);
    programme.setAttribute('role', 'tabpanel');
    programme.setAttribute('aria-labelledby', button.id);
    programme.tabIndex = 0;
    button.addEventListener('click', () => choose(index, false, true));
    button.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = buttons.length - 1;
      if (next !== undefined) { event.preventDefault(); choose(next, true, true); }
    });
  });
  restore();
  addEventListener('popstate', () => restore());
  addEventListener('hashchange', () => restore(true));
  choices.hidden = false;
  section.classList.add('sejour-ready');

  share.addEventListener('click', async () => {
    const index = selected;
    const url = programmeUrl().href;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('copie indisponible');
      await navigator.clipboard.writeText(url);
      if (selected === index) {
        manual.hidden = true;
        feedback.textContent = 'Le lien vers ce programme est copié. Vous pouvez le partager ou le garder pour plus tard.';
      }
    } catch {
      if (selected === index) {
        manual.hidden = false;
        link.value = url;
        link.focus();
        link.select();
        feedback.textContent = 'Copiez le lien ci-dessous pour retrouver et partager ce programme.';
      }
    }
  });

  const clearPrint = () => document.body.classList.remove('imprimer-programme');
  addEventListener('afterprint', clearPrint);
  print.addEventListener('click', () => {
    // La classe n'agit qu'en média print : l'écran ne disparaît jamais.
    document.body.classList.add('imprimer-programme');
    try { window.print(); } catch { clearPrint(); }
  });
  section.querySelector('.sejour-programme-actions').hidden = false;
})();
