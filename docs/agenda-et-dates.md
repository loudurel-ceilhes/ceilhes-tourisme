# Agenda : occurrences, ouvertures et soirées de Cénomes

L’actualisation `node scripts/agenda.mjs` consulte DATAtourisme et le fichier public canonique `https://esquirols.fr/assets/data/ardoise-cenomes.json`. L’instantané `data/agenda-source.json` conserve uniquement les champs publics utilisés, les adresses des sources et leurs dates de consultation ; l’ardoise a une empreinte SHA-256. Aucun contact ou champ interne Odoo n’y figure. La page distingue les données de l’office des soirées du restaurant.

`node scripts/agenda-cache.mjs` reconstruit l’agenda **sans réseau** depuis cet instantané. Netlify l’exécute avant le catalogue du carnet. La date civile suit Paris. L’action quotidienne rafraîchit les sources puis enregistre l’agenda, l’instantané, le catalogue, Mon séjour et les sorties de recherche. Un échec du téléchargement arrête cette actualisation, sans effacer les dernières données ; les dates de consultation restent visibles. Pour contrôler une génération sans écrire : `node scripts/agenda.mjs --from-cache --dry-run`.

Les soirées sont calculées sur 90 jours d’après les règles de l’ardoise. Les événements datés priment sur les récurrences, les exclusions sont conservées : le 18 décembre 2026 remplace bien le 25 décembre. Les menus du midi ne deviennent pas des soirées. L’horaire et le prix du soir ne sont pas déduits du menu à 18 €. Chaque lien conserve la date et le service vers la carte correspondante sur la vitrine ; aucune disponibilité de réservation n’est promise. Le calendrier possède ses tests de premier/dernier vendredi et d’exception, sans copie d’un module applicatif distant.

Toutes les fiches à venir des communes retenues restent filtrables : l’ancienne limite de 30 fiches supprimait des sorties de décembre. À l’ouverture, 12 rendez-vous et les soirées de Cénomes sont présentés ; le bouton « Voir les autres rendez-vous » révèle le reste. Un filtre cherche dans l’ensemble des fiches. Les cartes affichent trois occurrences au maximum puis un élément `details` natif, utilisable au clavier sans JavaScript. Les autres dates restent consultables et les données structurées gardent les occurrences. En filtrant un week-end ou un séjour (31 jours maximum), seules les occurrences correspondantes sont affichées. Une période d’exposition ne prouve pas l’ouverture quotidienne : une mention visible rappelle cette limite.

Les exceptions d’ouverture sont dans `data/agenda-ouvertures.json`, par identifiant source. Le cas flor’Avène est documenté par la description publiée : lundi à vendredi, hors jours fériés. La règle est bornée au 2 novembre 2026–28 février 2027 et n’est appliquée que si le texte source contient encore la fermeture justifiant cette règle. Aucun horaire n’est extrait automatiquement d’une phrase. Les jours fériés sont les fêtes nationales françaises, adaptées au lieu de cette manifestation.

Les champs `data-carnet-dates` ne sont produits que pour des occurrences ponctuelles certaines, jamais pour une plage d’exposition. Le module commun `assets/sejour-dates.js` garde les dates facultatives du séjour ; l’agenda écrit ses paramètres `periode=sejour`, `debut` et `fin`. Réinitialiser le filtre conserve la préférence, tandis qu’effacer les dates communes propage l’effacement entre les onglets.

Vérifications : `node --test tests/agenda.test.mjs tests/agenda-calendrier.test.mjs`, puis les parcours Playwright `agenda_details.py`, `agenda_periodes.py` et `partage.py`. Les essais n’envoient aucun formulaire et ne créent aucune réservation.

## Ajouter un rendez-vous à un calendrier

Dans les détails d’une fiche, « Dans mon calendrier » permet de choisir une
occurrence puis de télécharger un fichier `.ics`, importable dans Apple
Calendrier, Outlook et Google Agenda. Un lien Google Agenda ouvre également
un formulaire prérempli, sans créer l’événement à la place du visiteur. Aucun
compte n’est relié au site, aucun abonnement ni synchronisation n’est créé.
Le fichier est préparé dans le navigateur, sans requête à un service distant.

Les sources actuelles donnent des dates civiles, sans heures structurées.
L’export utilise donc `DTSTART;VALUE=DATE` et une fin exclusive au lendemain
du dernier jour ; il n’invente ni heure ni durée. L’interface et le fichier
précisent « journée entière, horaire à confirmer » : cela ne signifie pas une
activité ou une ouverture pendant toute la journée. Ces dates ne sont pas
converties en instants UTC et restent exactes lors des changements d’heure.
Le lien Google indique `Europe/Paris` et les mêmes dates civiles.

Une exposition conserve sa période d’origine : le bouton est explicitement
« Ajouter la période (.ics) ». Un seul événement couvre cette période, sans
récurrence quotidienne et sans prétendre que le lieu ouvre chaque jour. Un
filtre de séjour restreint le choix des occurrences ponctuelles, mais ne
transforme jamais un fragment de période en journée d’ouverture confirmée.
Les réservations restent des démarches distinctes ; l’export enregistre une
idée de sortie et ne confirme aucune réservation.

`assets/calendrier-ics.js` produit le format RFC 5545 : identifiant stable par
fiche et date de début, lieu, lien permanent de la fiche, provenance, fin
exclusive, échappement des caractères réservés et lignes pliées à 75 octets
sans couper un caractère UTF-8. Les liens restent activables au clavier et
les erreurs de téléchargement sont affichées. Sans JavaScript, les dates,
les détails et les contacts existants restent consultables.

Aucun nouveau générateur n’est nécessaire. Après modification des ressources,
`node scripts/version-assets.mjs` actualise leurs empreintes dans les pages.
Tests ciblés : `node --test tests/calendrier-ics.test.mjs tests/agenda.test.mjs
tests/agenda-calendrier.test.mjs` et `python3 -m unittest discover -s tests -p
'agenda_ics.py' -v`. Ce parcours télécharge de vrais fichiers locaux, teste le
clavier, les filtres, une exposition, un échec de préparation et le repli sans
JavaScript ; il ne contacte aucun calendrier distant.
