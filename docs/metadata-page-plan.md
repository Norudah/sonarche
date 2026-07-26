# Page Métadonnées — décisions de design et plan d'implémentation

> Doc de passation issu d'une session de critique des mocks Claude Design
> (2026-07-23). Self-contained : tout le contexte nécessaire est ici, les
> screenshots des mocks ne sont plus requis.

## Doctrine (actée, ne pas rejouer)

- La page Métadonnées est un **poste de triage, pas un rapport** : chaque
  chiffre affiché est une porte vers une liste filtrée. Un module qu'on ne
  peut que regarder n'a pas sa place.
- Pas de score de santé global. Le chiffre de tête est « N choses à
  corriger » ; **zéro est l'état gagnant** (état vide calme, carte verte,
  non cliquable).
- Complétion exprimée en comptes (« 1 227/1 248 »), le % réservé aux parts
  d'un tout.
- Ordre de construction : ① explorer filtrable par deep-link (prérequis
  absolu) ② agrégats côté front ③ la page ④ la provenance.

## Verdict sur les mocks Claude Design

4 variantes reçues (1a tuiles KPI, 1b deux colonnes, 1c compact, 1d état
zéro). Diagnostic : un rapport déguisé en poste de triage. Après coupes, le
choix de layout s'évapore — il reste une colonne.

### Coupé

- **Barre de provenance (Vérifié MB / Empreinte AcoustID / Manuel / Brut
  en barre 100 %)** : modèle faux. Les états ne sont pas exclusifs —
  l'empreinte AcoustID est le chemin vers les tags MusicBrainz, et « édité
  à la main » coexiste avec « vérifié MB ». La bonne représentation, plus
  tard, sera un **funnel cumulatif** (N morceaux → N empreintes → N
  vérifiées AcoustID → N taguées MB, chaque barre préfixe de la
  précédente) avec « édité à la main » en flag orthogonal hors funnel.
  Reporté après ④ : la donnée sidecar n'existe pas encore ; la page v1
  doit tenir sans.
- **Module « Pipeline — Juillet » (37 imports, 91 % match…)** : infaisable,
  pas seulement inutile. Les agrégats sont calculés côté front sur la liste
  TanStack Query chargée ; « 37 imports en juillet » exigerait un
  historique d'événements qui n'existe nulle part. Donnée inventée par le
  mock.
- **Tableau « Complétion par champ »** : doublon de la file de corrections
  (« Année manquante — 21 » = « Année 1 227/1 248 », même fait, même
  porte). Et des lignes mortes en permanence (« Titre 1 248/1 248 »). Si le
  dénominateur importe, le replier dans la ligne de correction
  (« 21 · sur 1 248 »).
- **Ligne « Anomalies » (année aberrante, casse à corriger, « feat. » dans
  le titre)** : un moteur de lint déguisé en ligne — heuristiques à faux
  positifs, items hétérogènes demandant des traitements différents. À
  réintroduire quand une règle fiable existera.
- **Tuiles KPI 1 248 / 118 / 74** : nav dupliquée de la sidebar, pas des
  portes utiles. Remplacées par une sous-ligne texte dans le header. Seule
  la pilule « N à corriger » compte.

### Gardé

- **File de corrections à 4 lignes** : année manquante, genre manquant ou
  hors arbre (fusion assumée : les deux se corrigent dans le même
  éditeur), pochette absente (albums), tracklist à trous (albums).
- **Exemples inline** sous chaque ligne (« Neon Slumber », « Half
  Light »…) : en texte simple, non cliquables individuellement en v1.
- **Répartition des genres** en tableau repliable sous la file (décision
  antérieure, inchangée).
- **État zéro façon mock 1d** : carte verte « Rien à corriger », file
  repliée en carte d'état calme non cliquable. Le meilleur écran des
  quatre.
- Le « N à corriger » de tête additionne morceaux et albums : assumé comme
  « N choses à corriger », pas un compte de morceaux.

## Contrat de filtres (la file = un contrat sur l'explorer)

Chaque ligne de la file est un query param que l'explorer doit supporter.
Vocabulaire :

