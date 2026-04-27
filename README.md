# Fiche personnage dark fantasy

Prototype React / Vite mobile-first pour créer et éditer une fiche personnage.

## Installation

```bash
npm install
npm run server
npm run dev
```

## Déploiement Docker

```bash
docker build -t fiche-personnage .
docker run -p 5174:5174 -v fiche-data:/app/data -v fiche-uploads:/app/uploads fiche-personnage
```

L'application est ensuite disponible sur `http://localhost:5174`.

## Nettoyage des images

```bash
npm run cleanup:images:dry-run
npm run cleanup:images
```

Le script supprime les fichiers de `uploads/` qui ne sont référencés par aucun portrait de personnage.

## Fonctionnalités actuelles

- Champs de personnage modifiables.
- Répartition interactive des 7 stats.
- Calcul automatique des modificateurs.
- PV actuels et CHANCE actuelle modifiables.
- Armure éditable avec réduction fixe.
- Armes et sorts éditables avec dé, stat utilisée et mod affiché.
- Blessures graves et notes.
- Sélection de personnage.
- Sauvegarde automatique côté serveur.
- Upload de portrait stocké dans `uploads/`.
