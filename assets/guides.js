// Compléments facultatifs : les guides et la fiche d'accueil restent lisibles sans JS.
(() => {
  document.querySelectorAll('[data-guide-print]').forEach(button => {
    button.hidden = false;
    button.addEventListener('click', () => window.print());
  });
  document.querySelectorAll('[data-guide-copy]').forEach(button => {
    button.hidden = false;
    button.addEventListener('click', async () => {
      const field = document.getElementById(button.dataset.guideCopy);
      const feedback = document.getElementById(button.dataset.guideFeedback);
      if (!field || !feedback) return;
      try {
        if (!navigator.clipboard?.writeText) throw new Error('clipboard');
        await navigator.clipboard.writeText(field.value);
        feedback.textContent = 'Texte copié. Vous pouvez le personnaliser avant de le partager.';
      } catch {
        field.focus();
        field.select();
        feedback.textContent = 'Le texte est sélectionné. Utilisez la fonction Copier de votre appareil.';
      }
    });
  });
})();
