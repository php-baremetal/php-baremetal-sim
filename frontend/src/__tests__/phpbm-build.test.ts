/**
 * php-baremetal projects (php-baremetal fork): the compileCode() provider
 * that builds composer.json + PHP sources through /api/phpbm, and the
 * composer.json edits behind "Add library".
 */
import { describe, expect, it, vi } from 'vitest';
import { buildPhpbmProject, isPhpbmProject, installPhpbmProvider } from '../services/phpbmBuild';
import { addRequire, removeRequire, requiredPackages } from '../services/phpbmPackages';

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

const FILES = [
  { name: 'index.php', content: '<?php echo 1;' },
  { name: 'composer.json', content: '{"require":{}}' },
];

describe('isPhpbmProject', () => {
  it('is a composer.json among the files', () => {
    expect(isPhpbmProject(FILES)).toBe(true);
    expect(isPhpbmProject([{ name: 'sketch.ino' }])).toBe(false);
  });
});

describe('buildPhpbmProject', () => {
  it('starts a job, polls it, and returns the image like a compile result', async () => {
    const statuses = [
      { status: 'running', log: 'resolving' },
      { status: 'done', log: 'resolving\nengine cached', binary_content: 'QUJD', engine_cached: true },
    ];
    const fetch = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith('/phpbm/build/start')) {
        expect(init?.method).toBe('POST');
        expect(JSON.parse(String(init?.body)).files).toEqual(FILES);
        return json({ job_id: 'j1' });
      }
      expect(url).toMatch(/\/phpbm\/build\/j1$/);
      return json(statuses.shift());
    });
    const progress = vi.fn();
    const r = await buildPhpbmProject(FILES, progress, { fetch, sleep: async () => {} });
    expect(r.success).toBe(true);
    expect(r.binary_content).toBe('QUJD');
    expect(r.stdout).toContain('engine cached');
    expect(progress).toHaveBeenCalledTimes(2);
    expect(progress.mock.calls[1][0].state).toBe('done');
  });

  it('reports a failed build with its log', async () => {
    const fetch = vi.fn((url: string) =>
      url.endsWith('/start')
        ? json({ job_id: 'j2' })
        : json({ status: 'error', log: 'composer update failed', error: 'package not found' }),
    );
    const r = await buildPhpbmProject(FILES, undefined, { fetch, sleep: async () => {} });
    expect(r.success).toBe(false);
    expect(r.error).toBe('package not found');
    expect(r.stdout).toContain('composer update failed');
  });

  it('explains an instance without the phpbm routes', async () => {
    const fetch = vi.fn(() => json({ detail: 'Not Found' }, 404));
    const r = await buildPhpbmProject(FILES, undefined, { fetch, sleep: async () => {} });
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/VELXIO_ENABLE_PHPBM/);
  });
});

describe('installPhpbmProvider', () => {
  it('handles php-baremetal projects and passes everything else on', async () => {
    const w = globalThis as { __velxio_prebuilt_firmware__?: (...a: unknown[]) => Promise<unknown> };
    const previous = vi.fn(async () => ({ success: true, stdout: 'overlay', stderr: '' }));
    w.__velxio_prebuilt_firmware__ = previous;
    installPhpbmProvider();
    const out = await w.__velxio_prebuilt_firmware__!([{ name: 'sketch.ino', content: '' }], 'esp32:esp32:esp32s3');
    expect(previous).toHaveBeenCalled();
    expect(out).toEqual({ success: true, stdout: 'overlay', stderr: '' });
    delete w.__velxio_prebuilt_firmware__;
  });
});

describe('composer.json require edits', () => {
  const base = JSON.stringify({
    name: 'x/y',
    require: { 'php-baremetal/ext-sys': '^1.0', 'php-baremetal/conductor': '^1.0' },
    extra: { baremetal: { board: 'generic-esp32s3-quad' } },
  });

  it('adds a package, keeps the other keys, sorts require', () => {
    const out = addRequire(base, 'php-baremetal/ext-gpio', '^1.0');
    const d = JSON.parse(out);
    expect(Object.keys(d.require)).toEqual([
      'php-baremetal/conductor',
      'php-baremetal/ext-gpio',
      'php-baremetal/ext-sys',
    ]);
    expect(d.extra.baremetal.board).toBe('generic-esp32s3-quad');
    expect(out.endsWith('\n')).toBe(true);
    expect(out).toContain('"php-baremetal/ext-gpio": "^1.0"');
  });

  it('removes a package', () => {
    const d = JSON.parse(removeRequire(base, 'php-baremetal/ext-sys'));
    expect(d.require).toEqual({ 'php-baremetal/conductor': '^1.0' });
  });

  it('reads the required packages, and nothing from broken JSON', () => {
    expect(Object.keys(requiredPackages(base))).toHaveLength(2);
    expect(requiredPackages('{ broken')).toEqual({});
  });

  it('refuses to edit a broken composer.json', () => {
    expect(() => addRequire('{ broken', 'php-baremetal/ext-gpio', '^1.0')).toThrow(/not valid JSON/);
  });
});
