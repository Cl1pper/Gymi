# 70 → 76 — déploiement sur Vercel

## Ce que contient le projet

    index.html            l'app
    sw.js                 cache hors ligne
    vercel.json           relais Open Food Facts (/off, /offs) + délai de la fonction photo
    package.json          dépendance du SDK Anthropic
    api/analyze-plate.js  fonction serveur du scan d'assiette

Tout doit être à la **racine** du projet Vercel. Le dossier `api/` y est détecté automatiquement.

## Variables d'environnement (une seule fois)

Vercel → ton projet → Settings → Environment Variables :

- `ANTHROPIC_API_KEY` = ta clé (https://console.anthropic.com)
- `PLATE_SCAN_KEY` = un code de ton choix (optionnel, mais conseillé : sans lui,
  quiconque trouve l'URL peut utiliser ton crédit). L'app le demande au premier scan.

Les variables ne sont prises en compte qu'au **déploiement suivant** : redéploie après les avoir ajoutées.

## Déployer

Par GitHub : remplace les fichiers du dépôt par ceux-ci, commit, push. Vercel redéploie seul.

Ou en ligne de commande, depuis ce dossier :

    npx vercel --prod

## Coût

Une analyse = environ 3 à 7 centimes avec Claude Opus 5.
