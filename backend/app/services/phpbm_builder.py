"""
php-baremetal firmware builds for the simulator (php-baremetal fork).

A php-baremetal project is a composer.json (the packages = the firmware's
features) plus project-src/ (the PHP code). With `storage: embedded` the two
land in different places of the flash image:

  * the ENGINE (bootloader, partition table, app with PHP + the extensions)
    depends only on the resolved packages: composer.lock + the locked SDK;
  * the PHP sources become the `storage` FAT partition, which ESP-IDF makes
    with components/fatfs/fatfsgen.py (fatfs_create_rawflash_image).

So a build is two steps of very different cost:

  1. engine: composer resolves the normalised composer.json against
     repository.php-baremetal.com; the lock's hash keys a cache of merged
     images. A new lock runs `phpbm build --merged` (minutes, CPU-heavy, one
     at a time); a known lock costs nothing;
  2. storage: fatfsgen over the visitor's sources, written into a copy of the
     cached engine at the storage partition's offset (well under a second).

Measured against phpbm's own output: the regenerated storage.bin differs only
in the 4-byte FAT volume serial, which fatfsgen draws at random every run.

The composer.json a visitor sends is NOT trusted: only php-baremetal/*
packages from the canonical registry, no other repositories, no scripts, the
conductor as the only plugin, and the simulator's board/storage forced (see
normalize_composer). Environment:

  VELXIO_ENABLE_PHPBM        1 to mount /api/phpbm (default off)
  PHPBM_CMD                  phpbm command line   (default "phpbm")
  COMPOSER_CMD               composer command line (default "composer")
  PHPBM_FATFSGEN_CMD         "<python> <idf>/components/fatfs/fatfsgen.py"
                             (default: derived from PHPBM_HOME's esp32 toolchain)
  PHPBM_SIM_CACHE            cache root (default /var/cache/phpbm-sim)
  PHPBM_REGISTRY             default https://repository.php-baremetal.com
  PHPBM_SIM_BOARD            default generic-esp32s3-quad
  PHPBM_MAX_PARALLEL_BUILDS  engine builds at once (default 1)
"""
from __future__ import annotations

import asyncio
import base64
import dataclasses
import glob
import hashlib
import json
import logging
import os
import re
import shlex
import shutil
import struct
import tempfile
import time
import uuid
from pathlib import Path, PurePosixPath

logger = logging.getLogger(__name__)

REGISTRY = os.environ.get('PHPBM_REGISTRY', 'https://repository.php-baremetal.com').rstrip('/')
SIM_BOARD = os.environ.get('PHPBM_SIM_BOARD', 'generic-esp32s3-quad')
CONDUCTOR = 'php-baremetal/conductor'
RUNTIMES = ('init-loop', 'event-driven', 'web-server')
DEFAULT_RUNTIME = 'init-loop'
DEFAULT_PHP = '8.5.11'
DEFAULT_SDK = 'esp32@^2.0'

_PACKAGE_RE = re.compile(r'^php-baremetal/[a-z0-9][a-z0-9_.-]{0,63}$')
_CONSTRAINT_RE = re.compile(r'^[0-9A-Za-z.*^~<>=|, @-]{1,40}$')
_PHP_RE = re.compile(r'^8\.\d{1,2}\.\d{1,3}$')
_SDK_RE = re.compile(r'^esp32@[0-9A-Za-z.*^~<>=|, -]{1,30}$')
MAX_PACKAGES = 40
MAX_SOURCE_FILES = 64
MAX_SOURCE_BYTES = 96 * 1024  # the storage partition is 128 KB, FAT takes its share


class PhpbmBuildError(Exception):
    """A build failure the visitor can act on (bad composer.json, resolution, …)."""


# ── composer.json ─────────────────────────────────────────────────────────────

