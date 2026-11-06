# FORK.md: php-baremetal/php-baremetal-sim

Fork of [davidmonterocrespo24/velxio](https://github.com/davidmonterocrespo24/velxio)
(AGPLv3) for the php-baremetal simulator (`sim.php-baremetal.com`): **PHP 8.5 on
an emulated ESP32-S3**, with the blog's examples, `index.php` and
`composer.json` editable, and packages from `repository.php-baremetal.com`.

- Work branch: `php-baremetal`. `master` stays aligned with upstream.
- Upstream base: `73977b63` (2026-11-06).
- Local workspace: `big-refactor/simulation/` (see `../README.md`).

## How it works

```
gallery example ──► prebuilt firmware (/firmware/php-baremetal/<id>.bin) ──► Run (no build)
        │
        └─ edit index.php / composer.json, "Add library" ──► Run
                 │
                 ▼  POST /api/phpbm/build/start  (compileCode() seam: __velxio_prebuilt_firmware__)
        composer.json normalised (registry only, simulator board) ──► composer update ──► composer.lock
                 │
                 ├─ lock already seen? ──► cached engine (merged.bin)       [0 s]
                 └─ new lock ──► phpbm build --merged (queue, 1 at a time)   [~90 s, once]
                 ▼
        fatfsgen(project-src) ──► storage.bin written at the "storage" partition offset   [~0.1 s]
                 ▼
        merged image ──► ESP32-S3 QEMU (esp32s3-picsimlab, -m 8M PSRAM)
```

With `storage: embedded` the PHP sources are only the FAT partition
(`fatfs_create_rawflash_image`): the engine depends only on the lock. Check
done: the regenerated `storage.bin` differs from phpbm's only in the 4 bytes of
the FAT volume serial (random on every run).

## Changes to upstream (by topic, one commit each)

| # | Topic | Files |
|---|---|---|
| 1 | **ESP32-S3 PSRAM**: `-m <N>M` to QEMU (`psram_mb` or `VELXIO_ESP32S3_PSRAM_MB`); without it the php firmware reboots forever | `backend/app/services/esp32_worker.py`, `test/backend/unit/test_esp32s3_psram_arg.py` |
| 2 | **Examples with prebuilt firmware**: `ExampleBoard.prebuiltFirmwareUrl`, same path as "Upload firmware" | `frontend/src/utils/prebuiltFirmware.ts`, `utils/loadExample.ts`, `data/examples.ts`, `data/examples-php-baremetal.ts`, `data/php-baremetal/*`, tests |
| 3 | **Limits for public use**: `MAX_ESP32_SESSIONS`, `ESP32_SESSION_TIMEOUT_S` (default off) | `backend/app/services/esp32_lib_manager.py`, `test_esp32_session_limits.py` |
| 4 | **Compile off**: `VELXIO_ENABLE_COMPILE=0` (no toolchain routes) + `VITE_ENABLE_COMPILE=false` (no Compile for sketches; php projects still compile) | `backend/app/main.py`, `frontend/src/lib/features.ts`, `EditorToolbar.tsx`, `test_enable_compile_flag.py` |
| 5 | **php-baremetal build server**: `/api/phpbm` (start/poll + packages), builder with per-lock cache | `backend/app/services/phpbm_builder.py`, `api/routes/phpbm.py`, `scripts/phpbm_warm.py`, `test_phpbm_*.py` |
| 6 | **php-baremetal frontend**: provider on the `compileCode()` seam (+`onProgress`), "Add library" → `composer.json` | `services/phpbmBuild.ts`, `services/phpbmPackages.ts`, `components/simulator/PhpbmPackagesModal.tsx`, `LibraryManagerModal.tsx`, `services/compilation.ts`, `main.tsx`, `phpbm-build.test.ts` |
| 7 | **Branding + AGPL §13**: name, "based on Velxio · source" in the header, Help menu with fork source + attribution | `lib/brand.ts`, `AppHeader.tsx`, `EditorMenuBar.tsx`, `index.html`, `manifest.webmanifest` |
| 8 | **Docker**: `Dockerfile.php-baremetal`, entrypoint tolerant without toolchains | `Dockerfile.php-baremetal`, `docker/entrypoint.sh`, `.dockerignore`, `.gitignore` |
| 9 | **Language mode `php`**: "PHP (php-baremetal)" option on ESP32-S3 boards, index.php + composer.json template, branded titles | `types/board.ts`, `lib/phpProjectTemplate.ts`, `store/useEditorStore.ts`, `store/useSimulatorStore.ts`, `EditorToolbar.tsx`, `utils/loadExample.ts`, `utils/useSEO.ts`, `php-language-mode.test.ts` |
| 10 | **Profile `VITE_SIM_PROFILE=php-baremetal`**: only ESP32-S3 boards in the pickers, no online-only/Pro ads, gallery limited to PHP projects, PHP starter workspace / "New project" (one "ESP32-S3 · PHP" section with DevKit, XIAO S3, Nano ESP32), no Account menu, no PRO items or "Share / Embed" in the menus, no Velxio Discord, Help menu toward php-baremetal; `libraries.json` hidden on PHP boards (packages live in composer.json) | `lib/simProfile.ts`, `lib/simProfileWorkspace.ts`, `ComponentPickerModal.tsx`, `BoardPickerModal.tsx`, `NewProjectDialog.tsx`, `EditorMenuBar.tsx`, `AppHeader.tsx`, `FileExplorer.tsx`, `main.tsx`, `sim-profile.test.ts` |
| 11 | **Site pages** (visual style from the "sim.php-baremetal.com" design canvas): home on `/` (what it is, how it works, verified peripheral table with status, examples, sim → board, Velxio credits + AGPL source offer) and examples list on `/examples` (search, runtime filter); data read from the examples themselves | `pages/php-baremetal/*` (`HomePage.tsx`, `ExamplesListPage.tsx`, `SiteChrome.tsx`, `siteData.ts`, `site.css`), `lib/simProfileRoutes.tsx` (home via upstream's `registerProRoutes` index route), `App.tsx` (1 line: `/examples`), `lib/brand.ts`, `php-site-pages.test.ts` |
| 12 | **CI / CD**: image to GHCR (`php-baremetal: image`, by hand or tag `sim-v*`; phpbm checked out from the private repo with `PHPBM_READ_TOKEN`; libqemu from the `php-baremetal-sim-qemu` Release; `VITE_SOURCE_URL` = exact commit) and deploy over SSH (`php-baremetal: deploy`, by hand, `production` environment) | `.github/workflows/php-baremetal-image.yml`, `.github/workflows/php-baremetal-deploy.yml`, `deploy/` (compose, Caddyfile, README), `Dockerfile.php-baremetal` (`ARG VITE_SOURCE_URL`), `.dockerignore` |
| 13 | `FORK.md` | |

### Safety of the visitor's `composer.json` (`normalize_composer`)
Only `php-baremetal/*` packages; `repositories` forced to the canonical registry;
no `scripts`; only plugin `conductor`; `board` forced to `generic-esp32s3-quad`
and `storage: embedded`; `runtime` ∈ {init-loop, event-driven, web-server};
validated `platform.php`/`sdk`/constraints; ≤ 40 packages, ≤ 64 files / 96 KB of
sources, paths without `..`/absolute/hidden. Engine builds: 1 at a time
(`PHPBM_MAX_PARALLEL_BUILDS`), timeouts 300 s (composer) / 1800 s (phpbm).

### "Add library"
`GET /api/phpbm/packages` (registry proxy, 15 min cache): `bm-ext` (extensions),
`bm-lib` (drivers: led-ws2812, imu-qmi8658, …) and `php-*`. Hidden: `*-hal`,
`bm-common`, `conductor`, `esp32-executor` (the conductor adds them).
Note: the registry's `search.json` returns 0 results (e.g. `q=gpio`), so we use `list.json` + `p2/`.

## Environment variables (fork)

| Variable | Default | Image `Dockerfile.php-baremetal` |
|---|---|---|
| `VELXIO_ESP32S3_PSRAM_MB` | unset (no PSRAM) | `8` |
| `MAX_ESP32_SESSIONS` | 0 = unlimited | `4` |
| `ESP32_SESSION_TIMEOUT_S` | 0 = no limit | `600` |
| `VELXIO_ENABLE_COMPILE` | 1 | `0` |
| `VITE_ENABLE_COMPILE` (build) | true | `false` |
| `VELXIO_ENABLE_PHPBM` | 0 | `1` |
| `PHPBM_CMD` / `COMPOSER_CMD` | `phpbm` / `composer` | `php /opt/phpbm/phpbm` |
| `PHPBM_SIM_CACHE` | `/var/cache/phpbm-sim` | idem (volume) |
| `PHPBM_FATFSGEN_CMD` | derived from `PHPBM_HOME` | derived |
| `PHPBM_REGISTRY`, `PHPBM_SIM_BOARD`, `PHPBM_MAX_PARALLEL_BUILDS` | registry / generic-esp32s3-quad / 1 | |
| `VITE_SOURCE_URL` (build) | `https://github.com/php-baremetal/php-baremetal-sim` | |
| `VITE_SIM_PROFILE` (build) | unset (upstream) | `php-baremetal` |
| `VELXIO_NEWS` | on | `off` (no Velxio "What's new" popup) |

## QEMU provenance

| | |
|---|---|
| Source | `qemu-source-98580369` from velxio.dev (personal key), sha256 `2ed11c89…40e8` |
| Velxio QEMU commit | `985803692859` (2026-10-31) = `libqemu-xtensa` **1.2.10** = `QEMU_ASSETS_REV=xtensa-1.2.10` |
| Mirror | `php-baremetal/php-baremetal-sim-qemu` (to be created; GPL-2.0) |
| Build | `velxio-qemu/Dockerfile.php-baremetal` (the tarball's `Dockerfile.build` lacks `tomli` and fails) |
| amd64 result | `libqemu-xtensa.so` 46.9 MB, `libqemu-riscv32.so` 43.8 MB, ~80 s on 22 cores |
| ROM | the 4 `pc-bios/*.bin` files = the ones velxio.dev distributes |

## Build context outside git

- `prebuilt/qemu/`: `.so` + ROMs (or `QEMU_RELEASE_URL`).
- `prebuilt/phpbm/`: phpbm CLI, `../tools/stage-phpbm.sh` (private repo, no public
  release; the image needs `build --merged`, which is not in the 27/10 phar).
  `--copy-links`: `vendor/php-baremetal/spec` is a path-repo symlink.
- The examples' firmware is built **inside** the image (`scripts/phpbm_warm.py`),
  so `frontend/public/firmware/php-baremetal/*.bin` is excluded from the context.

## Tests

- backend `pytest`: all green except 11 in `test_espidf_real_paths.py`, which were already
  failing upstream (they need Arduino libraries installed on the host).
- frontend `vitest` with **Node 22**: 375 files / 6013 tests, 0 failures. With the host's Node 20.10
  the jsdom tests don't start (`ERR_REQUIRE_ESM`, needs Node ≥ 20.17): an environment issue.
- End-to-end by hand: cold build 87 s → edited `index.php` 0.1 s (engine cached) →
  boot in QEMU with the new output (`EDITED IN THE SIMULATOR: SOS on GPIO 2`).

## Known limitations / TODO

- **Addressable LEDs (WS2812) do not work on the S3**: in `velxio-qemu` the S3 RMT is an
  `unimp_device` (`hw/xtensa/esp32s3.c`, `esp32s3.rmt`), so the driver waits forever in
  `new Ws2812(...)`. The RMT model exists only for the classic ESP32 (`hw/ssi/esp32_rmt.c`).
  Decision (2026-11-06): leave it out; project ready in `../examples-src/led-ring`, homepage marks it "Not available".
- QEMU doesn't model the internal pull-up: before a button is driven,
  GPIO4 reads 0 (LED on at boot in button-led).
- php-baremetal logo/favicon/palette not yet applied (no assets in `logos/`).
- The hot `load_firmware` loses sensors/wifi/bus_map (upstream behaviour); PSRAM survives
  because it comes from the env.
- Before a public release: CI (`velxio-qemu` release + GHCR image), `deploy/` compose + proxy.

## Aligning with upstream

```bash
git fetch upstream
git checkout master && git merge --ff-only upstream/master && git push origin master
git checkout php-baremetal && git rebase master
```

If `QEMU_ASSETS_REV` changes in `Dockerfile.standalone`: download the new
`qemu-source-*`, update `velxio-qemu`, and make a new tag/Release.
