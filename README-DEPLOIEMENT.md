# Préparer et publier ceilhes-tourisme.fr

Site statique édité par Lou Durel : pages HTML, photos, styles et petits
scripts JavaScript. Aucune dépendance applicative à installer. Node 22 sert
au serveur local, à la génération des annuaires et aux contrôles.

## Vérifier une modification

Depuis le dossier du dépôt, cette commande lance un serveur local pour
regarder les modifications sans les publier :

```bash
node scripts/serve.mjs
```

Sur son ordinateur, ouvrir `http://localhost:8788`. Arrêter le serveur avec
Ctrl+C. Il sert les fichiers locaux ; il ne reproduit pas les redirections
et en-têtes de Netlify.

Cette commande vérifie les fichiers, les liens et leurs ancres, les images,
les données JSON et les menus. Elle reproduit aussi la génération de
Netlify dans une copie temporaire et vérifie qu'un deuxième passage donne
le même résultat. Elle ne modifie pas le dépôt et ne contacte aucun service
extérieur :

```bash
node scripts/verifier-site.mjs
```

Cette commande teste les règles de génération et le vérificateur avec des
cas normaux et des erreurs attendues :

```bash
node --test tests/*.test.mjs
```

Les parcours sur ordinateur, téléphone et au clavier sont vérifiés par
`tests/*.py`. Ils utilisent Python 3.12 et Playwright, uniquement
pour les tests. Pour installer ces outils dans un environnement de
développement, puis lancer le contrôle qui démarre et arrête son serveur :

```bash
python3 -m pip install playwright==1.58.0
python3 -m playwright install chromium
python3 -m unittest discover -s tests -p '*.py' -v
```

Si Chromium est déjà installé dans l'environnement cloud, indiquer son
chemin au lieu de télécharger un autre navigateur :

```bash
BROWSER_EXECUTABLE=/usr/bin/chromium python3 -m unittest discover -s tests -p '*.py' -v
```

## Mettre à jour le contenu

Les fiches d'hébergements et de restauration indiquent leur source et la
date de consultation. Les références détaillées et les points restant à
confirmer sont dans `docs/sources-adresses.md`. Les photos sont accessibles
par les galeries officielles des établissements.

Le carnet `mon-sejour.html` conserve les choix dans le navigateur du
visiteur, sans serveur ni compte. Son bouton d'impression permet de garder
les adresses des fiches sur papier ou en PDF. Il n'effectue aucune réservation.
Les formulaires de recherche restent indépendants de cette sélection.

Les pages HTML ordinaires se modifient directement. Les fiches producteurs,
marchés et monuments sont générées : modifier le fichier correspondant
dans `data/`, puis lancer son générateur pour mettre à jour le HTML affiché
localement. Les commandes suivantes reconstruisent ces trois annuaires :

```bash
node scripts/producteurs.mjs
node scripts/marches.mjs
node scripts/monuments.mjs
```

Ne pas modifier à la main les blocs HTML entre les balises `@producteurs`,
`@marches` ou `@monuments`. Le guide [CLAUDE.md](CLAUDE.md) explique les
données, les photos et les conventions du site.

L'agenda est actualisé par sa tâche GitHub à partir de DATAtourisme. Pour
essayer une récupération sans écrire la page, cette commande utilise le
réseau et affiche les événements retenus :

```bash
node scripts/agenda.mjs --dry-run
```

Un accès extérieur refusé dans un environnement cloud ne prouve pas que
le site ou sa source est en panne. Les contrôles locaux ne dépendent pas de
la disponibilité de cette source.

## Publier

**Netlify suit la branche `main` du dépôt GitHub.** Après validation d'une
modification et son arrivée sur `main`, Netlify publie automatiquement.
Il n'y a pas de dossier à glisser-déposer : les photos, polices et icônes
sont déjà dans le dépôt.

La configuration `netlify.toml` indique le dossier à publier (`.`) et les
étapes : producteurs, marchés, monuments, empreintes des styles et scripts
pour éviter les anciennes copies en cache, puis contrôle du résultat.
Ce dernier contrôle (`node scripts/verifier-site.mjs --publication`) vérifie
les fichiers et empreintes déjà générés sans relancer la génération. S'il
échoue, Netlify arrête ce déploiement, même après un envoi direct sur `main`.

La tâche GitHub **Vérification du site** s'exécute pour chaque proposition
de modification (pull request) et les envois ordinaires sur `main`. Examiner
ses deux résultats, contrôles locaux et parcours navigateur, avant de
fusionner. Pour imposer cette règle, les déclarer comme contrôles requis
dans les règles de protection de `main` sur GitHub. Le fichier de workflow
ne change pas ces réglages. Le contrôle final de Netlify protège les fichiers
publiés ; les tests de comportement et de navigateur restent dans GitHub.

La mise à jour automatique de l'agenda effectue elle-même les contrôles
locaux et les tests Node avant d'enregistrer sa page. Si un contrôle échoue,
elle ne publie pas cette mise à jour. Cette vérification est intégrée à sa
propre tâche car les commits d'une tâche GitHub ne relancent pas les autres
contrôles automatiquement. Les tests au navigateur restent dans la tâche
**Vérification du site**.

Le **Gardien des liens** reste chargé de vérifier les adresses extérieures
chaque semaine. Une panne extérieure ne fait pas échouer les contrôles
locaux à chaque modification.

## Après publication

- Vérifier le résultat du déploiement dans Netlify et les pages modifiées
  sur téléphone, notamment leurs photos et leurs boutons.
- Si une redirection ou un en-tête a changé, le vérifier sur le déploiement
  Netlify ; le petit serveur local ne l'applique pas.
- Pour une nouvelle page publique, mettre à jour la navigation commune et
  `sitemap.xml`. Le sitemap à soumettre à Google Search Console est
  `https://ceilhes-tourisme.fr/sitemap.xml`.
- Vérifier l'aperçu de partage de la page concernée : les images dédiées
  sont dans `images/og/`.

Le domaine `ceilhes-tourisme.fr` et HTTPS se gèrent dans les paramètres de
domaine de Netlify. Aucune clé ni aucun mot de passe ne doit entrer dans
le dépôt.
