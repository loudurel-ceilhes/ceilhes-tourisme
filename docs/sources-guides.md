# Sources des nouveaux guides pratiques

Consultation le **14 novembre 2026**. Les informations ci-dessous ont été lues en ligne, sans appel ni message aux établissements et sans relevé terrain. Les pages publiques distinguent une vente directe, une visite organisée et un simple passage en boutique.

## Curistes et accueil

- https://www.centrethermalavene.com/ : cure conventionnée de 18 jours ; calendriers distincts du centre thermal et du spa. La page affiche le 16 mars–21 novembre 2026 pour le centre, le 3 mars–27 novembre 2026 pour le spa. Le guide renvoie vers le calendrier en cours plutôt que recopier ces dates ou inventer celles de 2027.
- https://www.tourisme.grandorb.fr/Thermalisme/Avene.html et https://www.tourisme.grandorb.fr/Liste/Nos-brochures.html : ressources officielles et hébergements.
- `infos-pratiques.html`, `docs/sources-adresses.md`, vitrine Esquirols et boutique Odoo : accès, commerces, réservations et Frigo Plein. Le guide ne crée aucun service de transport ou de livraison.
- Les suggestions de repas et l'organisation des trois semaines sont éditoriales, sans régime médical ni promesse de santé.

## Sorties de producteurs

| Maison | Source relue | Retenu |
| --- | --- | --- |
| Miellerie du Mas Valette | https://www.vivreengrandorb.fr/avene/meillerie-mas-valette-/ | Miels, pollen, propolis ; visite sur rendez-vous au 06 84 30 70 58. |
| La Part du Loup | https://www.vivreengrandorb.fr/avene/ferme-la-part-du-loup/ | Vente directe ; lundi–vendredi sur RDV, samedi marché du Bousquet 9 h–12 h, dimanche fermé. Les anciennes heures 8 h 30–12 h 30 du registre sont remplacées. Les visites De ferme en ferme concernent un événement ponctuel. |
| Ferme des Monts et des Sources | https://www.vivreengrandorb.fr/avene/ferme-des-monts-et-des-sources-/ | Vente directe à Vinas ; lundi–samedi sur RDV, dimanche fermé ; 06 32 89 68 65. |
| La Fermière de Sylvanès | https://www.tourisme-aveyron.com/fr/diffusio/autres-commerces/la-fermiere-de-sylvanes-sylvanes_TFO403517386701 | Boutique à Ramondedieu, charcuterie et conserves ; téléphone actuel 06 48 75 72 82. Pas de grille horaire publiée : ne pas reprendre l'ancienne grille d'annuaire comme confirmée. |
| Ferme de Saint-Pierre d'Issis | https://www.tourisme-aveyron.com/fr/diffusio/autres-commerces/ferme-de-st-pierre-d-issis-camares_TFO404055308522 | Vente directe de roquefort, œufs, miel et viande ovine ; 07 71 26 76 09. La visite hebdomadaire gratuite n'est pas confirmée par cette source actuelle et n'est pas promise dans le guide. |
| Le Vieux Berger | https://www.le-vieux-berger.com/ | Boutique, visite libre et visite guidée sur réservation ; cette dernière annoncée pour 45 min à 1 h. Les horaires de boutique et de visite diffèrent : lien direct plutôt que grille fusionnée. |
| Maison Carles | https://roquefort-carles.fr/fr/boutique | Adresse 6 avenue de Lauras, deux gammes et visite sur rendez-vous. La grille hebdomadaire indique lundi–vendredi 8 h 15–17 h 30 mais la FAQ décrit une ouverture saisonnière tous les jours : contradiction conservée comme motif d'appel, pas résolue arbitrairement. |
| Les Bergers du Larzac | https://www.tourisme-aveyron.com/fr/diffusio/artisans-entreprises/fromagerie-cooperative-des-bergers-du-larzac-la-cavalerie_TFO128189268597 | Magasin près de la sortie A75 47, à La Cavalerie. L'horaire actuel diffère de l'ancien registre : le nouveau guide renvoie à la fiche à jour. Aucune visite d'atelier n'est promise. |

Les circuits regroupent des adresses par secteur et conseillent deux étapes. Aucun temps de conduite ou kilométrage n'a été inventé. Les coordonnées de commune ou de hameau du registre ne sont pas présentées comme des entrées exactes : l'accès et le stationnement se demandent lors du rendez-vous.

### Données locales alignées

Dans `data/producteurs.json`, La Part du Loup et La Fermière de Sylvanès ont été actualisées avec leur source et la date de consultation. Ces deux identités ne sont pas présentes sous une correspondance certaine dans `data/reseau-producteurs.json` : aucun rapprochement supposé n'a été appliqué à ce second registre.

## Petites promenades

- **Bouloc** : https://www.herault-tourisme.com/fr/fiche/equipements-de-loisirs/plan-d-eau-le-bouloc-de-ceilhes-et-rocozels-ceilhes-et-rocozels_TFOLOILAR034FS000T7/ — le site officiel décrit parking, aire de pique-nique, jeux et « parcours accessible autour du plan d'eau ». L'information d'accessibilité est attribuée à cette source ; état du chemin, pente et revêtement par tronçon non mesurés. Les toilettes ne sont pas recensées dans la fiche utilisée.
- **Ceilhes** : https://www.tourisme.grandorb.fr/Office-de-Tourisme/Les-villes-et-villages.html — façades, linteaux et portes anciennes, fontaine du Griffoul. La promenade reste dans les rues publiques et n'invente pas de parcours balisé.
- **Joncels** : https://www.tourisme.grandorb.fr/Les-incontournables/Joncels/3812.html — abbatiale fortifiée, place au nord de l'église, vestiges du cloître et galerie romane en grès rose. Aucun horaire d'ouverture intérieure n'est promis.

Les créneaux 30/60/90 minutes sont explicitement des **temps que le visiteur choisit de consacrer au lieu**, pas des durées de circuit. Les points de départ sont nommés, sans photo prétendument prise sur place. Pour livrer ensuite des fiches de randonnée mesurées, il reste à relever les tracés, distances, revêtements, dénivelés, escaliers, bancs, toilettes et photos d'accès. Aucun attribut « poussette » n'est déduit de l'apparence d'une carte.

## Kit hébergeurs et QR

- `assets/qr-bienvenue.svg` encode exactement `https://ceilhes-tourisme.fr/bienvenue.html?utm_source=hebergeurs&utm_medium=qr&utm_campaign=accueil`.
- QR généré localement avec qrcode 8.2, correction M, bordure de quatre modules. Aucun service QR tiers, URL raccourcie ou identifiant d'hébergeur n'est utilisé.
- La fiche ne recopie ni prix ni horaires : elle dirige vers les pages actuelles.
- `assets/fiche-accueil-ceilhes.pdf` est la version imprimée de `kit-hebergeurs.html` ; la CSS d'impression limite le document à la fiche d'accueil.
- `assets/guides.js` active seulement impression et copie volontaire du texte proposé. Il n'envoie aucun message et ne soumet aucun formulaire.

## Entretien

Lors d'une modification de la fiche, régénérer son PDF depuis `kit-hebergeurs.html` en A4 avec les styles d'impression, puis vérifier le nombre de pages et les liens. Garder le QR sur l'adresse stable `bienvenue.html`. Pour les maisons, revoir les sources avant tout changement d'horaire ; une nouvelle saison ne renouvelle pas automatiquement une confirmation ancienne.
