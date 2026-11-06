/**
 * Every php-baremetal example, at `/examples` (php-baremetal fork; App.tsx
 * picks it over Velxio's gallery under VITE_SIM_PROFILE=php-baremetal).
 * Search and runtime filter; each card opens the example in the simulator.
 */
import React, { useMemo, useState } from 'react';
import { PUBLIC_URL } from '../../lib/brand';
import { useSEO } from '../../utils/useSEO';
import { ExampleCard, SiteShell } from './SiteChrome';
import { siteExamples } from './siteData';

export const ExamplesListPage: React.FC = () => {
  useSEO({
    title: 'Examples — php-baremetal sim',
    description:
      'Every php-baremetal example that runs in the simulator: PHP 8.5 on an emulated ESP32-S3, with its circuit, runtime and packages. Open one and press Run.',
    url: `${PUBLIC_URL}/examples`,
  });
  const all = useMemo(() => siteExamples(), []);
  const runtimes = useMemo(() => [...new Set(all.map((e) => e.runtime))].sort(), [all]);
  const [query, setQuery] = useState('');
  const [runtime, setRuntime] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter(
      (e) =>
        (!runtime || e.runtime === runtime) &&
        (!q ||
          [e.title, e.description, e.board, ...e.parts, ...e.packages].some((s) =>
            s.toLowerCase().includes(q),
          )),
    );
  }, [all, query, runtime]);

  return (
    <SiteShell>
      <section className="pbm-section">
        <div className="pbm-wrap pbm-section__inner">
          <div className="pbm-head-row">
            <div>
              <span className="pbm-kicker">Examples</span>
              <h1 className="pbm-h2" style={{ fontSize: 'clamp(44px, 6vw, 80px)' }}>
                Every example,
                <br />
                ready to run.
              </h1>
            </div>
            <p className="pbm-body">
              Each one is a complete project — index.php, composer.json and its circuit. It opens
              with a prebuilt firmware, so Run starts it at once; edit the PHP or the packages
              and Run builds your version.
            </p>
          </div>

          <div className="pbm-filter" role="search">
            <label htmlFor="pbm-q">Search</label>
            <input
              id="pbm-q"
              type="search"
              placeholder="gpio, button, led…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <label htmlFor="pbm-rt">Runtime</label>
            <select id="pbm-rt" value={runtime} onChange={(e) => setRuntime(e.target.value)}>
              <option value="">All</option>
              {runtimes.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <span className="pbm-count" aria-live="polite">
              {shown.length} of {all.length}
            </span>
          </div>

          {shown.length > 0 ? (
            <div className="pbm-grid">
              {shown.map((ex) => (
                <ExampleCard key={ex.id} ex={ex} index={all.indexOf(ex)} />
              ))}
            </div>
          ) : (
            <p className="pbm-empty">No example matches. Clear the search to see all of them.</p>
          )}
        </div>
      </section>
    </SiteShell>
  );
};

export default ExamplesListPage;
