import type { ExampleProject } from './examples';
import blinkSosPhp from './php-baremetal/blink-sos/index.php?raw';
import buttonLedPhp from './php-baremetal/button-led/index.php?raw';
import blinkSosComposer from './php-baremetal/blink-sos/composer.json?raw';
import buttonLedComposer from './php-baremetal/button-led/composer.json?raw';
import i2cClockPhp from './php-baremetal/i2c-clock/index.php?raw';
import i2cClockComposer from './php-baremetal/i2c-clock/composer.json?raw';
import buttonEventsPhp from './php-baremetal/button-events/index.php?raw';
import buttonEventsComposer from './php-baremetal/button-events/composer.json?raw';

/**
 * php-baremetal examples (php-baremetal fork).
 *
 * Each one runs a PREBUILT php-baremetal firmware: PHP 8.5 on an ESP32-S3
 * (board `generic-esp32s3-quad`, quad PSRAM, UART console), built with
 * `phpbm build --merged` from the example's composer.json/lock and
 * project-src/. The image is served from /firmware/php-baremetal/<id>.bin
 * (fetched at image build time, never committed) and loaded like
 * "Upload firmware", so Run boots it without compiling.
 *
 * The board's files are the project itself: index.php (the code) and
 * composer.json (the packages = the firmware's features). Editing either and
 * pressing Run rebuilds through /api/phpbm (services/phpbmBuild.ts): a code
 * change only repacks the storage partition; a package change builds a new
 * engine once per lock. "Add package" edits composer.json's require.
 *
 * The backend must attach PSRAM to the S3 (VELXIO_ESP32S3_PSRAM_MB=8): the
 * runtime's heap lives there and the firmware aborts at boot without it.
 */
const FW = '/firmware/php-baremetal';

