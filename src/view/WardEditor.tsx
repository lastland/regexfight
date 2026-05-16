/**
 * WardEditor — the player composes their regex Ward here.
 *
 * Match semantics: the engine full-matches the Ward end-to-end against each
 * Spell (it wraps the source as `^(?:...)$` at resolution time). The player
 * just writes the body. Player-typed `^`/`$` are accepted but redundant. See
 * the Amendment in `src/combat/docs/adr/0003-full-anchored-match.md`.
 *
 * Only the `i` flag is offered (other JS flags are intentionally omitted).
 *
 * Test-bench slot: see ADR-0001 (view). v1 ships without a live test bench,
 * but the layout reserves a clearly-labelled slot here so the future addition
 * is drop-in. If the parent does not supply `testBenchSlot`, we render the
 * "coming soon" placeholder so the absence is intentional rather than hidden.
 *
 * Supported-syntax cheat sheet: doc-only — the parser accepts any JS regex.
 * See `src/view/docs/adr/0002-supported-regex-scope.md` for the rationale.
 */

import { useMemo, useState, type JSX } from 'react';

export type WardEditorProps = {
  initialSource?: string;
  initialFlags?: string; // only '' or 'i' supported in v1
  onSubmit: (ward: RegExp) => void;
  testBenchSlot?: React.ReactNode;
};

type ParseResult =
  | { ok: true; regex: RegExp }
  | { ok: false; error: string };

function parseWard(source: string, flags: string): ParseResult {
  if (source.length === 0) {
    return { ok: false, error: 'Ward is empty.' };
  }
  try {
    return { ok: true, regex: new RegExp(source, flags) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, error: message };
  }
}

export function WardEditor(props: WardEditorProps): JSX.Element {
  const [source, setSource] = useState(props.initialSource ?? '');
  const [caseInsensitive, setCaseInsensitive] = useState(
    (props.initialFlags ?? '').includes('i'),
  );

  const flags = caseInsensitive ? 'i' : '';
  const parsed = useMemo(() => parseWard(source, flags), [source, flags]);

  const handleSubmit = (): void => {
    if (parsed.ok) {
      props.onSubmit(parsed.regex);
    }
  };

  return (
    <section
      aria-label="Ward editor"
      className="flex flex-col gap-4 rounded border border-zinc-700 bg-zinc-900/50 p-4"
    >
      <div className="flex flex-col gap-2">
        <label
          htmlFor="ward-source"
          className="text-sm font-semibold uppercase tracking-wide text-zinc-300"
        >
          Ward (regex)
        </label>
        <div className="flex items-center gap-2 font-mono">
          <span className="text-zinc-500">/</span>
          <input
            id="ward-source"
            type="text"
            value={source}
            onChange={(e) => { setSource(e.target.value); }}
            spellCheck={false}
            autoComplete="off"
            placeholder="dragon\d+"
            className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-100 outline-none focus:border-zinc-400"
          />
          <span className="text-zinc-500">/</span>
          <label className="flex items-center gap-1 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={caseInsensitive}
              onChange={(e) => { setCaseInsensitive(e.target.checked); }}
            />
            <span className="font-mono">i</span>
          </label>
        </div>
        <div className="min-h-[1.25rem] text-sm">
          {parsed.ok ? (
            <span className="text-zinc-500">Ward parses.</span>
          ) : (
            <span className="text-rose-400" role="alert">
              {parsed.error}
            </span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!parsed.ok}
        className="self-start rounded bg-emerald-700 px-4 py-2 font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
      >
        Start encounter
      </button>

      <SupportedSyntaxCheatSheet />

      {/* Reserved slot for the future Test Bench. See ADR-0001 (view). */}
      <div
        aria-label="Test bench slot"
        className="rounded border border-dashed border-zinc-700 bg-zinc-950/40 p-3 text-sm text-zinc-500"
      >
        {props.testBenchSlot ?? (
          <span className="italic">test bench — coming soon</span>
        )}
      </div>
    </section>
  );
}

// Doc-only cheat sheet — the parser accepts any JS regex; this just names
// the curated subset v1 teaches.
const CHEAT_SHEET_ROWS: ReadonlyArray<readonly [string, string]> = [
  ['abc', 'literal characters'],
  ['.', 'any single character'],
  ['[abc] [^abc] [a-z]', 'character class / negated / range'],
  ['\\d \\D', 'digit / non-digit'],
  ['\\w \\W', 'word char / non-word char'],
  ['\\s \\S', 'whitespace / non-whitespace'],
  ['? * +', '0–1 / 0+ / 1+ repetitions'],
  ['{n} {n,} {n,m}', 'exact / at-least / range repetitions'],
  ['(...)  (?:...)', 'group (capture has no mechanics; ?: is non-capturing)'],
  ['|', 'alternation'],
  ['\\.  \\(  \\\\', 'escape a metacharacter with a backslash'],
  ['i flag', 'case-insensitive match (toggle above)'],
];

function SupportedSyntaxCheatSheet(): JSX.Element {
  return (
    <details
      aria-label="Supported regex syntax"
      className="rounded border border-zinc-800 bg-zinc-950/30 p-3 text-sm text-zinc-300"
    >
      <summary className="cursor-pointer font-semibold uppercase tracking-wide text-zinc-300">
        Supported syntax
      </summary>
      <p className="mt-2 text-xs text-zinc-500">
        The engine matches your Ward end-to-end, so <code>^</code> and{' '}
        <code>$</code> are accepted but unnecessary. Other JS features
        (lookahead/behind, backreferences, named groups, Unicode property
        escapes) are out of scope in v1.
      </p>
      <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 font-mono text-xs sm:grid-cols-2">
        {CHEAT_SHEET_ROWS.map(([pat, desc]) => (
          <li key={pat} className="flex gap-2">
            <code className="text-zinc-100">{pat}</code>
            <span className="text-zinc-400">— {desc}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
