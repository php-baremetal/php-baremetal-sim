/**
 * php-baremetal profile: the site's home page at `/` (php-baremetal fork),
 * through upstream's own seam for a landing page (lib/proRoutes.ts: an
 * `index` route replaces the OSS redirect to /editor, see App.tsx RootRoute).
 */
import { registerProRoutes } from './proRoutes';
import { PHP_BAREMETAL_PROFILE } from './simProfile';
import { HomePage } from '../pages/php-baremetal/HomePage';

export function installSimProfileRoutes(): void {
  if (!PHP_BAREMETAL_PROFILE) return;
  registerProRoutes([{ path: '', element: <HomePage />, index: true }]);
}
