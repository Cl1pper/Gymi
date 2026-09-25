# 70 → 76 — déploiement sur Vercel

## Ce que contient le projet

    index.html            l'app
    sw.js                 cache hors ligne
    vercel.json           relais Open Food Facts (/off, /offs) + délai de la fonction photo
    package.json          configuration du projet (aucune dépendance à installer)
    api/analyze-plate.js  fonction serveur du scan d'assiette (Google Gemini, gratuit)

Tout doit être à la **racine** du dépôt GitHub.

## Clé Gemini gratuite (une seule fois)

1. Va sur https://aistudio.google.com avec ton compte Google
2. Clique « Get API key » puis « Create API key »
3. Copie la clé (elle commence par AIza…)

Aucune carte bancaire. L'offre gratuite limite le nombre d'analyses par minute
et par jour : largement assez pour tes repas. En contrepartie, Google peut
utiliser les photos envoyées pour améliorer ses modèles.

## Variables d'environnement

Vercel → ton projet → Settings → Environment Variables :

- `GEMINI_API_KEY` = la clé AIza…
- `PLATE_SCAN_KEY` = ton code d'accès (optionnel, conseillé)

Puis Deployments → ⋯ sur le dernier → Redeploy.
Si tu avais mis `ANTHROPIC_API_KEY`, tu peux la supprimer : elle ne sert plus.
