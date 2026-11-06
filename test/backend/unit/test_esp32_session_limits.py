"""
Public-instance limits on ESP32 workers (php-baremetal fork):
MAX_ESP32_SESSIONS caps concurrent QEMU workers, ESP32_SESSION_TIMEOUT_S
stops a worker after a wall-clock budget. Both off by default (upstream).
"""
import asyncio
import os
import threading
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services import esp32_lib_manager as m


def _fake_instance(callback):
    proc = MagicMock()
    proc.wait.return_value = 0
    return m._WorkerInstance(
        process=proc, stdin_lock=threading.Lock(), callback=callback,
        board_type='esp32-s3', uart_bufs={0: m._UartBuffer(0)}, threads=[],
        loop=MagicMock(),
    )


class TestSessionCap(unittest.IsolatedAsyncioTestCase):

    async def test_unlimited_by_default(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop('MAX_ESP32_SESSIONS', None)
            self.assertEqual(m.max_esp32_sessions(), 0)
            self.assertEqual(m.esp32_session_timeout_s(), 0)

    async def test_refuses_a_start_over_the_cap_without_launching(self):
        mgr = m.EspLibManager()
        mgr._instances['other::esp32-s3'] = _fake_instance(AsyncMock())
        cb = AsyncMock()
        with patch.dict(os.environ, {'MAX_ESP32_SESSIONS': '1'}), \
             patch.object(m.subprocess, 'Popen') as popen:
            await mgr.start_instance('me::esp32-s3', 'esp32-s3', cb, firmware_b64='AAAA')
        popen.assert_not_called()
        cb.assert_awaited_once()
        kind, data = cb.await_args.args
        self.assertEqual(kind, 'error')
        self.assertIn('all 1 ESP32 slots', data['message'])
        self.assertNotIn('me::esp32-s3', mgr._instances)

    async def test_garbage_limit_is_ignored(self):
        with patch.dict(os.environ, {'MAX_ESP32_SESSIONS': 'many'}):
            self.assertEqual(m.max_esp32_sessions(), 0)


class TestSessionTimeout(unittest.IsolatedAsyncioTestCase):

    async def test_expire_stops_the_armed_worker_and_says_why(self):
        mgr = m.EspLibManager()
        cb = AsyncMock()
        inst = _fake_instance(cb)
        mgr._instances['me::esp32-s3'] = inst
        await mgr._expire('me::esp32-s3', inst, 600)
        self.assertNotIn('me::esp32-s3', mgr._instances)
        kinds = [c.args[0] for c in cb.await_args_list]
        self.assertIn('error', kinds)
        msg = next(c.args[1]['message'] for c in cb.await_args_list if c.args[0] == 'error')
        self.assertIn('10 minutes', msg)

    async def test_expire_leaves_a_restarted_worker_alone(self):
        mgr = m.EspLibManager()
        old, new = _fake_instance(AsyncMock()), _fake_instance(AsyncMock())
        mgr._instances['me::esp32-s3'] = new
        await mgr._expire('me::esp32-s3', old, 600)
        self.assertIs(mgr._instances['me::esp32-s3'], new)
        new.callback.assert_not_awaited()


if __name__ == '__main__':
    unittest.main()
