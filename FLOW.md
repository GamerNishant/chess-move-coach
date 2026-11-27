# Chess Move Coach: code flow

## Entry points

| Target | Entry | What loads |
|---|---|---|
| Extension | `extension/manifest.json` | `bridge.js` (MAIN world) and `content.js` (isolated world) on `https://www.chess.com/*`. `background.js` service worker. `offscreen.html` → `offscreen.js` on demand. `popup.html` → `popup.js` from the toolbar button. |
| Userscript | `userscript/chess-move-coach.user.js` | One IIFE: chess.js + core + bridge + `src/targets/userscript.js`. Stockfish comes from `@resource stockfish`. |
| Build | `scripts/build.mjs` | Concatenates `vendor/chess.js` (exports stripped) + `src/*.js` + a target entry into IIFEs, copies the engine, and stamps the version from `package.json`. |

Order inside `content.js` and the userscript: `chess.js → board.js → coach.js → uci.js → reader.js → ui.js → app.js → (bridge.js) → target entry`. Every file declares top-level names in one shared IIFE scope.

## Startup

1. **Bridge** (`src/bridge.js`, `cmcBridge(window)`). Every 300 ms it finds `wc-chess-board` and reads `game.getFEN()`, `getPlayingAs()` and `isGameOver()`. It writes them to `<html data-cmc-fen|as|over>`, or removes them if the game object isn't found.
2. **Target entry** builds its adapters:
   - extension (`src/targets/extension-content.js`): `engine.analyze` = `chrome.runtime.sendMessage({type:'cmc:analyze', fen, depth, movetime, owner})`, and `store` = `chrome.storage.local`.
   - userscript (`src/targets/userscript.js`): `makeEngine()` runs `bootSf19()`. It gets the JS with `GM_getResourceText('sf19')` and the .wasm with `fetchWasm()` (`GM_xmlhttpRequest`, arraybuffer). It builds a Blob worker from a prelude plus the engine source wrapped in `function __cmcBoot(){…}`. It posts the wasm bytes as the first message. The prelude patches `fetch` to return them, clears `onmessage` and calls `__cmcBoot()`, and the engine then installs its own UCI handler. Then `UciEngine(worker)` starts, with a 20 s ready timeout. If any step fails, `bootSf10()` runs (the asm.js `@resource 'sf10'` as a Blob worker). `store` = `GM_getValue/GM_setValue`.
3. **`startApp`** (`src/app.js`) loads settings (merged over `DEFAULTS`), creates the panel (`UI.createPanel`), and starts `tick()` every 400 ms.

## Main loop: `tick()` in `src/app.js`

1. `Reader.currentMove(Chess)` (`src/reader.js`):
   1. `bridgeState()` reads the `data-cmc-*` attributes.
   2. `gate(over)` decides whether feedback is allowed from `location.pathname` and the game-over state (the bridge, or game-over DOM via `gameOverInDom()`). If it isn't allowed, it returns `{gate}` only.
   3. `userColor` = the bridge `as`, or the board's `flipped` class.
   4. `readMoveList(Chess)` finds the `.main-line-ply` nodes (with fallbacks), rebuilds each SAN from the figurine `data-figurine` + text (`nodeSan`), and replays them in chess.js to get `positions[]` and `moves[]`. The selected node is the one with the `.selected` class, or the last one.
   5. Cross-check: if the bridge FEN doesn't match `positions[selected+1]`, it uses the index whose position does match.
   6. Fallback, used when no list could be read: it diffs the previous bridge FEN against the current one by trying every legal move.
   7. It returns `{fenBefore, uci, san, key, userColor, gate, source}`, or `{gate, idle}`.
2. Signature check: if path, move key, side, strength, opponent setting and online setting are all unchanged, `tick` stops here. Most ticks end here.
3. Paused or idle: `engine.cancelAll()`, then `ui.render({kind:'paused'|'idle'})`.
4. If it's an opponent move and *Explain opponent moves* is off: idle message.
5. `engine.cancelAll()` stops stale searches. `ui.render({kind:'loading'})` shows the skeleton.
6. `run(STRENGTH[s.strength])` calls `evalFen(fenBefore, lim)`, then `evalFen(fenAfter, lim)` (skipped when the game is over). Both read the cache first, keyed on FEN without clocks plus depth. The "after" of move *n* is the "before" of move *n+1*, so stepping forward usually costs one search. Then `Coach.explain(...)`, and `fb.depth` = the lower of the two depths.
7. If `token` changed while awaiting (a newer move was selected), the result is dropped.
8. Double-check: if `settings.verify` is on and the class is `mistake`, `blunder` or `miss`, it renders `{kind:'feedback', verifying:true}`. That dims the badge and shows "Double-checking deeper…". It then runs `run({depth+4, movetime×2})` and uses that result, with `fb.verified = true`.
9. `ui.render({kind:'feedback', fb, engine})`. The footer shows the engine, the depth, "double-checked" if verified, and the move source.

