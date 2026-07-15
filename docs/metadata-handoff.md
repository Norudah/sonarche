# Handoff — Automatisation des métadonnées (Sonarche)

## Objectif
Remplir automatiquement les métadonnées d'un morceau téléchargé (album, année, n° de piste, genre, pochette) via beets + MusicBrainz. C'est « le cœur de Sonarche ». Aujourd'hui les fichiers arrivent quasi nus (titre + artiste YouTube seulement).

## Stack concernée
- **beets 2.12** dans un venv app-owned : `~/Library/Application Support/com.rpierucci.sonarche/venv/`
- Config beets générée par Rust : `src-tauri/src/python_env.rs` → `write_beets_config()`, écrite dans `~/Library/Application Support/com.rpierucci.sonarche/beets/config.yaml` (réécrite à chaque lancement).
- Sidecar Python (stdio/NDJSON) : `sidecar/` — handlers dans `main.py` (`download`, `import`, `library_list`, `library_remove`).
- Bibliothèque audio : `~/Music/Sonarche/`. Fichiers de test présents : Metallica – Nothing Else Matters, Scattle – Knock Knock, Skillet – Monster.

## Diagnostic (prouvé, pas supposé)

1. **Bug racine — MusicBrainz était débranché.** Dans beets 2.12, MusicBrainz n'est plus core, c'est un **plugin** activé par défaut (`plugins: [musicbrainz]`). Notre config le remplaçait par `plugins: fetchart embedart`, **écrasant** la liste → aucune source de métadonnées → 0 candidat → tout retombait en `asis` (import « tel quel »). `fetchart` (pochette) était donc inutile aussi (il a besoin d'un ID release MB).
   - **Correctif (fait, NON committé)** dans `python_env.rs` : `plugins: musicbrainz fetchart embedart`. Vérifié : passe de **0 → 5 candidats**.

2. **Mauvais mode d'import.** L'import fait `beet import --quiet` en mode **album** sur un fichier **seul** → beets compare 1 titre à des albums entiers → score ridicule (ex. « Zippy Kid 17 % »). En mode **singleton**, il trouve le bon artiste/titre (Metallica 75 %), **mais** MusicBrainz renvoie un « enregistrement » nu : **pas d'album/année/n° piste/pochette**.

3. **Chaîne complète qui donne les infos riches** (validée sur Metallica) :
   `autotag.tag_item(item)` → `track_id` (recording) → `plugin.mb_api.get_recording(id, includes=["releases"])` → choisir une release → `plugin.album_for_id(release_id)` → `AlbumInfo` (album, année, label, tracklist) → retrouver notre piste (n°/total). **Pochette** : `https://coverartarchive.org/release/{release_id}/front`.

4. **Problème de classement (le vrai mur).** La recherche **texte** classe mal : pour « Nothing Else Matters » elle remonte des versions live / une reprise ukulélé avant le studio. → nécessite l'**empreinte acoustique** (AcoustID) pour mettre la bonne version en tête, ET/OU laisser l'utilisateur choisir parmi des propositions.

5. **Genre** : jamais fourni par MB core → nécessite le plugin **`lastgenre`** (Last.fm). Toujours vide aujourd'hui.

6. **Invariant non respecté** : `fpcalc` (empreinte) et `ffmpeg` ne sont **pas** bundlés (seul `../sidecar` est une resource Tauri). Requis pour activer le plugin `chroma` (AcoustID).

## État du code

**Committé (`develop`)** :
- `2eb7609` — drawer d'inspection métadonnées (lecture seule + bouton « Modifier » UI, **aucune** écriture beets). Bandeau « Correspondance MusicBrainz » = décor non fonctionnel.
- `44e559f` — suppression d'un morceau (corbeille + modale de confirmation, `library_remove` via API beets, supprime aussi le fichier). Outil de test, indépendant.

**NON committé, en sommeil (à reprendre)** :
- `src-tauri/src/python_env.rs` — réactivation de `musicbrainz` (**brique 1**).
- `sidecar/metadata.py` — **brique 2a** : handler `handle(request_id, {artist, title, length})` qui renvoie `{candidates: [...]}`, chaque candidat = `{title, artist, album, year, track, track_total, album_type, label, cover_url, recording_id, release_id, match}`. Testé en isolation (4 propositions riches sur Metallica). **Non branché** dans `main.py`, ne gêne rien.

## Plan (une brique à la fois, chacune vérifiable)

Décisions structurantes (2026-07-14) :
- L'onglet téléchargement devient une **file d'attente / historique** (tableau : nom, état téléchargement, type single/album, complétion métadonnées en %). L'historique survit au redémarrage (JSON en app data, côté Rust).
- **Auto-import** : plus de bouton « Importer ». Pipeline par job : `download → import beets → rapport métadonnées`.
- **Sidecar stateless** (une étape pure par handler), **Rust possède la file séquentielle** et la machine à états `queued → downloading → importing → enriching → done | failed(étape)`, événements `job_updated`. Re-trigger = ré-enfiler uniquement l'étape ratée. Anti-spam par construction (file séquentielle + rate-limiters autour des appels réseau : MB 1 req/s, AcoustID 3 req/s).
- **AcoustID en tête de chaîne, pas en fallback** (la recherche texte classe mal : live/reprises devant le studio). Fallback : recherche texte MB, puis Discogs/édition manuelle.

Briques :
- **Brique 1** — committer la réactivation `musicbrainz` (python_env.rs). Effet : MB de nouveau interrogé.
- **Brique 2** — file de jobs Rust + tableau file d'attente/historique + auto-import.
- **Brique 3** — rapport d'import : `importer.py` relit l'item après import (champs beets : `mb_trackid`, `artpath`, `year`…) et renvoie un rapport structuré → % de complétion (jeux de champs différents singleton vs album).
- **Brique 4** — bundler `fpcalc` + `ffmpeg` (chemin absolu), clé API AcoustID, plugins `chroma` + `lastgenre`. L'empreinte classe la bonne version en n°1.
- **Brique 5** — mode album : détection playlist avant téléchargement (`extract_info(process=False)`, albums YT Music = playlists `OLAK5uy_…`), téléchargements séquentiels (`sleep_interval`), import beets en mode album (une release couvre tout l'album → peu d'appels MB).
- **Brique 6 (fallback manuel)** — propositions cliquables dans le drawer via `metadata_candidates` + application du choix (écriture API beets : `store()` + `write()`, invalider TanStack Query). ⚠️ 2e « écrivain » de la lib en plus de l'importeur.

## Notes utiles
- **Tester sans re-télécharger** : beets travaille sur les fichiers locaux. On peut re-scanner un morceau déjà présent (fonctionnalité « re-scan » évoquée, pas encore demandée).
- **Contraintes MB** : rate-limit ~1 req/s (le handler 2a fait plusieurs appels → prévoir spinner) ; gérer offline/timeout.
- **Piège vécu** : `item.genre` lève « no such field » sur beets 2.12 → utiliser `item.get("genre")`.
- Après modif de config/sidecar, **relancer `tauri dev`** (sidecar recopié en resource).
- Souhait utilisateur explicite : **que ça devine tout seul** (→ priorité à l'empreinte acoustique, brique 3).
