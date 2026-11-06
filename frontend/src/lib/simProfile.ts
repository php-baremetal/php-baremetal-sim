/**
 * Deployment profile (php-baremetal fork).
 *
 * VITE_SIM_PROFILE=php-baremetal turns this Velxio into the php-baremetal
 * simulator: PHP on the ESP32-S3 and nothing it cannot run. Everything the
 * deployment cannot deliver is hidden, never deleted, so the fork stays a
 * small diff against upstream:
 *
 *   - boards: only the ESP32-S3 kinds (BOARD_SUPPORTS_PHP) in every picker;
 *   - velxio.dev "online only" board/component ads: suppressed (upstream seam);
 *   - gallery: only php-baremetal projects (upstream seam);
 *   - a fresh workspace / "New project": an ESP32-S3 in PHP mode;
 *   - Account menu, velxio.dev links, Velxio's Discord: hidden or replaced.
 *
 * Unset, every helper here is a no-op and the app behaves as upstream.
 */
import { BOARD_SUPPORTS_PHP, type BoardKind } from '../types/board';
import type { ExampleProject } from '../data/examples';
import { ONLINE_ONLY_BOARD_ADS, ONLINE_ONLY_COMPONENT_ADS, suppressOnlineOnlyAds } from './onlineOnlyBoards';
import { installGalleryExampleFilter } from './galleryExampleFilter';

export const PHP_BAREMETAL_PROFILE: boolean = import.meta.env.VITE_SIM_PROFILE === 'php-baremetal';

/** The board kinds a picker should offer under this profile. */
export function profileBoards<T extends string>(kinds: readonly T[]): T[] {
  return PHP_BAREMETAL_PROFILE
    ? kinds.filter((k) => BOARD_SUPPORTS_PHP.has(k as BoardKind))
    : [...kinds];
}

/** A gallery example this deployment can run: every board an ESP32-S3 PHP project. */
export function isPhpBaremetalExample(ex: ExampleProject): boolean {
  const boards = ex.boards ?? [];
  return (
    boards.length > 0 &&
    boards.every(
      (b) =>
        BOARD_SUPPORTS_PHP.has(b.boardKind as BoardKind) &&
        (b.files ?? []).some((f) => f.name === 'composer.json'),
    )
  );
}

/** Install the profile's seams; call once at startup, before the first render. */
export function installSimProfile(): void {
  if (!PHP_BAREMETAL_PROFILE) return;
  suppressOnlineOnlyAds([
    ...ONLINE_ONLY_BOARD_ADS.map((a) => a.id),
    ...ONLINE_ONLY_COMPONENT_ADS.map((a) => a.id),
  ]);
  installGalleryExampleFilter((list) => list.filter(isPhpBaremetalExample));
}
