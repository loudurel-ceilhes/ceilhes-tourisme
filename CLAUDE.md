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

## Les images : la règle à ne pas relâcher

Le site pesait **15,5 Mo d'images**, dont **15,6 Mo sur la seule page
`galerie.html`**. Les visiteurs arrivent en vacances, sur téléphone, avec une
4G rurale — parfois depuis un gîte sans wifi. Une page qui met une minute à
s'afficher est refermée avant d'avoir servi à quoi que ce soit.

Après optimisation, ce qu'un visiteur télécharge vraiment :

| Page                | Avant   | Sur téléphone | Sur ordinateur |
| ------------------- | ------- | ------------- | -------------- |
| `galerie.html`      | 15,6 Mo | **1,8 Mo**    | 4,0 Mo         |
| `index.html`        | 2,3 Mo  | **0,2 Mo**    | 0,5 Mo         |
| `l-orb.html`        | 5,3 Mo  | **0,5 Mo**    | 1,1 Mo         |

**Toute nouvelle photo doit passer par la même préparation** : trois versions
WebP (640, 1000, 1600 px) plus un repli JPEG à 1600 px de côté long, servies
en `<picture>` :

```html
<picture>
  <source type="image/webp" sizes="(max-width: 900px) 100vw, 900px"
    srcset="images/photo-640.webp 640w,
            images/photo-1000.webp 1000w,
            images/photo-1600.webp 1600w">
  <img src="images/photo.jpg" alt="…" width="1600" height="1067"
       loading="lazy" decoding="async">
</picture>
```

Règles :

- **jamais** un JPEG sorti d'appareil photo tel quel (2000 px, 1,2 Mo) ;
- côté long **1600 px maximum** : la mise en page ne va pas au-delà ;
- `width` et `height` **obligatoires** — sans eux la page saute quand la photo
  arrive, en pleine lecture ;

  ⚠️ **Leur complément indispensable : `height:auto` en CSS.** Ces attributs
  imposent une hauteur réelle si le style ne dit pas le contraire. La règle
  globale `img{max-width:100%;height:auto}` est là pour ça — **ne jamais la
  retirer**. Sans elle, une photo de 1600×1200 placée dans une colonne de
  galerie de 300 px s'affiche en 300×1200 : étirée sur tout l'écran. C'est
  exactement ce qui est arrivé le jour où les attributs ont été ajoutés.
  Les règles qui imposent volontairement `height:100%` ou `aspect-ratio`
  (`.photo-duo`, `.banner`, `.feature`…) sont plus spécifiques et continuent
  de s'appliquer normalement ;
- `loading="lazy"` partout **sauf** la photo d'ouverture, qui prend
  `fetchpriority="high"` : la retarder ne fait rien gagner ;
- un `alt` qui décrit ce qu'on voit, toujours.

Sur `galerie.html`, l'attribut `sizes` vaut `30vw` : la grille fait trois
colonnes, le navigateur choisit donc la version 640 px et non la 1000.

### Le piège qui a fait croire que la correction ne marchait pas

La règle `height:auto` a été corrigée, publiée, vérifiée en ligne… et Lou a
continué de voir les photos étirées pendant des jours. Ce n'était pas le site :
**son navigateur appliquait encore la feuille de style d'avant**, mise en cache
quand `/assets/*` était encore servi avec un an de validité.

Leçon : **on ne peut pas annuler un cache déjà posé.** Tant que la copie n'a
pas expiré, le navigateur ne redemande rien. La seule sortie est de changer
l'**adresse** du fichier.

D'où `scripts/version-assets.mjs`, que Netlify lance à chaque publication
(`command` dans `netlify.toml`) : il transforme `assets/styles.css` en
`assets/styles.css?v=39135ee0`, l'empreinte étant calculée sur le contenu.
Elle ne bouge que si le fichier a vraiment changé.

**Écrivez donc toujours `assets/styles.css` tout court dans le HTML** : la
publication s'occupe du reste. Le script est idempotent, on peut le relancer
sans risque :

```bash
node scripts/version-assets.mjs
```

Signe qui doit alerter : « j'ai corrigé, c'est en ligne, mais lui voit encore
l'ancien ». Avant de chercher un bug, vérifier ce que le navigateur applique
vraiment — pas ce que le fichier contient.

## Les annuaires : des fichiers de données, pas du HTML

Trois sections du site sont fabriquées depuis des fichiers de données par
des scripts que Netlify lance à chaque publication (même modèle que
l'agenda) : les **producteurs** (`data/producteurs.json` →
`scripts/producteurs.mjs`, balises `@producteurs` de `terroir.html`), les
**marchés** (`data/marches.json` → `scripts/marches.mjs`, balises `@marches`
de `terroir.html`) et les **monuments historiques** (`data/monuments.json` →
`scripts/monuments.mjs`, balises `@monuments` de `patrimoine.html`).
La règle est la même partout : on ne modifie jamais le HTML entre les
balises, on modifie le fichier de données puis on relance le script.

## L'annuaire des producteurs : un fichier de données, pas du HTML

Les fiches producteurs de `terroir.html` (80 et quelques) ne se modifient
**jamais dans le HTML** : elles sont fabriquées depuis
**`data/producteurs.json`** par `scripts/producteurs.mjs`, que Netlify lance
à chaque publication (avec `version-assets.mjs`). Le HTML généré est aussi
enregistré dans le dépôt, entre les balises `<!-- @producteurs -->` et
`<!-- @/producteurs -->` de la page.

Corriger un téléphone, ajouter une ferme, retirer une fiche : tout se passe
dans le fichier JSON (une entrée par producteur : nom, lieu, description,
téléphone, email, site, vente, labels, sources…). Puis :

```bash
node scripts/producteurs.mjs   # refabrique les fiches dans terroir.html
```

L'email n'est volontairement **pas affiché** sur la page (anti-spam) ; il
reste dans le fichier. Chaque fiche garde ses `sources` (adresses web où
l'info a été vérifiée) et sa date `maj` : une fiche sans source ne devrait
pas exister.

La **carte interactive** en haut de l'annuaire vient des mêmes données : le
champ `gps` ([latitude, longitude]) place l'épingle, `gpsPrecision` vaut
`"commune"` (centre de la commune, source Wikipédia), `"lieu-dit"` (hameau
géolocalisé) ou `"exacte"` (position relevée à la ferme). Un producteur sans
`gps` reste dans l'annuaire mais pas sur la carte.

Pour affiner une épingle sans toucher au JSON :
**ceilhes-tourisme.fr/reglage-carte.html** — page-outil interne (hors menu,
hors sitemap, non indexée). On y fait glisser les épingles sur la position
réelle des fermes, puis « Copier les corrections » produit un bloc à envoyer
à Claude, qui reporte les coordonnées dans `data/producteurs.json` avec
`gpsPrecision: "exacte"`.

## Le gardien des liens

Chaque lundi matin, GitHub lance `scripts/gardien-liens.mjs`
(`.github/workflows/gardien-liens.yml`) : les ~300 liens extérieurs et tous
les liens internes du site sont testés. En cas de casse, un signalement
étiqueté `gardien-des-liens` s'ouvre sur le dépôt avec la liste — il suffit
de demander à Claude de réparer. Les domaines qui refusent les robots
(Facebook, Pages Jaunes…) sont exclus du test pour éviter les fausses
alertes. Le même gardien veille sur le dépôt esquirols.

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
