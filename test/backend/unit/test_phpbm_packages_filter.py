"""Which registry packages the php-baremetal Add-library dialog offers (php-baremetal fork)."""
import unittest

from app.api.routes.phpbm import _user_facing


class TestUserFacingPackages(unittest.TestCase):

    def test_offered(self):
        for name, kind in (('php-baremetal/ext-gpio', 'bm-ext'),
                           ('php-baremetal/led-ws2812', 'bm-lib'),
                           ('php-baremetal/esp32-display-st77916', 'bm-lib'),
                           ('php-baremetal/php-mbstring', 'bm-php-ext')):
            with self.subTest(name=name):
                self.assertTrue(_user_facing(name, kind))

    def test_hidden(self):
        for name, kind in (('php-baremetal/esp32-gpio-hal', 'bm-hal'),
                           ('php-baremetal/bm-common', 'bm-lib'),
                           ('php-baremetal/esp32-executor', 'bm-lib'),
                           ('php-baremetal/conductor', 'composer-plugin')):
            with self.subTest(name=name):
                self.assertFalse(_user_facing(name, kind))


if __name__ == '__main__':
    unittest.main()
