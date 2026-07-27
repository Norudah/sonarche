# Marque Sonarche

Les règles de dessin sont dans `sonarche-brand.html` — ouvre-le dans un navigateur.
Ce fichier ne dit que comment refaire les fichiers.

## Les sources

| Fichier | Rôle |
| --- | --- |
| `sonarche-mark.svg` | La marque, grille 24. Miroir de `src/shared/ui/SonarcheMark.tsx` — les deux doivent rester identiques. |
| `sonarche-mark-small.svg` | Le jumeau simplifié, grille 16. Sous 32 px, les détails d'un pixel ne dessinent plus, ils salissent. |
| `sonarche-tile.svg` | La tuile système 1024, marque complète. |
| `sonarche-tile-small.svg` | La même tuile, jumeau dedans. Sert aux tailles 16 et 32. |
| `sonarche-tile-1024.png` | Rendu de `sonarche-tile.svg`. Ne sert qu'à alimenter `tauri icon`. |

## Refaire le jeu d'icônes

`tauri icon` ne sait pas changer de source selon la taille : il rééchantillonne
un seul PNG. Or à 32 px la marque complète se referme en boue. Le jeu est donc
assemblé en deux temps.

**1 — Le gros œuvre.** Rasteriser `sonarche-tile.svg` en 1024 et le passer à
`tauri icon`. Cela remplit tout : Windows, iOS, Android, et les gabarits macOS.

```bash
npx tauri icon docs/brand/sonarche-tile-1024.png
```

**2 — Les petites tailles.** Rasteriser chaque taille depuis le SVG plutôt que
de rééchantillonner le 1024 (le vectoriel rend plus net), en prenant
`sonarche-tile-small.svg` pour 16 et 32 et `sonarche-tile.svg` au-delà, puis
assembler l'`.icns` avec `iconutil` :

```bash
iconutil -c icns sonarche.iconset -o src-tauri/icons/icon.icns
```

Le `.iconset` mappe `icon_16x16` et `icon_16x16@2x` / `icon_32x32` sur le jumeau,
et tout le reste sur la marque complète. `src-tauri/icons/32x32.png`, référencé
par `tauri.conf.json`, prend lui aussi le jumeau.

## Ce qui reste sur la marque complète

`icon.ico` (Windows) est laissé tel que `tauri icon` le produit : il embarque
ses petites tailles depuis le 1024, sans le jumeau. À reprendre le jour où
Windows est une cible réelle.
