"""
VELXIO_ENABLE_COMPILE=0 (php-baremetal fork): a firmware-only instance does
not mount the toolchain routes; the simulation WebSocket and /health stay.
"""
import importlib
import os
import unittest
from unittest.mock import patch

TOOLCHAIN = ('/api/compile', '/api/compile-chip', '/api/compile-rom', '/api/libraries',
             '/api/micropython-libs', '/api/intellisense', '/api/flash')


def _prefixes(app):
    paths = {getattr(r, 'path', '') for r in app.routes}
    return {p for p in TOOLCHAIN if any(x == p or x.startswith(p + '/') for x in paths)}, paths


class TestEnableCompileFlag(unittest.TestCase):

    def _load(self, value):
        env = {} if value is None else {'VELXIO_ENABLE_COMPILE': value}
        with patch.dict(os.environ, env, clear=False):
            if value is None:
                os.environ.pop('VELXIO_ENABLE_COMPILE', None)
            import app.main as main
            return importlib.reload(main)

    def tearDown(self):
        self._load(None)

    def test_default_mounts_every_toolchain_route(self):
        mounted, _ = _prefixes(self._load(None).app)
        self.assertEqual(mounted, set(TOOLCHAIN))

    def test_disabled_mounts_none_but_keeps_simulation_and_health(self):
        for value in ('0', 'false', 'off'):
            main = self._load(value)
            mounted, paths = _prefixes(main.app)
            self.assertEqual(mounted, set(), value)
            self.assertIn('/health', paths)
            self.assertTrue(any(p.startswith('/api/simulation') for p in paths))


if __name__ == '__main__':
    unittest.main()
