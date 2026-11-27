/* Offscreen document: owns the single Stockfish 19 (NNUE lite, WASM) worker shared
 * by all tabs. The .wasm sits next to the .js, which is where the loader looks. */
const engine = UciEngine(new Worker('engine/stockfish-19-lite-single.js'));

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target !== 'offscreen') return;
  if (msg.type === 'cmc:analyze') {
    engine.analyze(msg.fen, msg.depth, msg.movetime, msg.owner).then(
      (result) => sendResponse({ result }),
      (e) => sendResponse({ error: e.message, engineUnavailable: !!e.engineUnavailable }),
    );
    return true;
  }
  if (msg.type === 'cmc:cancel') { engine.cancelAll(msg.owner); sendResponse({ ok: true }); }
});
