/**
 * php-baremetal projects (php-baremetal fork).
 *
 * A board whose files include a composer.json is a php-baremetal project:
 * composer.json picks the firmware's packages, the other files are the PHP
 * sources. Compile/Run send them to /api/phpbm, which resolves the packages,
 * reuses (or, for a new lock, builds) the PHP engine and packs the sources
 * into the storage partition; the result is a merged ESP32-S3 flash image
 * the board runs like any other ESP32 firmware.
 *
 * Plugged into compileCode() through the `__velxio_prebuilt_firmware__` seam,
 * so the toolbar's compile path (console, progress card, compileBoardProgram)
 * is reused unchanged. Any other project falls through to the normal compiler.
 */
import { getApiBase } from '../lib/apiBase';
import type { CompileProgress, CompileResult, SketchFile } from './compilation';

export const PHPBM_POLL_MS = 1500;
const PHPBM_TIMEOUT_MS = 40 * 60 * 1000;

export function isPhpbmProject(files: readonly { name: string }[]): boolean {
  return files.some((f) => f.name === 'composer.json');
}

interface BuildStatus {
  status: 'queued' | 'running' | 'done' | 'error';
  log: string;
  binary_content?: string;
  engine_cached?: boolean;
  error?: string;
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export async function buildPhpbmProject(
  files: SketchFile[],
  onProgress?: CompileProgress,
  deps: { fetch?: Fetch; sleep?: (ms: number) => Promise<void>; now?: () => number } = {},
): Promise<CompileResult> {
  const doFetch = deps.fetch ?? ((u, i) => fetch(u, i));
  const sleep = deps.sleep ?? ((ms) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = deps.now ?? (() => Date.now());
  const base = getApiBase();
  const started = now();

  const fail = (error: string, log = ''): CompileResult => ({
    success: false,
    stdout: log,
    stderr: error,
    error,
    error_kind: 'compile_error',
  });

  let jobId: string;
  try {
    const r = await doFetch(`${base}/phpbm/build/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: files.map((f) => ({ name: f.name, content: f.content })) }),
    });
    if (r.status === 404) {
      return fail('This instance cannot build php-baremetal projects (VELXIO_ENABLE_PHPBM is off).');
    }
    if (!r.ok) return fail(`php-baremetal build could not start (HTTP ${r.status})`);
    jobId = ((await r.json()) as { job_id: string }).job_id;
  } catch (e) {
    return fail(`php-baremetal build could not start: ${String(e)}`);
  }

  for (;;) {
    if (now() - started > PHPBM_TIMEOUT_MS) return fail('php-baremetal build timed out');
    let s: BuildStatus;
    try {
      const r = await doFetch(`${base}/phpbm/build/${jobId}`);
      if (!r.ok) return fail(`php-baremetal build status: HTTP ${r.status}`);
      s = (await r.json()) as BuildStatus;
    } catch (e) {
      return fail(`php-baremetal build status: ${String(e)}`);
    }
    const elapsed = Math.round((now() - started) / 1000);
    const finished = s.status === 'done' || s.status === 'error';
    onProgress?.({
      state: finished ? 'done' : s.status === 'queued' ? 'pending' : 'running',
      stdout: s.log,
      elapsedSeconds: elapsed,
      stage: s.status === 'queued' ? 'queued' : 'compiling',
      progress: null,
      estimatedSeconds: null,
      buildSeconds: elapsed,
      serverLoad: 'low',
      tier: 'local',
      priority: false,
    });
    if (s.status === 'done' && s.binary_content) {
      return { success: true, binary_content: s.binary_content, stdout: s.log, stderr: '', has_wifi: false };
    }
    if (s.status === 'error') return fail(s.error ?? 'php-baremetal build failed', s.log);
    await sleep(PHPBM_POLL_MS);
  }
}

type Provider = (
  files: SketchFile[],
  board: string,
  onProgress?: CompileProgress,
) => Promise<CompileResult | null>;

/** Install the php-baremetal provider on the compileCode() seam, in front of any other one. */
export function installPhpbmProvider(): void {
  const w = globalThis as { __velxio_prebuilt_firmware__?: Provider };
  const previous = w.__velxio_prebuilt_firmware__;
  w.__velxio_prebuilt_firmware__ = async (files, board, onProgress) => {
    if (isPhpbmProject(files)) return buildPhpbmProject(files, onProgress);
    return previous ? previous(files, board, onProgress) : null;
  };
}
