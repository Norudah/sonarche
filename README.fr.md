<div align="center">

<img src="docs/brand/sonarche-tile-1024.png" alt="Sonarche" width="168" height="168">

# Sonarche

**From the stream into the Ark.**

Une bibliothèque musicale de bureau qui range, tague et joue ta collection — et
la garde en fichiers bien à toi, longtemps après la disparition de l'application
qui les a produits.

[![Version](https://img.shields.io/badge/version-0.9.1-6163f2)](CHANGELOG.md)
[![Plateformes](https://img.shields.io/badge/plateformes-macOS%20%7C%20Windows-6163f2)](#installation)
[![Licence](https://img.shields.io/badge/licence-MIT-6163f2)](LICENSE)

[English](README.md) · **Français**

</div>

---

## Pourquoi ça existe

Les services de streaming te prêtent de la musique. Un dossier de fichiers
tagués, lui, est à toi.

Sonarche sert à garder la seconde : il prend un tas de fichiers audio — peu
importe d'où ils viennent —, les identifie en les écoutant, écrit de vrais tags,
les range dans une arborescence propre, et te donne un lecteur et un explorateur
par-dessus. Dessous, il y a [beets](https://beets.io), la référence en gestion de
bibliothèque, dont l'index SQLite fait foi. Rien n'est enfermé : pointe un autre
lecteur sur le même dossier demain, tout fonctionne encore.

## Ce qu'il fait

**Il identifie les morceaux à l'oreille, pas au nom de fichier.** Chaque fichier
est empreinté avec [Chromaprint](https://acoustid.org/chromaprint), interrogé
auprès d'[AcoustID](https://acoustid.org), puis résolu vers une sortie
[MusicBrainz](https://musicbrainz.org). Un fichier appelé `audio_04_final.m4a`
ressort avec son vrai titre, son artiste, son album, son année et son numéro de
piste. Là où l'empreinte ne trouve rien, l'application le dit au lieu de deviner
en silence.

**Il range tout dans une seule arborescence.** Les albums atterrissent en
`Artiste/Album/01 Titre.m4a`, avec une pochette de 500 px à côté pour
l'affichage et l'originale archivée juste à côté. Toute la bibliothèque se
déplace sur un autre disque en un clic, index compris.

**Il donne cinq entrées dans la collection.** Morceaux, albums, artistes, genres
et tes propres catégories (Film, Jeux vidéo, …), toutes virtualisées pour qu'une
bibliothèque de plusieurs milliers de titres défile à pleine vitesse.

**Il lit en natif.** Un moteur audio en Rust — pas une balise `<audio>` dans une
webview — avec file d'attente, lecture aléatoire, répétition, enchaînement sans
blanc, paroles synchronisées, et une vraie intégration aux touches média et au
centre de contrôle du système.

**Il te dit ce qui cloche.** Une page Métadonnées trie la bibliothèque : ce qui
n'est pas tagué, ce qui a l'air douteux, ce que l'empreinte contredit — avec un
chemin en un clic vers chaque cas.

**Il importe ce que tu as déjà.** Pointe-le sur quinze ans de dossiers : il
analyse, rend compte de ce qu'il a trouvé, copie (jamais ne déplace) et enrichit
sur place. Tout ce qu'il va chercher dehors est cadencé par des limites que tu
règles toi-même.

Ajouter un morceau depuis un lien web est l'une des façons d'entrer, à côté de
l'import de fichiers que tu possèdes déjà.

<!-- TODO: la même capture que le README anglais, une fois prise. -->

## Installation

Récupère la version qui correspond à ta machine dans la
[dernière release](https://github.com/Norudah/sonarche/releases/latest).

| Machine                    | Fichier                        |
| -------------------------- | ------------------------------ |
| Mac, Apple Silicon (M1–M4) | `Sonarche_x.y.z_aarch64.dmg`   |
| Mac, Intel                 | `Sonarche_x.y.z_x64.dmg`       |
| Windows 10/11, 64 bits     | `Sonarche_x.y.z_x64-setup.exe` |

Un doute sur ton Mac ? Tape `uname -m` — `arm64` c'est Apple Silicon, `x86_64`
c'est Intel. Windows sur ARM fait tourner la version x64 en émulation.

Les fichiers `.tar.gz` et `.sig` de la même release sont la tuyauterie du
système de mise à jour. Tu n'en as pas besoin.

Rien d'autre à installer : l'application embarque son propre Python et pose ses
outils dans un dossier qui lui appartient. Le Python de ton système n'est jamais
touché.

### Première ouverture sur macOS

Sonarche est signée, mais pas _notariée_ — la notarisation demande un compte
développeur Apple payant, et ce projet n'en a pas. Elle prouve qui a écrit un
programme, pas que ce programme est bon ; sans elle, macOS affiche un
avertissement à la première ouverture, et seulement à la première.

> **Ne clique pas sur le bouton bleu.** Il dit _Placer dans la corbeille_.

1. Ouvre Sonarche. macOS répond _« Apple n'a pas pu confirmer que "Sonarche" ne
   contenait pas de logiciel malveillant »_. Clique sur **Terminé**.
2. Ouvre **Réglages Système → Confidentialité et sécurité**, descends tout en
   bas, section **Sécurité**. Une ligne à propos de Sonarche t'y attend.
3. Clique sur **Ouvrir quand même**, authentifie-toi, puis **Ouvrir**.

Cette ligne disparaît environ une heure après la tentative d'ouverture. Si elle
n'y est pas, retente d'ouvrir l'application puis retourne dans les Réglages.

Tu ne reverras pas cet écran : les mises à jour suivantes sont écrites par le
système de mise à jour de l'application, qui ne pose pas d'attribut de
quarantaine.

<!-- TODO: le vrai dialogue Gatekeeper, macOS 15.6.1 — la capture du 2026-07-28. -->

### Première ouverture sur Windows

SmartScreen affiche _« Windows a protégé votre ordinateur »_ au premier
téléchargement, pour la même raison : l'installeur n'est pas signé par un
certificat payant. Clique sur **Informations complémentaires → Exécuter quand
même**.

L'installation se fait pour ton compte utilisateur seul, donc il n'y a aucune
fenêtre UAC — ni à l'installation, ni aux mises à jour.

### Premier lancement

L'application s'ouvre sur un court parcours qui met son environnement en place :
elle déballe le Python embarqué, installe `yt-dlp` et `beets` dans un
environnement virtuel qui lui appartient, et demande une
[clé API AcoustID](https://acoustid.org/new-application) gratuite.

La clé est facultative et vivement recommandée — sans elle, les pistes sont
taguées à partir des indices disponibles au lieu d'être identifiées. Elle est
rangée dans le trousseau du système, jamais dans un fichier de configuration, et
n'atteint plus jamais l'interface une fois enregistrée.

Le premier lancement prend une quinzaine de secondes et n'a besoin d'aucune
connexion : les roues Python voyagent dans le bundle.

## Comment ça marche

```
┌──────────────────────────────────────────────┐
│  Webview React + HeroUI                      │  ce que tu vois
└───────────────┬──────────────────────────────┘
                │  IPC Tauri (commandes typées, événements)
┌───────────────┴──────────────────────────────┐
│  Cœur Rust                                   │  moteur audio, travaux,
│  rodio · rusqlite · keyring                  │  historique, intégration OS
└───────────────┬──────────────────────────────┘
                │  un canal stdio, NDJSON, une requête par ligne
┌───────────────┴──────────────────────────────┐
│  Sidecar Python (venv de l'app)              │  yt-dlp, beets,
│  yt-dlp · beets · mutagen · Pillow           │  MusicBrainz, AcoustID
└───────────────┬──────────────────────────────┘
                │
        ┌───────┴─────────┐
        │ bibliothèque    │  fichiers audio + index SQLite
        │ beets (à toi)   │  ← la source de vérité
        └─────────────────┘
```

Quelques règles que le code tient :

- **La bibliothèque beets fait foi.** L'application lit son index SQLite et ne
  l'écrit jamais directement — toute écriture passe par beets lui-même.
- **Le Python du système n'est jamais touché.** Toute installation se fait dans
  un environnement virtuel qui appartient à l'application, depuis des roues
  épinglées dans un fichier de verrouillage.
- **Aucun ré-encodage avec perte.** Un flux AAC natif est gardé tel quel.
- **`stdout` ne transporte que du JSON de protocole.** Chaque ligne de log part
  sur `stderr`, puis dans un fichier tournant, parce qu'un processus graphique
  n'a pas de console sous Windows.
- **Le sidecar meurt avec l'application.** Son environnement est vérifié à
  chaque lancement, et reconstruit s'il est cassé.

### Formats pris en charge

La lecture et l'import couvrent `mp3`, `flac`, `m4a`, `m4b`, `mp4`, `aac`,
`ogg`, `wav`, `aiff`. Un `.ogg` qui porte de l'Opus plutôt que du Vorbis est le
seul cas que l'extension ne tranche pas ; il est signalé comme une erreur plutôt
qu'ignoré en silence.

### Où vivent les choses

|          | macOS                                                  | Windows                            |
| -------- | ------------------------------------------------------ | ---------------------------------- |
| Musique  | `~/Music/Sonarche`                                     | `%USERPROFILE%\Music\Sonarche`     |
| Données  | `~/Library/Application Support/com.rpierucci.sonarche` | `%APPDATA%\com.rpierucci.sonarche` |
| Journaux | `…/logs/sonarche.log`                                  | `…\logs\sonarche.log`              |

Le dossier de musique se déplace depuis **Paramètres → Bibliothèque** ; celui des
données de l'application, non. Tout ce qu'il contient est reconstructible — le
Python, l'environnement virtuel, l'historique des téléchargements — sauf l'index
beets, qui voyage avec la musique.

## Développement

Prérequis : Node 22 (voir `.nvmrc`), une chaîne d'outils Rust, et un Python 3.10+
sur le `PATH` pour lancer les tests du sidecar.

```bash
npm install
npm run tauri dev
```

`npm run tauri dev` récupère le Python embarqué au premier lancement
(`scripts/prepare-runtime.mjs`, ~24 Mo, mis en cache et gitignoré).

### Les commandes qui valident un changement

```bash
npm run lint && npx tsc --noEmit && npm test    # front
cd src-tauri && cargo clippy --all-targets && cargo fmt && cargo test
cd sidecar && python -m unittest discover -p "*_test.py"
npm run format                                  # prettier, 120 colonnes
```

Les trois suites doivent être vertes avant qu'un changement soit fini. La CI
lance exactement ces commandes sur la pull request de release.

### Prévisualiser l'interface sans backend

La webview tourne dans un navigateur ordinaire contre une couche IPC simulée —
pratique pour le travail de design, et le seul moyen d'atteindre un écran dont
l'état réel est difficile à reproduire :

```bash
npm run dev
```

puis `http://localhost:1420/?mockTauri`. Quelques paramètres l'accompagnent :
`&route=/library/albums` ouvre directement une vue imbriquée, `&onboarding=1`
force le parcours d'installation, `&update` affiche l'invite de mise à jour,
`&splash=3000` maintient l'écran de lancement assez longtemps pour le regarder.

### Organisation

```
src/                 application React
  app/               coquille : routage, layout, providers, jetons de design
  features/<domaine>/ UI métier, hooks, appels IPC, traductions
  shared/            briques réutilisables et agnostiques (lecteur, motion, ui)
src-tauri/src/       cœur Rust — un module par sujet
sidecar/             sidecar Python ; *_test.py à côté de chaque module
scripts/             outillage de build (Python embarqué, contrôle du lock)
docs/                identité visuelle
```

`shared` n'importe rien du niveau application, `features` peut importer
`shared`, `app` importe les deux. Aucun import entre features. Tout passe par
l'alias `@/`.

### Releases

Les versions sont gérées par
[release-please](https://github.com/googleapis/release-please). Fusionner
`develop` dans `main` ouvre une pull request de release qui met à jour
`package.json`, `Cargo.toml` et `tauri.conf.json` ensemble et écrit
[`CHANGELOG.md`](CHANGELOG.md) ; fusionner _celle-là_ pose le tag et publie les
bundles. Ne jamais taguer à la main.

Les commits suivent les
[Conventional Commits](https://www.conventionalcommits.org/) : `type(scope):
sujet`, à l'impératif, sans point final.

## Construit sur

[beets](https://beets.io) · [yt-dlp](https://github.com/yt-dlp/yt-dlp) ·
[MusicBrainz](https://musicbrainz.org) · [AcoustID](https://acoustid.org) &
[Chromaprint](https://acoustid.org/chromaprint) ·
[Cover Art Archive](https://coverartarchive.org) · [LRCLIB](https://lrclib.net) ·
[Last.fm](https://www.last.fm) · [Tauri](https://tauri.app) ·
[HeroUI](https://www.heroui.com) · [rodio](https://github.com/RustAudio/rodio)

Sois gentil avec les services gratuits ci-dessus : les limites dans
**Paramètres → Limitations** existent pour que cette application reste un client
poli, et les baisser n'est pas une fonctionnalité.

## Licence

[MIT](LICENSE).

Sonarche est un outil à usage personnel, pour gérer de la musique que tu as le
droit de garder. Respecte les conditions des services avec lesquels tu l'utilises,
et le droit d'auteur du pays où tu vis.
