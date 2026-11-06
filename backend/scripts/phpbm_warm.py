"""
Pre-build php-baremetal example firmware (php-baremetal fork).

  python -m scripts.phpbm_warm <examples-dir> <out-dir>

Each subdirectory of <examples-dir> holding a composer.json and an index.php
(frontend/src/data/php-baremetal/<id>/) is built with the same PhpbmBuilder
the /api/phpbm route uses, so the image ships:
  * <out-dir>/<id>.bin — the gallery's prebuilt firmware (prebuiltFirmwareUrl);
  * the engine of every example's lock in PHPBM_SIM_CACHE, so a visitor who
    edits an example's index.php gets a firmware in well under a second.
"""
import asyncio
import base64
import sys
from pathlib import Path

from app.services.phpbm_builder import PhpbmBuilder


async def main(src: Path, out: Path) -> int:
    builder = PhpbmBuilder()
    out.mkdir(parents=True, exist_ok=True)
    failed = 0
    for project in sorted(p for p in src.iterdir() if (p / 'composer.json').is_file()):
        files = [{'name': f.name, 'content': f.read_text()}
                 for f in sorted(project.iterdir()) if f.is_file()]
        log: list[str] = []
        try:
            result = await builder.build(files, log)
        except Exception as exc:  # noqa: BLE001
            print(f'[warm] {project.name}: FAILED: {exc}\n' + '\n'.join(log[-40:]), flush=True)
            failed += 1
            continue
        (out / f'{project.name}.bin').write_bytes(base64.b64decode(result['binary_content']))
        print(f'[warm] {project.name}: engine {result["engine_key"][:12]} '
              f'({"cached" if result["engine_cached"] else "built"})', flush=True)
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(asyncio.run(main(Path(sys.argv[1]), Path(sys.argv[2]))))
