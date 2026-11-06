/**
 * php-baremetal fork: PHP as a board language mode, and the deployment's
 * page titles.
 */
import { describe, expect, it } from 'vitest';
import { BOARD_SUPPORTS_PHP } from '../types/board';
import { PHP_DEFAULT_FILES } from '../lib/phpProjectTemplate';
import { requiredPackages } from '../services/phpbmPackages';
import { useEditorStore } from '../store/useEditorStore';
import { brandTitle } from '../lib/brand';

describe('PHP language mode', () => {
  it('is offered on the ESP32-S3 boards only', () => {
    expect([...BOARD_SUPPORTS_PHP].sort()).toEqual(['arduino-nano-esp32', 'esp32-s3', 'xiao-esp32-s3']);
  });

  it('seeds a php-baremetal project: index.php + composer.json', () => {
    useEditorStore.getState().createFileGroup('group-php-test', 'php');
    const files = useEditorStore.getState().getGroupFiles('group-php-test');
    expect(files.map((f) => f.name)).toEqual(['index.php', 'composer.json']);
    expect(files[0].content).toContain('function loop(');
    useEditorStore.getState().deleteFileGroup('group-php-test');
  });

  it('the template composer.json targets the simulator board with gpio', () => {
    const composer = JSON.parse(PHP_DEFAULT_FILES[1].content);
    expect(composer.extra.baremetal.board).toBe('generic-esp32s3-quad');
    expect(Object.keys(requiredPackages(PHP_DEFAULT_FILES[1].content))).toContain('php-baremetal/ext-gpio');
  });
});

describe('brandTitle', () => {
  it('renames the upstream suffixes', () => {
    expect(brandTitle('PHP on ESP32-S3: Blink SOS — Velxio Arduino Simulator')).toBe(
      'PHP on ESP32-S3: Blink SOS | php-baremetal sim',
    );
    expect(brandTitle('Multi-Board Simulator Editor — Arduino, ESP32, RP2040, RISC-V | Velxio')).toBe(
      'Editor | php-baremetal sim',
    );
    expect(brandTitle('Example — Velxio')).toBe('Example | php-baremetal sim');
    expect(brandTitle('Velxio')).toBe('php-baremetal sim');
  });
});

describe('brandTitle is idempotent', () => {
  it('leaves an already branded title alone', () => {
    expect(brandTitle('Blink | php-baremetal sim')).toBe('Blink | php-baremetal sim');
    expect(brandTitle('php-baremetal sim')).toBe('php-baremetal sim');
  });
});
