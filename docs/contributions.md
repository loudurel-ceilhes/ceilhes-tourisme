# Proposer une photo ou corriger une fiche

`contribuer.html` prépare un courriel vers **lou.durel@gmail.com**, l’adresse déjà publiée dans les mentions légales du guide. Aucun service de réception Netlify n’est présumé disponible. Le formulaire ne transmet rien, ne téléverse aucune photo et ne conserve pas les saisies. L’utilisateur relit le message, ouvre sa messagerie et décide de l’envoyer. Le site n’affiche jamais « reçu » ou « envoyé ».

Une correction n’exige pas de photo. La photo demande un lien HTTPS consultable ou une pièce jointe ajoutée dans la messagerie, son sujet, son auteur/crédit et les confirmations de droits. L’autorisation est limitée à ceilhes-tourisme.fr ; aucun usage sur les autres sites ou en publicité n’en découle. Les images et corrections restent soumises à une vérification humaine. Pour les personnes identifiables, l’accord de publication doit être confirmé, avec celui du représentant légal pour un enfant.

Sans JavaScript, les liens des fiches conduisent à une page qui fournit l’adresse de courriel et les renseignements à joindre. Le formulaire interactif reste masqué. Le texte complet peut être copié si aucune messagerie n’est configurée ; pour un long message, seul l’objet est prérempli et une instruction demande de copier le corps, sans le tronquer.

## Génération et intégration

`node scripts/contributions.mjs` ajoute les liens « Corriger cette fiche » et « Proposer une photo » aux cartes HTML possédant une ancre connue ou un lien de carnet local. Les pages publiques reçoivent aussi un lien de contribution en bas de page. Les pages internes et 404 sont exclues. Une carte de circuit dont l’ancre de secteur est partagée reçoit une ancre propre dérivée de son identifiant de carnet ; les anciens liens sont conservés.

Le catalogue embarqué dans la page de contribution contient uniquement les noms et destinations publiques extraits du guide. Les paramètres visiteurs ne peuvent pas fournir librement un titre ou une adresse de redirection : seules les destinations du catalogue, sur le domaine canonique, sans paramètres supplémentaires, sont acceptées. Les textes sont affichés via `textContent` ou `value`, puis encodés dans les seuls paramètres `subject` et `body` du courriel, avec un destinataire constant. Aucun lien de photo n’est téléchargé par le formulaire.

Deux compléments sont ciblés explicitement : les 32 fiches des listes `monuments` de `patrimoine.html`, et les six cartes `asso` de `vie-associative.html`. Parmi les monuments, 31 possèdent un lien officiel POP/Mérimée `PAxxxxxxxx`, qui produit une ancre telle que `monument-pa00103465`. L’ensemble de statues-menhirs de Murat-sur-Vèbre, objet Palissy sans identifiant Mérimée dans les données, reçoit l’ancre éditoriale explicite `monument-statues-menhirs-murat-sur-vebre` ; aucune référence officielle n’est inventée. Une association reçoit une ancre telle que `association-ceilhes-pour-tous`. Une ancre existante est conservée ; le générateur refuse une collision. Les autres listes et blocs de mise en page ne sont pas transformés. Les contributions restent visuellement secondaires, sous chaque fiche.

Ordre à intégrer dans la construction : générateurs des fiches et agenda, navigation, **contributions**, catalogue du carnet, empreintes des ressources, vérification. Le workflow quotidien de l’agenda doit aussi lancer les contributions après l’actualisation et enregistrer `contribuer.html` avec l’agenda et le catalogue. Le menu et le sitemap doivent inclure `contribuer.html`.

Commandes utiles :

```bash
node scripts/contributions.mjs --dry-run       # lecture seule
node scripts/contributions.mjs --catalogue-only # met à jour seulement contribuer.html
node --test tests/contributions.test.mjs
BROWSER_EXECUTABLE=/usr/bin/chromium /workspace/.cloud-environment-venv/bin/python tests/contributions.py -q
```

Les tests couvrent le contexte et les URL forgées, les injections de texte/en-têtes, les droits photo et le changement de mode, les messages longs, les liens HTML sans JavaScript, la stabilité du générateur et l’affichage mobile. Aucun essai n’ouvre une messagerie ni n’envoie de courriel. La réception réelle reste donc à constater lors d’une contribution volontaire.
