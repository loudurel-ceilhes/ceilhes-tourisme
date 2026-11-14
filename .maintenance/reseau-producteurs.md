# Le réseau Galtier : données et mise à jour

`data/reseau-producteurs.json` est la référence publique commune. La page
`producteurs-region.html` est produite par `node scripts/reseau-galtier.mjs` et
intégralement consultable sans JavaScript. Les sites voisins peuvent reprendre
un instantané de ce JSON ; les identifiants `producteur-<id>` restent stables.

## Périmètre au 14 novembre 2026

- 254 identifiants distincts présents dans l'annuaire public Galtier ; collecte
  complète par catégorie, vérifiée contre les totaux renvoyés par l'API.
- Cinq compléments du répertoire de L'Esquirol : Tanguy Vesinet, Maison Boubal,
  La Tradition Pâtissière, Les Pâtes de Remylie et Jasse Larzou. Les communes et
  sites qui restent inconnus sont laissés vides, jamais déduits d'un homonyme.
- Onze correspondances explicites avec les fiches déjà présentes sur
  `terroir.html`. Elles renvoient à l'ancre existante, sans recopier portraits,
  GPS, téléphone ou description.

La source historique intitulée « 253 producteurs » contenait 168 identifiants
uniques. La pagination du service public change parfois d'ordre entre requêtes :
une simple boucle sur les pages n'assure pas l'exhaustivité.

## Rafraîchir sans perdre les corrections éditoriales

```
python3 scripts/collecter-galtier.py --sortie /tmp/galtier-public.json
```

La collecte utilise TLS vérifié, cinq requêtes simultanées au maximum, déduplique
par identifiant et recommence seulement les catégories incomplètes. Elle échoue
sans écrire la sortie si les totaux ne correspondent pas, y compris en cas de
nouvelle catégorie non prévue. Elle ne conserve ni adresses précises, ni mails,
ni téléphones, ni prix, ni biographies ou photos.

Relire ensuite les ajouts et changements par identifiant. Reporter les faits
publics retenus dans le registre ; conserver les champs éditoriaux `statut`,
`ficheLocale`, `nature`, `portrait` et les corrections de nom. La collecte refuse
d'écrire directement dans le registre. Les suppressions d'un annuaire ne sont
pas des preuves de cessation d'activité.

Enfin : `node scripts/reseau-galtier.mjs`, `node --test tests/reseau-galtier.test.mjs`
et `node scripts/verifier-site.mjs`. Les tests navigateur `reseau_galtier.py`
contrôlent filtres, accents, URL partageable, absence de résultat et lecture sans
JavaScript. La construction Netlify régénère le HTML avant de calculer les
empreintes des ressources.

## Qualification des relations

Le champ machine `statut` accepte : `decouvert`, `contact`, `recu`, `commande`,
`historique`. Le texte public emploie « Repéré dans la région », « Découvert avec
L'Esquirol » et « Déjà proposé à L'Esquirol ». Il ne publie aucun détail de
transaction. Même `recu` n'est pas un état du stock actuel ; la disponibilité
reste à confirmer. La nature distingue producteurs/artisans, collectifs et
intermédiaires. Quand elle n'est pas établie, la page dit « Maison de la région ».

Les producteurs absents de la boutique n'ont pas de faux lien d'achat. Les liens
présents conduisent à leur site public ou à une fiche locale existante. Le lien
Galtier `produit.php?client=…` ouvre un catalogue professionnel, pas une fiche
publique de visite : il n'est pas présenté comme une adresse touristique.

## Identités qui restent à confirmer

- « Maison Boubal » n'est pas fusionnée automatiquement avec « Boubal et Fils
  GAEC » à Cruéjouls. Les deux entrées restent distinctes jusqu'à confirmation.
- « La Tradition Pâtissière » à Firmi n'est pas fusionnée avec
  « Spécialité Aveyronnaise » à Marcillac-Vallon.
- Le libellé de contact « Minoterie Vallée du Céor / Castanié (Florimeule) »
  réunit potentiellement deux maisons. L'annuaire contient séparément
  `producteur-167` (Minoterie Vallée du Créor, Salmiech, nom conservé de la source)
  et `producteur-154` (Moulin du Castanié–Minoterie Marty, Moyrazès). Aucun nouveau
  producteur fictif ni relation commerciale attribuée aux deux par défaut.

Ces incertitudes n'empêchent pas de présenter les faits publics de l'annuaire ;
elles interdisent seulement de déduire une identité ou une relation commerciale.

Le 14 novembre, la présentation publique est devenue entièrement neutre à la demande de Lou : `producteurs-region.html`, `data/reseau-producteurs.json`, identifiants `producteur-<id>`. Les sources du transporteur restent seulement dans ce dossier de maintenance. Le champ numérique public de rapprochement est `annuaireId`.
