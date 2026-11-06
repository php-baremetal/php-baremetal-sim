"""
php-baremetal projects in the simulator (php-baremetal fork).

  POST /api/phpbm/build/start   {files: [{name, content}]} -> {job_id}
  GET  /api/phpbm/build/{id}    -> {status, log, binary_content?, error?}
  GET  /api/phpbm/packages      -> the registry's user-facing packages

Mounted only with VELXIO_ENABLE_PHPBM=1 (see app/main.py).
"""
from __future__ import annotations

import asyncio
import logging
import time

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.phpbm_builder import REGISTRY, JobRegistry, PhpbmBuilder

logger = logging.getLogger(__name__)
router = APIRouter()
jobs = JobRegistry(PhpbmBuilder())


class ProjectFile(BaseModel):
    name: str
    content: str


class BuildRequest(BaseModel):
    files: list[ProjectFile]


@router.post('/build/start')
async def build_start(req: BuildRequest):
    job = jobs.start([f.model_dump() for f in req.files])
    return {'job_id': job.id}


@router.get('/build/{job_id}')
async def build_status(job_id: str):
    job = jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail='unknown build job')
    body = {'status': job.status, 'log': '\n'.join(job.log[-400:])}
    if job.status == 'done' and job.result:
        body.update(job.result)
    if job.status == 'error':
        body['error'] = job.error
    return body


# ── package list (proxied: the browser never talks to the registry) ─────────
# The user-facing kinds only: extensions (bm-ext), device drivers (bm-lib, e.g.
# led-ws2812, imu-qmi8658) and PHP extensions (php-*). HALs and transports
# (bm-hal / esp32-*) are added by the conductor; bm-common is shared plumbing.
_USER_TYPES = ('bm-ext', 'bm-lib')
_CACHE_TTL_S = 900
_cache: dict = {'at': 0.0, 'packages': None}
_cache_lock = asyncio.Lock()


def _user_facing(name: str, kind: str | None) -> bool:
    short = name.split('/', 1)[-1]
    # bm-common / conductor / esp32-executor: plumbing other packages pull in.
    if short.startswith('bm-') or short in ('conductor', 'esp32-executor') or short.endswith('-hal'):
        return False
    return kind in _USER_TYPES or short.startswith('php-')


async def _fetch_packages() -> list[dict]:
    async with httpx.AsyncClient(timeout=15) as client:
        names = (await client.get(f'{REGISTRY}/list.json')).json().get('packageNames', [])

        async def one(name: str):
            try:
                r = await client.get(f'{REGISTRY}/p2/{name}.json')
                versions = r.json()['packages'][name]
            except Exception as exc:  # noqa: BLE001 — one bad entry must not empty the list
                logger.warning('registry metadata for %s: %s', name, exc)
                return None
            latest = versions[0]
            kind = latest.get('type')
            if not _user_facing(name, kind):
                return None
            return {
                'name': name,
                'type': kind,
                'version': latest.get('version'),
                'description': latest.get('description') or '',
                'constraint': '^' + '.'.join(str(latest.get('version', '1.0')).lstrip('v').split('.')[:2]),
            }

        found = await asyncio.gather(*(one(n) for n in names))
    return sorted((p for p in found if p), key=lambda p: p['name'])


@router.get('/packages')
async def packages():
    async with _cache_lock:
        if _cache['packages'] is None or time.time() - _cache['at'] > _CACHE_TTL_S:
            try:
                _cache['packages'] = await _fetch_packages()
                _cache['at'] = time.time()
            except Exception as exc:  # noqa: BLE001
                logger.warning('registry unreachable: %s', exc)
                if _cache['packages'] is None:
                    raise HTTPException(status_code=502, detail='package registry unreachable') from None
    return {'registry': REGISTRY, 'packages': _cache['packages']}
