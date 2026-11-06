/**
 * php-baremetal packages (php-baremetal fork): the "Add library" side of a
 * php-baremetal project. A package is a line in composer.json's `require`,
 * exactly as `composer require php-baremetal/<name>` would write it; the
 * server's phpbm build resolves it against repository.php-baremetal.com.
 */
import { getApiBase } from '../lib/apiBase';

export interface PhpbmPackage {
  name: string;
  type: string;
  version: string;
  description: string;
  /** What "Add" writes into require, e.g. "^1.0". */
  constraint: string;
}

export async function fetchPhpbmPackages(
  fetcher: (url: string) => Promise<Response> = (u) => fetch(u),
): Promise<{ registry: string; packages: PhpbmPackage[] }> {
  const r = await fetcher(`${getApiBase()}/phpbm/packages`);
  if (!r.ok) throw new Error(`package list: HTTP ${r.status}`);
  return r.json();
}

/** Parse composer.json, or throw a message the user can act on. */
function parse(composerJson: string): Record<string, unknown> {
  let data: unknown;
  try {
    data = JSON.parse(composerJson);
  } catch (e) {
    throw new Error(`composer.json is not valid JSON (${(e as Error).message}) — fix it first`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('composer.json must be a JSON object');
  }
  return data as Record<string, unknown>;
}

function serialize(data: Record<string, unknown>): string {
  // Composer's own layout: 4-space indent, slashes unescaped, trailing newline.
  return JSON.stringify(data, null, 4) + '\n';
}

/** The php-baremetal packages composer.json requires (name -> constraint). */
export function requiredPackages(composerJson: string): Record<string, string> {
  try {
    const req = parse(composerJson).require;
    return req && typeof req === 'object' ? (req as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** composer.json with `name` required at `constraint`; every other key kept in place. */
export function addRequire(composerJson: string, name: string, constraint: string): string {
  const data = parse(composerJson);
  const req = { ...((data.require as Record<string, string>) ?? {}) };
  req[name] = constraint;
  // Composer keeps require sorted when config.sort-packages is set; we sort
  // too, so the same set of packages always reads (and hashes) the same.
  data.require = Object.fromEntries(Object.entries(req).sort(([a], [b]) => a.localeCompare(b)));
  return serialize(data);
}

/** composer.json without `name` in require. */
export function removeRequire(composerJson: string, name: string): string {
  const data = parse(composerJson);
  const req = { ...((data.require as Record<string, string>) ?? {}) };
  delete req[name];
  data.require = req;
  return serialize(data);
}