def normalize_composer(raw: str | dict) -> dict:
    """The composer.json the server will actually build, from the visitor's one.

    Keeps what a project legitimately chooses (its packages and constraints,
    the PHP version, the runtime, package options) and forces everything that
    could reach outside the registry or change the simulated hardware.
    """
    try:
        src = json.loads(raw) if isinstance(raw, str) else dict(raw)
    except (TypeError, ValueError) as exc:
        raise PhpbmBuildError(f'composer.json is not valid JSON: {exc}') from None
    if not isinstance(src, dict):
        raise PhpbmBuildError('composer.json must be a JSON object')

    require_in = src.get('require') or {}
    if not isinstance(require_in, dict):
        raise PhpbmBuildError('composer.json "require" must be an object')
    require: dict[str, str] = {}
    for name, constraint in require_in.items():
        if name == 'php' or name.startswith('ext-'):
            continue  # platform requirements: the firmware decides those
        if not isinstance(name, str) or not _PACKAGE_RE.match(name):
            raise PhpbmBuildError(
                f'package "{name}" is not allowed here: only php-baremetal/* packages '
                f'from {REGISTRY} can be built in the simulator')
        if not isinstance(constraint, str) or not _CONSTRAINT_RE.match(constraint):
            raise PhpbmBuildError(f'version constraint of "{name}" is not valid: {constraint!r}')
        require[name] = constraint
    require.setdefault(CONDUCTOR, '^1.0')
    if len(require) > MAX_PACKAGES:
        raise PhpbmBuildError(f'too many packages ({len(require)}, max {MAX_PACKAGES})')

    config = src.get('config') if isinstance(src.get('config'), dict) else {}
    platform = config.get('platform') if isinstance(config.get('platform'), dict) else {}
    php = platform.get('php', DEFAULT_PHP)
    if not isinstance(php, str) or not _PHP_RE.match(php):
        raise PhpbmBuildError(f'config.platform.php must look like 8.5.11, got {php!r}')

    extra = src.get('extra') if isinstance(src.get('extra'), dict) else {}
    bm = extra.get('baremetal') if isinstance(extra.get('baremetal'), dict) else {}
    runtime = bm.get('runtime', DEFAULT_RUNTIME)
    if runtime not in RUNTIMES:
        raise PhpbmBuildError(f'extra.baremetal.runtime must be one of {", ".join(RUNTIMES)}')
    sdk = bm.get('sdk', DEFAULT_SDK)
    if not isinstance(sdk, str) or not _SDK_RE.match(sdk):
        raise PhpbmBuildError(f'extra.baremetal.sdk must be an esp32 constraint like {DEFAULT_SDK}')
    options = bm.get('options', {})
    if not isinstance(options, dict):
        raise PhpbmBuildError('extra.baremetal.options must be an object')

    return {
        'name': 'velxio-sim/project',
        'type': 'project',
        'repositories': [{'type': 'composer', 'url': REGISTRY, 'canonical': True}],
        'require': dict(sorted(require.items())),
        'config': {
            'allow-plugins': {CONDUCTOR: True},
            'platform': {'php': php},
        },
        'extra': {'baremetal': {
            'sdk': sdk,
            'board': SIM_BOARD,   # the simulated hardware, whatever the project says
            'runtime': runtime,
            'storage': 'embedded',
            **({'options': options} if options else {}),
        }},
    }


def _canonical(obj) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(',', ':')).encode()


def deps_key(normalized: dict) -> str:
    return hashlib.sha256(_canonical(normalized)).hexdigest()


# ── sources ───────────────────────────────────────────────────────────────────

