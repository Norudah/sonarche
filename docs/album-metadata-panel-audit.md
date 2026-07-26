# Audit — panneau d'édition des métadonnées d'un album

> État des lieux du drawer d'inspection album (`AlbumMetadataDrawer`) au
> 2026-07-26, sur `develop`. Document destiné à être lu seul, accompagné d'un
> screenshot, pour briefer une refonte UI/UX.
>
> Méthode : lecture intégrale du code du panneau et de ses dépendances, plus
> manipulation réelle du panneau dans l'app (preview `?mockTauri`, viewport
> 1280×720). Les mesures citées sont relevées à l'écran, pas estimées, sauf
> mention explicite.
>
> **Les §1 à §5 sont l'audit d'origine, conservé tel quel.** Les maquettes sont
> revenues et les arbitrages sont pris : voir **[§6 Décisions](#6-décisions-—-ce-qui-est-tranché)**,
> qui fait foi en cas de contradiction avec le brief du §5.

---

## 1. Ce que le panneau fait aujourd'hui

Point d'entrée : bouton **Inspecter** (icône `FileText`) dans les actions du
hero d'un album, et depuis la carte d'un album dans la grille. Ouvre un drawer
à droite, largeur `40rem` (640 px), plein écran en dessous de `sm`.

### Structure, de haut en bas

| Bloc               | Contenu                                                                                                | Fichier                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| Bandeau            | Pochette 96 px (+ crayon inerte en édition), eyebrow « ALBUM », titre, « artiste · N titres », ✕       | `AlbumInspectHeader.tsx`                           |
| Complétion         | Libellé « COMPLÉTION » + « N/M pistes complètes » + anneau %                                           | `AlbumCompletionRow.tsx`                           |
| Champs communs     | Album, Artiste de l'album, Année, Genre + Genre parent (lecture seule), Catégorie + chips de taxonomie | `AlbumCommonFields.tsx`                            |
| Séparateur         | `<hr>`                                                                                                 | —                                                  |
| Champs spécifiques | Tableau 4 colonnes : N°, Titre, Artiste, Genre — une ligne par morceau, tout éditable                  | `AlbumTrackFields.tsx`                             |
| Panneau latéral    | Cartes flottantes hors du drawer : offre de genre, propagation d'artiste                               | `AlbumEditAside.tsx`, `AlbumArtistPropagation.tsx` |
| Pied               | Re-matcher (gauche) · Modifier / Annuler + Enregistrer (droite), ligne de feedback au-dessus           | inline dans `AlbumMetadataDrawer.tsx`              |

### Modèle d'interaction

- **Deux modes globaux.** Lecture par défaut : tous les champs sont des
  `<input readOnly>` gris. Un clic sur **Modifier** bascule l'ensemble du
  panneau en édition (fond blanc + bordure). Il n'existe aucun moyen d'éditer
  un seul champ.
- **Brouillon.** L'édition travaille sur une copie (`draft`) réamorcée à chaque
  entrée en mode édition. **Annuler** jette le brouillon. **Enregistrer**
  calcule un diff et envoie **un seul appel** au sidecar pour tous les morceaux.
- **Fan-out des champs communs.** Modifier « Genre » en haut écrit la valeur sur
  les N morceaux. Si les morceaux divergeaient déjà sur un champ, celui-ci
  affiche le placeholder « Valeurs multiples » et **reste intact** tant qu'on ne
  le remplit pas — protection contre l'écrasement silencieux.
- **Priorité ligne > commun.** Le genre existe aux deux endroits ; la valeur
  saisie sur une ligne l'emporte pour ce morceau.
- **Deux assistants contextuels**, rendus hors du drawer, flottant à gauche :
  - _genre_ : éditer le genre d'une ligne propose « Appliquer aux N morceaux /
    Ce morceau seul » (boutons sur `mousedown`, contrainte WebKit macOS) ;
  - _artiste_ : renommer l'artiste d'une ligne A→B liste **en cases à cocher**
    les autres morceaux encore en A. Jamais de remplacement en bloc — décision
    actée : « X » reste légitime sur les morceaux sans invité.
- **Re-matcher** relance l'identification MusicBrainz sur tout l'album, morceau
  par morceau (N appels séquentiels), et rapporte « x/y pistes identifiées ».

Le drawer piste (`MetadataDrawer`, 30 rem) suit le même modèle sur un seul
morceau, avec en plus « Voir l'album » et un compteur en 7 points.

---

## 2. Problèmes

Classés par gravité. Les points marqués **⚠︎** sont des pertes de données ou des
pièges, pas des questions de goût.

### A. Pièges et pertes de données

**A1 ⚠︎ — Fermer jette le brouillon sans un mot.** Vérifié à l'écran : après
avoir modifié un artiste et un genre en mode édition, `Échap` ferme le drawer et
tout est perdu. Idem au clic sur le backdrop et sur le ✕. Aucune confirmation,
aucune trace. C'est le défaut le plus grave du panneau : il est plus facile de
perdre 5 minutes de saisie que de les enregistrer.
`AlbumMetadataDrawer.tsx:205` — `onOpenChange` ferme sans regarder l'état.

**A2 ⚠︎ — Renommer l'album éjecte l'utilisateur.** La page détail retrouve son
album par `(artiste, titre)` depuis l'URL. Après un renommage enregistré, plus
aucun album ne correspond → `<Navigate to="/library/albums" replace />` : le
drawer disparaît et on se retrouve sur la grille, sans explication, juste après
une action réussie. Depuis la grille, même cause, effet plus doux : la clé
change, `inspected` devient `null`, le drawer se referme seul.
`views/AlbumDetailView.tsx:56`, `views/AlbumsView.tsx:39`.
Renommer un album est un cas d'usage central : c'est là que ça casse.

**A3 ⚠︎ — Re-matcher pendant l'édition détruit le résultat du re-match.** Le
bouton reste actif en mode édition. Le re-match réécrit les tags côté
bibliothèque ; le brouillon, lui, garde les anciennes valeurs et n'est pas
rafraîchi. À l'enregistrement, le diff est calculé contre la nouvelle base et
**réécrit par-dessus** ce que le re-match venait de corriger. Silencieux.

**A4 — Aucun accusé de réception.** Seul l'échec parle (`update.isError`). En
cas de succès, le panneau retombe en lecture, sans un mot. Sur un album de 20
morceaux, rien ne dit ce qui a été écrit ni combien de fichiers ont été touchés.

**A5 — Aucun retour arrière.** Ni annulation après enregistrement, ni historique.
Les tags des fichiers sont réécrits pour de bon.

**A6 — Enregistrer est toujours actif**, même sans la moindre modification (le
code sort silencieusement si le diff est vide). Rien, nulle part, n'indique
qu'un champ a été modifié : pas de pastille, pas de mise en gras, pas de compteur
« 3 modifications en attente ».

**A7 — Le panneau latéral disparaît en dessous de `sm`** (`hidden … sm:flex`,
`AlbumEditAside.tsx:111`). Sur fenêtre étroite, la propagation d'artiste et
l'application du genre à tout l'album n'existent tout simplement plus — sans
message ni repli.

### B. Compréhension — le vocabulaire n'est expliqué nulle part

**B1 — Aucune aide contextuelle dans toute l'app.** Aucun composant tooltip,
aucune icône `?`. Le seul `title` HTML du panneau est celui du crayon inerte de
la pochette. HeroUI fournit `tooltip` et `popover` : la brique existe, elle n'est
pas utilisée.

**B2 — « Artiste de l'album » vs « Artiste » : la distinction n'est posée nulle
part.** Ce n'est pas seulement un mot à définir : c'est le modèle mental de
l'app. Un utilisateur qui corrige le mauvais des deux casse soit le regroupement
en albums, soit la recherche. La difficulté est aggravée par la disposition
actuelle : les deux champs sont dans **deux blocs différents et éloignés** (l'un
dans « Champs communs » en haut, l'autre en colonne dans le tableau, 500 px plus
bas). Le contraste qui les définit n'est jamais visible d'un seul coup d'œil.

**B3 — Jargon interne exposé.** « hors comptage » (deux fois), « varie »,
« Valeurs multiples », « Genre parent », « COMPLÉTION » à côté de « 2/2 pistes
complètes ». Chacun de ces termes suppose de connaître le modèle interne.

**B4 — Deux métriques différentes collées l'une à l'autre, sans étiquette.**
Dans la ligne de complétion, l'anneau affiche un **pourcentage de champs
remplis** (7 champs × N morceaux) tandis que le texte affiche un **nombre de
morceaux complets**. Deux définitions de « complet » à 3 cm d'écart. Vu à
l'écran : « COMPLÉTION / 2/2 pistes complètes » et « 100 % ».

**B5 — La complétion n'est pas actionnable.** Elle donne un chiffre, jamais
_quel_ champ manque ni _sur quel_ morceau. Sur un album à 84 %, il faut lire les
20 lignes du tableau à la recherche des cases vides. La page Métadonnées a acté
la doctrine inverse (« chaque chiffre est une porte ») ; ce panneau ne la suit
pas.

**B6 — Le genre est à deux endroits sans que la règle soit dite.** Rien
n'explique que la valeur d'une ligne gagne sur la valeur commune. Un utilisateur
qui remplit les deux ne peut pas prédire le résultat.

### C. Le contenant : le drawer est trop étroit pour ce qu'il porte

Mesuré à l'écran, viewport 1280×720, sur un album de **2 morceaux** : la zone
scrollable fait **474 px de haut pour 897 px de contenu**. Moins de la moitié du
formulaire est visible sur le plus petit album possible.

Extrapolation (une ligne de tableau ≈ 31 px) : ~1 170 px de contenu pour 12
morceaux, ~1 420 px pour 20 — soit **2,5 à 3 écrans de défilement**, dans un
tuyau de 640 px de large, alors qu'il reste 640 px de fenêtre inutilisés à
gauche, occupés par une page assombrie qui affiche… la même tracklist.

Conséquences concrètes :

- Le bloc « Champs communs » et le tableau des morceaux **ne sont jamais visibles
  ensemble** au-delà de 3 ou 4 morceaux. Or c'est précisément la relation qu'il
  faut comprendre (« ce champ écrit sur ces lignes-là »).
- L'en-tête de colonnes du tableau **n'est pas collant** : passé le premier
  écran, on édite des cellules sans savoir quelle colonne on touche.
- Le pied (Enregistrer) est fixe, tant mieux ; mais l'anneau de complétion, lui,
  défile et disparaît.
- Les colonnes sont trop étroites : à `1.1fr / 1fr / 0.9fr`, « Bryan Adams feat.
  Sarah McLachlan » est tronqué en cours de frappe (constaté).

### D. Les cartes contextuelles : bonne idée, mauvais emplacement

C'est le point que l'usage rend le plus visible. Constaté à l'écran :

- **Elles apparaissent à 500 px de la cellule éditée**, ancrées à `top: 7rem`
  du drawer (`AlbumEditAside.tsx:111`), quelle que soit la ligne concernée. On
  édite une cellule en bas à droite ; la carte s'affiche en haut à gauche. Rien
  ne relie visuellement les deux — pas de flèche, pas de surbrillance de la
  ligne, pas de mouvement partant de la cellule.
- **Elles se posent sur la page assombrie**, hors du panneau : elles flottent
  au-dessus de la pochette de l'album et du hero, sur un fond qui n'est ni le
  leur ni celui du drawer. Elles lisent comme un artefact, pas comme une partie
  du formulaire.
- **L'offre de genre s'évapore au premier clic ailleurs.** Elle est liée au
  focus de la cellule ; quitter la cellule la fait disparaître alors que la
  modification, elle, reste dans le brouillon. Constaté : en passant du genre
  d'une ligne à l'artiste de la même ligne, la carte genre est remplacée par la
  carte artiste et l'offre « appliquer à tout l'album » est perdue — il faut
  savoir qu'il faut recliquer dans la cellule pour la faire revenir.
- **Elles ne s'empilent pas vraiment.** Deux offres simultanées (genre +
  artiste) tiennent dans une colonne de 19 rem sans hiérarchie ni ordre stable.
