# Chess Move Coach: design

## What it does

A floating panel on chess.com that explains the move you are looking at, in two levels:

| Level | Shown | Content |
|---|---|---|
| Quick take | always | badge (Best … Blunder), eval before → after, **headline** (what the move did), **next** (the consequence), optional **Better: X** chip |
| Deep dive | on click / <kbd>Alt</kbd>+<kbd>D</kbd> / auto (setting) | *What your move did* (≤3 bullets) · *Their plan* (one-line theme, ≤3 annotated moves, engine line chips) · *Your plan* (the better move and the best answer to their reply) |

Both levels are kept short on purpose. A game has 30–80 moves, so a wall of text per move would never be read.

It runs as two products built from the same source:
- **Chromium extension** (MV3): Chrome, Edge, Brave and other Chromium browsers, version 116 or later.
- **Userscript** for Tampermonkey or Violentmonkey: any browser, including Firefox.

## Tech stack and why

| Choice | Why |
|---|---|
| Plain JavaScript, no framework, no bundler | It's a small UI. A concatenating build script (`scripts/build.mjs`) gives two targets with no toolchain to maintain. |
| [chess.js 0.13.4](https://github.com/jhlywa/chess.js) | Move legality, SAN↔move conversion and FEN. It's vendored, and its `export` keywords are stripped at build time so it shares the IIFE scope. |
| Stockfish.js **19 lite, single-threaded WASM** (NNUE) | It's about 1.9 MB, needs no SharedArrayBuffer and no cross-origin isolation, and reaches depth 18 in about 2–4 s. That is far above 2600 strength, so the coach can judge master-level moves. The extension needs `'wasm-unsafe-eval'` in its CSP. The userscript keeps Stockfish.js 10 (asm.js) as a fallback for pages that block WASM. |
| Shadow DOM (closed) for the panel | chess.com's CSS can't break the panel, and the panel's CSS can't leak into chess.com. |
| Heuristic text generation instead of an LLM | It's instant, free, needs no API key and works offline. Every claim comes from the engine line plus exact board geometry, so it's never vague. |

## Architecture

```
            ┌──────────────── shared core (src/) ────────────────┐
 chess.com  │ reader.js ──► app.js ──► coach.js ──► ui.js         │
  DOM  ───► │   ▲  (which move?)  │      ▲ board.js (motifs)     │
            │   │                 ▼      │                       │
 bridge.js ─┘ (page world:      engine adapter ── uci.js (UCI client)
  data-cmc-* attributes)            │
                                    ├─ extension: content → background SW → offscreen doc → Worker(stockfish)
                                    └─ userscript: Blob Worker(@resource stockfish) [→ optional chess-api.com]
```

### Module boundaries

| File | Responsibility | Depends on |
|---|---|---|
| `src/board.js` | Attack maps, loose pieces, material, `describeMove` (fork / threat / pile-up / check / castle / develop / center / passer), `lineMaterial` along a PV | chess.js |
| `src/coach.js` | Classification (win-% drop), headline/next/better, deep-dive sections, plan theme. **A pure function**: `explain(ctx) → feedback object` | board.js |
| `src/uci.js` | UCI client: queue, PV parsing, cancel by owner (tab) | a Worker |
| `src/reader.js` | Reads the move list DOM and the bridge attributes, picks the move to explain, and applies the **fair-play gate** | chess.js, DOM |
| `src/bridge.js` | Runs in the page's JS world and copies `wc-chess-board.game` FEN, side and game-over into `<html data-cmc-*>`. Read-only. | page |
| `src/ui.js` | Panel, pill, settings view, drag, shortcuts | DOM |
| `src/app.js` | Poll loop, cache, cancellation, glue | everything above + adapters |
| `src/targets/*` | Per-target adapters (engine + storage) and entry points | — |

Built files (`extension/content.js`, `bridge.js`, `background.js`, `offscreen.js`, `engine/`, `userscript/*.user.js`, `docs/*.user.js`) are generated. Edit `src/`.

## Data model

There's no database. The state is:

- **Settings** (`chrome.storage.local["cmc"]` or `GM_setValue("cmc")`):
  `{ strength: 'fast'|'balanced'|'deep', verify, autoDeep, explainOpponent, online, collapsed, pos: {right,bottom}|null }`
- **Engine cache** (in memory, per tab, at most 400 entries): key `FEN-without-clocks | depth` → `{ cp|mate (side-to-move POV), pv[], bestMove, depth }`.
- **Feedback object** (output of `Coach.explain`): `{ moveLabel, san, uci, mover, isUser, cls{key,label,symbol,tone}, evalBefore, evalAfter, drop, whiteCp, quick{headline,next,better}, deep{did[], plan{title,summary,bullets,line}, yours{title,bullets,line}} }`.

## Key decisions and trade-offs

- **Engine budget.** Strength presets are a target depth plus a time cap (`STRENGTH` in `app.js`): Fast 12/1.5 s, Balanced 18/4 s, Deep 22/10 s. A bad verdict (Mistake, Blunder, Missed win) is shown at once but marked "Double-checking deeper…". Both positions are then searched again at depth +4 with twice the time, and that result replaces the first. A quick shallow search can't make a final call on its own. Inaccuracies are not re-checked, because they cost little and are too frequent.
- **Engine hosting for the userscript.** jsDelivr refuses the 200 MB `stockfish` npm package, so `npm run build` copies the SF19 .js and .wasm into `docs/engine/`, which GitHub Pages serves. The .js is an `@resource`. The .wasm is downloaded with `GM_xmlhttpRequest`, which ignores page CSP, and handed to a Blob worker whose `fetch` is patched to return those bytes. The worker itself never touches the network, so a strict `connect-src` on chess.com can't break it. This was tested under `connect-src 'self'`.
- **Classification by win-probability drop.** The drop is computed with Lichess's logistic win-% formula, not raw centipawns, so a 200 cp slip at +8 doesn't count as a blunder. The thresholds are <2 Excellent, <5 Good, <10 Inaccuracy, <20 Mistake, otherwise Blunder. "Best" means it matched the engine's move. "Forced" means it was the only legal move. "Missed win" means a forced mate was missed but the position is still winning.
- **Headline priority.** Mate facts come first, then a hung piece (only when the engine's reply really takes it), then a tactic the move allows (fork, capture or threat), then material won or lost, then eval-state change, then the move's own motif. The most concrete true statement wins.
- **The engine line is the source of truth.** Board heuristics only *name* what the engine shows. For example, "hangs" requires the engine's reply to capture that piece.
- **Material counting.** For the headline it stops at the first quiet move, so "Loses a knight for a pawn" is about the immediate exchange. For the plan it uses the visible line (≤5 plies), so "Nxf7 … Nxh8" reads as winning the rook.
- **Two move sources.** The DOM move list is the main source: it works in every world and gives the *selected* move in reviews. The page bridge FEN cross-checks it and covers custom start positions. If chess.com changes its markup, one source usually still works.
- **Fair-play gate (`Reader.gate`).** Feedback is allowed on `/analysis`, `/explorer` and vs-computer pages. It's allowed on `/game|play|live|daily` pages only once the game is over (bridge `isGameOver()` or game-over DOM). It's always off on puzzles, and off on unknown pages. Failing closed is intentional.
- **Extension engine in an offscreen document.** MV3 service workers can't start Workers, and a content script can't start an extension-origin Worker. One offscreen document serves every tab. Jobs are tagged with `tabId:randomId`, so one tab can't cancel another tab's search.
- **Userscript engine as a Blob Worker.** If chess.com's CSP blocks it, the error state offers an **opt-in** online engine (chess-api.com, FEN only). It's off by default.
- **SF19 lite instead of the full SF19 (≈94 MB) or multi-threaded builds.** The lite network is weaker than the full one but still far stronger than any human. It loads in about a second, and it avoids the COOP/COEP headers that threads would need.

## Security and privacy

- All page-derived text goes into the panel through `textContent`. Nothing is parsed as HTML.
- The closed shadow root means page scripts can't read or change the panel.
- The bridge only *reads* the game object. It never calls a method that changes the game.
- Permissions: `storage` and `offscreen` only. Content scripts are limited to `https://www.chess.com/*`. There are no host permissions and no remote code.
- Network: the extension makes no requests, because the engine is bundled. The userscript downloads the engine from this project's GitHub Pages: the SF19 .js as an `@resource`, and the .wasm on each page load, which the browser may cache. The SF10 fallback comes from jsDelivr. It calls chess-api.com only when the user turns on the online fallback.

## How to extend

- **New motif** (pin, skewer, discovered attack, and so on): add detection in `Board.describeMove` (push a tag and a phrase), then optionally a headline rule in `Coach.explain` and a plan theme in `buildPlan`. Add a test in `test/coach.test.mjs` with a FEN and a fake engine result.
- **New site** (for example lichess): write a reader with the same `currentMove()` contract and a gate, then pick the reader in `app.js` by `location.host`. Add the `@match` and manifest `matches`.
- **LLM-written deep dive:** feed the feedback object (it already holds the facts) to a model in a new engine-like adapter. Keep the quick take heuristic so it stays instant.
- **Firefox extension:** Firefox MV3 has no offscreen API, but its background page can start Workers. Add a `background.scripts` variant that runs `UciEngine` directly.
