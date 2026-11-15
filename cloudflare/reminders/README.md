# Rappels Web Push · GROS PÉTARD — Nutrition

La page **Plus → Mes rappels** propose une activation par appareil, un test Web Push et sept horaires indépendants. L’application transmet l’abonnement du navigateur, les horaires et le fuseau. Le journal, les aliments et les mesures restent dans le navigateur.

## Vérification locale

Depuis ce dossier, avec Node.js 22.12 ou plus récent.

```sh
npm ci
npm test
npm run check
npm run dev
```

`GET /status` vérifie la présence du binding `RAPPELS_KV`. Wrangler émule le stockage KV pendant `npm run dev`. La commande `check` vérifie la compilation en mode simulation.

## Configuration de la recette

1. Dans **Workers & Pages**, créer le Worker `gros-petard-rappels-recette` via GitHub. Sélectionner le dépôt `Chriskess-ctrl/gros-petard-nutrition`, la branche `feat/samsung-push-reminders-2026-11-15` et le dossier `cloudflare/reminders`. Utiliser `npm test` comme commande de build et `npx wrangler deploy` comme commande de déploiement. Le fichier `wrangler.toml` associe déjà le binding `RAPPELS_KV` à l’espace de stockage de recette.
2. Préparer des valeurs distinctes pour la recette dans le gestionnaire de secrets. Pour le relais et le code d’activation, générer chacun 32 octets aléatoires encodés en Base64URL sans remplissage. Générer la paire VAPID avec `npm exec -- web-push generate-vapid-keys --json`.
3. Renseigner les secrets du Worker de recette dans **Settings → Variables and Secrets**. Pour un déploiement avec Wrangler, `npm exec -- wrangler deploy --secrets-file .dev.vars.recette` publie la recette avec ses secrets et son déclencheur minute.
4. Dans Vercel, renseigner `REMINDERS_WORKER_URL` avec l’URL HTTPS du Worker de recette et `REMINDERS_RELAY_TOKEN` avec la même valeur que sur Cloudflare. Cibler l’environnement **Preview** et la branche `feat/samsung-push-reminders-2026-11-15`, puis créer un nouvel aperçu de cette branche.
5. Ouvrir l’aperçu dans Chrome sur le Samsung. Dans **Plus → Mes rappels**, saisir le code d’activation, autoriser les notifications, envoyer un test, puis vérifier un rappel planifié avec l’application fermée. Tester aussi **Désactiver sur cet appareil**.

| Variable du Worker | Valeur |
| --- | --- |
| `VAPID_PUBLIC_KEY` | Clé publique de la paire VAPID |
| `VAPID_PRIVATE_KEY` | Clé privée de la même paire |
| `VAPID_SUBJECT` | URL HTTPS ou adresse de contact au format `mailto:` |
| `REMINDERS_RELAY_TOKEN` | Secret partagé par le Worker et le relais Vercel |
| `PAIRING_CODE_SHA256` | Empreinte SHA-256 hexadécimale minuscule du code, calculée sur le texte Base64URL |

Conserver la clé privée VAPID, le secret du relais et le code d’activation dans un gestionnaire de secrets. Le code d’activation est saisi dans l’application sur chaque nouvel appareil. Cinq appareils peuvent être inscrits en même temps. Une rotation de la paire VAPID impose un nouvel abonnement du navigateur.

## Programmation

Cloudflare appelle le Worker chaque minute en UTC. Le Worker calcule l’heure locale dans le fuseau enregistré par l’appareil. Un jour du mois absent se rabat sur le dernier jour du mois. Une heure sautée au printemps se déclenche à la première minute valide. À l’automne, un rappel accepté est compté une seule fois par date locale. Les échecs temporaires peuvent être retentés sur les quatre minutes suivantes.

Le binding KV conserve les abonnements et horaires. Le Durable Object SQLite coordonne les modifications, les désactivations et les envois concurrents. Le relais Vercel authentifie ses appels au Worker. Un jeton distinct est nécessaire pour modifier ou désactiver un appareil. Le Worker accepte les abonnements Chrome utilisant le service Push de Google.

La mise en service de `gros-petard-rappels` et de l’application publique requiert la validation de la recette sur le Samsung.

## Déploiement de recette Vercel

Le projet Vercel isolé `gros-petard-rappels-recette-web` reçoit les déploiements Preview de la branche `feat/samsung-push-reminders-2026-11-15`. Les variables `REMINDERS_WORKER_URL` et `REMINDERS_RELAY_TOKEN` sont limitées à cette branche et à Preview. Aucun déploiement de cette branche ne doit remplacer l'application publique.
