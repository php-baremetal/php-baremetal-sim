/**
 * Branding of this deployment (php-baremetal fork).
 *
 * AGPLv3 §13: users interacting with this modified Velxio over a network must
 * be offered its source. SOURCE_URL is that offer; it is linked from the
 * header (every page, the editor included) and the Help menu, together with
 * the attribution to the upstream project. Keep both visible.
 */
export const APP_NAME = 'php-baremetal sim';
export const SITE_URL = 'https://php-baremetal.com';
/** The source code of THIS deployment (the fork), as AGPLv3 §13 requires. */
export const SOURCE_URL =
  import.meta.env.VITE_SOURCE_URL || 'https://github.com/php-baremetal/php-baremetal-sim';
export const UPSTREAM_URL = 'https://github.com/davidmonterocrespo24/velxio';
export const ATTRIBUTION = 'Based on Velxio (AGPLv3) by David Montero Crespo';

/**
 * A page title in this deployment's name. Upstream pages hard-code Velxio
 * suffixes ("… — Velxio Arduino Simulator", "… | Velxio"); useSEO passes
 * every title through here, so no page has to be edited one by one.
 */
export function brandTitle(title: string): string {
  if (title.includes(APP_NAME)) return title;
  let t = title.replace(/\s*[—|–-]\s*Velxio\b.*$/u, '').trim();
  if (/^Multi-Board Simulator Editor/.test(t)) t = 'Editor';
  t = t.replace(/\bVelxio\b/g, APP_NAME);
  return t && t !== APP_NAME ? `${t} | ${APP_NAME}` : APP_NAME;
}

/** php-baremetal links used by the site pages (checked to resolve, 2026-11-06). */
export const DOCS_URL = 'https://php-baremetal.com/documentation';
export const REGISTRY_URL = 'https://repository.php-baremetal.com/';
export const ORG_GITHUB_URL = 'https://github.com/php-baremetal';
/** GPL-2.0 corresponding source of the libqemu binaries this image ships. */
export const QEMU_SOURCE_URL = 'https://github.com/php-baremetal/php-baremetal-sim-qemu';
