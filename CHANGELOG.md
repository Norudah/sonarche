# Changelog

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
