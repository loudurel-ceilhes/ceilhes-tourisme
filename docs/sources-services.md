# Sources des services essentiels

Consultation du **15 novembre 2026**, par HTTPS vérifié, sans appel, message ni relevé terrain. Page : `services-essentiels.html` ; complément depuis `infos-pratiques.html#services`. La fiche PDF ne recopie pas les horaires variables des professionnels.

| Information | Source consultée | Limites conservées |
| --- | --- | --- |
| Pharmacie des Monts d’Orb, 55 avenue Jean Jaurès, 34260 Le Bousquet-d’Orb, 04 67 23 80 64 | https://lebousquetdorb.fr/services/sante/ | La source municipale confirme nom, adresse et téléphone. Aucun horaire ou tour de garde inventé ; appel préalable. |
| Maison de santé pluridisciplinaire, 57 avenue Jean Jaurès, 34260 Le Bousquet-d’Orb, 04 67 95 09 68 | https://lebousquetdorb.fr/services/sante/ | L’annuaire municipal associe ce numéro à la maison de santé et aux médecins généralistes. Aucune disponibilité sans rendez-vous annoncée. |
| Mairie de Ceilhes, 04 67 23 40 89 | https://ville-ceilhes.fr/contact/ | Source à contacter pour les toilettes et points d’eau en service. Ces équipements ne sont pas encore localisés comme vérifiés. |
| Parking, aire de pique-nique et jeux au Bouloc | https://www.herault-tourisme.com/fr/fiche/equipements-de-loisirs/plan-d-eau-le-bouloc-de-ceilhes-et-rocozels-ceilhes-et-rocozels_TFOLOILAR034FS000T7/ | Le point officiel 43.8029, 3.1067 désigne le site du plan d’eau ; ce n’est ni une entrée de parking relevée ni une place accessible garantie. Aucune gratuité, durée ou permission de nuit en véhicule annoncée. |
| L’Esquirol Ceilhes, 2 bis avenue du Lac, 04 67 97 78 31 | https://esquirols.fr/ceilhes.html et source du propriétaire dans le dépôt vitrine | Lien vers les horaires et fermetures communs ; aucune duplication de la grille. La mairie affiche encore un ancien horaire « tous les jours » : il n’a pas été repris. |
| 15, 112 et 114 | https://www.service-public.gouv.fr/particuliers/vosdroits/F33954 | Contacts d’urgence, séparés des soins courants ; aucune adresse de consultation d’urgence non vérifiée. |

## Carte

Les trois adresses de rue sont géocodées par l’API de la Base Adresse Nationale, avec correspondance au numéro demandé et à la commune :

- Pharmacie : `34038_0232_00055`, 43.690217 / 3.168837, type `housenumber`, score 0,9587.
- Maison de santé : `34038_0232_00057`, 43.690126 / 3.169101, type `housenumber`, score 0,9587.
- L’Esquirol Ceilhes : `34071_0033_00002_bis`, 43.802730 / 3.112287, type `housenumber`, score 0,7995 ; libellé exact « 2bis Avenue du Lac 34260 Ceilhes-et-Rocozels ».

Le quatrième point, Bouloc, vient des données structurées de la fiche Hérault Tourisme. Les coordonnées sont des repères d’adresses ou de site, jamais présentées comme des entrées ou cheminements accessibles. La liste des contacts et les liens d’itinéraire restent utilisables sans carte ; les tuiles OpenStreetMap ne sont chargées qu’après clic sur « Afficher la carte ».

## Eau, toilettes et accessibilité

Aucune source actuelle consultée ne confirme l’emplacement et les conditions d’accès d’un sanitaire public ou d’un point d’eau potable à Ceilhes. La fontaine du Griffoul est une information patrimoniale, pas une preuve de potabilité. La page fournit le contact municipal et les questions pratiques à poser. Un relevé terrain ou une confirmation directe pourra compléter la fiche sans inventer de prestations.

## Impression et entretien

- `assets/fiche-services-ceilhes.pdf` est la fiche A4 compacte issue des styles d’impression de la page ; elle contient contacts, précautions de déplacement utiles et adresse de la version actuelle.
- Après modification de téléphone/adresse, mettre à jour la fiche écran et la table d’impression puis régénérer le PDF.
- Les dates de consultation désignent une lecture de source, pas une validation téléphonique ou terrain.
- Les services colis/gaz/retrait d’espèces détaillés sont maintenus sur la vitrine (`esquirols/docs/services-comptoir.md`) ; le guide touristique y renvoie plutôt que tenir une seconde liste de conditions.
