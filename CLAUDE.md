# ceilhes-tourisme.fr — guide du dépôt

Site touristique du village de **Ceilhes-et-Rocozels** (Hérault, 34260) :
le lac, l'Orb, les randonnées, le patrimoine, les hébergeurs, l'agenda.

Le propriétaire (Lou) est épicier, pas développeur. Toute explication lui étant
destinée est en français, sans jargon, et aucune commande n'est proposée sans
dire ce qu'elle fait.

## Ce qu'est ce site

Site **100 % statique** : du HTML écrit à la main, aucun framework, aucune
étape de construction. C'est volontaire : un site de village doit pouvoir être
repris dans cinq ans sans réinstaller quoi que ce soit.

19 pages, dont `le-lac.html`, `l-orb.html`, `randonnees.html`,
`randonnees-vtt.html`, `patrimoine.html`, `nature.html`, `terroir.html`,
`thermes-avene.html`, `hebergeurs.html`, `agenda.html`, `alentours.html`,
`galerie.html`, `vie-associative.html`, `infos-pratiques.html`.

## Publication : plus jamais de glisser-déposer

**Le site se publie tout seul.** Netlify surveille la branche `main` : dès
qu'une modification y arrive, le site en ligne se met à jour en une minute
environ.

```bash
git add -A && git commit -m "ce que j'ai changé" && git push
```

Ce qu'il ne faut **plus** faire : glisser le dossier sur Netlify à la main.
Sur le site voisin (esquirols.fr), c'est ainsi que la version en ligne s'est
retrouvée avec un mois de retard sans que personne ne s'en aperçoive.

## Le point noir à traiter en priorité : le poids des images

**16 Mo d'images pour 19 pages.** C'est, de très loin, le principal défaut de
ce site.

Le contexte compte : les visiteurs arrivent en vacances, souvent sur téléphone,
souvent avec une 4G rurale médiocre — parfois depuis un gîte sans wifi. Une
page qui met huit secondes à afficher une photo du lac est une page refermée
avant d'avoir servi à quoi que ce soit.

Règles à appliquer à toute nouvelle image :

- format **WebP** (ou AVIF), jamais un JPEG sorti d'appareil photo ;
- largeur maximale **1600 px** pour une photo pleine largeur, 800 px pour une
  vignette ;
- viser **moins de 200 ko** par image, idéalement moins de 100 ;
- toujours `width`, `height`, un `alt` descriptif, et `loading="lazy"` pour
  tout ce qui n'est pas visible d'emblée.

## Conventions

- **Langue** : tout le contenu visible est en français. Noms de fichiers en
  minuscules avec traits d'union.
- **Une page ajoutée** doit l'être aussi dans le menu de **toutes** les pages
  et dans `sitemap.xml`.
- **Couleurs et polices** : uniquement via les variables CSS de `assets/`.
- **En-tête et pied de page recopiés dans chaque fichier** : toute
  modification se fait dans **toutes** les pages, sans exception.

## Lien avec les autres projets

- **`esquirols`** — le site de L'Esquirol, l'épicerie du village. Les deux
  sites se citent mutuellement : le touriste qui cherche une randonnée doit
  trouver où acheter son casse-croûte, et inversement.
- **`transhumance`** — l'application de vente et le fichier client.

Ce maillage entre les deux sites est un atout de référencement local : ne
jamais casser un lien croisé sans le remplacer.

## Sécurité

Aucun secret dans ce dépôt, et il ne doit jamais y en avoir : le site est
entièrement statique.
