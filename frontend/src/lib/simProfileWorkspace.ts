/**
 * php-baremetal profile: what a FRESH workspace is (php-baremetal fork).
 * Kept apart from simProfile.ts because it needs the stores.
 *
 * A new project is a complete, runnable circuit, matching the PHP template
 * (lib/phpProjectTemplate.ts blinks GPIO2): the board, a 330 Ω resistor and
 * a red LED, wired GPIO2 → resistor → LED → GND. The "New project" cards show
 * exactly that circuit, so the project has to contain it.
 */
import type { BoardKind } from '../types/board';
import { useSimulatorStore, DEFAULT_BOARD_POSITION } from '../store/useSimulatorStore';
import { useEditorStore } from '../store/useEditorStore';
import { PHP_BAREMETAL_PROFILE } from './simProfile';

export const PROFILE_STARTER_BOARD: BoardKind = 'esp32-s3';

/** Per board: the header pins that are GPIO2 and GND (utils/boardPinMapping.ts),
 *  and the board's drawn width, to place the parts to its right. */
const STARTER_WIRING: Record<string, { gpio2: string; gnd: string; width: number }> = {
  'esp32-s3': { gpio2: '2', gnd: 'GND.2', width: 128 },
  'xiao-esp32-s3': { gpio2: 'D1', gnd: 'GND', width: 91 },
  'arduino-nano-esp32': { gpio2: 'A1', gnd: 'GND.1', width: 215 },
};

/** The LED circuit of a PHP starter project, for a board placed at (x, y). */
export function starterCircuit(boardId: string, kind: string, x: number, y: number) {
  const w = STARTER_WIRING[kind] ?? STARTER_WIRING[PROFILE_STARTER_BOARD];
  const partsX = x + w.width + 80;
  const components = [
    { id: 'r-led', metadataId: 'resistor', x: partsX, y: y + 90, properties: { value: '330' } },
    { id: 'led1', metadataId: 'led', x: partsX + 130, y: y + 20, properties: { color: 'red' } },
  ];
  const end = (componentId: string, pinName: string) => ({ componentId, pinName, x: 0, y: 0 });
  const wires = [
    { id: 'w-gpio2-r', start: end(boardId, w.gpio2), end: end('r-led', '1'), color: '#e74c3c', waypoints: [] },
    { id: 'w-r-led', start: end('r-led', '2'), end: end('led1', 'A'), color: '#e74c3c', waypoints: [] },
    { id: 'w-led-gnd', start: end('led1', 'C'), end: end(boardId, w.gnd), color: '#2c3e50', waypoints: [] },
  ];
  return { components, wires };
}

/**
 * Add a board in PHP mode (index.php + composer.json) with its LED circuit,
 * make it active, and replace whatever parts and wires were on the canvas.
 */
export function addPhpStarterBoard(kind: BoardKind = PROFILE_STARTER_BOARD): string {
  const sim = useSimulatorStore.getState();
  const { x, y } = DEFAULT_BOARD_POSITION;
  const id = sim.addBoard(kind, x, y);
  sim.setActiveBoardId(id);
  useSimulatorStore.getState().setBoardLanguageMode(id, 'php');
  const { components, wires } = starterCircuit(id, kind, x, y);
  const s = useSimulatorStore.getState();
  s.setComponents(components);
  s.setWires(wires);
  s.recalculateAllWirePositions();
  return id;
}

/**
 * Replace upstream's untouched starting workspace (one Arduino Uno with the
 * default sketch, and the LED wired to it) with an ESP32-S3 PHP project.
 * Anything else — a restored draft, a loaded project or example — is left alone.
 */
export function adoptPhpStarterWorkspace(): void {
  if (!PHP_BAREMETAL_PROFILE) return;
  const sim = useSimulatorStore.getState();
  const [only, ...rest] = sim.boards;
  if (!only || rest.length || only.boardKind !== 'arduino-uno') return;
  const files = useEditorStore.getState().getGroupFiles(only.activeFileGroupId);
  if (files.length !== 1 || files[0].name !== 'sketch.ino' || files[0].modified) return;
  sim.removeBoard(only.id);
  addPhpStarterBoard();
}