## Engine request paths

**Extension**
```
content.js engine.analyze ──runtime.sendMessage──► background.js onMessage
  ensureOffscreen() → chrome.offscreen.createDocument('offscreen.html', WORKERS) (once)
  ──runtime.sendMessage({target:'offscreen', owner: tabId:rand})──► offscreen.js
  UciEngine.analyze → Worker('engine/stockfish-19-lite-single.js' + .wasm; manifest CSP allows 'wasm-unsafe-eval')
     position fen … / go depth D movetime T → info … pv … → bestmove
  ◄── {result} or {error, engineUnavailable} ── back through both hops
```
`cmc:cancel` follows the same path and calls `UciEngine.cancelAll(owner)`. That rejects the owner's queued jobs and sends `stop` to its running job, whose promise then rejects with `cancelled`.

**Userscript:** `makeEngine().analyze` waits for `booting` (SF19, else SF10), then calls `local.analyze`. If the engine is unavailable and settings.online is on, it calls `remoteEngine(fen, depth)`, which uses `GM_xmlhttpRequest` POST to `https://chess-api.com/v1`. Scores there are from White's side and get converted to side-to-move.

**UCI parsing** (`src/uci.js`): it keeps the last `info … pv` line without `multipv ≥2` and without a lower or upper bound, and keeps only UCI-shaped PV tokens (Stockfish.js appends `bmc …`). On `bestmove` it resolves `{fen, depth, cp|mate, pv, bestMove}`. `bestmove (none)` means mate or stalemate.

## Feedback generation: `Coach.explain` in `src/coach.js`

1. It finds the legal move that matches `uci`, works out mover and user, and builds `moveLabel` ("14… Nf6").
2. `Board.describeMove` gives the move's own motif (victims are labelled "their" or "your").
3. It plays the move and records checkmate, stalemate or draw.
4. Scores are converted to the mover's POV: `sb` = before, `sa` = −after. Win % drop gives the class.
5. `annotateLine` replays the best line (before) and the reply line (after) with motif text for each ply.
6. `Board.lineMaterial(move + reply PV)` gives the material swing. `Board.loosePieces` finds a hung piece.
7. Headline priority: mate given or stalemate → missed mate → allows mate → keeps mate → hung piece → allowed tactic → material won or lost → eval-state change → own motif.
8. `next` is the expected reply, or for tactic headlines the eval story. `better` is the engine's move and why.
9. Deep dive: `did[]`, `buildPlan()` (theme: forced mate / cash in / king attack / threats / center / development / quiet), and `yours[]`.

## User actions (`src/ui.js`)

| Action | Handler | Effect |
|---|---|---|
| Click *Deep dive* / <kbd>Alt</kbd>+<kbd>D</kbd> | `setDeep` | Toggles `hidden` and `aria-expanded`. Resets to the `autoDeep` setting on each new move. |
| <kbd>Alt</kbd>+<kbd>M</kbd> / — / pill click | `toggleCollapsed` | Panel ↔ pill. Saved in settings. |
| Drag header | `onDown/onMove/onUp` | Moves the panel, clamped to the viewport. Saves `pos` on release. |
| ⚙ | swaps `view` | Settings view. Each change calls `save()`, which calls `store.set` and `onChange`, which clears `lastSig` so the next tick re-analyzes. |
| Retry / Use online engine (error state) | `onRetry` / `onUseOnline` | Clears `lastSig`, then runs `tick()`. |

## Error paths

- Unreadable move list and no bridge: idle state "Waiting for a move…".
- Engine failed to start: `worker.onerror` before `readyok` rejects with `engineUnavailable`. The panel shows an error with Retry (and, in the userscript, *Use online engine*).
- Extension reloaded under an open tab: `sendMessage` throws "context invalidated", and the panel says to reload the tab.
- Stale search: rejected with `cancelled`, and silently ignored.
- `Coach.explain` can't match the move: the error state shows "Could not replay that move."

## Shutdown

There's nothing to clean up. Closing the tab ends the content script. The offscreen document (with its worker) stays alive while the extension does, so later searches start warm. Chrome may close it, and `ensureOffscreen()` recreates it on demand. The userscript's worker ends with the page.
