/* Carnet personnel : texte local uniquement, aucun envoi. */
(() => {
  'use strict';
  const form = document.querySelector('[data-jeu-form]');
  if (!form) return;
  const key = 'ceilhes:jeu-village:v1';
  const fields = [...form.querySelectorAll('[data-jeu-reponse]')];
  const status = document.querySelector('[data-jeu-stockage]');
  const count = document.querySelector('[data-jeu-compte]');
  const progress = document.querySelector('[data-jeu-progres]');
  let storageAvailable = true;
  const storageMessage = () => {
    status.textContent = storageAvailable
      ? 'Vos réponses restent dans ce navigateur. Aucune réponse n’est envoyée.'
      : 'Ce navigateur ne permet pas de conserver vos réponses. Vous pouvez continuer sur cette page ; copiez-les avant de la quitter.';
  };
  const updateCount = () => {
    const n = fields.filter(field => field.value.trim()).length;
    count.textContent = `${n} réponse${n > 1 ? 's' : ''} notée${n > 1 ? 's' : ''} sur ${fields.length}`;
    progress.value = n;
  };
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (saved?.version === 1 && saved.answers && typeof saved.answers === 'object') {
      fields.forEach(field => {
        const value = saved.answers[field.name];
        if (typeof value === 'string') field.value = value.slice(0, field.maxLength);
      });
    }
    // Détecter aussi un stockage lisible mais refusé en écriture.
    localStorage.setItem(key, JSON.stringify({version: 1, answers: Object.fromEntries(fields.map(field => [field.name, field.value]))}));
  } catch {
    // Une donnée ancienne illisible ne bloque pas le carnet.
    try { localStorage.setItem(key, JSON.stringify({version: 1, answers: {}})); }
    catch { storageAvailable = false; }
  }
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', () => {
    updateCount();
    try {
      localStorage.setItem(key, JSON.stringify({version: 1, answers: Object.fromEntries(fields.map(field => [field.name, field.value.slice(0, field.maxLength)]))}));
      storageAvailable = true;
    } catch { storageAvailable = false; }
    storageMessage();
  });
  document.querySelector('[data-jeu-effacer]').addEventListener('click', () => {
    if (!window.confirm('Effacer les sept réponses de ce carnet ?')) return;
    fields.forEach(field => { field.value = ''; });
    try { localStorage.removeItem(key); }
    catch { storageAvailable = false; }
    document.querySelector('#solutions').open = false;
    updateCount();
    storageMessage();
    fields[0].focus();
  });
  let solutionsBeforePrint = null;
  document.querySelectorAll('[data-jeu-print]').forEach(button => {
    button.addEventListener('click', () => {
      document.body.dataset.jeuPrint = button.dataset.jeuPrint;
      const solutions = document.querySelector('#solutions');
      solutionsBeforePrint = solutions.open;
      if (button.dataset.jeuPrint === 'solutions') solutions.open = true;
      window.print();
    });
  });
  window.addEventListener('afterprint', () => {
    delete document.body.dataset.jeuPrint;
    if (solutionsBeforePrint !== null) document.querySelector('#solutions').open = solutionsBeforePrint;
    solutionsBeforePrint = null;
  });
  document.querySelectorAll('[data-jeu-js]').forEach(element => { element.hidden = false; });
  updateCount();
  storageMessage();
})();