| Ligne                 | Destination               |
| --------------------- | ------------------------- |
| Année manquante       | `/tracks?missing=year`    |
| Genre manquant        | `/tracks?genre=missing`   |
| Genre hors arbre      | `/tracks?genre=off-tree`  |
| Pochette absente      | `/albums?missing=artwork` |
| Tracklist à trous     | `/albums?tracklist=gaps`  |
| (réservé, provenance) | `/tracks?provenance=raw`  |

- `?genre=` (nom de genre) existe déjà pour la page famille — le schéma
  d'URL doit rester compatible. Sur `/tracks`, un `?genre=` non-sentinelle
  filtre sur le nom exact, même sémantique que la page famille.
- **Décision tranchée (2026-07-23)** : les lignes en albums atterrissent
  sur la page Albums existante avec query params — même mécanique de
  deep-link, pas de vue nouvelle.

## Plan

1. ~~**Figer ce contrat de filtres**~~ **Fait** — contrat en code dans
   `triagePaths` (`src/app/paths.ts`), les tests des deux parsers
   round-trippent contre ces chaînes.
2. ~~**Implémenter les filtres**~~ **Fait** — modules `triage.ts`
   colocalisés (`tracks/` et `albums/`, testés), chips de filtre actif
   retirables (`TriageChips`) avec compte et état vide dédié dans les deux
   vues. Les sentinelles genre passent par `familyKeyOf`, donc l'explorer
   et la page Genres classent identiquement. « Tracklist à trous » = trou
   dans la séquence 1…attendu (total déclaré, sinon plus haut numéro) ;
   album sans aucun numéro = hors verdict (problème de tags, pas de trous).
3. ~~**Agrégats en helpers purs**~~ **Fait** — `buildTriageQueue` /
   `countToFix` dans `features/library/triage/queue.ts` (testés), dérivés
   des mêmes prédicats que l'explorer : une porte ouvre exactement sur ce
   qu'elle annonce. La ligne genre fusionnée porte **deux portes** (N
   manquants / N hors arbre) — une porte à zéro disparaît.
4. ~~**Page v1**~~ **Fait** — `features/library/triage/MetadataPage.tsx`
   (la feature `metadata` placeholder est absorbée dans `library` : la page
   consomme les données bibliothèque et les frontières interdisent le
   cross-feature ; la route `/metadata` et le namespace i18n `metadata`
   sont inchangés). Header + sous-ligne compte, pilule ambre « N à
   corriger » (ancre file), lignes à exemples inline, répartition des
   genres repliable (chaque famille → sa page), état zéro carte verte.
5. ~~**Écrire la provenance dans le sidecar.**~~ **Fait** — module
   `sidecar/provenance.py`, attributs flexibles beets écrits par chaque
   chemin qui mute des tags :
   - `sonarche_edited_at` + `sonarche_edited_fields` (union cumulée des
     champs touchés à la main) — posés par `library.update`, le signal
     non-reconstituable.
   - `sonarche_fingerprinted` — posé dès qu'un Chromaprint est calculé
     (match ou pas), l'étage « N empreintes » du futur funnel.
   - `sonarche_match_source` = `acoustid` | `text` — posé à l'application
     d'un match (enrich mono, vote album, adoption bonus).
     Le sidecar ne les relit jamais ; ils alimentent le funnel à venir et
     `beet ls`. Piège documenté dans le code : les hints texte mutent les
     items en mémoire sans store, donc la provenance s'écrit sur la ligne
     fraîche (enrich) ou avant les hints (batch album).
     **Fait aussi** : `genres.recompute` épargne désormais les genres édités
     à la main (`provenance.was_hand_edited(item, "genres")`) — le seul
     endroit où le sidecar relit la trace, pour la respecter.

## Reporté explicitement

- Funnel provenance (quand la donnée sidecar existera).
- Ligne « Anomalies » / lint (quand une règle fiable existera).
- Multi-genre : statu quo (collapse sur la valeur unique).
- Les 4 clés i18n `recompute*` restent orphelines volontairement (le hook
  `useRecomputeGenres` sert de backup quand MusicBrainz ne trouve pas de
  genre) ; à nettoyer si ce backup tourne sans bouton.
