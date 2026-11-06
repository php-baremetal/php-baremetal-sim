/**
 * What the site pages say about the examples, read from the examples
 * themselves (php-baremetal fork): the runtime and the packages come from
 * each board's composer.json, the parts from its circuit. Nothing is typed
 * twice, so a page can never describe an example differently from what
 * opens in the simulator.
 */
import { exampleProjects, type ExampleProject } from '../../data/examples';
import { galleryExamples } from '../../lib/galleryExampleFilter';
import { isPhpBaremetalExample } from '../../lib/simProfile';
import { requiredPackages } from '../../services/phpbmPackages';
import { boardDisplayName } from '../../types/board';
import type { BoardKind } from '../../types/board';

export interface SiteExample {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  runtime: string;
  board: string;
  parts: string[];
  packages: string[];
  href: string;
}

const PART_NAMES: Record<string, string> = {
  led: 'LED',
  resistor: 'resistor',
  pushbutton: 'push button',
  'slide-switch': 'slide switch',
  potentiometer: 'potentiometer',
};

function partName(type: string): string {
  const bare = type.replace(/^(wokwi|velxio)-/, '');
  return PART_NAMES[bare] ?? bare.replace(/-/g, ' ');
}

function boardName(kind: string): string {
  return boardDisplayName({ boardKind: kind as BoardKind }) ?? kind;
}

export function toSiteExample(ex: ExampleProject): SiteExample {
  const board = ex.boards?.[0];
  const composer = board?.files?.find((f) => f.name === 'composer.json')?.content ?? '{}';
  let runtime = 'init-loop';
  try {
    runtime = JSON.parse(composer)?.extra?.baremetal?.runtime ?? runtime;
  } catch {
    /* a broken composer.json still lists the example */
  }
  const packages = Object.keys(requiredPackages(composer))
    .filter((p) => p !== 'php-baremetal/conductor')
    .map((p) => p.replace(/^php-baremetal\//, ''));
  const parts = [...new Set(ex.components.map((c) => partName(c.type)))];
  return {
    id: ex.id,
    title: ex.title.replace(/^PHP on ESP32-S3:\s*/, ''),
    description: ex.description,
    difficulty: ex.difficulty,
    runtime,
    board: board ? boardName(board.boardKind) : 'ESP32-S3',
    parts,
    packages,
    href: `/example/${ex.id}`,
  };
}

/** Every PHP example this deployment can run, in gallery order. */
export function siteExamples(): SiteExample[] {
  return galleryExamples(exampleProjects).filter(isPhpBaremetalExample).map(toSiteExample);
}
