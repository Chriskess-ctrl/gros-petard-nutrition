# Prototype mobile — GROS PÉTARD Nutrition V2

**Statut : non publié, non testé sur Samsung.** Ce dossier est indépendant de l'application « Nutrition & Silhouette » située à la racine du dépôt et de l'application « Nutrition LITE » hébergée sur chatgpt.site.

## Fonctionnel
- Navigation fixe à cinq entrées, adaptée aux petits écrans.
- Accueil avec sélection de date, total calories/macros, cinq repas.
- Journal avec saisie, modification et suppression d'aliments et portions.
- Enregistrement local dans la clé dédiée `gp-nutrition-v2-ergonomic-prototype-only` pour éviter toute collision avec d'autres versions.
- Manifeste et service worker pour permettre l'installation PWA **après publication HTTPS et tests**.

## À développer avant remplacement
Bibliothèque d'aliments, menus futurs, suivi poids et mensurations, moyennes 7/15/30 jours, paramètres, migration/import du JSON de Nutrition LITE, validation de l'installation et du hors-ligne sur Android.

## Attention aux données
Le bouton « Exporter » sauvegarde **uniquement les données du prototype**. Il ne récupère ni ne restaure les données de Nutrition LITE. Aucun export personnel ne doit être ajouté au dépôt.

## Publication
Ne pas modifier `main` ni la publication actuelle pour tester ce dossier. Préparer une prévisualisation isolée avant de donner une URL d'installation.
