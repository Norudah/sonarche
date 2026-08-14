# Le changelog présentable

`CHANGELOG.md`, à la racine, est généré par release-please : un inventaire exhaustif, en anglais, une ligne par commit. Il ne bouge pas.

Ce dossier est l'autre moitié : les notes qu'on montre **dans l'app**, écrites à la main, dans la langue du lecteur, avec des captures quand une image va plus vite qu'un paragraphe. L'app les embarque au build, donc elles s'affichent hors-ligne et même quand on est déjà à jour (`Réglages → Mises à jour → Voir les nouveautés`).

## Écrire une version

Un fichier par version **et par langue**, nommé `<version>.<langue>.md` :

```
changelog/
  2.1.0.fr.md
  2.1.0.en.md
  media/
    2.1-index-rail.webp
```

Une version qui n'existe que dans une langue s'affiche quand même, dans celle-là — mieux qu'un trou dans l'historique.

## Le format

```md
---
date: 2026-08-14
---

# Le titre de la version

Un paragraphe d'intro. On peut **appuyer** un mot.

## Une section

De la prose, puis une capture :

![Ce que montre l'image](media/2.1-index-rail.webp)

- une puce
- une autre
```

Ce qui est lu, et rien d'autre : `date` en front matter, le `#` comme titre, les `##` comme sections, les paragraphes, les listes à puces, les images `![légende](media/…)`. Tout le reste est ignoré — pas de HTML, jamais.

Les images vivent dans `media/`, en `.webp`, redimensionnées avant d'être commitées : elles partent dans le binaire de l'app. Le texte du `![…]` sert de légende, alors il s'écrit comme une phrase.

## Quand

Sur la Release PR, avant de la merger — au même moment que la section `### En bref` du corps de la release. Les deux disent la même chose : `En bref` argumente l'installation depuis la fenêtre de mise à jour, ce fichier raconte la version une fois installée.
