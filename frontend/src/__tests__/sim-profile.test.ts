/**
 * php-baremetal fork: VITE_SIM_PROFILE=php-baremetal hides what the
 * deployment cannot run; unset, everything behaves as upstream.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

async function load(profile: string | undefined) {
  vi.resetModules();
  vi.stubEnv('VITE_SIM_PROFILE', profile ?? '');
  const sim = await import('../lib/simProfile');
  const ads = await import('../lib/onlineOnlyBoards');
  const gallery = await import('../lib/galleryExampleFilter');
  const { exampleProjects } = await import('../data/examples');
  return { sim, ads, gallery, exampleProjects };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('php-baremetal profile', () => {
  it('keeps only the ESP32-S3 boards', async () => {
    const { sim } = await load('php-baremetal');
    expect(sim.profileBoards(['arduino-uno', 'esp32-s3', 'raspberry-pi-3', 'xiao-esp32-s3', 'esp32-c3'])).toEqual([
      'esp32-s3',
      'xiao-esp32-s3',
    ]);
  });

  it('suppresses the online-only ads and narrows the gallery to PHP projects', async () => {
    const { sim, ads, gallery, exampleProjects } = await load('php-baremetal');
    sim.installSimProfile();
    for (const ad of [...ads.ONLINE_ONLY_BOARD_ADS, ...ads.ONLINE_ONLY_COMPONENT_ADS]) {
      expect(ads.isOnlineOnlyAdSuppressed(ad.id)).toBe(true);
    }
    const shown = gallery.galleryExamples(exampleProjects).map((e) => e.id);
    expect(shown).toEqual(expect.arrayContaining(['php-baremetal-blink-sos', 'php-baremetal-button-led']));
    expect(shown.every((id) => id.startsWith('php-baremetal-'))).toBe(true);
    gallery.installGalleryExampleFilter(null);
  });

  it('is a no-op without the profile', async () => {
    const { sim, ads, gallery, exampleProjects } = await load(undefined);
    expect(sim.PHP_BAREMETAL_PROFILE).toBe(false);
    expect(sim.profileBoards(['arduino-uno', 'esp32-c3'])).toEqual(['arduino-uno', 'esp32-c3']);
    sim.installSimProfile();
    expect(ads.ONLINE_ONLY_BOARD_ADS.some((a) => ads.isOnlineOnlyAdSuppressed(a.id))).toBe(false);
    expect(gallery.galleryExamples(exampleProjects)).toHaveLength(exampleProjects.length);
  });
});

describe('PHP starter circuit', () => {
  it('wires GPIO2 -> 330R -> LED -> GND on each ESP32-S3 board', async () => {
    vi.resetModules();
    const { starterCircuit } = await import('../lib/simProfileWorkspace');
    const { boardPinToNumber } = await import('../utils/boardPinMapping');
    for (const kind of ['esp32-s3', 'xiao-esp32-s3', 'arduino-nano-esp32']) {
      const { components, wires } = starterCircuit(kind, kind, 50, 50);
      expect(components.map((c) => c.metadataId)).toEqual(['resistor', 'led']);
      const gpio = wires.find((w) => w.id === 'w-gpio2-r')!;
      expect(boardPinToNumber(kind, gpio.start.pinName), kind).toBe(2);
      const gnd = wires.find((w) => w.id === 'w-led-gnd')!;
      expect(gnd.end.pinName, kind).toMatch(/^GND/);
    }
  });
});
