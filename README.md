# GROS PÉTARD — Nutrition & Silhouette

Version 2.0.0. Application personnelle en français, prévue pour Chrome Android et GitHub Pages. HTML, CSS et JavaScript statiques, sans compilation, sans compte et sans serveur de données.

## Publier après accord

Téléverser tous les fichiers de ce dossier au même niveau dans le dépôt de l’application Nutrition. Conserver les noms et extensions. Choisir **Settings → Pages → Deploy from a branch → main → /(root) → Save**. Les fichiers sont publics lorsque le dépôt et le site sont publics. Ne jamais ajouter un journal JSON, un export CSV, un PDF personnel ou les documents nutritionnels au dépôt.

Ouvrir ensuite l’URL HTTPS indiquée par GitHub Pages dans Chrome Android. Dans le menu ⋮, choisir **Installer et créer un raccourci → Installer** ; selon la version de Chrome, le menu peut afficher **Ajouter à l’écran d’accueil**. Le bouton d’installation de l’application utilise l’invite native quand Chrome la propose.

## Fonctions

- Journal de faim à toute heure, de 0 à 10, avec sensations physiques, émotions, contexte et notes.
- Repas et collations avec plusieurs aliments, calories, protéines, glucides et lipides ; édition et suppression.
- 58 références génériques, recherche et familles ; états cru/cuit/égoutté explicites ; aliments personnalisés avec étiquette pour 100 g ou 100 ml ; portions en g, ml ou unités définies.
- Repas favoris dont les quantités peuvent être modifiées avant enregistrement.
- Sept mesures possibles, dont le poids, une fiche par date, courbes et moyennes du lundi au dimanche.
- Activités sportives et journées sans séance explicitement renseignées.
- Analyses descriptives par période : repas/faim, horaires, contexte, sport, satiété et suivi par semaine. Aucun ajustement automatique d’objectif.
- Vrai PDF A4 paginé et option d’impression ; détail du journal facultatif ; génération sur l’appareil avec pdf-lib local.
- Sauvegarde/restauration JSON V2 ; restauration d’une sauvegarde V1 ; validation des contenus avant remplacement ; export CSV.

## Repères nutritionnels et confidentialité

L’application n’impose aucun objectif. Les repères chiffrés facultatifs se modifient dans les réglages. Les valeurs alimentaires sont des estimations de la V1 et des repères génériques. L’étiquette du produit est prioritaire. Aucune conversion universelle entre poids cru et cuit n’est appliquée. Les idées de repas et la place des collations s’appuient sur les guides et menus fournis, sans reproduire de données privées ni convertir leur contenu en prescriptions.

Les journées alimentaires complètes doivent être marquées volontairement. Elles seules entrent dans les moyennes alimentaires ; les dates absentes ne deviennent pas des journées à zéro calorie. Les pesées manquantes sont exclues des moyennes de poids. Le bilan ne mesure ni la graisse ni la masse musculaire et ne démontre pas de causalité.

Le journal est conservé dans IndexedDB sur le navigateur et à l’adresse de l’application ; un stockage local de secours est prévu. Il n’y a aucun envoi de journal, formulaire ou rapport à GitHub ou à un autre serveur. Aucune police distante, publicité ni service d’analyse. Les seuls accès réseau sont ceux nécessaires pour obtenir ou mettre à jour les fichiers publics de l’application. Les données ne sont pas chiffrées sur le téléphone ; une personne ayant accès à ce navigateur peut les consulter. Les sauvegardes et rapports téléchargés sont privés et doivent être gardés hors du dépôt public.

## Passer de la V1 à la V2

1. Télécharger d’abord une sauvegarde JSON depuis la V1.
2. Remplacer les fichiers au même emplacement GitHub, en gardant le nom du dépôt et son adresse.
3. Ouvrir avec le même navigateur et le même appareil. Accepter le message de nouvelle version si nécessaire.
4. Le journal `gp-nutrition-v1` est repris automatiquement si aucun journal V2 n’existe à cette adresse. Les aliments notés à même date, heure et type sont groupés en repas. Pour les mesures en double à une date, les valeurs les plus récemment saisies de chaque mesure sont conservées. Les anciens repères restent modifiables.
5. Si l’adresse, l’appareil ou le navigateur change, restaurer le JSON V1 via **Bilan → Mes données**.

La copie locale V1 est gardée pour permettre un retour en arrière. Le bouton d’effacement complet supprime aussi cette copie locale. Ne pas effacer les données Chrome pour rafraîchir l’icône ou mettre à jour le code.

## Vérifications et limites connues

15 contrôles automatiques réussis sur les calculs, dates, moyennes, reprise V1, validation JSON, protection CSV, stockage de secours, conflits et logique du service worker. Ressources et dimensions des trois icônes vérifiées. Rapports PDF de contrôle rendus et inspectés, sans débordement des marges.

Le navigateur de test intégré n’a pas pu démarrer dans l’environnement de préparation. Les interactions en navigateur, IndexedDB réel, le rendu smartphone, l’installation et le fonctionnement hors ligne réel restent à confirmer dans Chrome Android après publication. Le code est responsive et le manifeste est préparé pour l’installation, mais cette limite de validation ne doit pas être confondue avec un test sur téléphone.

Les PDF directs utilisent les polices standard PDF : les accents français sont pris en charge. Certains emoji ou caractères d’autres alphabets sont remplacés par `[symbole]` dans le PDF uniquement ; le journal original les conserve. L’option d’impression Chrome peut conserver les caractères supportés par les polices de l’appareil.

## Fichiers

Conserver ensemble `index.html`, `style.css`, `app.js`, `core.js`, `storage.js`, `foods.js`, `reports.js`, `pdf-lib.min.js`, `manifest.webmanifest`, `sw.js` et les trois PNG. `LICENSE-pdf-lib.txt` contient la licence MIT de pdf-lib. Les chemins relatifs permettent l’utilisation dans un sous-dossier de GitHub Pages.

## Documentation officielle

- [Configurer GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Installer une application Web sur Android](https://support.google.com/chrome/answer/9658361?hl=fr&co=GENIE.Platform%3DAndroid)

Aucune publication n’est effectuée par la préparation de ce paquet.
