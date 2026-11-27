/* Offscreen document: owns the single Stockfish worker shared by all tabs. */
const engine = UciEngine(new Worker('engine/stockfish.asm.js'));

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
