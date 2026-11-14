# Partager et emporter le carnet

La sélection personnelle reste dans `localStorage`, clé `ceilhes:mon-sejour:v1`,
avec une limite de 60 idées. Aucun compte ni synchronisation distante n'est créé.

## Catalogue public

`node scripts/carnet-catalogue.mjs` extrait les attributs `data-carnet-*` des
pages HTML publiques à la racine. Il écrit `data/carnet-catalogue.json` et le
bloc JSON intégré à `mon-sejour.html`. Le lancer **après** les autres générateurs
(producteurs, agenda, nouvelles fiches), **avant** `version-assets.mjs`.

Les identifiants doivent être stables, uniques et composés de lettres minuscules,
chiffres ou traits d'union. Deux fiches de même identifiant avec des informations
contradictoires bloquent la génération. Les catégories admises sont Randonnée,
Adresse, Hébergement, Producteur, Événement et Guide. Seuls les liens HTML du guide et
les traces SityTrail attendues sont acceptés.

## Lien et fichier de transfert

Le lien est de la forme `mon-sejour.html#carnet=id-1,id-2`. Le fragment contient
uniquement les références publiques des idées, jamais des titres ou des liens
fournis par un tiers. Les informations affichées viennent du catalogue du guide.
Toute personne recevant ce lien peut consulter les idées correspondantes.

Le fichier exporté contient `format: "ceilhes-mon-sejour"`, `version: 2` et un
tableau `ids`. Import maximal : 32 Ko et 60 références, avec validation stricte
des identifiants. Les anciennes références inconnues sont signalées et ne sont
pas remplacées par un contenu arbitraire. Les doublons sont regroupés.

L'ouverture d'un lien ou d'un fichier affiche un aperçu. Seul le bouton
« Ajouter ces idées à mon carnet » enregistre une fusion avec la sélection
existante ; il ne remplace jamais le carnet. Si le total dépasse 60, l'ajout
est bloqué jusqu'au retrait volontaire de quelques idées. Un refus du stockage
conserve la sélection précédente et l'aperçu, afin de pouvoir réessayer.

## Copie hors ligne

Le téléchargement HTML fournit une liste autonome avec titres, catégories,
liens et date de la copie. Aucun script, police distante, image ou requête n'est
nécessaire pour la lire. Ce n'est pas une copie complète des fiches : ouvrir
leurs détails et vérifier les conditions du jour exige une connexion. Le fichier
le précise et rappelle qu'il ne constitue pas une réservation.

L'impression du carnet dans le site reste disponible. Les commandes de partage
et d'import sont masquées à l'impression. Sans JavaScript, les programmes et
fiches du guide restent lisibles ; les fonctions personnelles ne sont pas
présentées comme actives.

## Vérification

- `node --test tests/carnet-catalogue.test.mjs`
- `BROWSER_EXECUTABLE=/usr/bin/chromium /workspace/.cloud-environment-venv/bin/python -m unittest discover -s tests -p 'carnet*.py' -v`

Les tests couvrent le catalogue, le contenu malveillant, le partage, la fusion,
les doublons, les références disparues, le refus du stockage, la limite de 60,
le téléchargement/export, la lecture hors réseau, le repli de copie et le mobile.
