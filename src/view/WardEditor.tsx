/**
 * WardEditor — the player composes their regex Ward here.
 *
 * Match semantics: see `src/combat/docs/adr/0003-full-anchored-match.md`.
 * The editor does NOT auto-anchor; the player must write `^...$` themselves.
 * Only the `i` flag is offered (other JS flags are intentionally omitted).
 *
 * Test-bench slot: see ADR-0001 (view). v1 ships without a live test bench,
 * but the layout reserves a clearly-labelled slot here so the future addition
 * is drop-in. If the parent does not supply `testBenchSlot`, we render the
 * "coming soon" placeholder so the absence is intentional rather than hidden.
 */

import { useMemo, useState } from 'react';

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
            onChange={(e) => setSource(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            placeholder="^dragon\d+$"
            className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-100 outline-none focus:border-zinc-400"
          />
          <span className="text-zinc-500">/</span>
          <label className="flex items-center gap-1 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={caseInsensitive}
              onChange={(e) => setCaseInsensitive(e.target.checked)}
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