def split_project(files: list[dict]) -> tuple[str, dict[str, bytes]]:
    """(composer.json text, {relative source path: bytes}) from the editor files.

    Every file that is not composer.json/composer.lock is a PHP source. A
    leading project-src/ is accepted and dropped; paths must stay inside.
    """
    composer = None
    sources: dict[str, bytes] = {}
    for f in files:
        name = str(f.get('name', '')).strip()
        content = f.get('content', '')
        if name == 'composer.json':
            composer = content
            continue
        if name in ('composer.lock', 'phpbm.lock') or not name:
            continue
        if name.startswith('project-src/'):
            name = name[len('project-src/'):]
        p = PurePosixPath(name)
        if p.is_absolute() or '..' in p.parts or any(part.startswith('.') for part in p.parts):
            raise PhpbmBuildError(f'file name not allowed: {name}')
        sources[str(p)] = content.encode() if isinstance(content, str) else bytes(content)
    if composer is None:
        raise PhpbmBuildError('the project has no composer.json')
    if not sources:
        raise PhpbmBuildError('the project has no PHP sources (index.php)')
    if len(sources) > MAX_SOURCE_FILES:
        raise PhpbmBuildError(f'too many source files ({len(sources)}, max {MAX_SOURCE_FILES})')
    total = sum(len(b) for b in sources.values())
    if total > MAX_SOURCE_BYTES:
        raise PhpbmBuildError(f'sources too large ({total // 1024} KB, max {MAX_SOURCE_BYTES // 1024} KB)')
    return composer, sources


# ── flash layout ──────────────────────────────────────────────────────────────

_PART_MAGIC = 0x50AA
_PART_FMT = '<HBBII16sI'   # magic, type, subtype, offset, size, label, flags


def partition(table: bytes, label: str) -> tuple[int, int]:
    """(offset, size) of a partition, from a binary ESP partition table."""
    for i in range(0, len(table) - 31, 32):
        magic, _t, _st, offset, size, raw_label, _f = struct.unpack_from(_PART_FMT, table, i)
        if magic != _PART_MAGIC:
            break
        if raw_label.rstrip(b'\0').decode(errors='replace') == label:
            return offset, size
    raise PhpbmBuildError(f'the firmware has no "{label}" partition')


def overlay(engine: bytes, offset: int, image: bytes) -> bytes:
    """The engine image with `image` written at `offset` (0xFF-padded if past the end)."""
    out = bytearray(engine)
    end = offset + len(image)
    if end > len(out):
        out.extend(b'\xff' * (end - len(out)))
    out[offset:end] = image
    return bytes(out)


@dataclasses.dataclass
class Engine:
    key: str
    image: Path
    storage_offset: int
    storage_size: int
    sector_size: int
    long_names: bool


# ── commands ──────────────────────────────────────────────────────────────────

def _cmd(env_name: str, default: str) -> list[str]:
    return shlex.split(os.environ.get(env_name) or default)


def fatfsgen_cmd() -> list[str]:
    configured = os.environ.get('PHPBM_FATFSGEN_CMD')
    if configured:
        return shlex.split(configured)
    home = Path(os.environ.get('PHPBM_HOME') or Path.home() / '.phpbm')
    tool = sorted(glob.glob(str(home / 'toolchains/esp32/esp-idf-*/components/fatfs/fatfsgen.py')))
    py = sorted(glob.glob(str(home / 'toolchains/esp32/tools/python_env/*/bin/python')))
    if not tool or not py:
        raise PhpbmBuildError('fatfsgen.py not found: set PHPBM_FATFSGEN_CMD')
    return [py[-1], tool[-1]]


async def _run(argv: list[str], cwd: Path, log: list[str], timeout: float) -> None:
    log.append('$ ' + ' '.join(shlex.quote(a) for a in argv))
    proc = await asyncio.create_subprocess_exec(
        *argv, cwd=str(cwd), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
        env={**os.environ, 'COMPOSER_NO_INTERACTION': '1', 'NO_COLOR': '1'},
    )
    try:
        out, _ = await asyncio.wait_for(proc.communicate(), timeout)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        raise PhpbmBuildError(f'{Path(argv[0]).name} timed out after {int(timeout)} s') from None
    text = out.decode(errors='replace')
    log.extend(text.splitlines()[-200:])
    if proc.returncode != 0:
        raise PhpbmBuildError(f'{" ".join(argv[:2])} failed (exit {proc.returncode})')