export const phpBaremetalExamples: ExampleProject[] = [
  {
    id: 'php-baremetal-blink-sos',
    title: 'PHP on ESP32-S3: Blink SOS',
    description:
      'PHP 8.5 running on an ESP32-S3: setup() configures GPIO2 and loop() ' +
      'blinks "SOS" in Morse code on an external LED. Prebuilt php-baremetal ' +
      'firmware, press Run.',
    category: 'basics',
    difficulty: 'beginner',
    boardFilter: 'esp32-s3',
    tags: ['php', 'php-baremetal', 'esp32-s3', 'gpio', 'led', 'blink'],
    boards: [
      {
        boardKind: 'esp32-s3',
        x: 260,
        y: 60,
        files: [
          { name: 'index.php', content: blinkSosPhp },
          { name: 'composer.json', content: blinkSosComposer },
        ],
        prebuiltFirmwareUrl: `${FW}/blink-sos.bin`,
      },
    ],
    code: '',
    components: [
      // ~330R, as in the example's comment, keeps the LED in its rating at 3.3 V.
      { type: 'wokwi-resistor', id: 'r-led', x: 430, y: 130, properties: { value: '330' } },
      { type: 'wokwi-led', id: 'led1', x: 560, y: 90, properties: { color: 'red' } },
    ],
    wires: [
      {
        id: 'w-gpio2-r',
        start: { componentId: 'esp32-s3', pinName: '2' },
        end: { componentId: 'r-led', pinName: '1' },
        color: '#e74c3c',
      },
      {
        id: 'w-r-led',
        start: { componentId: 'r-led', pinName: '2' },
        end: { componentId: 'led1', pinName: 'A' },
        color: '#e74c3c',
      },
      {
        id: 'w-led-gnd',
        start: { componentId: 'led1', pinName: 'C' },
        end: { componentId: 'esp32-s3', pinName: 'GND.2' },
        color: '#2c3e50',
      },
    ],
  },
  {
    id: 'php-baremetal-button-led',
    title: 'PHP on ESP32-S3: Button → LED',
    description:
      'PHP 8.5 running on an ESP32-S3: loop() reads a push button on GPIO4 ' +
      '(internal pull-up, pressed = 0) and mirrors it to an LED on GPIO2. ' +
      'Prebuilt php-baremetal firmware, press Run and click the button.',
    category: 'basics',
    difficulty: 'beginner',
    boardFilter: 'esp32-s3',
    tags: ['php', 'php-baremetal', 'esp32-s3', 'gpio', 'button', 'input', 'led'],
    boards: [
      {
        boardKind: 'esp32-s3',
        x: 260,
        y: 60,
        files: [
          { name: 'index.php', content: buttonLedPhp },
          { name: 'composer.json', content: buttonLedComposer },
        ],
        prebuiltFirmwareUrl: `${FW}/button-led.bin`,
      },
    ],
    code: '',
    components: [
      { type: 'wokwi-pushbutton', id: 'btn1', x: 80, y: 120, properties: { color: 'green' } },
      { type: 'wokwi-resistor', id: 'r-led', x: 430, y: 130, properties: { value: '330' } },
      { type: 'wokwi-led', id: 'led1', x: 560, y: 90, properties: { color: 'red' } },
    ],
    wires: [
      {
        id: 'w-gpio4-btn',
        start: { componentId: 'esp32-s3', pinName: '4' },
        end: { componentId: 'btn1', pinName: '1.r' },
        color: '#22aaff',
      },
      {
        id: 'w-btn-gnd',
        start: { componentId: 'btn1', pinName: '2.r' },
        end: { componentId: 'esp32-s3', pinName: 'GND.1' },
        color: '#2c3e50',
      },
      {
        id: 'w-gpio2-r',
        start: { componentId: 'esp32-s3', pinName: '2' },
        end: { componentId: 'r-led', pinName: '1' },
        color: '#e74c3c',
      },
      {
        id: 'w-r-led',
        start: { componentId: 'r-led', pinName: '2' },
        end: { componentId: 'led1', pinName: 'A' },
        color: '#e74c3c',
      },
      {
        id: 'w-led-gnd',
        start: { componentId: 'led1', pinName: 'C' },
        end: { componentId: 'esp32-s3', pinName: 'GND.2' },
        color: '#2c3e50',
      },
    ],
  },
  {
    id: 'php-baremetal-i2c-clock',
    title: 'PHP on ESP32-S3: I²C clock (DS3231)',
    description:
      'PHP 8.5 on an ESP32-S3 talking I²C: setup() scans the bus and finds the DS3231 ' +
      'real-time clock at 0x68, loop() reads its time registers every second and prints ' +
      'the time on the serial monitor. Prebuilt php-baremetal firmware, press Run.',
    category: 'sensors',
    difficulty: 'intermediate',
    boardFilter: 'esp32-s3',
    tags: ['php', 'php-baremetal', 'esp32-s3', 'i2c', 'rtc', 'ds3231', 'clock'],
    boards: [
      {
        boardKind: 'esp32-s3',
        x: 260,
        y: 60,
        files: [
          { name: 'index.php', content: i2cClockPhp },
          { name: 'composer.json', content: i2cClockComposer },
        ],
        prebuiltFirmwareUrl: `${FW}/i2c-clock.bin`,
      },
    ],
    code: '',
    components: [{ type: 'velxio-ds3231', id: 'rtc1', x: 40, y: 130, properties: {} }],
    wires: [
      { id: 'rtc1-sda', start: { componentId: 'esp32-s3', pinName: '11' }, end: { componentId: 'rtc1', pinName: 'SDA' }, color: '#2196f3' },
      { id: 'rtc1-scl', start: { componentId: 'esp32-s3', pinName: '10' }, end: { componentId: 'rtc1', pinName: 'SCL' }, color: '#ff9800' },
      { id: 'rtc1-vcc', start: { componentId: 'esp32-s3', pinName: '3V3.1' }, end: { componentId: 'rtc1', pinName: 'VCC' }, color: '#ff0000' },
      { id: 'rtc1-gnd', start: { componentId: 'esp32-s3', pinName: 'GND.1' }, end: { componentId: 'rtc1', pinName: 'GND' }, color: '#000000' },
    ],
  },
  {
    id: 'php-baremetal-button-events',
    title: 'PHP on ESP32-S3: Button events (event-driven)',
    description:
      'The event-driven runtime: no loop(). A press of the button on GPIO4 raises an ' +
      'interrupt that arrives as a typed event; the listener toggles the LED on GPIO2. ' +
      'Between presses the CPU sleeps. Prebuilt php-baremetal firmware, press Run and click the button.',
    category: 'basics',
    difficulty: 'intermediate',
    boardFilter: 'esp32-s3',
    tags: ['php', 'php-baremetal', 'esp32-s3', 'event-driven', 'events', 'interrupt', 'button', 'led'],
    boards: [
      {
        boardKind: 'esp32-s3',
        x: 260,
        y: 60,
        files: [
          { name: 'index.php', content: buttonEventsPhp },
          { name: 'composer.json', content: buttonEventsComposer },
        ],
        prebuiltFirmwareUrl: `${FW}/button-events.bin`,
      },
    ],
    code: '',
    components: [
      { type: 'wokwi-pushbutton', id: 'btn1', x: 80, y: 120, properties: { color: 'green' } },
      { type: 'wokwi-resistor', id: 'r-led', x: 430, y: 130, properties: { value: '330' } },
      { type: 'wokwi-led', id: 'led1', x: 560, y: 90, properties: { color: 'red' } },
    ],
    wires: [
      { id: 'w-gpio4-btn', start: { componentId: 'esp32-s3', pinName: '4' }, end: { componentId: 'btn1', pinName: '1.r' }, color: '#22aaff' },
      { id: 'w-btn-gnd', start: { componentId: 'btn1', pinName: '2.r' }, end: { componentId: 'esp32-s3', pinName: 'GND.1' }, color: '#2c3e50' },
      { id: 'w-gpio2-r', start: { componentId: 'esp32-s3', pinName: '2' }, end: { componentId: 'r-led', pinName: '1' }, color: '#e74c3c' },
      { id: 'w-r-led', start: { componentId: 'r-led', pinName: '2' }, end: { componentId: 'led1', pinName: 'A' }, color: '#e74c3c' },
      { id: 'w-led-gnd', start: { componentId: 'led1', pinName: 'C' }, end: { componentId: 'esp32-s3', pinName: 'GND.2' }, color: '#2c3e50' },
    ],
  },
];
