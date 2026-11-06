/**
 * php-baremetal fork: the site pages describe the examples from the examples
 * themselves (runtime and packages from composer.json, parts from the circuit).
 */
import { describe, expect, it } from 'vitest';
import { phpBaremetalExamples } from '../data/examples-php-baremetal';
import { toSiteExample } from '../pages/php-baremetal/siteData';

describe('site example data', () => {
  it('reads runtime, packages and parts from the example', () => {
    const blink = toSiteExample(phpBaremetalExamples.find((e) => e.id === 'php-baremetal-blink-sos')!);
    expect(blink.title).toBe('Blink SOS');
    expect(blink.runtime).toBe('init-loop');
    expect(blink.packages).toEqual(expect.arrayContaining(['ext-gpio', 'ext-sys']));
    expect(blink.packages).not.toContain('conductor');
    expect(blink.parts).toEqual(['resistor', 'LED']);
    expect(blink.href).toBe('/example/php-baremetal-blink-sos');
    expect(blink.board).toMatch(/ESP32-S3/);
  });

  it('lists the button for the button example', () => {
    const btn = toSiteExample(phpBaremetalExamples.find((e) => e.id === 'php-baremetal-button-led')!);
    expect(btn.parts).toContain('push button');
  });
});
