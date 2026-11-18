# GROS PÉTARD — Nutrition V2 · Plan ergonomique mobile validé
Date : 2026-11-09
Statut : architecture fonctionnelle approuvée ; développement fonctionnel non commencé.

## Principe
Application PWA installable sur Samsung Android, pensée d'abord pour une largeur de 360–430 px. Un seul écran principal visible à la fois, navigation persistante en bas, aucun défilement horizontal, aucun écran d'accueil interminable. Les cinq entrées principales sont Accueil, Journal, Menus, Suivi, Plus. Le contenu de chaque entrée peut défiler verticalement ; le menu reste accessible.

## 1. Accueil
- En-tête discret « GROS PÉTARD ».
- Sélecteur de date (précédent / calendrier / suivant / aujourd'hui).
- Résumé calories consommées/restantes et protéines, glucides, lipides, avec objectifs personnalisables.
- Cinq lignes de repas avec kcal et accès direct à l'édition : Petit-déjeuner, Collation matin, Déjeuner, Collation après-midi, Dîner.
- Indication explicite de journée complète ou incomplète ; ne jamais assimiler une journée absente à 0 kcal.
- Accès rapide à la saisie et aux pesées ; pas de duplication du journal détaillé.

## 2. Journal
- Date synchronisée avec l'Accueil.
- Les cinq catégories de repas restent visibles même vides.
- Toucher un repas ouvre sa fiche ; recherche d'aliment, quantité, édition, suppression, favori.
- Ajout rapide sans traverser plusieurs pages, confirmation d'enregistrement, retour à la même date.
- Conserver les données complémentaires existantes (faim, activité, notes) via un accès secondaire sans encombrer l'écran principal.

## 3. Menus
- Préparer une date future ; vues jour / semaine / mois.
- Copier un repas ou une journée, utiliser les favoris, ajuster les quantités.
- Distinguer repas prévus et consommés pour éviter de fausser les statistiques.

## 4. Suivi
- Sous-onglets Poids et Mensurations.
- Saisie datée et correction des valeurs existantes.
- Poids : courbe, moyennes sur 7, 15, 30 jours et comparaison à la période précédente de même longueur ; exclure les dates sans pesée.
- Mensurations : taille, hanches, fessiers, cuisses, poitrine et champs existants ; courbe par mesure ; comparaison entre deux dates sélectionnées et différence signée.
- Graphiques lisibles sur 360 px, période et unité explicites.

## 5. Plus
- Bibliothèque d'aliments et favoris.
- Statistiques : moyennes kcal/macros sur 7, 15, 30 jours, seulement les journées explicitement complètes ; nombre de journées incluses affiché ; comparaison des périodes.
- Objectifs, unités, paramètres.
- Sauvegarde/export JSON et restauration/import avec validation avant remplacement, avertissement de sauvegarde préalable.

## Règles transversales
- Cibles tactiles d'au moins 44 × 44 px ; textes lisibles ; contrastes vérifiés ; clavier numérique pour poids et quantités.
- Barre du bas fixe, compatible avec les zones sûres Android et clavier ouvert ; pas de double menu.
- Les actions destructrices nécessitent confirmation.
- Dates locales sans décalage de fuseau ; distinguer absence de donnée et valeur zéro.
- Ne pas modifier les cibles nutritionnelles de l'utilisatrice.
- L'habillage (vert forêt, pêche, crème, icônes) vient après validation des maquettes fonctionnelles.

## Parcours de recette n°1 (prioritaire)
1. Ouvrir l'app sur Samsung : Accueil, date du jour et résumé.
2. Choisir une autre date : les totaux et les cinq repas suivent cette date.
3. Toucher « Collation matin », chercher un aliment, saisir la quantité et enregistrer.
4. Revenir à l'Accueil : ligne de repas et macros mis à jour sans doublon.
5. Modifier/supprimer l'aliment, contrôler les recalculs.
6. Marquer la journée complète ; vérifier son inclusion dans les statistiques.
7. Fermer et rouvrir la PWA ; vérifier la persistance.

## Préservation des données et déploiement
- L'application actuelle Nutrition LITE est publiée sur gros-petard-nutrition-lite.easymesa16.chatgpt.site et reste inchangée.
- Le dépôt GitHub Chriskess-ctrl/gros-petard-nutrition contient une application distincte « Nutrition & Silhouette » : ne PAS supposer qu'il est le code source de Nutrition LITE.
- Ne pas publier sur main, remplacer la PWA actuelle ni supprimer les données avant récupération du code et test d'une sauvegarde JSON de Nutrition LITE.
- GitHub Pages sera la cible de publication d'une nouvelle PWA, après validation du code et des migrations ; le stockage de l'ancien domaine ne sera pas transféré automatiquement.
- Aucun fichier de données personnelles JSON ne doit être commité.
