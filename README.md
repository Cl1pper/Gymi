# 70 → 76 — Coach de musculation et de nutrition

Version **8.0** · application web installable (PWA) · 100 % hors ligne · aucune donnée envoyée.

## Contenu du dossier

| Fichier | Rôle |
|---|---|
| `index.html` | L'application complète |
| `sw.js` | Fonctionnement hors ligne et mises à jour immédiates |
| `_redirects` | Relais Netlify vers Open Food Facts |

Les trois fichiers sont indispensables.

## Mise en production

1. Netlify → ton site → onglet **Deploys** → glisser ce dossier dans la zone de dépôt.
2. Sur l'iPhone : fermer complètement l'app puis la rouvrir.
3. Vérifier dans Réglages : « Version 8.0 ».

Toujours redéployer sur le **même site** : l'adresse conserve les données.

## Nouveautés de la 8.0

- **Programme automatique** — après le profil, un récap animé montre la semaine (full body, haut/bas ou push/pull/legs selon le nombre de séances) et une journée de repas adaptée à l'objectif. Un geste l'active : le bouton START suit ensuite le programme.
- **Journée type** dans l'onglet Manger, qui change avec le profil.
- **WorkoutX** — vraies démonstrations en GIF et catalogue de plus de 1 400 exercices à ajouter aux séances. La clé se saisit dans les Réglages et reste sur le téléphone ; elle n'est ni dans le code publié ni dans les sauvegardes.
- **Hébergement en pause** — si l'hébergeur coupe le site, l'app installée continue de s'ouvrir depuis son cache.

## Nouveautés de la 7.0

- **Profil adaptatif** — sexe, âge, taille, poids, objectif, niveau, séances par semaine ; taux de gras, poids visé et points faibles en option.
- **Dix personas** — chiffres clés, astuces, conseils par point faible, organisation recommandée.
- **Garde-fous** — pas de déficit sous 18 ans, déficit plafonné si déjà sec, jamais sous le métabolisme de base.
- **Programmes** — Full body (variantes A/B/C) ou ciblé par muscle, choisis selon l'objectif et le niveau.
- **Repas selon l'objectif** — denses en masse, rassasiants en sèche, riches en glucides en force.
- **Animations refaites** — tempo corrigé sur 15 exercices, phase affichée, trajectoire de la charge, muscles travaillés.
- **Haltères** — la charge se note par haltère, affichée « kg / haltère ».
- **Accueil plus sobre.**

## Contrôle qualité

- 200 tests fonctionnels automatisés.
- 5 profils très différents testés de bout en bout dans Chrome, repas des trois objectifs vérifiés.
- Saisie décimale française vérifiée sur 10 champs.
- Aucun débordement sur 5 tailles d'écran (320 à 1280 px).

## Limites connues

- Un seul profil par téléphone : chaque personne installe l'app sur son appareil.
- Taux de gras estimé à partir de l'IMC s'il n'est pas renseigné : approximatif chez les personnes musclées.
- L'impact glycémique est une estimation, pas une mesure.
- Pas de scan de code-barres par caméra (non supporté par Safari).
- WorkoutX gratuit : 500 requêtes par mois, GIF en 180 px avec filigrane. Les correspondances et les GIF sont mis en cache pour économiser le quota.
