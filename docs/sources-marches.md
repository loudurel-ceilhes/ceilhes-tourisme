# Marchés : calendrier de séjour et sources

Mise à jour du 14 novembre 2026. La liste conserve les 32 fiches existantes ; une date de consultation n'est pas une confirmation par téléphone du maintien d'un marché.

## Sources relues en ligne

| Fiche | Source | Ce qui est effectivement établi |
| --- | --- | --- |
| Bédarieux, lundi et BioNat samedi | https://www.bedarieux.fr/Vivre/Ma-ville/Marches-et-salons/1/71.html | Page municipale accessible, modifiée le 7 avril 2026 : marché du lundi jusqu'à 13 h toute l'année, même les jours fériés ; BioNat samedi 8 h–12 h. Ces occurrences restent qualifiées de rendez-vous habituels, pas de présence garantie de chaque exposant. |
| Le Caylar, producteurs d'été | https://le-caylar-en-larzac.fr/a-la-une/marches-des-producteurs-tous-les-mercredis-soirs-de-juillet-et-aout/ | La commune annonce les mercredis de juillet et août. La fiche ne confirme pas une édition 2027 : le calcul reste borné à l'été 2026 de la liste initiale. |
| Avène, marché du mercredi | https://commune-avene.fr/marche-hebdomadaire-du-mercredi-matin-a-avene/ | L'article est daté du **27 mars 2022** et annonce une ouverture le mercredi 6 avril. Il ne permet pas de fixer la saison actuelle. Aucune date 2026 ou 2027 n'en est calculée. |
| Avène, marché de l'hôtel | https://www.eauthermaleavene-lhotel.com/marche-des-artisans-et-producteurs-locaux-eau-thermale-avene-lhotel | Annonce datée du **11 mars 2025**, chaque deuxième jeudi, avec première édition le 10 avril 2025. Le précédent libellé « mai à novembre » est remplacé par une indication de saison passée à confirmer. Aucune occurrence 2026/2027 automatique. |
| Ceilhes, soirées de producteurs | https://www.haut-languedoc-vignobles.com/agenda/les-marches-et-fetes-traditionnelles ; https://ville-ceilhes.fr/ | L'ancienne fiche Hérault Tourisme renvoie HTTP 410 et l'ancienne fiche de l'office redirige vers son agenda général. Les quatre dates 2026 de la liste initiale restent consultables comme calendrier passé ; le bouton mène à l'agenda actuel pour les prochaines éditions. |
| Saint-Gervais-sur-Mare | https://stgervaissurmare.fr/marche-hebdomadaire/ | Erreur HTTP 503 lors de cette consultation ; les informations et la date de revue initiales sont conservées, sans prétendre les avoir réactualisées. |
| Lacaune | https://www.lacaune.com/vivre-%C3%A0-lacaune/march%C3%A9s-gourmands-de-l-%C3%A9t%C3%A9/ | Cette page traite des marchés gourmands d'été. Elle ne confirme pas à elle seule les deux rendez-vous mensuels ordinaires ; ceux-ci gardent les sources et la date de la liste initiale et le statut « habituel, à confirmer ». |

Les autres sources, dates `maj` et niveaux de confiance restent ceux des fiches existantes. La nouvelle fonctionnalité n'annonce pas une vérification générale des 32 marchés.

## Données à entretenir

`data/marches.json` reste l'unique référence. Chaque fiche a un `id` stable et un `calendrier` :

- `hebdomadaire` : `jours` utilise dimanche = 0, lundi = 1, … samedi = 6.
- `mensuel` : `regles` contient `jour`, `rang` (1 à 5) et éventuellement `mois`. Les deux rencontres mensuelles de Lacaune et les deux mercredis estivaux de Lunas sont explicitement représentés.
- `dates` : liste de dates civiles ISO complètes, associée à l'année publiée.
- `a-confirmer` : aucune occurrence n'est calculée ; `motif` explique quelle information manque et la fiche conserve son lien de confirmation.

Toute saison calculable possède une année et des bornes, ou une liste de dates complètes. Une nouvelle saison exige une nouvelle vérification ; il ne faut pas remplacer « 2026 » par « 2027 » sans source. `confirmation: habitude` distingue une récurrence des `dates-publiees`. Ces dernières ne garantissent pas qu'un événement ancien a effectivement eu lieu, ni qu'un futur événement sera maintenu.

Après modification : `node scripts/marches.mjs`. Le générateur produit les listes sans JavaScript et les données du sélecteur dans le bloc `@marches` de `terroir.html`. Il refuse les dates incohérentes, saisons non bornées, identifiants en double et adresses de source non HTTP(S).

L'état statique est daté du dernier relevé enregistré, pour rester reproductible. Le navigateur actualise les étiquettes de fin de saison à la date de Paris. Les liens de recherche conservent les autres paramètres de la page (filtres producteurs, campagne) et n'incluent aucune donnée personnelle.

## Contrôles

- `node --test tests/marches.test.mjs` : dates impossibles, année bissextile, passage d'année, fuseau Paris, période de 31 jours, récurrences mensuelles, calendriers non reconduits, aucun résultat, génération stable et contenu échappé.
- `BROWSER_EXECUTABLE=/usr/bin/chromium /workspace/.cloud-environment-venv/bin/python tests/marches.py -v` : recherche et rechargement, conservation des autres filtres, erreurs, absence de dates, comportement mobile et listes sans JavaScript.

Aucun message n'a été envoyé aux organisateurs.
