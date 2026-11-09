# Audit initial — refonte GROS PÉTARD Nutrition (09/11/2026)

## État vérifié
- Dépôt : Chriskess-ctrl/gros-petard-nutrition, branche principale main ; travail isolé sur work/refonte-ergonomie-nutrition-2026-11-09.
- Code inspecté : README.md, index.html, app.js, core.js, reports.js, storage.js, style.css.
- Application statique HTML/CSS/JS, PWA sans backend de données.
- Stockage : IndexedDB nommé selon le chemin de l'application, secours localStorage ; sauvegarde JSON V2 et migration V1.
- Le calcul existant des moyennes nutritionnelles n'inclut que les journées explicitement complètes ; les pesées absentes ne valent pas zéro.
- Des champs de mensurations existent : poids, taille, hanches, fessiers, cuisse, poitrine, bras.
- Des courbes et des moyennes hebdomadaires de poids existent déjà.

## Point bloquant avant refonte du code
Les captures Android du 09/11 montrent une interface verte/pêche avec cinq onglets « Aujourd'hui / Journal / Aliments / Silhouette / Rapports » et un bandeau permanent 1700 kcal. Or le code de la branche main inspecté présente une autre interface prune/rose, « Nutrition & Silhouette », et des pages « Mes repas », « Mes sensations », etc. Il faut déterminer si le téléphone exécute un autre dépôt, une autre branche, un déploiement différent ou une version en cache avant de modifier l'interface. Ne pas supposer que ce dépôt est le code exact de la PWA actuellement installée.

## Besoins validés
1. Deux collations distinctes : matin et après-midi, sans perdre les anciens repas.
2. Écrans compacts accessibles par menu, pas une page interminable ; suppression des doublons.
3. Moyennes calories et poids sur 7, 15, 30 jours, et périodes précédentes ; historique de comparaison.
4. Mensurations saisissables par date ; courbes et écarts signés entre deux dates sélectionnées (kg et cm).
5. Afficher la couverture des données et distinguer jours incomplets, jours non renseignés et dates futures.
6. Préserver JSON, stockage local, installation Android et mode hors ligne.

## Architecture proposée (à confirmer après identification de la version installée)
- Aujourd'hui : résumé compact, 5 repas et saisie rapide.
- Menus : journal par date, planification et duplication.
- Progrès : poids, mensurations, courbes, comparaison des périodes et dates.
- Aliments : recherche, favoris, création et édition.
- Réglages / données : objectifs, export/import JSON, vérification de sauvegarde.

## Sécurité et recette
- Ne pas toucher à main ni publier la branche de travail.
- Ne pas importer de données personnelles JSON dans GitHub.
- Avant toute migration de schéma, tester sauvegarde/restauration et compatibilité rétroactive.
- Tester les calculs avec relevés manquants, les collations historiques, les dates limites, les écarts signés et l'affichage Samsung.
- Vérifier l'URL exacte de la PWA installée et la configuration GitHub Pages avant les changements fonctionnels.
