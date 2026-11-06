#!/usr/bin/env node
/**
 * php-baremetal fork: the crawler-facing files of sim.php-baremetal.com.
 *
 * Runs after `vite build` (npm run build:docker) and does nothing unless
 * VITE_SIM_PROFILE=php-baremetal. Under the profile it replaces Velxio's
 * velxio.dev SEO output, which would tell search engines that every page here
 * is a copy of a velxio.dev page:
 *
 *   dist/sitemap.xml          our pages only, on our domain
 *   dist/robots.txt           pointing at that sitemap
 *   dist/examples/index.html  static head (title, description, canonical, OG)
 *   dist/editor/index.html    idem
 *
 * The home page head is index.html itself; the per-example editor pages
 * (/example/<id>) are client-rendered and get their head from useSEO.
 * prerender-seo.mjs is skipped under the profile (it renders Velxio's pages).
 *
 * Domain: VITE_PUBLIC_URL, default https://sim.php-baremetal.com (= lib/brand.ts).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

if (process.env.VITE_SIM_PROFILE !== 'php-baremetal') process.exit(0);

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist');
const DOMAIN = (process.env.VITE_PUBLIC_URL || 'https://sim.php-baremetal.com').replace(/\/$/, '');

if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/index.html not found: run `vite build` first.');
  process.exit(1);
}

// Top-level example ids (4-space indent; component/wire ids are deeper).
const exampleIds = [
  ...readFileSync(join(root, 'src/data/examples-php-baremetal.ts'), 'utf-8').matchAll(/^ {4}id: '([^']+)'/gm),
].map((m) => m[1]);

// Every <loc> equals the canonical useSEO emits (trailing slash).
const urls = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/examples/', changefreq: 'weekly', priority: '0.9' },
  { path: '/editor/', changefreq: 'monthly', priority: '0.7' },
  ...exampleIds.map((id) => ({ path: `/example/${id}/`, changefreq: 'monthly', priority: '0.6' })),
];

writeFileSync(
  join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((u) => `  <url>
    <loc>${DOMAIN}${u.path}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`)
  .join('\n')}
</urlset>
`,
);

writeFileSync(
  join(dist, 'robots.txt'),
  `User-agent: *
Allow: /
Disallow: /api/
Disallow: /project/
Sitemap: ${DOMAIN}/sitemap.xml
`,
);

// Static heads for the pages a crawler or a link preview fetches without JS.
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const PAGES = {
  examples: {
    title: 'Examples — php-baremetal sim',
    description:
      'Every php-baremetal example that runs in the simulator: PHP 8.5 on an emulated ESP32-S3, with its circuit, runtime and packages. Open one and press Run.',
  },
  editor: {
    title: 'Editor — php-baremetal sim',
    description:
      'Write PHP 8.5 for an emulated ESP32-S3, add php-baremetal packages and press Run: the firmware is built for you and runs in your browser.',
  },
};
const base = readFileSync(join(dist, 'index.html'), 'utf-8');
for (const [route, { title, description }] of Object.entries(PAGES)) {
  const url = `${DOMAIN}/${route}/`;
  let html = base
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta (?:name|property)="(?:og:|twitter:)?title" content=")[^"]*"/g, `$1${esc(title)}"`)
    .replace(/(<meta (?:name|property)="(?:og:|twitter:)?description" content=")[^"]*"/g, `$1${esc(description)}"`)
    .replace(/(<meta property="og:url" content=")[^"]*"/, `$1${url}"`)
    .replace(/<link rel="canonical"[^>]*>\s*/g, '');
  html = html.replace('</head>', `  <link rel="canonical" href="${url}" />\n  </head>`);
  mkdirSync(join(dist, route), { recursive: true });
  writeFileSync(join(dist, route, 'index.html'), html);
}

console.log(`php-baremetal SEO → ${urls.length} sitemap URLs on ${DOMAIN}, robots.txt, ${Object.keys(PAGES).length} page heads`);
