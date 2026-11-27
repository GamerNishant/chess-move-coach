/* Extension content script entry (isolated world). The engine lives in an
 * offscreen document; we talk to it through the background service worker. */
const OWNER = Math.random().toString(36).slice(2);

const engine = {
  analyze(fen, st) {
    return chrome.runtime
      .sendMessage({ type: 'cmc:analyze', fen, depth: st.depth, movetime: st.movetime, owner: OWNER })
      .then((r) => {
        if (!r) throw new Error('No answer from the engine. Reload the page.');
        if (r.error) { const e = new Error(r.error); e.engineUnavailable = !!r.engineUnavailable; throw e; }
        return r.result;
      }, (e) => {
        throw new Error(/context invalidated/i.test(e.message) ? 'The extension was updated. Reload this tab.' : e.message);
      });
  },
  cancelAll() {
    try { chrome.runtime.sendMessage({ type: 'cmc:cancel', owner: OWNER }).catch(() => {}); } catch (e) { /* tab outlived the extension */ }
  },
  label: () => 'Stockfish 19 NNUE · on-device',
};

const store = {
  get: () => chrome.storage.local.get('cmc').then((o) => o.cmc),
  set: (v) => chrome.storage.local.set({ cmc: v }).catch(() => {}),
};

startApp({ engine, store, canUseOnline: false });
