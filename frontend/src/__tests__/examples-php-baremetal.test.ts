/**
 * php-baremetal fork: gallery examples that run a PREBUILT firmware.
 *
 * The board names its image by URL; the loader fetches it and parses it with
 * the same readFirmwareFile() the toolbar's "Upload firmware" uses, so Run
 * boots it without compiling.
 */
import { describe, expect, it, vi } from 'vitest';
import { exampleProjects } from '../data/examples';
import { phpBaremetalExamples } from '../data/examples-php-baremetal';
import { resolvePrebuiltFirmware } from '../utils/prebuiltFirmware';

const respond = (bytes: number[], status = 200) =>
  Promise.resolve(new Response(new Uint8Array(bytes), { status }));

describe('php-baremetal examples', () => {
  it('are registered in the gallery', () => {
    const ids = new Set(exampleProjects.map((e) => e.id));
    for (const ex of phpBaremetalExamples) expect(ids.has(ex.id)).toBe(true);
  });

  it('each runs one ESP32-S3 with a prebuilt image and shows its index.php', () => {
    for (const ex of phpBaremetalExamples) {
      expect(ex.boards).toHaveLength(1);
      const [board] = ex.boards!;
      expect(board.boardKind).toBe('esp32-s3');
      expect(board.prebuiltFirmwareUrl).toBe(
        `/firmware/php-baremetal/${ex.id.replace(/^php-baremetal-/, '')}.bin`,
      );
      expect(board.files?.[0].name).toBe('index.php');
      expect(board.files?.[0].content).toMatch(/^<\?php/);
      // init-loop projects define loop(); event-driven ones listen for events instead.
      const runtime = JSON.parse(board.files![1].content).extra.baremetal.runtime;
      if (runtime === 'event-driven') expect(board.files?.[0].content).toContain('Events::listen(');
      else expect(board.files?.[0].content).toContain('function loop(');
    }
  });

  it('wire only to components the example declares', () => {
    for (const ex of phpBaremetalExamples) {
      const known = new Set([...ex.components.map((c) => c.id), 'esp32-s3']);
      for (const w of ex.wires) {
        expect(known.has(w.start.componentId)).toBe(true);
        expect(known.has(w.end.componentId)).toBe(true);
      }
    }
  });
});

describe('resolvePrebuiltFirmware', () => {
  it('returns null when the board names no image', async () => {
    const fetcher = vi.fn();
    expect(await resolvePrebuiltFirmware(undefined, 'esp32-s3', fetcher)).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('fetches the image and returns it as the base64 program Upload firmware produces', async () => {
    const fetcher = vi.fn(() => respond([0xe9, 0x03, 0x02, 0x20, 0xff]));
    const fw = await resolvePrebuiltFirmware('/firmware/php-baremetal/x.bin', 'esp32-s3', fetcher);
    expect(fetcher).toHaveBeenCalledWith('/firmware/php-baremetal/x.bin');
    expect(fw?.program).toBe(btoa(String.fromCharCode(0xe9, 0x03, 0x02, 0x20, 0xff)));
    expect(fw?.message).toMatch(/binary firmware/);
  });

  it('a missing image costs the program, not the example', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetcher = vi.fn(() => respond([], 404));
    expect(await resolvePrebuiltFirmware('/firmware/nope.bin', 'esp32-s3', fetcher)).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