# ── builder ───────────────────────────────────────────────────────────────────

class PhpbmBuilder:
    def __init__(self, cache_root: str | Path | None = None):
        self.root = Path(cache_root or os.environ.get('PHPBM_SIM_CACHE') or '/var/cache/phpbm-sim')
        self._build_slots = asyncio.Semaphore(max(1, int(os.environ.get('PHPBM_MAX_PARALLEL_BUILDS') or 1)))
        self._key_locks: dict[str, asyncio.Lock] = {}

    def _lock(self, key: str) -> asyncio.Lock:
        return self._key_locks.setdefault(key, asyncio.Lock())

    # Step 1 ── the engine for these packages ─────────────────────────────────
    async def engine(self, normalized: dict, log: list[str]) -> tuple[Engine, bool]:
        """The cached engine for a normalised composer.json; (engine, was_cached)."""
        dkey = deps_key(normalized)
        project = self.root / 'projects' / dkey
        async with self._lock('deps:' + dkey):
            if not (project / 'composer.lock').exists():
                project.mkdir(parents=True, exist_ok=True)
                (project / 'composer.json').write_text(json.dumps(normalized, indent=2) + '\n')
                src = project / 'project-src'
                src.mkdir(exist_ok=True)
                (src / 'index.php').write_text('<?php\n')  # replaced per build (step 2)
                log.append('resolving packages against ' + REGISTRY)
                await _run(_cmd('COMPOSER_CMD', 'composer') + ['update', '--no-progress'],
                           project, log, timeout=300)

        engines = self.root / 'engines'
        # phpbm.lock (the locked SDK) only exists after this project's first
        # build: until then the key cannot be known and the engine is built.
        # The engine is stored under the key computed AFTER the build, so the
        # next project with the same packages finds it (computing it before
        # the build made every new package set build twice).
        lock_key = self._lock_key(project, normalized)
        if lock_key and (engines / f'{lock_key}.json').exists():
            return self._load(engines / f'{lock_key}.json'), True

        async with self._lock('deps-build:' + dkey):
            lock_key = self._lock_key(project, normalized)
            if lock_key and (engines / f'{lock_key}.json').exists():
                return self._load(engines / f'{lock_key}.json'), True
            log.append('new package set: building the PHP engine, this takes a few minutes')
            async with self._build_slots:
                started = time.monotonic()
                await _run(_cmd('PHPBM_CMD', 'phpbm') + ['build', '--merged'], project, log, timeout=1800)
                log.append(f'engine built in {time.monotonic() - started:.0f} s')
            lock_key = self._lock_key(project, normalized) or self._lock_key(project, normalized, dev_sdk=True)
            engines.mkdir(parents=True, exist_ok=True)
            return self._store(project, lock_key, engines), False

    @staticmethod
    def _lock_key(project: Path, normalized: dict, dev_sdk: bool = False) -> str | None:
        """sha256 of what fixes an engine: composer.lock + phpbm.lock + extra.baremetal.

        None while phpbm.lock is missing (before the project's first build).
        An SDK linked as esp32@dev is never locked by phpbm: with dev_sdk the
        key stands in its fingerprint from the build, so the engine is reused
        until that build input changes.
        """
        phpbm_lock = project / 'phpbm.lock'
        if phpbm_lock.exists():
            sdk = phpbm_lock.read_bytes()
        elif dev_sdk and (project / '.phpbm/build/fingerprint.json').exists():
            sdk = (project / '.phpbm/build/fingerprint.json').read_bytes()
        else:
            return None
        return hashlib.sha256(
            (project / 'composer.lock').read_bytes() + sdk + _canonical(normalized['extra'])
        ).hexdigest()

    def _store(self, project: Path, key: str, engines: Path) -> Engine:
        build = project / '.phpbm' / 'build'
        table = (build / 'idf' / 'partition_table' / 'partition-table.bin').read_bytes()
        offset, size = partition(table, 'storage')
        sdk = (build / 'sdkconfig').read_text(errors='replace')
        sector = 4096
        for n in (512, 1024, 2048):
            if f'CONFIG_FATFS_SECTOR_{n}=y' in sdk:
                sector = n
        long_names = 'CONFIG_FATFS_LFN_NONE=y' not in sdk
        image = engines / f'{key}.bin'
        shutil.copyfile(build / 'merged.bin', str(image) + '.part')
        os.replace(str(image) + '.part', image)
        meta = {'storage_offset': offset, 'storage_size': size, 'sector_size': sector,
                'long_names': long_names}
        (engines / f'{key}.json').write_text(json.dumps(meta))
        return self._load(engines / f'{key}.json')

    @staticmethod
    def _load(meta_path: Path) -> Engine:
        meta = json.loads(meta_path.read_text())
        return Engine(key=meta_path.stem, image=meta_path.with_suffix('.bin'),
                      storage_offset=meta['storage_offset'], storage_size=meta['storage_size'],
                      sector_size=meta['sector_size'], long_names=meta['long_names'])

    # Step 2 ── the visitor's sources ─────────────────────────────────────────
    async def storage(self, engine: Engine, sources: dict[str, bytes], log: list[str]) -> bytes:
        with tempfile.TemporaryDirectory(prefix='phpbm-src-') as tmp:
            src = Path(tmp) / 'project-src'
            for rel, data in sources.items():
                dest = src / rel
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(data)
            out = Path(tmp) / 'storage.bin'
            argv = fatfsgen_cmd() + [str(src)]
            if engine.long_names:
                argv.append('--long_name_support')
            argv += ['--use_default_datetime', '--partition_size', hex(engine.storage_size),
                     '--output_file', str(out), '--sector_size', str(engine.sector_size)]
            await _run(argv, Path(tmp), log, timeout=60)
            return out.read_bytes()

    async def build(self, files: list[dict], log: list[str]) -> dict:
        composer, sources = split_project(files)
        normalized = normalize_composer(composer)
        engine, cached = await self.engine(normalized, log)
        log.append(f'engine {engine.key[:12]} ({"cached" if cached else "new"}); packing {len(sources)} source file(s)')
        storage = await self.storage(engine, sources, log)
        image = overlay(engine.image.read_bytes(), engine.storage_offset, storage)
        return {'binary_content': base64.b64encode(image).decode(), 'engine_key': engine.key,
                'engine_cached': cached}


