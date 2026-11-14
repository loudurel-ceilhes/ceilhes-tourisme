// Les quatre programmes restent lisibles sans JavaScript. Les onglets et
// l'impression d'un seul programme sont des compléments de confort.
(() => {
  const section = document.getElementById('idees-sejour');
  if (!section) return;
  const choices = section.querySelector('.sejour-choix');
  const buttons = [...choices.querySelectorAll('button')];
  const programmes = [...section.querySelectorAll('.sejour-parcours article')];
  const print = document.getElementById('imprimer-programme');

  function choose(index, focus = false) {
    buttons.forEach((button, i) => {
      button.setAttribute('aria-selected', String(i === index));
      button.tabIndex = i === index ? 0 : -1;
      programmes[i].hidden = i !== index;
    });
    if (focus) buttons[index].focus();
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
    button.addEventListener('click', () => choose(index));
    button.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = buttons.length - 1;
      if (next !== undefined) { event.preventDefault(); choose(next, true); }
    });
  });
  const hashIndex = programmes.findIndex(programme => '#' + programme.id === location.hash);
  choose(hashIndex < 0 ? 0 : hashIndex);
  choices.hidden = false;
  section.classList.add('sejour-ready');

  const clearPrint = () => document.body.classList.remove('imprimer-programme');
  addEventListener('afterprint', clearPrint);
  print.addEventListener('click', () => {
    // La classe n'agit qu'en média print : l'écran ne disparaît jamais.
    document.body.classList.add('imprimer-programme');
    try { window.print(); } catch { clearPrint(); }
  });
  section.querySelector('.sejour-programme-actions').hidden = false;
})();
