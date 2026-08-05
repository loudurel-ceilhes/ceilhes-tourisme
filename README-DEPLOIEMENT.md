# Déployer ceilhes-tourisme.fr sur Netlify

Site statique multi-pages — **édité par Lou Durel**. Aucune compilation nécessaire.

## Contenu (à déposer tel quel)
- 16 pages indexées : index, le-lac, l-orb, randonnees, nature, terroir, patrimoine,
  alentours, agenda, vie-associative, hebergeurs, thermes-avene, herault-moto,
  pompiers-ceilhes, infos-pratiques, mentions-legales.
- 404.html (page d'erreur, noindex) · randonnees-vtt.html (redirection 301).
- assets/ → styles.css + script.js
- images/ → ⚠️ À AJOUTER : copiez ici votre dossier `images` (photos du site + image
  de partage `village-orb.jpg`, utilisée pour l'aperçu Facebook/Twitter).
- sitemap.xml · robots.txt · netlify.toml · _redirects

## Mise en ligne (glisser-déposer)
1. Vérifiez que `images/` est bien à la racine, à côté des .html.
2. https://app.netlify.com → "Add new site" → "Deploy manually".
3. Glissez tout le dossier `ceilhes-tourisme`. Le site est en ligne en quelques secondes.

## Domaine
Netlify → Domain management → "Add custom domain" → `ceilhes-tourisme.fr`,
puis suivez les instructions DNS chez votre registrar. HTTPS automatique et gratuit.

## Après mise en ligne
- Soumettez `https://ceilhes-tourisme.fr/sitemap.xml` dans Google Search Console.
- Vérifiez l'aperçu de partage sur https://www.opengraph.xyz (image = images/village-orb.jpg).
