/**
 * php-baremetal simulator home page, at `/` (php-baremetal fork; registered
 * by lib/simProfile.ts under VITE_SIM_PROFILE=php-baremetal).
 *
 * Says what the simulator does and how, credits Velxio (SiteChrome), and
 * only claims what was verified: the peripheral table marks each row as
 * tested, untested, or not available on the emulated ESP32-S3.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSEO } from '../../utils/useSEO';
import { DOCS_URL, REGISTRY_URL } from '../../lib/brand';
import { ExampleCard, SiteShell } from './SiteChrome';
import { siteExamples } from './siteData';

type Tok = [cls: '' | 'k' | 's' | 'c' | 'f' | 'n', text: string];

// The starter project's index.php (lib/phpProjectTemplate.ts), comments left out.
const CODE: Tok[][] = [
  [['k', '<?php']],
  [],
  [['f', 'define'], ['', '('], ['s', "'LED'"], ['', ', '], ['n', '2'], ['', ');']],
  [],
  [['k', 'function'], ['', ' '], ['f', 'setup'], ['', '(): '], ['k', 'void'], ['', ' {']],
  [['', '    '], ['f', 'gpio_mode'], ['', '(LED, '], ['n', 'GPIO_OUTPUT'], ['', ');']],
  [['', '    '], ['k', 'echo'], ['', ' '], ['s', '"Hello from PHP "'], ['', ' . PHP_VERSION . '], ['s', '"\\n"'], ['', ';']],
  [['', '}']],
  [],
  [['k', 'function'], ['', ' '], ['f', 'loop'], ['', '('], ['k', 'int'], ['', ' $tick): '], ['k', 'void'], ['', ' {']],
  [['', '    '], ['f', 'gpio_write'], ['', '(LED, $tick % '], ['n', '2'], ['', ');']],
  [['', '    '], ['f', 'delay'], ['', '('], ['n', '500'], ['', ');']],
  [['', '}']],
];
const HOT_LINES = new Set([10, 11]);

// What the serial monitor really prints when the starter project boots.
const BOOT = [
  'ESP-ROM:esp32s3-20210327',
  'I (1305) main_task: Started on CPU0',
  'project 0.0.0: PHP 8.5.11 on ESP32-S3 (quad PSRAM, generic)',
  '--- /app/index.php (init-loop) ---',
  'Hello from PHP 8.5.11',
];

const FACTS = [
  { k: 'Install', v: 'Nothing' },
  { k: 'Hardware', v: 'None needed' },
  { k: 'Language', v: 'PHP 8.5' },
  { k: 'Boards', v: 'ESP32-S3 DevKit · XIAO · Nano ESP32' },
  { k: 'Engine', v: 'Velxio + QEMU' },
];

type Status = 'ok' | 'wip' | 'no';
const STATUS_LABEL: Record<Status, string> = {
  ok: 'Tested',
  wip: 'Not tested yet',
  no: 'Not available',
};
const BENCH: { name: string; parts: string; pkg: string; status: Status }[] = [
  { name: 'GPIO', parts: 'LEDs, push buttons', pkg: 'ext-gpio', status: 'ok' },
  { name: 'Interrupts', parts: 'Button edges delivered as events (event-driven runtime)', pkg: 'ext-events · watch_gpio()', status: 'ok' },
  { name: 'Serial', parts: 'Serial monitor (UART0)', pkg: 'echo · print', status: 'ok' },
  { name: 'I²C', parts: 'DS3231 real-time clock; the bench also emulates BMP280 and MPU6050', pkg: 'ext-i2c', status: 'ok' },
  { name: 'SPI', parts: 'ST77916 round display', pkg: 'ext-spi + driver', status: 'wip' },
  { name: 'Addressable LEDs', parts: 'WS2812 needs the RMT peripheral, which the emulated ESP32-S3 does not have yet', pkg: 'ext-led + led-ws2812', status: 'no' },
  { name: 'WiFi / web', parts: 'The emulated ESP32-S3 has no radio', pkg: 'ext-wifi · ext-web', status: 'no' },
];

function SimWindow() {
  const [running, setRunning] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [running]);

  const led = running && tick % 2 === 1;
  const serial = running ? BOOT.slice(0, Math.min(BOOT.length, tick + 1)) : [...BOOT, '(stopped)'];

  return (
    <figure className="pbm-win">
      <div className="pbm-win__frame">
        <div className="pbm-win__bar">
          <span className="pbm-dim">my-project · index.php</span>
          <span>
            <span className="pbm-dim">BOARD</span> ESP32-S3 DevKit
          </span>
          <span>
            <span className="pbm-dim">RUNTIME</span> init-loop
          </span>
          <span className="pbm-win__spacer" />
          <span className="pbm-dim">
            <span className={`pbm-win__dot${running ? ' pbm-win__dot--on' : ''}`} aria-hidden="true" />
            {running ? 'RUNNING' : 'STOPPED'}
          </span>
          <button
            type="button"
            className={`pbm-win__run${running ? '' : ' pbm-win__run--stopped'}`}
            onClick={() => setRunning((r) => !r)}
          >
            {running ? '■ Stop' : '▶ Run'}
          </button>
        </div>
        <div className="pbm-win__body">
          <pre className="pbm-code">
            <code>
              {CODE.map((toks, i) => (
                <span key={i} className={`pbm-code__line${running && HOT_LINES.has(i) ? ' pbm-code__line--hot' : ''}`}>
                  <span className="pbm-tk-c">{String(i + 1).padStart(3, ' ')}  </span>
                  {toks.map(([c, t], j) => (
                    <span key={j} className={c ? `pbm-tk-${c}` : undefined}>
                      {t}
                    </span>
                  ))}
                </span>
              ))}
            </code>
          </pre>
          <div
            className="pbm-bench"
            role="img"
            aria-label={`Emulated ESP32-S3 wired to an LED on GPIO2, LED ${led ? 'on' : 'off'}`}
          >
            <div className="pbm-board">
              <div className="pbm-board__pins" style={{ left: 8 }}>
                {Array.from({ length: 11 }, (_, i) => (
                  <span key={i} />
                ))}
              </div>
              <div className="pbm-board__pins" style={{ right: 8 }}>
                {Array.from({ length: 11 }, (_, i) => (
                  <span key={i} />
                ))}
              </div>
              <div className="pbm-board__chip">
                <small>ESP32-S3</small>
                <b>PHP 8.5</b>
              </div>
              <span className="pbm-board__label">GPIO2</span>
            </div>
            <div className={`pbm-wire${led ? ' pbm-wire--on' : ''}`} />
            <div className="pbm-led">
              <span className={`pbm-led__bulb${led ? ' pbm-led__bulb--on' : ''}`} />
              <span className="pbm-led__legs">
                <span />
                <span />
              </span>
              <small>LED · 330 Ω</small>
            </div>
          </div>
        </div>
        <div className="pbm-serial">
          <div className="pbm-serial__head">
            <span>serial monitor</span>
            <span>$tick = {tick}</span>
          </div>
          <pre>
            {serial.map((l, i) => (
              <span key={i} className={l.startsWith('---') ? 'pbm-serial__mark' : undefined}>
                {l}
              </span>
            ))}
          </pre>
        </div>
      </div>
      <figcaption>
        Fig. 1 — The starter project: GPIO2 blinks every 500 ms. An illustration; the real
        emulator is one click away.
      </figcaption>
    </figure>
  );
}

export const HomePage: React.FC = () => {
  useSEO({
    title: 'php-baremetal sim — PHP on an emulated ESP32-S3',
    description:
      'Write PHP 8.5, press Run and watch an emulated ESP32-S3 blink LEDs, read buttons and print to the serial monitor. Nothing to install, nothing to flash. Based on Velxio.',
    url: typeof window !== 'undefined' ? window.location.origin + '/' : '/',
  });
  const examples = useMemo(() => siteExamples(), []);
  const firstExample = examples[0];

  // In-page anchors (/#how) after a client-side navigation.
  useEffect(() => {
    if (window.location.hash) {
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
    }
  }, []);

  return (
    <SiteShell>
      {/* HERO */}
      <section className="pbm-section">
        <div className="pbm-wrap pbm-hero__inner">
          <div className="pbm-hero__cols">
            <div className="pbm-hero__left">
              <div className="pbm-tags">
                <span>Runs in your browser</span>
                <span>Based on Velxio</span>
              </div>
              <h1 className="pbm-h1">
                No board?
                <br />
                Run it <span className="pbm-accent">anyway.</span>
                <span className="pbm-cursor" aria-hidden="true" />
              </h1>
            </div>
            <div className="pbm-hero__right">
              <p className="pbm-lede">
                Write PHP 8.5, press Run, and watch an emulated ESP32-S3 blink LEDs, read
                buttons and print to the serial monitor. Nothing to install, nothing to flash.
              </p>
              <div className="pbm-btns">
                <Link className="pbm-btn pbm-btn--solid" to="/editor">
                  Open the simulator →
                </Link>
                {firstExample && (
                  <Link className="pbm-btn" to={firstExample.href}>
                    Try {firstExample.title}
                  </Link>
                )}
              </div>
            </div>
          </div>
          <SimWindow />
        </div>
      </section>

      {/* FACTS */}
      <section className="pbm-section pbm-section--alt" aria-label="At a glance">
        <div className="pbm-wrap">
          <dl className="pbm-facts">
            {FACTS.map((f) => (
              <div key={f.k}>
                <dt>{f.k}</dt>
                <dd>{f.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* §01 HOW */}
      <section id="how" className="pbm-section">
        <div className="pbm-wrap pbm-section__inner">
          <div className="pbm-head-row">
            <div>
              <span className="pbm-kicker">§01 — How it works</span>
              <h2 className="pbm-h2">
                Write. Add.
                <br />
                Run.
              </h2>
            </div>
            <p className="pbm-body">
              The chip is emulated by QEMU, with 8 MB of PSRAM. What boots is a real
              php-baremetal firmware, built by phpbm exactly as for a physical board — not PHP
              pretending to be hardware.
            </p>
          </div>
          <ol className="pbm-grid">
            <li className="pbm-step">
              <span className="pbm-step__n">01</span>
              <h3 className="pbm-h3">Write index.php</h3>
              <p>
                <code>setup()</code> runs once, <code>loop()</code> runs forever. A new project
                starts with a blinking LED already wired to GPIO2.
              </p>
            </li>
            <li className="pbm-step">
              <span className="pbm-step__n">02</span>
              <h3 className="pbm-h3">Add packages</h3>
              <p>
                <code>composer.json</code> lists the firmware's features: extensions such as{' '}
                <code>ext-gpio</code>, device drivers, PHP extensions such as{' '}
                <code>php-mbstring</code>. The Libraries button adds them from the{' '}
                <a href={REGISTRY_URL}>package registry</a>.
              </p>
            </li>
            <li className="pbm-step">
              <span className="pbm-step__n">03</span>
              <h3 className="pbm-h3">Press Run</h3>
              <p>
                The server builds the firmware. A set of packages it has never seen takes about
                a minute and a half, once; after that, and whenever only the PHP changes, it
                is ready in about a second. Watch the pins, the parts and the serial monitor.
              </p>
            </li>
          </ol>
        </div>
      </section>

      {/* §02 BENCH */}
      <section className="pbm-section pbm-section--dark">
        <div className="pbm-wrap pbm-section__inner">
          <div className="pbm-head-row">
            <div>
              <span className="pbm-kicker">§02 — On the virtual bench</span>
              <h2 className="pbm-h2">
                What works
                <br />
                today.
              </h2>
            </div>
            <p className="pbm-body">
              Drop parts on the canvas, wire them to the pins and drive them from PHP. This
              table only says “tested” for what has been run in the simulator.
            </p>
          </div>
          <div className="pbm-table-box">
            <table className="pbm-table">
              <thead>
                <tr>
                  <th scope="col">Peripheral</th>
                  <th scope="col">Parts</th>
                  <th scope="col">From PHP</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {BENCH.map((b) => (
                  <tr key={b.name}>
                    <th scope="row">{b.name}</th>
                    <td>{b.parts}</td>
                    <td className="pbm-pkg">{b.pkg}</td>
                    <td>
                      <span className={`pbm-status pbm-status--${b.status}`}>{STATUS_LABEL[b.status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* §03 EXAMPLES */}
      <section id="examples" className="pbm-section">
        <div className="pbm-wrap pbm-section__inner">
          <div className="pbm-head-row">
            <div>
              <span className="pbm-kicker">§03 — Examples</span>
              <h2 className="pbm-h2">
                Start from
                <br />
                a working project.
              </h2>
            </div>
            <Link className="pbm-btn" to="/examples">
              All examples ({examples.length}) →
            </Link>
          </div>
          <div className="pbm-grid">
            {examples.slice(0, 3).map((ex, i) => (
              <ExampleCard key={ex.id} ex={ex} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* §04 SIM TO SILICON */}
      <section className="pbm-section pbm-section--alt">
        <div className="pbm-wrap pbm-section__inner">
          <div className="pbm-split">
            <div className="pbm-split__text">
              <span className="pbm-kicker">§04 — Sim to silicon</span>
              <h2 className="pbm-h2">
                Same code.
                <br />
                Real board.
              </h2>
              <p className="pbm-body">
                The PHP you run here is the PHP you flash. Start a project with phpbm, put your{' '}
                <code>index.php</code> in <code>project-src/</code>, require the same packages
                and pick your real board. The simulator always builds for a generic ESP32-S3;
                on hardware, the board in <code>composer.json</code> decides.
              </p>
              <a className="pbm-mono" href={DOCS_URL} style={{ alignSelf: 'flex-start', padding: '10px 0' }}>
                Read the phpbm documentation →
              </a>
            </div>
            <div className="pbm-term">
              <div className="pbm-term__head">terminal</div>
              <pre>
                <code>
                  <span className="pbm-tk-c"># a project for your board</span>
                  {'\n'}
                  <span className="pbm-tk-k">$</span> phpbm init blink
                  {'\n'}
                  <span className="pbm-tk-k">$</span> cd blink
                  {'\n'}
                  <span className="pbm-tk-k">$</span> composer require php-baremetal/ext-gpio
                  {'\n'}
                  <span className="pbm-tk-c"># copy index.php into project-src/</span>
                  {'\n'}
                  <span className="pbm-tk-k">$</span> phpbm toolchain:install
                  {'\n'}
                  <span className="pbm-tk-k">$</span> phpbm flash
                  {'\n'}
                  <span className="pbm-tk-k">$</span> phpbm monitor
                </code>
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pbm-section">
        <div className="pbm-wrap pbm-cta">
          <h2 className="pbm-h1">
            Your first blink
            <br />
            is <span className="pbm-accent">one click</span> away.
          </h2>
          <Link className="pbm-btn pbm-btn--solid" to="/editor" style={{ minHeight: 56 }}>
            Open the simulator →
          </Link>
        </div>
      </section>
    </SiteShell>
  );
};

export default HomePage;
