# Changelog

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
