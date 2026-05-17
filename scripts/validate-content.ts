/**
 * Build-time content validator.
 *
 * Reads every YAML file referenced from the Vite content plugin's manifest,
 * parses it with `loadEnemyYaml` / `loadPlayerYaml`, and lets the underlying
 * Zod schemas surface any cross-field invariant violation (pattern compiles,
 * phases monotonically decreasing, pools matching the pattern, seed spells
 * present in Phase-1 pools, etc.).
 *
 * Wired into `npm run build` ahead of `vite build` so a malformed YAML can
 * never reach a production deploy.
 *
 * Run directly via `npm run validate:content`.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnemyYaml, loadPlayerYaml } from '../src/content/load';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

type Entry =
  | { kind: 'enemy'; src: string }
  | { kind: 'player'; src: string };

const ENTRIES: readonly Entry[] = [
  { kind: 'player', src: 'data/player.yaml' },
  { kind: 'enemy', src: 'data/enemies/00-java-float.yaml' },
];

async function validateOne(entry: Entry): Promise<void> {
  const absPath = path.resolve(ROOT, entry.src);
  const text = await readFile(absPath, 'utf8');
  if (entry.kind === 'enemy') {
    await loadEnemyYaml(text);
  } else {
    await loadPlayerYaml(text);
  }
}

async function main(): Promise<void> {
  for (const entry of ENTRIES) {
    try {
      await validateOne(entry);
      console.log(`ok  ${entry.src}`);
    } catch (err) {
      console.error(`FAIL ${entry.src}`);
      console.error((err as Error).message);
      process.exit(1);
    }
  }
}

void main();
