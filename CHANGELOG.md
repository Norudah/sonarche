# Changelog

## [1.0.0](https://github.com/Norudah/sonarche/compare/sonarche-v0.9.1...sonarche-v1.0.0) (2026-07-31)


### Features

* **build:** port the app to Windows ([6fe30bf](https://github.com/Norudah/sonarche/commit/6fe30bfb9a7b894d22e76481a153a64e16e41e12))
* **import:** archive every import, and say what it brought in ([2d4d9e6](https://github.com/Norudah/sonarche/commit/2d4d9e66f16db3d10214a34859eb8588b16aaef8))
* **import:** point the recap at the align remedy ([f292f9b](https://github.com/Norudah/sonarche/commit/f292f9be4d6195cf80726a79647417513d66b8c3))
* **import:** rebuild the page on the download page's grammar ([84c3b38](https://github.com/Norudah/sonarche/commit/84c3b38c5f85f1ce45075d3f86afc3074458c9e8))
* **library:** align unidentified albums with MusicBrainz, filling blanks only ([a0ba497](https://github.com/Norudah/sonarche/commit/a0ba497ee894671bb246309e6f2e2ef309d9e306))
* **library:** fill genres in the align pass, through the genre pipeline ([856a757](https://github.com/Norudah/sonarche/commit/856a757913439656ef17bcb628bd636ab6f8f309))
* **player:** fetch and show a track's lyrics on demand ([91a333d](https://github.com/Norudah/sonarche/commit/91a333d50d28cf80ba991433da7062511a8da47d))
* **settings:** add a Library section with a movable folder and a danger zone ([ca37364](https://github.com/Norudah/sonarche/commit/ca37364b4b3631922b0cfbe5a336e351d0a66a41))
* **settings:** let the theme be chosen ([20463c7](https://github.com/Norudah/sonarche/commit/20463c707059b079e67129874a6dad17e5f5a8df))
* **settings:** put the politeness delays on a stepped scale ([5ceea67](https://github.com/Norudah/sonarche/commit/5ceea67a3a5f3e26c9b7110de49f4842388aed21))
* **settings:** rebuild Appearance around theme tiles and a language switch ([3d61183](https://github.com/Norudah/sonarche/commit/3d611836f4377006d051c3d705b4ed0f57cfc714))
* **settings:** test an API key and probe the services behind it ([2c9f89b](https://github.com/Norudah/sonarche/commit/2c9f89bf68acc9c528c208b80e5a77e1332e6801))
* **shell:** close the gaps the pre-v1 security pass found ([625b522](https://github.com/Norudah/sonarche/commit/625b5224f8f8a2b1de6ed405aa9ed4ab836788e4))
* **shell:** quiet the native title bar on Windows ([539cff4](https://github.com/Norudah/sonarche/commit/539cff48476244f793f723d3f7671c7e2e3e211b))
* **ui:** give empty pages and link controls one shape ([dde691c](https://github.com/Norudah/sonarche/commit/dde691cc9577f833c40d56cb66a66ee27870c20c))
* **ui:** let the appearance choice reach the window frame ([749b324](https://github.com/Norudah/sonarche/commit/749b324a896f7b7bd26c4cd78df7f26f393bd5bc))
* **ui:** let the launch end on a welcome instead of a cut ([fd05601](https://github.com/Norudah/sonarche/commit/fd05601974d8bb65e9e58ee11492a1e9abe81a37))
* **ui:** let the launch welcome be switched off ([a064d9d](https://github.com/Norudah/sonarche/commit/a064d9d8ea1690d64188c3798d4cd7d2ddeeb190))
* **ui:** let the user ask for an update from the settings ([54953b0](https://github.com/Norudah/sonarche/commit/54953b021665fa69556f186e0f784212edcc9467))
* **ui:** make button shape mean something ([2d851ea](https://github.com/Norudah/sonarche/commit/2d851eaae3a2d007b66fc17003daf1dc7512300b))
* **ui:** make elevation, glow and the accent band answer to the theme ([0f6f821](https://github.com/Norudah/sonarche/commit/0f6f821ffa2d7a63efe759617fc5729ee938a156))
* **ui:** make the metadata page state its verdict ([13eb11f](https://github.com/Norudah/sonarche/commit/13eb11f451b1f05087cdf59bc7858008559e0b9b))
* **ui:** open on the Sonarche mark and hand the window over gently ([0407164](https://github.com/Norudah/sonarche/commit/04071647b53834bcdd213f19c21ba1527705a3d2))
* **ui:** re-accord the light theme as paper ([4b04876](https://github.com/Norudah/sonarche/commit/4b048761d0f46bfc002275d7cc4ba645ed3598ee))
* **ui:** turn the dark theme into Night ([ac45e37](https://github.com/Norudah/sonarche/commit/ac45e377137b6ef0a381d32724b6e362c00e2a43))


### Bug Fixes

* **build:** drop the three packages beets declares and never imports ([43469df](https://github.com/Norudah/sonarche/commit/43469dfe33f922293bb473b8faa7e6d635a11753))
* **import:** stop beets replacing an album's real cover ([8223b34](https://github.com/Norudah/sonarche/commit/8223b342099819b393e88324a1bb6a5a54f101ee))
* **library:** carry the WAL files when the jobs database is renamed ([dd2374b](https://github.com/Norudah/sonarche/commit/dd2374b4ff1c9905d493abce7fd283d58fb10eaf))
* **player:** make the lyrics follow mode a switch, not a lone icon ([f1cc9d5](https://github.com/Norudah/sonarche/commit/f1cc9d53ae7af79f4d3c9c4fe68628b5f946ce95))
* **shell:** keep the sidecar's tracebacks instead of writing them to nowhere ([2bd6d6c](https://github.com/Norudah/sonarche/commit/2bd6d6ce39bff271bf4b80d75fccb6f64edbaed4))
* **shell:** let the window be dragged on macOS ([77aff68](https://github.com/Norudah/sonarche/commit/77aff6811a1e953b9f7e07c7d4eb8ad2298ffbeb))
* **shell:** quote paths in the beets config so Windows can read it ([b873284](https://github.com/Norudah/sonarche/commit/b8732847e756e3aaf6b93cdbf630e4c8e2fe740c))
* **sidecar:** finish the locale sweep the first pass left half done ([b279276](https://github.com/Norudah/sonarche/commit/b279276cb44f1fb736519745a4f35a7ca978f2fa))
* **sidecar:** send the bundle's own version in the user agent ([3c53a2b](https://github.com/Norudah/sonarche/commit/3c53a2bea17b0ed9ed862644c6c766de9be66b36))
* **sidecar:** speak UTF-8 over the channel instead of the Windows locale ([3f526c7](https://github.com/Norudah/sonarche/commit/3f526c7b74896ed68e9b1eb63b8f3f587300e70c))
* **ui:** capitalise the Ark in the launch and setup greetings ([f1f497a](https://github.com/Norudah/sonarche/commit/f1f497a7f856a3ed376d70bb47c81520a9909c36))
* **ui:** drop platform branding from user-facing copy ([2ace015](https://github.com/Norudah/sonarche/commit/2ace0155d2d12f870f29ca7265d812b49b82c035))
* **ui:** give the history and metadata pages a surface to stand on ([0258e79](https://github.com/Norudah/sonarche/commit/0258e7941acd035b2771a672d60402b6889a1cff))
* **ui:** make clear history sweep the import archive too ([f9cc07c](https://github.com/Norudah/sonarche/commit/f9cc07c9fe3278436de82c0b884f4d2ca4882ea1))
* **ui:** stop the composer's focus reading as a second shadow ([4bc808a](https://github.com/Norudah/sonarche/commit/4bc808ab08faaea43d887f8b5b972bd19a58dfd4))
* **ui:** stop the light theme from leaking into the dark one ([b6082dd](https://github.com/Norudah/sonarche/commit/b6082dd34ab2dfa491e826c12c7d28798c5b3407))


### Miscellaneous Chores

* cut the first stable release ([116b31a](https://github.com/Norudah/sonarche/commit/116b31ac103ee96bf8da6102e4c49a023f050e2c))

## [0.9.1](https://github.com/Norudah/sonarche/compare/sonarche-v0.9.0...sonarche-v0.9.1) (2026-07-28)


### Bug Fixes

* **build:** seal the macOS bundle and sign the updater artifacts ([4335574](https://github.com/Norudah/sonarche/commit/4335574676445975ef71170ca42258e5c9d9b9a5))
* **build:** seal the macOS bundle and sign the updater artifacts ([e4968c1](https://github.com/Norudah/sonarche/commit/e4968c19c2851ad1bf2ac12544862a91060d01cc))

## [0.9.0](https://github.com/Norudah/sonarche/compare/sonarche-v0.8.0...sonarche-v0.9.0) (2026-07-28)


### Features

* **build:** let the app update itself ([9c503c1](https://github.com/Norudah/sonarche/commit/9c503c1bbe9fd9fdc58144dcec683027b3214e92))
* **build:** ship our own Python instead of asking for one ([7ada434](https://github.com/Norudah/sonarche/commit/7ada434f19ce4cd80437f2c5d9fa5e18cb7404d1))
* **download:** let a job carry a category and stamp it after enrich ([082f5f0](https://github.com/Norudah/sonarche/commit/082f5f0092cacfd01c95ff765244197c746bf8aa))
* **download:** show a download as a card rather than a table row ([314a32c](https://github.com/Norudah/sonarche/commit/314a32c1381ba5d79287efb344326c69c339da32))
* **library:** copy a chosen folder into the ark ([d51580d](https://github.com/Norudah/sonarche/commit/d51580dbf0ecefb7ae3ea2920f148f7ba448d99d))
* **library:** edit an album's metadata in one modal ([1ea7fb8](https://github.com/Norudah/sonarche/commit/1ea7fb85629085812388d3f1788a4a97bc9494e4))
* **library:** give an oversized imported cover a version to be drawn from ([db65c49](https://github.com/Norudah/sonarche/commit/db65c495253bd302a1cc7729a1fde4d89b1d4490))
* **library:** look at a folder before importing it ([9a6b546](https://github.com/Norudah/sonarche/commit/9a6b54639c39f826725aef776f370ad0da26b5d5))
* **player:** decode the formats an imported library is made of ([b91b67f](https://github.com/Norudah/sonarche/commit/b91b67fc35a8a376945fb823b79863abe4a74edb))
* **player:** native audio engine in Rust ([11cbb05](https://github.com/Norudah/sonarche/commit/11cbb0578f3b2fb59dc9d41e511d34d6d91c9c5b))
* **player:** play through the Rust engine instead of the webview ([80e9b0b](https://github.com/Norudah/sonarche/commit/80e9b0bdc78c844e56f48aa0e457d5fd0cfdaabe))
* **player:** restore media keys through the OS media session ([c9f3dcd](https://github.com/Norudah/sonarche/commit/c9f3dcdb3c973e6c12f90ddd7384480b6d687429))
* **player:** seek that lands, and a gapless hand-over ([b06ef4d](https://github.com/Norudah/sonarche/commit/b06ef4dc8de2c0143e9dc9b2dd679fa3062668a3))
* **shell:** let a cleared step be opened and read again ([30e0699](https://github.com/Norudah/sonarche/commit/30e06992b658d3470258fa644ea72862076fe302))
* **shell:** offer the update instead of only being able to install it ([a8d9a21](https://github.com/Norudah/sonarche/commit/a8d9a214a580632a7484d244af307aae9ceadbdc))
* **shell:** remember the first-run walkthrough and let it be replayed ([ab38fea](https://github.com/Norudah/sonarche/commit/ab38feabce6d93a9dbd4c3bbc875130cf1e53ddc))
* **shell:** walk the first launch through its three steps ([6176646](https://github.com/Norudah/sonarche/commit/61766468d37356fdcdea882aa9515f63bba127e5))
* **ui:** draw the Sonarche ark and make it the app mark ([77eb68f](https://github.com/Norudah/sonarche/commit/77eb68f5c2ff79aa31adb43af388850e204c7eea))
* **ui:** show the playhead and widen the seek bar's grab area ([5f85dc5](https://github.com/Norudah/sonarche/commit/5f85dc58fee3fc4f3ce2f6a2b20facfd55438229))
* **ui:** state an album's completion as a count, not a share ([c2ceffe](https://github.com/Norudah/sonarche/commit/c2ceffebc2d87fe9145454368f6e3cad0da8d63d))
* **ui:** tell the user when a track cannot be played ([b60c197](https://github.com/Norudah/sonarche/commit/b60c19736040a5655060c12679549d983fe4923d))


### Bug Fixes

* **build:** check out the release branch before syncing Cargo.lock ([d22ee48](https://github.com/Norudah/sonarche/commit/d22ee48f353fc0a5e6850de3c17eb6003aec5630))
* **library:** refile a track when its album or artist is renamed ([426d9a2](https://github.com/Norudah/sonarche/commit/426d9a25afa3a51b0c423fdac4a8c52485180757))
* **library:** stop baking the album cover into every imported track ([f9213d0](https://github.com/Norudah/sonarche/commit/f9213d0190021b8ccfe06f3ca61c3c2205638551))
* **shell:** make the setup reset actually replay the setup ([58bf92c](https://github.com/Norudah/sonarche/commit/58bf92ce1715adcc5e4aa0786067eddf3d7d8a60))


### Performance Improvements

* **library:** cache the album grouping on the track array's identity ([893877a](https://github.com/Norudah/sonarche/commit/893877a4bb00fd616d8bea6929ab6e845d4b8e96))
* **library:** serve display-sized covers instead of archived originals ([b60c29d](https://github.com/Norudah/sonarche/commit/b60c29d9a1c9b3194116bc7daff18a44f7491d9d))
* **library:** stop refetching the whole library on every navigation ([9fe72eb](https://github.com/Norudah/sonarche/commit/9fe72eb86edc5a900d4b81a27172fd28b1100191))
* **sidecar:** find an imported single by its marker, not by scanning ([329b0e1](https://github.com/Norudah/sonarche/commit/329b0e1470400f26a0680b9b75c320455367d14d))
* **sidecar:** give the library listing its own channel ([54b3cc8](https://github.com/Norudah/sonarche/commit/54b3cc83e09f680c3de7c4febaa971bba2d48b53))
* **sidecar:** pass the library listing through as raw bytes ([776339f](https://github.com/Norudah/sonarche/commit/776339fad46b77f7e6815546bcc4d28f2c10dd0e))
* stop redoing library-sized work on every keystroke and render ([c4cdcb6](https://github.com/Norudah/sonarche/commit/c4cdcb670c0ae1627dd1e7308992892f2f14a520))

## [0.8.0](https://github.com/Norudah/sonarche/compare/sonarche-v0.7.0...sonarche-v0.8.0) (2026-07-26)


### Features

* **download:** move the activity table to its own History page ([22a6610](https://github.com/Norudah/sonarche/commit/22a6610521d13f386d8a0a25e5696b23e88db139))
* **download:** open the record a finished row produced ([8dec5ee](https://github.com/Norudah/sonarche/commit/8dec5eeab724ee4454f47e7fe01307cdc69a372d))
* **library:** add a category axis alongside genres ([c9d87b5](https://github.com/Norudah/sonarche/commit/c9d87b59aa94d8b2953c11963d5bdc50ce9efe3c))
* **library:** anchor the artist hover play to the cover corner ([be69a92](https://github.com/Norudah/sonarche/commit/be69a92172cdb0062badd298771a7e8ae3d88731))
* **library:** browse a genre, category or artist's tracks in place ([58d8569](https://github.com/Norudah/sonarche/commit/58d856969f74511ee74bbb115b961e6ed2891056))
* **library:** build the metadata triage page ([0c921fb](https://github.com/Norudah/sonarche/commit/0c921fbfa85fa0c3cdc1be6da75b04dead8fb1d8))
* **library:** drop the borrowed streaming hero for a metadata-first band ([bf891f4](https://github.com/Norudah/sonarche/commit/bf891f4109d7333ff7ae24298033adbdad9239c2))
* **library:** filter the explorers from metadata triage deep links ([e63f0e4](https://github.com/Norudah/sonarche/commit/e63f0e43085386f4ac543ea4464e83693e1f948c))
* **library:** float the album drawer's fan-out offers beside the panel ([1780aad](https://github.com/Norudah/sonarche/commit/1780aad529bbb1eb6474825d8a23d87a23be19d0))
* **library:** genre-based line-art avatars for artists ([e1fbad9](https://github.com/Norudah/sonarche/commit/e1fbad9d2204be3e4df642b3be99d238904288f7))
* **library:** give every explorer the same sticky work bar ([3c363f2](https://github.com/Norudah/sonarche/commit/3c363f26d406ac2acdb76c9e21734b50d2ed50c3))
* **library:** give the tracks explorer a sticky filter bar ([a50546d](https://github.com/Norudah/sonarche/commit/a50546d0f3da15bb9e12c2c45de894acd79d2a81))
* **library:** index, filter and sort tracks in pure modules ([ac4aa7c](https://github.com/Norudah/sonarche/commit/ac4aa7c33c2c9d36b1d7bf437c01fc0f6abcb535))
* **library:** inspect and edit a whole album in one drawer ([b4f1d19](https://github.com/Norudah/sonarche/commit/b4f1d19be2e91feddea56a1706bf62c06c67dd59))
* **library:** keep row actions on screen and play on double-click ([20cb089](https://github.com/Norudah/sonarche/commit/20cb089ff08bc19128536e99237ba3dc4116e5f9))
* **library:** link hero genre chips to their pages, animate the row ([9c467e4](https://github.com/Norudah/sonarche/commit/9c467e410291fb7cbcbc73880cebc2f8cba01556))
* **library:** open a genre's tracks from its page ([1e23208](https://github.com/Norudah/sonarche/commit/1e2320853e068b4010c2ea674c34251e6251deea))
* **library:** open the album metadata drawer from the shelf ([2a1534b](https://github.com/Norudah/sonarche/commit/2a1534bb78d12f9dca8f693c77785c9032c957e6))
* **library:** pair every play-all with a shuffle pill ([28acdb9](https://github.com/Norudah/sonarche/commit/28acdb91a37d3be2268c1bde0473af51367e41e6))
* **library:** play a genre from its hero ([2cabfea](https://github.com/Norudah/sonarche/commit/2cabfea1b0ac252bbca85cd1683ffe05da15c3e4))
* **library:** save edits from the track metadata drawer ([4e23ec8](https://github.com/Norudah/sonarche/commit/4e23ec85882c9ee60cffbc3f0bf0ab2c9945403c))
* **library:** set the category and per-track genre from the album drawer ([21c8b24](https://github.com/Norudah/sonarche/commit/21c8b249b8762796b86941c7e838ff3c7da319bc))
* **library:** show album completeness as a ring that fills on arrival ([4daab32](https://github.com/Norudah/sonarche/commit/4daab3223ee04ed4279a2c20c23e5a568af9038f))
* **library:** sort the genres shelf by size or name ([398558d](https://github.com/Norudah/sonarche/commit/398558da1f0b227b2fe6d6184d4ef32d2d4d0d9b))
* **library:** sort the tracks table from its column headers ([4a91ff6](https://github.com/Norudah/sonarche/commit/4a91ff60022c94efe8e9c39c2c7272521b6db605))
* **library:** step back through history from the hero's trail ([d779dcb](https://github.com/Norudah/sonarche/commit/d779dcbe70b63f91a675a494133000bffffdeea3))
* **library:** surface suspect matches and duplicate recordings in triage ([d80c104](https://github.com/Norudah/sonarche/commit/d80c10437eeeceb7ee7e1f14176f7b3955f5576a))
* **library:** turn the genres view into a family card index ([71fd3ad](https://github.com/Norudah/sonarche/commit/71fd3ad6f745e569baaf30bf6a01e48c2a8571ef))
* **library:** widen the category taxonomy and rename TV to Series ([306f3b0](https://github.com/Norudah/sonarche/commit/306f3b00617ca4b4088fa17ffc4d915ae333fa36))
* **player:** add ordered and shuffled set launches ([0ef8b00](https://github.com/Norudah/sonarche/commit/0ef8b009c5e9816ceee89b4a198c832d8ae5a427))
* **player:** add queue primitives (order, shuffle, repeat) ([c5eaaf9](https://github.com/Norudah/sonarche/commit/c5eaaf9eae058f1f72a4bec3d3ed93e5a0e5b13f))
* **player:** give the queue panel sections and air ([792771c](https://github.com/Norudah/sonarche/commit/792771c14fc9140fe10a33c732cf40937174aafb))
* **player:** navigate to the album and artist from the bar ([c6f74e9](https://github.com/Norudah/sonarche/commit/c6f74e91f7483ee57f802660fcc968b807f2881e))
* **player:** play sets through a real queue ([3523d97](https://github.com/Norudah/sonarche/commit/3523d97b4b151e3de3e799f850f69879b15289e9))
* **player:** show cover art in the play queue ([fa76b2e](https://github.com/Norudah/sonarche/commit/fa76b2e209747268d02834289ef556b2d63a5ae6))
* **settings:** bring the settings page into the app shell ([7beab2d](https://github.com/Norudah/sonarche/commit/7beab2df0af6a7e822e2effb8da3865beb3f47b4))
* **sidecar:** add a batch metadata write path ([b454b1e](https://github.com/Norudah/sonarche/commit/b454b1ec70abbbae6370ba69036adaddd1c7d359))
* **sidecar:** expose the beets grouping tag as an editable field ([22639b7](https://github.com/Norudah/sonarche/commit/22639b7a793b60ffb93103d866b042b96f8e916d))
* **sidecar:** record metadata provenance as flexible attributes ([b30d128](https://github.com/Norudah/sonarche/commit/b30d12823c3a16195910233ece47b7045a660890))
* **sidecar:** spare hand-edited genres in genre recompute ([4101a6b](https://github.com/Norudah/sonarche/commit/4101a6b04946cd2f9dc6ba655a477ab46bd16559))
* **ui:** breathing room for the sidebar and the traffic lights ([070e34b](https://github.com/Norudah/sonarche/commit/070e34b2eb5e704573daf8e60de561d28b72324d))
* **ui:** drop the topbar and the native title bar, rework the sidebar ([f3ec00c](https://github.com/Norudah/sonarche/commit/f3ec00c079839af22315a06d2605dc396c89ec74))


### Bug Fixes

* **download:** stop reporting a partly-downloaded playlist as a failure ([6578b66](https://github.com/Norudah/sonarche/commit/6578b66fbdae8fffe50c6e55e31f3d634bb37267))
* **library:** keep a metadata field's label on one line ([dd75140](https://github.com/Norudah/sonarche/commit/dd7514073cede8fc183a917747de414c7e014ca4))
* **library:** stop a genre chip from renaming the category page ([fece290](https://github.com/Norudah/sonarche/commit/fece290d8681f3402642732d91e3d5487fc5f854))
* **library:** stop the hero wash covering the tracklist, round the row actions ([deb7de1](https://github.com/Norudah/sonarche/commit/deb7de1bb1f92c9f4ce805d8f95161dfcc8c4f48))
* **library:** tint triage chips amber and unblock genre families with no album ([da91c29](https://github.com/Norudah/sonarche/commit/da91c2959d286e404d5408bc4ccb384b2ad23bb4))
* **player:** end tracks at the library length, not the element's ([15630a2](https://github.com/Norudah/sonarche/commit/15630a2af039147ae257275615261662e5609132))
* **shell:** keep native traffic lights visible in system dark mode ([c972f5a](https://github.com/Norudah/sonarche/commit/c972f5a0e7920a747c4596e7b39c2dfd2e3bb9c4))
* **sidecar:** rescue cross-language album matches onto one clean release ([357770d](https://github.com/Norudah/sonarche/commit/357770da2844e9629df75838cf4dd6a67bf15642))


### Performance Improvements

* **library:** debounce the library search ([a7d59dc](https://github.com/Norudah/sonarche/commit/a7d59dca9fb6b8b0a882de3702cef54409058846))
* **library:** settle the search debounce at 275ms ([4a42932](https://github.com/Norudah/sonarche/commit/4a4293202249836cf16d317eb5e46990bbf19222))

## [0.7.0](https://github.com/Norudah/sonarche/compare/sonarche-v0.6.0...sonarche-v0.7.0) (2026-07-20)


### Features

* browse the library by album, artist and genre — and the perf work to scale it ([d41c266](https://github.com/Norudah/sonarche/commit/d41c266de67b3d249e2dc46f521bb818b4172b47))
* **library:** add the albums grid and album page ([5c719eb](https://github.com/Norudah/sonarche/commit/5c719eb1549cf642a95b24dae1dd1db87b2db6bd))
* **library:** browse the genres themselves, not only their families ([bb50d58](https://github.com/Norudah/sonarche/commit/bb50d583e2a14326322adc2c95d176e56038ff89))
* **library:** browse the library by artist ([e181f4c](https://github.com/Norudah/sonarche/commit/e181f4cb5e4bea6cc5e8e24ee4a209257f5a5f3e))
* **library:** browse the library by genre family ([8918971](https://github.com/Norudah/sonarche/commit/89189718a2abd24c748273767a6e783b8cf3ca2e))
* **library:** pin the album's identity once the hero scrolls away ([8c0a12a](https://github.com/Norudah/sonarche/commit/8c0a12a1dd4dea3cc5d5f4d88011d0d9ea30700b))
* **library:** place the album metadata affordance, drop the recency sort ([d322572](https://github.com/Norudah/sonarche/commit/d322572249a06e6b00028c04f261f61f805f0af7))
* **library:** redesign the tracks page as a columned list ([3406094](https://github.com/Norudah/sonarche/commit/340609464bc0dd687078332f3ca9e02af61666ea))
* **library:** redesign track metadata inspector panel ([b105425](https://github.com/Norudah/sonarche/commit/b10542566eec698761e21067ed4c9d4b031b7183))
* **shell:** give startup a real splash instead of a half-live shell ([774b654](https://github.com/Norudah/sonarche/commit/774b654c88dc469db74ebe699ede35d8caf03197))


### Bug Fixes

* **library:** return to the top of the list when the search changes ([203fd5d](https://github.com/Norudah/sonarche/commit/203fd5d076ea7da4b031c58b508aa078e41b8255))
* **library:** stop the album hero stuttering on arrival ([da87fcb](https://github.com/Norudah/sonarche/commit/da87fcbf5859228315e7c10b4a195cfeda061156))
* **library:** stop the artist thumbnail reading as an album cover ([d8b8c59](https://github.com/Norudah/sonarche/commit/d8b8c593ee21adaf27de4f066a05a25134ee812b))
* **library:** stop the mock library echoing genres as their own bucket ([aa6f532](https://github.com/Norudah/sonarche/commit/aa6f532398ed2f1ff32ea5f84c1652097e9dad44))
* **player:** take durations from the audio file, not the release ([d670232](https://github.com/Norudah/sonarche/commit/d67023264752045bef7f06b840705fd4440d273a))
* **ui:** fade page transitions without movement or a gap ([a398c4b](https://github.com/Norudah/sonarche/commit/a398c4b1f973f71d55dcc4c594527a8981a41e1a))
* **ui:** make hover, scrolling and page transitions feel immediate ([05acec3](https://github.com/Norudah/sonarche/commit/05acec361e701cf8407e69a36c9d07af50985322))
* **ui:** show a pointer cursor on hand-rolled buttons ([3cc3ecd](https://github.com/Norudah/sonarche/commit/3cc3ecd5fcff67dae1fe3df1248fec6232483f86))


### Performance Improvements

* **library:** read the listing straight from SQLite instead of beets' ORM ([40b8ee3](https://github.com/Norudah/sonarche/commit/40b8ee339f73ae8bc4e29dc98842f03dd9739209))
* **library:** render only the visible rows of the tracks table ([339676e](https://github.com/Norudah/sonarche/commit/339676ed2ec01a28f5f3abe75cf6eb2db62dcf56))
* **library:** resolve cover art once per album, not per track ([b89a5ba](https://github.com/Norudah/sonarche/commit/b89a5baa717d0c9a6e5386c45c27a12a6c92cfd3))
* **player:** split the playhead out of the player context ([2bc6823](https://github.com/Norudah/sonarche/commit/2bc682394fc5a445aed037220bb70e9a5c05bbe0))
* **ui:** defer cover art that lives in a list ([49b2b56](https://github.com/Norudah/sonarche/commit/49b2b56595ac689a279f888fc037c7b04c0b850e))

## [0.6.0](https://github.com/Norudah/sonarche/compare/sonarche-v0.5.0...sonarche-v0.6.0) (2026-07-19)


### Features

* **download:** animate the queue table and the URL composer ([f693e03](https://github.com/Norudah/sonarche/commit/f693e03f6e34994ce5fd77b8251b9ab3e949a41c))
* **download:** replace dash placeholders with a neutral empty-cell marker ([97e3e93](https://github.com/Norudah/sonarche/commit/97e3e93966ae45c66d8a4101cbd1e80a1b96acd9))
* motion polish, download pipeline improvements, and library management ([1abb00d](https://github.com/Norudah/sonarche/commit/1abb00dd008728d88e48e545ca3ec3168be46d1c))
* **player:** animate the transport button and now-playing swaps ([6f6cf8c](https://github.com/Norudah/sonarche/commit/6f6cf8c17cc99cc66f76b3f7132ed0bf353fdae7))
* **shell:** animate route transitions and the sidebar nav indicator ([9e004fa](https://github.com/Norudah/sonarche/commit/9e004fa853afbd36cd6aa8be033c3146ef15eda2))
* **shell:** drop the home page and condense the sidebar ([8334a6e](https://github.com/Norudah/sonarche/commit/8334a6e5d68f9d77ff00bc036f4444558f78268d))
* **shell:** move download history to SQLite as sonarche.db ([b713f91](https://github.com/Norudah/sonarche/commit/b713f91860381292af324eee6c0f01c534516229))
* **shell:** surface download attempts per track ([7260db9](https://github.com/Norudah/sonarche/commit/7260db948c9fb96f4dc9c39179a91f3a52df2360))
* **sidecar:** add configurable rate limits for AcoustID and downloads ([f586b57](https://github.com/Norudah/sonarche/commit/f586b57a6cf1bd6492c25da3529ccb8d1aeac214))
* **sidecar:** tag unidentified tracks provisionally instead of leaving them blank ([7364f91](https://github.com/Norudah/sonarche/commit/7364f919b749eeffafc785d543750bea02bab5ba))
* **ui:** add motion design tokens and reduced-motion support ([bec132d](https://github.com/Norudah/sonarche/commit/bec132dac607ea566251190c626d6925a98ce013))
* **ui:** rebuild the download page around a pipeline table ([b855ffd](https://github.com/Norudah/sonarche/commit/b855ffdfcaeab7bdddb0bca5fef90a88dbd52f67))
* **ui:** restyle the playlist/track choice and tighten the download page ([74fb236](https://github.com/Norudah/sonarche/commit/74fb2369907ae19ca5c67a3e10fd0f3c2c42d953))
* **ui:** surface provisional tags, rename enrich to identify, add copy source link ([b985c76](https://github.com/Norudah/sonarche/commit/b985c762fb410771518d82767e423d450fc9aa5d))


### Bug Fixes

* **download:** mock enqueue_download and retry_job in the dev Tauri stub ([d025a61](https://github.com/Norudah/sonarche/commit/d025a61de1ed4b954fc99d140040a5d547adbe5a))
* **sidecar:** dedupe on primary recording, fall back to release-group cover ([c62ad34](https://github.com/Norudah/sonarche/commit/c62ad342e41a69fd9ccdca7b8e7465d54db2b5fb))
* **sidecar:** place the last unmatched track by elimination ([2c25af9](https://github.com/Norudah/sonarche/commit/2c25af95799829d98f744d9991fe6b9911bef9ca))
* **ui:** tune the download queue's colors, artwork and playlist picker ([4b6fba5](https://github.com/Norudah/sonarche/commit/4b6fba56340355d319fcb6be0f12c97fd19e3f89))

## [0.5.0](https://github.com/Norudah/sonarche/compare/sonarche-v0.4.0...sonarche-v0.5.0) (2026-07-16)


### Features

* **download:** download YouTube playlists as album jobs ([f1f1bd3](https://github.com/Norudah/sonarche/commit/f1f1bd30ad2a3fedf444d0b2e08b74d0a1b14994))
* **download:** mark content duplicates in the queue table ([e7d518d](https://github.com/Norudah/sonarche/commit/e7d518db4bc878fe0cd7367d560d52254541f6db))
* **download:** retry downloads with backoff and trace the pipeline ([244e42c](https://github.com/Norudah/sonarche/commit/244e42c20ff6265ee29109256e3ff340b0652eab))
* **download:** stream per-track enrich progress to the queue table ([99671f7](https://github.com/Norudah/sonarche/commit/99671f7fda7d5cab4eb6f854eb0d03fe50f98e1b))
* **library:** show album artist in the metadata drawer ([7346e56](https://github.com/Norudah/sonarche/commit/7346e5619e5fadd61c116817df9690668ebd28c4))
* **library:** tag adopted bonus tracks with their origin release ([a774086](https://github.com/Norudah/sonarche/commit/a774086358b0aacb06bc87cb44b2f78c72ddd94c))
* **shell:** dev-only full library reset in settings ([6d9408f](https://github.com/Norudah/sonarche/commit/6d9408f3ca8e783eac9c90965aa4931a622c6ff4))
* **sidecar:** fingerprint-first album enrich with dedupe and adoption ([ed95a5d](https://github.com/Norudah/sonarche/commit/ed95a5dc389a03eaf1c13c6499569558c6a8a3c7))
* **sidecar:** keep HQ cover on disk, embed the 500px thumb ([c9d4c63](https://github.com/Norudah/sonarche/commit/c9d4c63481b231d341ebdb4f2780da1ac562f900))
* YouTube album downloads with fingerprint-first enrichment ([575b65f](https://github.com/Norudah/sonarche/commit/575b65fd7898f56b2452d27cd2b524bab045637e))


### Bug Fixes

* **build:** recopy sidecar resources when Python files change ([49d84fd](https://github.com/Norudah/sonarche/commit/49d84fd5f156ab77bd9c3af7ed5f58c8729d14f6))
* **download:** dedupe playlist entries by video id ([58656cd](https://github.com/Norudah/sonarche/commit/58656cd70eaaa74c0c64586c628d45f29f2b6650))
* **sidecar:** keep album batches in one album folder ([b8dc40f](https://github.com/Norudah/sonarche/commit/b8dc40fef5d4e74dd43af559a398cdbe2af8f357))
* **sidecar:** let beets prune folders holding only cover-hq ([1c67fea](https://github.com/Norudah/sonarche/commit/1c67feaee3944a629912054c0c8ccd420c535b23))

## [0.4.0](https://github.com/Norudah/sonarche/compare/sonarche-v0.3.0...sonarche-v0.4.0) (2026-07-16)


### Features

* **download:** clear queue history with confirmation dialog ([5266fc8](https://github.com/Norudah/sonarche/commit/5266fc87104367ad1000093e712066f304a58465))
* **library:** add a re-run auto-enrich action on a track ([c05ddb2](https://github.com/Norudah/sonarche/commit/c05ddb2e9def4082723eee444ebc0c8fe6a8953c))
* **library:** derive and surface each track's parent genre ([06f42b7](https://github.com/Norudah/sonarche/commit/06f42b75f30a5243827a8fc18362fe43e09a89cb))
* **library:** unify genre browsing into a parent/sub-genre accordion ([34e7bb7](https://github.com/Norudah/sonarche/commit/34e7bb77a305a65554eac900326468237a9e1566))
* **settings:** expose the Last.fm fetch delay as a user preference ([f3717b4](https://github.com/Norudah/sonarche/commit/f3717b48d94123d98968b848ab777c9cc4cd9b1c))
* **shell:** add a browse-by-genre section to the sidebar ([3b74803](https://github.com/Norudah/sonarche/commit/3b74803a33fe2c8c51af077475423d3777e0d7cd))
* **sidecar:** canonical genre tree, throttled Last.fm fallback, rate-limit setting ([d0c3fd5](https://github.com/Norudah/sonarche/commit/d0c3fd58662072b8eca4e260cff9f1f2ed74b72b))
* **sidecar:** canonicalize genres via lastgenre during enrichment ([9e73260](https://github.com/Norudah/sonarche/commit/9e732602fbf780970af1afe25e87ba027a31b0f0))
* **sidecar:** derive genre buckets from a canonical lastgenre tree ([e097844](https://github.com/Norudah/sonarche/commit/e097844a52bed906f21c4dd5fa3a904af52b74b4))


### Bug Fixes

* **library:** bucket guitar-based industrial genres under Metal/Rock ([2fe804b](https://github.com/Norudah/sonarche/commit/2fe804bdeebe4da4044f45cf531fad92951f448a))
* **library:** stop the metadata drawer from dragging on text selection ([592a6e9](https://github.com/Norudah/sonarche/commit/592a6e91e57cfd023ca6eecf27307c8705ac5bba))
* **sidecar:** pick the best release across a fingerprint's recordings ([c563f1b](https://github.com/Norudah/sonarche/commit/c563f1b2a9addd2a53b26e05d0269851bf79b71b))
* **sidecar:** resolve recordings to their studio album, not a best-of ([93d4d27](https://github.com/Norudah/sonarche/commit/93d4d270c4ac6fc611d0cc0df4065f7f428ecbfb))
* **sidecar:** throttle the genre recompute batch's Last.fm calls ([b24e95a](https://github.com/Norudah/sonarche/commit/b24e95afd6e3db4d4a3689fed71432e6958f7282))

## [0.3.0](https://github.com/Norudah/sonarche/compare/sonarche-v0.2.0...sonarche-v0.3.0) (2026-07-15)


### Features

* **download:** add match column and honest completion score ([161b0cc](https://github.com/Norudah/sonarche/commit/161b0ccbda17a5e7a5ad73af4c16481c840e16d6))
* **download:** add sequential job queue with auto-import ([7fa0e2e](https://github.com/Norudah/sonarche/commit/7fa0e2edd452b619388795a222ce931b4286fe31))
* **download:** replace staged card with queue/history table ([9384f54](https://github.com/Norudah/sonarche/commit/9384f54d9fd227dd2cf619750e7d042267b78062))
* **download:** run enrichment step in the job queue ([eb6e62b](https://github.com/Norudah/sonarche/commit/eb6e62bd11c7e96c8e0d21b278a5b26b63fcb096))
* **download:** show library presence with inspect and delete actions ([91d9220](https://github.com/Norudah/sonarche/commit/91d922042de775bf1d54793544801b935a4aceba))
* **library:** add metadata inspection drawer on tracks ([2eb7609](https://github.com/Norudah/sonarche/commit/2eb7609bb734b1d1392571a007e0449f4b3aa3b0))
* **library:** add track deletion with confirmation dialog ([44e559f](https://github.com/Norudah/sonarche/commit/44e559ff8e96c8bb1a2eaa02f59cdd7a8a26e9ec))
* **settings:** store API keys in the OS keychain ([b56ddf0](https://github.com/Norudah/sonarche/commit/b56ddf0eb298e37c6a84f81b1751c638dbad3177))
* **shell:** add topbar with settings entry point ([0a3ca27](https://github.com/Norudah/sonarche/commit/0a3ca272b0a0cd0bb7c8d8a34fc6f9c8ca15e613))
* **sidecar:** add read-only metadata candidates handler ([1002237](https://github.com/Norudah/sonarche/commit/10022373f3c39bd67ed56607a286406374b6e0f3))
* **sidecar:** enrich imported items via AcoustID fingerprint ([fb0ac4a](https://github.com/Norudah/sonarche/commit/fb0ac4a7a32fe0496bafc5263ad1f988f6f1c07d))
* **sidecar:** report post-import metadata from the beets library ([9f8d375](https://github.com/Norudah/sonarche/commit/9f8d375e66d233bb9342d4a72b734b5201b69b91))


### Bug Fixes

* **download:** fix hidden actions column and stale library chip in queue table ([53aab9c](https://github.com/Norudah/sonarche/commit/53aab9c66d0213f8691e2edab16dd423e1511ca0))
* **sidecar:** enable musicbrainz plugin in generated beets config ([49ba4ae](https://github.com/Norudah/sonarche/commit/49ba4ae245d52f5ccea670a57d67a29620869482))
* **sidecar:** sync album row after enrichment to stop false duplicates ([a9e1f9c](https://github.com/Norudah/sonarche/commit/a9e1f9c994fb13289f0c882cc196286e9a3f0970))
* **sidecar:** sync album row before move so albums keep distinct covers ([3d98cb9](https://github.com/Norudah/sonarche/commit/3d98cb9a1a975b1537dbfde878da305ef437ac32))

## [0.2.0](https://github.com/Norudah/sonarche/compare/sonarche-v0.1.0...sonarche-v0.2.0) (2026-07-13)


### Features

* bootstrap tauri desktop app with python sidecar poc ([8cf61ea](https://github.com/Norudah/sonarche/commit/8cf61ea9e5f742f21ae08e63e2dcfa2d56ef1b22))
* **download:** redesign hero with gradient, eyebrow and pill controls ([438dec8](https://github.com/Norudah/sonarche/commit/438dec85f71bae7b25bad2c418cef4c342dd0f5b))
* **player:** add integrated audio player ([0db1793](https://github.com/Norudah/sonarche/commit/0db17933e048b05636393445e0ca1284974d6e3b))
* **player:** three-zone bar with centered seekbar and custom slider styles ([96b533d](https://github.com/Norudah/sonarche/commit/96b533d12410fd133a08d34091d5796072dc2a5f))
* **player:** three-zone bar with now-playing, transport and volume ([c2d5759](https://github.com/Norudah/sonarche/commit/c2d575919635a5edf8532018265ed6f6a54b1f90))
* **shell:** restructure sidebar into Explorer/Arche/Playlists groups ([c5d8df3](https://github.com/Norudah/sonarche/commit/c5d8df3057f9ba9f96567d1320c447b1851a60b3))
* **shell:** thin draggable topbar and hidden native title bar ([1fe4e1c](https://github.com/Norudah/sonarche/commit/1fe4e1c85fcb7fa234d6a07c49519d991bb52d73))
* **shell:** three-section nav with contextual Arche sidebar ([06da5d2](https://github.com/Norudah/sonarche/commit/06da5d2ebce6f3a9fc9a8cead0dee2226dfa0ae2))
* **ui:** centralize design tokens on HeroUI v3 theme layer ([5291f93](https://github.com/Norudah/sonarche/commit/5291f93d59c2a4c74ed7d63d456fa05417157755))


### Bug Fixes

* **shell:** remove custom topbar and restore native macOS title bar ([c63fb1d](https://github.com/Norudah/sonarche/commit/c63fb1d8cf2191ba7f62f4382baffa434684c1f3))
* **sidecar:** resync beets config directory on every launch ([c1ab3a9](https://github.com/Norudah/sonarche/commit/c1ab3a9828a9ff225a19aab016aa0cc5257a3a9d))
* **sidecar:** update library audio dir from MusicManager to Sonarche ([71ebee5](https://github.com/Norudah/sonarche/commit/71ebee5f540b30c4b4026a5f704f5f8a07b565dd))
* **ui:** stretch page content instead of centering with max-width ([e1ab9f8](https://github.com/Norudah/sonarche/commit/e1ab9f8d4ed96eea2f7066f58854b659f254159a))

## [0.1.0](https://github.com/Norudah/music-manager/compare/music-manager-v0.0.1...music-manager-v0.1.0) (2026-07-11)


### Features

* bootstrap tauri desktop app with python sidecar poc ([8cf61ea](https://github.com/Norudah/music-manager/commit/8cf61ea9e5f742f21ae08e63e2dcfa2d56ef1b22))
* **player:** add integrated audio player ([0db1793](https://github.com/Norudah/music-manager/commit/0db17933e048b05636393445e0ca1284974d6e3b))