# ── jobs (start + poll: a cold engine build outlives an HTTP request) ─────────

@dataclasses.dataclass
class Job:
    id: str
    status: str = 'queued'          # queued | running | done | error
    log: list[str] = dataclasses.field(default_factory=list)
    result: dict | None = None
    error: str | None = None
    created: float = dataclasses.field(default_factory=time.time)


class JobRegistry:
    TTL_S = 900

    def __init__(self, builder: PhpbmBuilder):
        self.builder = builder
        self.jobs: dict[str, Job] = {}

    def start(self, files: list[dict]) -> Job:
        self._expire()
        job = Job(id=uuid.uuid4().hex)
        self.jobs[job.id] = job
        asyncio.get_running_loop().create_task(self._run(job, files))
        return job

    async def _run(self, job: Job, files: list[dict]) -> None:
        job.status = 'running'
        try:
            job.result = await self.builder.build(files, job.log)
            job.status = 'done'
        except PhpbmBuildError as exc:
            job.error, job.status = str(exc), 'error'
        except Exception as exc:  # noqa: BLE001 — reported to the visitor, logged in full here
            logger.exception('phpbm build %s failed', job.id)
            job.error, job.status = f'internal error: {type(exc).__name__}', 'error'

    def get(self, job_id: str) -> Job | None:
        return self.jobs.get(job_id)

    def _expire(self) -> None:
        cutoff = time.time() - self.TTL_S
        for jid in [j for j, job in self.jobs.items() if job.created < cutoff]:
            self.jobs.pop(jid, None)