- Leur contenu, lui, est bon : « Art Rock → Soundtrack », le titre du morceau, la
  question, deux issues explicites. C'est l'emplacement et le cycle de vie qui
  sont à revoir, pas le texte.

### E. Organisation des champs et grammaire visuelle

- **Le rail d'accent ne distingue plus rien.** Le trait `border-l-2
border-accent/30` est présent sur les trois blocs successifs (complétion,
  communs, spécifiques). Le commentaire de `AlbumSectionHeading.tsx:1` dit
  d'ailleurs l'inverse de ce que fait le code (`accent` est passé aux deux
  sections). Un marqueur porté par tout le monde n'est plus un marqueur.
- **Le mode lecture est un formulaire mort.** Le panneau affiche 6 champs et un
  tableau d'inputs gris qu'on ne peut pas toucher, et qui répètent exactement la
  tracklist visible sur la page derrière. Il ressemble à un formulaire, se
  comporte comme une fiche. Un utilisateur clique sur un champ et **rien ne se
  passe** — c'est l'anti-affordance la plus coûteuse du panneau.
- **La pochette n'est pas modifiable** mais porte un crayon `disabled` avec
  `cursor-pointer` et un `title="Bientôt disponible"` — sur un bouton désactivé,
  ce titre n'apparaît d'ailleurs pas de façon fiable.
- **Le tableau ne sait pas réordonner.** Renuméroter un album se fait à la main,
  cellule par cellule, sans détection de doublon ni de trou. Il n'y a pas non
  plus de « renuméroter dans l'ordre affiché ».
- **Aucune action de masse** hors les deux assistants : pas de « vider ce
  champ », pas de « copier l'artiste de l'album sur tous les morceaux »,
  pas de « appliquer l'année à tout ».
- **Champs absents** (à trancher, pas forcément à ajouter) : compositeur, n° de
  disque (hors périmètre acté), commentaire, ISRC/MBID en lecture. Aucune
  information technique non plus (format, débit, chemin du fichier) alors que le
  drawer piste ne les montre pas davantage.
- **Ordre des champs.** L'ordre actuel est album → artiste de l'album → année →
  genre → catégorie. Défendable, mais il sépare les deux champs « artiste » qui
  demandent justement à être comparés (cf. B2).

### F. Accessibilité et détails

- Le dialogue n'a **pas de nom accessible** (`dialog` sans `aria-label` /
  `aria-labelledby` dans l'arbre d'accessibilité relevé).
- Les cellules du tableau portent toutes le même `aria-label` (« Titre »,
  « Artiste »…) sans le morceau concerné : au lecteur d'écran, 20 champs
  « Titre » identiques.
- Les cartes contextuelles agissent sur `mousedown` : **inatteignables au
  clavier** (un `Tab` vers le bouton blur la cellule et démonte la carte).
- Pas de raccourci : ni `⌘S` pour enregistrer, ni `Échap` pour sortir du mode
  édition (aujourd'hui `Échap` ferme tout, cf. A1).
- Le tableau est une grille de `<div>` : ce n'est pas un tableau pour un lecteur
  d'écran, sans en-têtes associés aux cellules.

---

## 3. Recommandations

### R1 — Passer l'album en modale large. Garder le drawer pour le morceau.

**Oui à la modale pour l'album.** Le contenu est bidimensionnel (un bloc de
champs partagés _et_ un tableau de N lignes _et_ des commentaires contextuels) ;
le drawer le rend unidimensionnel et impose 2 à 3 écrans de défilement. Une
modale de ~1000–1100 px permet la seule chose qui manque vraiment : **voir les
champs communs et les morceaux qu'ils affectent en même temps**, et donner aux
cartes contextuelles un endroit où se poser à côté de la ligne concernée.

Piste de gabarit (à travailler par le design, pas une prescription) : colonne
gauche fixe ~360 px pour l'identité du disque (pochette, complétion, champs
communs), colonne droite extensible pour la tracklist avec en-tête collant, pied
d'action commun sur toute la largeur.

**Non à la modale pour le morceau.** Le drawer piste tient entièrement à l'écran
(vérifié) : le passer en modale coûterait du contexte sans rien résoudre. La
cohérence à viser n'est pas « même contenant partout » mais **même grammaire** :
mêmes champs, mêmes libellés, même aide, même pied d'action, même code couleur
lecture/édition. Si l'écart de contenant gêne malgré tout, la vraie unification
est ailleurs : **ouvrir le détail d'un morceau dans la modale album** (clic sur
une ligne → panneau de détail à droite), ce qui donne un lieu unique pour éditer
les métadonnées à deux échelles, sans deux drawers empilés.

Ce point mérite une décision explicite : la réponse change le nombre de surfaces
à maintenir.

### R2 — Tuer les pièges avant de redessiner

Aucun de ces points n'est un sujet de design ; ils sont à corriger quel que soit
le contenant retenu.

1. Garde de sortie : brouillon modifié + fermeture → « Abandonner les
   modifications ? ». Idem pour `Échap` (qui devrait d'abord sortir du mode
   édition, puis fermer).
2. Renommage : conserver l'identité de l'album après enregistrement (rediriger
   vers la nouvelle URL, ou garder le drawer ouvert sur l'album renommé) au lieu
   d'éjecter vers la grille.
3. Re-matcher : désactivé en mode édition, ou avertissement explicite (« le
   re-match réécrit les tags — tes modifications non enregistrées seront
   perdues »).
4. Confirmation de succès : « 12 morceaux mis à jour », sur la même ligne de
   feedback que les erreurs.
5. État « modifié » visible : pastille sur les champs touchés, compteur de
   modifications en attente, `Enregistrer` désactivé si le diff est vide.

### R3 — Une aide contextuelle, systématique et réutilisable

Un composant partagé (deux consommateurs réels dès le premier jour : les deux
panneaux, bientôt la page Métadonnées) : icône discrète à côté du libellé,
tooltip au survol **et au focus clavier**, contenu court. Pour les deux ou trois
notions qui demandent plus d'une phrase (artiste vs artiste d'album,
complétion), un popover cliquable plutôt qu'un tooltip, avec un exemple.

Règles proposées :

- l'icône n'apparaît **que** sur les champs qui en ont besoin — la mettre partout
  la rend invisible ;
- le texte nomme le problème avant le terme technique ;
- pas d'aide qui répète le libellé (« Année : l'année » ne sert à rien) ;
- remplacer purement et simplement le jargon quand une formulation claire existe
  (« hors comptage » → « ne compte pas dans la complétion »).

Textes prêts à intégrer en §4.

### R4 — Rapprocher les deux « artiste »

La distinction ne se règle pas par un tooltip seul. Trois leviers cumulables :

- montrer l'artiste de l'album **au-dessus de la colonne Artiste** du tableau
  (par exemple « Album rangé sous : Bryan Adams » en tête de colonne), pour que
  le contraste soit lisible sans mémoire ;
- une aide unique qui définit les deux dans le même texte, atteignable depuis les
  deux champs ;
- ne pas cacher que l'un range et l'autre décrit : c'est la phrase à faire tenir
  dans l'UI.

### R5 — Réancrer les cartes contextuelles

Trois options, par ordre de préférence :

1. **Ancrage à la ligne** : la carte se pose contre la ligne éditée (popover
   ancré), la ligne source est surlignée, la carte survit tant que la
   modification n'est pas tranchée (pas liée au focus).
2. **Bandeau inline sous la ligne** : la ligne s'ouvre en accordéon sur la
   question. Coût : le tableau bouge sous le curseur — ce qui avait justement
   motivé la sortie des cartes hors du flux.
3. **Zone « conséquences » persistante** dans le pied : toutes les propositions
   en attente empilées au même endroit, avec un compteur. Perd la proximité,
   gagne la persistance et le clavier.

Dans tous les cas : accessible au clavier, et une offre ne disparaît pas parce
qu'on a cliqué ailleurs.

### R6 — Rendre la complétion actionnable

Cliquer sur l'anneau → filtrer le tableau sur les morceaux incomplets, et marquer
les cellules vides. Et choisir **une** définition de « complet » à afficher, ou
étiqueter les deux.

---

## 4. Textes d'aide proposés (FR)

À relire avant intégration ; les clés i18n restent à créer côté `library`.

| Champ                  | Texte                                                                                                                                                                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Artiste de l'album** | Le nom sous lequel le disque est rangé : c'est lui qui regroupe les morceaux en un album et qui fait apparaître le disque dans la fiche de l'artiste. On y met l'artiste principal, même si certains morceaux ont des invités.                                   |
| **Artiste** (colonne)  | Qui joue _ce_ morceau-là, invités compris. C'est ce champ qu'affiche la lecture et qu'interroge la recherche. Exemple : l'album reste rangé sous « Bryan Adams », mais ce titre-ci est de « Bryan Adams feat. Sarah McLachlan ». **L'un range, l'autre décrit.** |
| **Genre**              | Le style du morceau, tel qu'il est écrit dans le fichier — le genre précis (« French House »), pas la grande famille.                                                                                                                                            |
| **Genre parent**       | La famille dans laquelle Sonarche range ce genre pour la navigation (« French House » → « Electronic »). Calculé automatiquement, non modifiable, et ne compte pas dans la complétion.                                                                           |
| **Catégorie**          | À quoi correspond ce disque : musique, bande originale de jeu, de film… Sert à séparer les BO du reste dans l'exploration. Facultatif : la laisser vide ne pénalise pas la complétion.                                                                           |
| **Année**              | L'année de sortie de cette édition du disque.                                                                                                                                                                                                                    |
| **N° de piste**        | La position du morceau sur le disque : c'est ce qui donne l'ordre de lecture. Deux morceaux avec le même numéro se retrouvent dans un ordre arbitraire.                                                                                                          |
| **Champs communs**     | Ces valeurs sont les mêmes pour tout le disque. Les modifier ici les écrit sur les N morceaux d'un coup.                                                                                                                                                         |
| **Valeurs multiples**  | Les morceaux de ce disque n'ont pas la même valeur ici. Laisse le champ vide pour n'y toucher à rien, ou écris une valeur pour l'imposer aux N morceaux.                                                                                                         |
| **Complétion**         | La part des champs de métadonnées déjà remplis sur ce disque. Les champs facultatifs (catégorie, genre parent) n'y entrent pas.                                                                                                                                  |
| **Re-matcher**         | Relance l'identification automatique : Sonarche ré-interroge MusicBrainz à partir de l'empreinte acoustique des fichiers et réécrit les tags reconnus. À faire avant tes corrections manuelles, pas après.                                                       |

---

## 5. Brief pour Claude Design

### Ce qu'on lui demande

Redessiner la surface d'édition des métadonnées d'un **album**, sur la base d'une
modale large (cf. R1), en traitant explicitement :

1. la coexistence à l'écran des champs communs et de la tracklist ;
2. l'emplacement et le cycle de vie des offres contextuelles (genre à tout
   l'album, propagation d'artiste) ;
3. la lisibilité de la distinction artiste d'album / artiste ;
4. la présence d'une aide contextuelle discrète mais systématique ;
5. la différence visuelle entre lecture et édition, et la visibilité de l'état
   « modifié, pas encore enregistré » ;
6. la tracklist à 20+ lignes : en-tête, densité, colonnes, défilement.

### Contraintes non négociables (décisions déjà actées)

- **DA de référence** : la page détail d'un album. Lavis `accent-soft →
background`, pilules rondes, tableaux à filets (pas de cartes encadrées),
  couleurs de statut `warning`/`success` pour la complétude. HeroUI + Tailwind,
  tokens de thème, pas de sélecteurs internes.
- **Thème clair uniquement** pour l'instant (le thème sombre est un backlog
  assumé, ne pas le traiter).
- **La propagation d'artiste reste une liste à cocher**, jamais un
  « remplacer partout » : l'ancienne valeur est souvent légitime sur les autres
  morceaux.
- **Un champ « valeurs multiples » laissé vide ne doit rien écraser.**
- **Pas de « nombre total de pistes »** : abandonné volontairement.
- **Pas de multi-disque** : hors périmètre.
- **Une seule écriture par enregistrement** : tout le panneau part en un lot.
- Français à l'écran, clés i18n stables en anglais.

### Ce qu'on ne veut pas voir revenir

- Un rapport qu'on ne peut que regarder : chaque chiffre doit mener quelque part.
- Un score de santé global supplémentaire.
- Une carte flottante détachée de ce qu'elle commente.
- Un mode édition indiscernable du mode lecture.

### Éléments à fournir avec le brief

- un screenshot du drawer en lecture,
- un screenshot en édition, tracklist visible,
- un screenshot avec une carte contextuelle affichée (c'est le plus parlant),
- ce document.

---

## 6. Décisions — ce qui est tranché

> Arbitrages du 2026-07-27, après retour des maquettes Claude Design
> (`docs/designs/Sonarche - Modale album (propositions).dc.html`). Cette section
> prime sur le brief du §5.

### Gabarit retenu : 1a, sans inversion

Modale large, **colonne d'identité à gauche, tracklist à droite**. L'inversion a
été envisagée puis écartée : les colonnes qui déclenchent des conséquences
(Artiste, Genre) sont à droite du tableau, et le popover est ancré à droite ; les
inverser rééloignerait la carte de la cellule qu'elle commente — le défaut même
qu'on corrige. La règle qui en découle : **plus on va à droite, plus on est
spécifique** (le disque → les morceaux → un morceau).

1b et 1c sont écartés. 1c en particulier ferait qu'inspecter un morceau depuis la
vue Morceaux chargerait son album entier.

### Le trou de 1a, et son bouchon

1a n'affiche **qu'une conséquence à la fois** alors que plusieurs peuvent être en
attente (un genre ligne 10, un artiste ligne 4). Retenu : **popover ancré pour
l'offre active, pastille dans la gouttière de la ligne pour les offres en
attente**, qui redéploie le popover au clic. C'est le motif de repli de 1h-A7
réutilisé en desktop — aucune largeur consommée, aucune offre perdue.

### Arbitrage des études

| Étude               | Retenu                                                                                                                       | Écarté                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **1d** aide         | mécanique **i** (tooltip survol + focus) et **ii** (popover « L'un range, l'autre décrit ») · **tout le vocabulaire de iii** | l'aide permanente sous chaque champ de iii — elle alourdit une colonne déjà dense |
| **1e** complétion   | **i** (l'anneau devient un filtre) + le liseré amber des cellules vides de **iii**                                           | **ii** : supprimer l'anneau le désaccorderait du hero album                       |
| **1f** édition      | **ii** — toujours éditable, l'état porte le sens ; plus de bouton Modifier                                                   | **i** (deux modes) · **iii** en systématique                                      |
| **1g** artiste      | **i**, **ii** et **iii** — les trois sont complémentaires                                                                    | —                                                                                 |
| **1h** états        | tout                                                                                                                         | —                                                                                 |
| **1i** drawer piste | tout                                                                                                                         | —                                                                                 |

Précisions :

- **Vocabulaire (1d-iii)** : « Genre parent » → **Famille de genre** aligne
  l'édition sur le vocabulaire de la vue Genres, qui parle déjà de familles.
  « hors comptage » → « ne compte pas dans la complétion ». « varie » et
  « Valeurs multiples » → formulations explicites (« 4 genres différents »,
  « laisse vide pour ne rien changer »).
- **Récapitulatif avant écriture (1f-iii)** : gardé, mais **conditionnel** — il
  n'apparaît qu'au-delà d'un seuil de morceaux touchés. Systématique, il
  imposerait un double clic pour corriger une faute de frappe.
- **1i retire l'artiste de l'album des champs éditables du morceau.** Ce n'est
  pas une perte : c'était un bug. Le champ n'écrit que sur le morceau courant, et
  comme les albums sont regroupés par artiste d'album
  (`albums.ts` → `albumArtistOf`), l'éditer depuis un morceau **sortait ce
  morceau de son album** et en créait un second à un titre. Remplacé par la
  mention de contexte « disque rangé sous X ».
- **Les deux surfaces basculent ensemble** sur le modèle toujours-éditable. Deux
  grammaires d'édition dans la même app seraient l'incohérence qu'on cherche à
  supprimer.

### Corrections apportées à 1a

- **L'anneau affiche un ratio, pas un pourcentage.** La maquette montrait « 85 % »
  à côté de « 24 des 29 morceaux sont complets » — deux métriques différentes, et
  un chiffre invérifiable de tête. L'anneau porte désormais **24/29**. Cohérent
  avec la doctrine « comptes, pas pourcentages » de la page Métadonnées.
- **« Copier l'artiste du disque » passe par la liste à cocher.** En l'état,
  l'action écrasait tous les featurings — exactement le footgun qu'on s'est
  interdit pour la propagation.
- **Cellules en texte, input monté au focus.** « Toujours éditable » sur 29 lignes
  × 4 colonnes ferait 116 champs montés en permanence, et la bibliothèque doit
  tenir des OST de 80 titres. Le DOM reste léger sans imposer la virtualisation.
- **Pas de glisser-déposer dans la tracklist.** Hors problématique : l'édition du
  N° et l'action « Renuméroter 1 → 29 » couvrent le besoin.
- **Un seul compteur de modifications**, dans le pied, à côté des boutons qui
  agissent dessus. La maquette le doublait dans la barre de titre.
- **Quasi plein écran sous ~1200 px.** La maquette est dessinée en 1180 px de
  large ; la fenêtre Tauri descend à 1080 px (`minWidth`), où la colonne
  d'identité fixe à 384 px ne laisserait que ~260 px aux trois colonnes
  flexibles. La lisibilité prime sur les marges.

### Gardé sous le coude

- **Catégorie sans saisie libre.** Les chips restent la seule entrée, parce que le
  couple français/anglais est aujourd'hui maîtrisé. Le jour où on assume
  l'anglicisme, on affichera les valeurs canoniques telles quelles (« Movies »,
  « Music ») et la question de la saisie libre se reposera.
- **Édition de la pochette.** Toujours pas implémentée ; le crayon inerte
  disparaît avec l'ancien drawer. Son emplacement reste à trouver le jour venu.
- **Glisser-déposer**, voir ci-dessus.
