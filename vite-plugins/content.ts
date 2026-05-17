/**
 * Build-time YAML → JSON pipeline for game content.
 *
 * Why this plugin exists: the production JS bundle must not contain the
 * Enemy regex `pattern` or the per-text Real/Decoy pool labels. Both would
 * give a casual devtools user the puzzle answer. This plugin emits each
 * known YAML file as a separate JSON asset (so the runtime JS never holds
 * the content text), and strips runtime-irrelevant fields — specifically
 * the `pattern` — from the emitted JSON so the regex never reaches the
 * browser at all.
 *
 * Validation is intentionally NOT done here. See `scripts/validate-content.ts`
 * — that script runs the full Zod schemas against the YAML and is wired into
 * `npm run build` ahead of `vite build`. Keeping validation out of the plugin
 * means `yaml` is the only build-time dep this file pulls in.
 *
 * Each entry's `project` function mirrors the corresponding Zod schema's
 * runtime-visible shape (after `.transform`). When schemas grow new
 * transforms, the matching `project` here must be updated too.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { Plugin } from 'vite';

type RawObject = Record<string, unknown>;

type Entry = {
  /** Source YAML path, relative to the project root. */
  src: string;
  /** Emitted JSON path, relative to the build out dir / dev URL base. */
  fileName: string;
  /** Pure projection: raw parsed YAML object → runtime-shaped object. */
  project: (raw: RawObject) => RawObject;
};

/** Player projection — mirrors `PlayerProfileSchema.transform` in
 *  `src/content/schemas.ts`. Picks `baseHp` and `baseAttack`, adds the empty
 *  `modifiers` slot (v1 — see `src/run/docs/adr/0001-...`).
 */
function projectPlayer(raw: RawObject): RawObject {
  return {
    baseHp: raw.baseHp,
    baseAttack: raw.baseAttack,
    modifiers: [],
  };
}

/** Enemy projection — mirrors `EnemySchema` minus the `pattern` field. The
 *  Enemy-level `realRate` default (0.5) matches `EnemySchema`'s `.default()`.
 *  Phase-level `realRate` stays optional — `combat/encounter.ts` falls back
 *  to the Enemy-level value at startEncounter().
 */
function projectEnemy(raw: RawObject): RawObject {
  // Drop pattern. Default realRate. Pass everything else through.
  const { pattern: _pattern, realRate, ...rest } = raw;
  void _pattern;
  return { ...rest, realRate: typeof realRate === 'number' ? realRate : 0.5 };
}

const ENTRIES: readonly Entry[] = [
  {
    src: 'data/player.yaml',
    fileName: 'data/player.json',
    project: projectPlayer,
  },
  {
    src: 'data/enemies/00-java-float.yaml',
    fileName: 'data/enemies/00-java-float.json',
    project: projectEnemy,
  },
];

async function readAndProject(entry: Entry, root: string): Promise<string> {
  const absPath = path.resolve(root, entry.src);
  const text = await readFile(absPath, 'utf8');
  const raw = parseYaml(text) as RawObject;
  return JSON.stringify(entry.project(raw));
}

export default function contentPlugin(): Plugin {
  let root = process.cwd();
  let isBuild = false;

  return {
    name: 'regexfight-content',

    configResolved(config) {
      root = config.root;
      isBuild = config.command === 'build';
    },

    async buildStart() {
      // Asset emission is meaningful only at production build. In serve
      // mode (dev / vitest) the middleware below answers `/data/...json`
      // requests directly from the source YAML.
      if (!isBuild) return;
      for (const entry of ENTRIES) {
        const source = await readAndProject(entry, root);
        this.emitFile({
          type: 'asset',
          fileName: entry.fileName,
          source,
        });
      }
    },

    configureServer(server) {
      // Serve `/data/...json` in dev by reading the source YAML on each
      // request. Cheap (files are tiny) and means YAML edits show up
      // without a server restart.
      const byUrl = new Map(ENTRIES.map((e) => ['/' + e.fileName, e]));
      server.middlewares.use((req, res, next) => {
        if (!req.url) {
          next();
          return;
        }
        const url = req.url.split('?')[0] ?? req.url;
        const entry = byUrl.get(url);
        if (!entry) {
          next();
          return;
        }
        void readAndProject(entry, root).then(
          (source) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(source);
          },
          (err: unknown) => {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'text/plain');
            res.end(`content plugin: ${(err as Error).message}`);
          },
        );
      });
    },
  };
}

// Exported for unit tests.
export { ENTRIES, projectPlayer, projectEnemy };
