/**
 * Shared chrome of the php-baremetal site pages (php-baremetal fork):
 * top bar, credits to the upstream project, footer, example card.
 *
 * The credits and the footer carry the AGPLv3 §13 source offer and the
 * attribution to Velxio; keep both on every site page.
 */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './site.css';
import {
  DOCS_URL,
  ORG_GITHUB_URL,
  QEMU_SOURCE_URL,
  REGISTRY_URL,
  SITE_URL,
  SOURCE_URL,
  UPSTREAM_URL,
} from '../../lib/brand';
import type { SiteExample } from './siteData';

export const SiteShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="pbm-site">
    <TopBar />
    <main>{children}</main>
    <Credits />
    <Footer />
  </div>
);

const TopBar: React.FC = () => {
  const { pathname } = useLocation();
  const current = (p: string) => (pathname === p ? ('page' as const) : undefined);
  return (
    <header className="pbm-top">
      <div className="pbm-wrap pbm-top__row">
        <Link to="/" className="pbm-logo" aria-label="php-baremetal sim, home">
          <span className="pbm-logo__mark" aria-hidden="true">
            <span />
          </span>
          <span className="pbm-logo__word">
            php<i>-</i>baremetal
          </span>
          <span className="pbm-logo__badge">SIM</span>
        </Link>
        <nav className="pbm-nav" aria-label="Primary">
          <Link to="/#how">How it works</Link>
          <Link to="/examples" aria-current={current('/examples')}>
            Examples
          </Link>
          <a href={DOCS_URL}>Docs</a>
          <a href={SITE_URL}>php-baremetal.com ↗</a>
          <Link to="/editor" className="pbm-nav__cta">
            Open the simulator →
          </Link>
        </nav>
      </div>
    </header>
  );
};

const Credits: React.FC = () => (
  <section className="pbm-section" aria-labelledby="pbm-credits-title">
    <div className="pbm-wrap pbm-credits">
      <div>
        <span id="pbm-credits-title" className="pbm-kicker" style={{ color: 'var(--pbm-muted)' }}>
          Built on Velxio
        </span>
        <p>
          This simulator is a fork of <a href={UPSTREAM_URL}>Velxio</a>, the open-source
          multi-board embedded simulator by David Montero Crespo, released under the AGPLv3.
          Velxio provides the editor, the circuit canvas and the QEMU-based ESP32 emulation;
          php-baremetal adds the PHP language mode, the phpbm build service, the package picker
          and the examples.
        </p>
        <p className="pbm-body" style={{ fontSize: 15 }}>
          Like Velxio, this site is free software under the AGPLv3 and its complete source is
          public. The ESP32 emulator libraries are QEMU, GPL-2.0, built from{' '}
          <a href={QEMU_SOURCE_URL}>this source</a>.
        </p>
      </div>
      <div className="pbm-credits__links" style={{ flex: '0 1 auto' }}>
        <a className="pbm-btn" href={SOURCE_URL}>
          Source of this site →
        </a>
        <a className="pbm-btn" href={UPSTREAM_URL}>
          Velxio on GitHub →
        </a>
      </div>
    </div>
  </section>
);

const Footer: React.FC = () => (
  <footer className="pbm-foot">
    <div className="pbm-wrap pbm-foot__row">
      <span>
        <b>
          php<i>-</i>baremetal
        </b>{' '}
        sim · AGPLv3 · based on <a href={UPSTREAM_URL}>Velxio</a> by David Montero Crespo
      </span>
      <span className="pbm-foot__links">
        <a href={SITE_URL}>php-baremetal.com</a>
        <a href={DOCS_URL}>Docs</a>
        <a href={REGISTRY_URL}>Registry</a>
        <a href={ORG_GITHUB_URL}>GitHub</a>
        <a href={SOURCE_URL}>Source (AGPLv3)</a>
      </span>
    </div>
  </footer>
);

export const ExampleCard: React.FC<{ ex: SiteExample; index: number }> = ({ ex, index }) => (
  <article className="pbm-card">
    <div className="pbm-card__head">
      <span>EX-{String(index + 1).padStart(2, '0')}</span>
      <code>{ex.runtime}</code>
    </div>
    <div className="pbm-card__body">
      <h3 className="pbm-h3">{ex.title}</h3>
      <p>{ex.description}</p>
      <div className="pbm-card__meta">
        <span>
          {ex.board} · {ex.parts.join(' · ')}
        </span>
        {ex.packages.length > 0 && (
          <span className="pbm-card__pkgs" aria-label="Packages">
            {ex.packages.map((p) => (
              <span key={p}>{p}</span>
            ))}
          </span>
        )}
      </div>
    </div>
    <Link className="pbm-card__open" to={ex.href}>
      Open in the simulator <span aria-hidden="true">→</span>
    </Link>
  </article>
);
