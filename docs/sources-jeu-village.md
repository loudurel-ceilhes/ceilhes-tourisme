# Jeu découverte de Ceilhes et Rocozels

Page : `jeu-village.html`. Vérification des sources et des photographies le **15 novembre 2026**.

## Choix du carnet

Sept énigmes mêlent observation de deux photographies, lecture d'un document, déduction et chronologie. Tous les éléments nécessaires sont présents dans la page et dans l'impression des questions. Les indices sont repliables et les réponses expliquées sont réunies dans un corrigé séparé. Aucun itinéraire, temps de parcours, accès intérieur ni accessibilité de terrain n'est annoncé. Il n'est pas nécessaire de se déplacer vers un pont, une berge ou un bâtiment pour répondre.

Le numéro des énigmes est un ordre de lecture, pas un ordre de visite. Les images sont des supports d'observation, pas la promesse d'un point de vue accessible. Une réponse ouverte (le récipient de l'énigme 3) est distinguée d'un fait historique documenté.

## Sources historiques

| Source consultée | Éléments retenus |
| --- | --- |
| [Mairie — Histoire et patrimoine](https://ville-ceilhes.fr/histoire-et-patrimoine/) | L'Orb traverse Ceilhes ; fontaine du Griffoul / « la font del Grifol », ancien point d'eau principal ; arrivée de l'eau courante en 1925 ; remaniement de Saint-Jacques en 1709. |
| [Ministère de la Culture, POP — Saint-Jean-Baptiste, PA00103425](https://pop.culture.gouv.fr/notice/merimee/PA00103425) | Église de Ceilhes ; mâchicoulis défensifs sur les contreforts à la fin du XIVe siècle ; clocher décrit avec deux baies jumelles sur chacune des faces ; inscription MH le 26 novembre 1986. |
| [Ministère de la Culture, POP — Saint-Jacques, PA00103426](https://pop.culture.gouv.fr/notice/merimee/PA00103426) | Église de Rocozels ; cession à l'ordre du Temple en 1180 ; inscription MH le 26 novembre 1986. |

Les sources primaires concordent sur **1180**, contrairement à une ancienne rédaction du guide qui indiquait 1181. Elles disent **inscrite**, pas classée, pour Saint-Jacques. Le jeu retient ces informations vérifiées. Le statut d'ancienne chapelle castrale reste probable dans la notice : il n'est pas employé comme réponse certaine. Les récits sur le château de Bouloc, les piliers déplacés ou les anciennes foires n'ont pas été nécessaires aux énigmes et ne sont pas repris sans vérification supplémentaire.

## Photographies existantes, inspectées visuellement

- `images/eglise-ceilhes.jpg`, © **Lou Durel** : montre Saint-Jean-Baptiste, une statue au premier plan et le cadran du clocher. Utilisée dans l'énigme 1 ; l'alt reste descriptif et ne prive pas un utilisateur de lecteur d'écran des détails utiles. La photographie ne montre pas les quatre faces du clocher : l'énigme 6 utilise explicitement la description de POP.
- `images/pont-pierre.jpg`, © **Alain Dandonneau** : montre le vieux pont de Ceilhes sur l'Orb et son reflet dans l'eau. Utilisée dans l'énigme 2. Le jeu n'attribue pas au pont une date de construction non vérifiée.

Les variantes WebP existantes sont réutilisées, sans nouvelle copie, retouche ni recadrage du sujet. Dimensions intrinsèques et `height:auto` sont conservés. Les auteurs sont visibles sous les photos ; autorisations existantes dans les mentions légales et `docs/sources-photographies.md`. Aucun pictogramme de remplacement ni photo générée.

## Réponses et impression

`assets/jeu-village.js` n'effectue aucune requête. Les réponses restent dans `localStorage` sous `ceilhes:jeu-village:v1`, sept champs bornés à 600 caractères. Aucune réponse n'est interprétée comme HTML. Le compteur mesure les réponses non vides, pas leur justesse. En cas de stockage refusé, le message précise que la conservation n'est pas disponible et le carnet reste utilisable pour la session. L'effacement demande confirmation.

Sans JavaScript, questions, champs, indices natifs `details` et corrigé restent lisibles. L'impression ordinaire produit le carnet sans réponses personnelles, indices ni corrigé. Les boutons activés par JavaScript permettent d'imprimer le corrigé seul, même s'il est fermé à l'écran ; `afterprint` rétablit le mode ordinaire. Les photographies utiles aux questions restent imprimées.

## Contrôles et intégration

`tests/jeu_village.py` contrôle le téléphone étroit, la saisie et la reprise, l'effacement annulable, le stockage refusé/corrompu, la neutralité du texte enregistré, l'accès au clavier, la lecture sans JavaScript et la séparation à l'impression. Un contrôle visuel mobile et des exports A4 complètent ces essais.

Les six essais navigateur passent. Les rendus ont été contrôlés à 320/390 px et sur ordinateur ; l'export A4 produit trois pages de questions et une page de corrigé. Le jeu peut être ajouté au carnet « Mon séjour » avec l'identifiant stable `jeu-village`, catégorie `Guide`.

Intégration attendue : ajouter **Jeu découverte** (`jeu-village.html`) dans le groupe de guides de `scripts/navigation.mjs`, puis régénérer la navigation, l'index de recherche/catalogue et les empreintes ; ajouter la page au sitemap. Des liens depuis patrimoine, petites balades ou la page d'accueil peuvent la rendre facile à trouver. Ces fichiers partagés sont laissés à l'intégration générale.
