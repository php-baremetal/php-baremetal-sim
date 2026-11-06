/**
 * Prebuilt firmware for gallery examples (php-baremetal fork).
 *
 * An example board may name a firmware image (`ExampleBoard.prebuiltFirmwareUrl`)
 * instead of — or next to — source code. The loader fetches it when the example
 * opens and hands it to the board exactly like the toolbar's "Upload firmware"
 * does: readFirmwareFile() → compileBoardProgram() → markCompiled(). Run then
 * boots that image without compiling anything.
 */
import type { BoardKind } from '../types/board';
import { readFirmwareFile } from './firmwareLoader';

export interface PrebuiltFirmware {
  program: string;
  message: string;
}

/** The file name the URL points at, so readFirmwareFile can detect the format by extension. */
function fileNameOf(url: string): string {
  const path = url.split(/[?#]/)[0];
  const name = path.slice(path.lastIndexOf('/') + 1);
  return name || 'firmware.bin';
}

/**
 * Fetch and parse one example board's prebuilt firmware. Returns null when
 * there is none or it cannot be fetched; the failure is reported, and the
 * example still opens (the board just has no program yet, as after a fresh load).
 */
export async function resolvePrebuiltFirmware(
  url: string | undefined,
  boardKind: BoardKind,
  fetcher: (url: string) => Promise<Response> = (u) => fetch(u),
): Promise<PrebuiltFirmware | null> {
  if (!url) return null;
  try {
    const r = await fetcher(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const file = new File([await r.arrayBuffer()], fileNameOf(url));
    const { program, message } = await readFirmwareFile(file, boardKind);
    return { program, message };
  } catch (e) {
    console.warn(`[firmware] prebuilt firmware ${url} could not be loaded:`, e);
    return null;
  }
}
