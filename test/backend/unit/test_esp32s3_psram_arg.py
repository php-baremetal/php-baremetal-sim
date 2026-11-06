"""
Tests for the `-m` (external PSRAM) argument of the ESP32-S3 QEMU launch
(php-baremetal fork). A firmware built with CONFIG_SPIRAM reboots forever
on a machine without PSRAM, so the decision lives in a shipped helper.
"""
import unittest

from app.services.esp32_worker import psram_arg


class TestPsramArg(unittest.TestCase):

    def test_no_psram_by_default(self):
        self.assertIsNone(psram_arg('esp32s3-picsimlab', None, env={}))

    def test_deployment_default_from_env(self):
        env = {'VELXIO_ESP32S3_PSRAM_MB': '8'}
        self.assertEqual(psram_arg('esp32s3-picsimlab', None, env=env), '8M')

    def test_start_config_wins_over_env(self):
        env = {'VELXIO_ESP32S3_PSRAM_MB': '8'}
        self.assertEqual(psram_arg('esp32s3-picsimlab', 2, env=env), '2M')

    def test_zero_in_config_disables_it(self):
        env = {'VELXIO_ESP32S3_PSRAM_MB': '8'}
        self.assertIsNone(psram_arg('esp32s3-picsimlab', 0, env=env))

    def test_only_s3_machines(self):
        env = {'VELXIO_ESP32S3_PSRAM_MB': '8'}
        self.assertIsNone(psram_arg('esp32-picsimlab', None, env=env))
        self.assertIsNone(psram_arg('esp32c3-picsimlab', None, env=env))

    def test_garbage_means_none(self):
        self.assertIsNone(psram_arg('esp32s3-picsimlab', None, env={'VELXIO_ESP32S3_PSRAM_MB': 'lots'}))

    def test_clamped_to_32mb(self):
        self.assertEqual(psram_arg('esp32s3-picsimlab', 64, env={}), '32M')


if __name__ == '__main__':
    unittest.main()
