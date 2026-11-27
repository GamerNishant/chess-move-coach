/* Userscript entry. Engine: Stockfish from the @resource, run as a Blob worker.
 * If chess.com's page blocks that worker, the user can opt in to an online engine. */
try { cmcBridge(typeof unsafeWindow !== 'undefined' ? unsafeWindow : window); } catch (e) { /* DOM move list still works */ }

function unavailable(msg) { const e = new Error(msg); e.engineUnavailable = true; return e; }

function remoteEngine(fen, depth) {
  return new Promise((resolve, reject) => {
    GM_xmlhttpRequest({
      method: 'POST',
      url: 'https://chess-api.com/v1',
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ fen, depth: Math.min(depth, 18), variants: 1 }),
      timeout: 20000,
      onload: (r) => {
        try {
          const d = JSON.parse(r.responseText);
          if (!d || !d.move) throw new Error('no move');
          const sign = fen.split(' ')[1] === 'w' ? 1 : -1; // API scores are from White's side
          const mate = d.mate != null ? d.mate * sign : null;
          const cp = mate != null ? null : Math.round((d.centipawns != null ? +d.centipawns : d.eval * 100) * sign);
          const pv = Array.isArray(d.continuationArr) ? d.continuationArr.slice() : [];
          if (pv[0] !== d.move) pv.unshift(d.move);
          resolve({ fen, depth: d.depth, cp, mate, pv, bestMove: d.move });
        } catch (e) { reject(new Error('The online engine gave an unexpected answer.')); }
      },
      onerror: () => reject(new Error('Online engine unreachable.')),
      ontimeout: () => reject(new Error('Online engine timed out.')),
    });
  });
}

function makeEngine() {
  let local = null;
  let mode = 'sf19';
  const LABELS = {
    sf19: 'Stockfish 19 NNUE · on-device',
    sf10: 'Stockfish 10 (fallback) · on-device',
    online: 'Stockfish · chess-api.com (online)',
  };

  const withTimeout = (p, ms, msg) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(unavailable(msg)), ms))]);

  // Stockfish 19 needs its .wasm. A Blob worker on chess.com may not be allowed to
  // fetch it, so we download the bytes here (GM_xmlhttpRequest ignores page CSP)
  // and hand them to the worker, whose fetch() is patched to serve them.
  function fetchWasm() {
    return new Promise((resolve, reject) => GM_xmlhttpRequest({
      method: 'GET', url: SF19_WASM, responseType: 'arraybuffer', timeout: 30000,
      onload: (r) => (r.status === 200 && r.response ? resolve(r.response) : reject(new Error('HTTP ' + r.status))),
      onerror: () => reject(new Error('download failed')),
      ontimeout: () => reject(new Error('download timed out')),
    }));
  }

  async function bootSf19() {
    const js = GM_getResourceText('sf19');
    if (!js) throw new Error('engine file missing');
    const wasm = await fetchWasm();
    const prelude =
      'self.onmessage=function(e){var bytes=e.data;' +
      'self.fetch=function(){return Promise.resolve(new Response(bytes,{headers:{"Content-Type":"application/wasm"}}))};' +
      'self.onmessage=null;__cmcBoot();};\nfunction __cmcBoot(){\n';
    const url = URL.createObjectURL(new Blob([prelude, js, '\n}'], { type: 'text/javascript' }));
    const w = new Worker(url);
    w.postMessage(wasm, [wasm]); // first message = the wasm bytes; UCI follows
    const eng = UciEngine(w);
    await withTimeout(eng.ready, 20000, 'Stockfish 19 did not start.');
    return eng;
  }

  async function bootSf10() {
    const src = GM_getResourceText('sf10');
    if (!src) throw new Error('fallback engine missing');
    const eng = UciEngine(new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))));
    await withTimeout(eng.ready, 12000, 'The local engine did not start (this page may block it).');
    return eng;
  }

  const booting = (async () => {
    try { local = await bootSf19(); mode = 'sf19'; return; } catch (e) { console.warn('[Move Coach] Stockfish 19 unavailable:', e.message); }
    try { local = await bootSf10(); mode = 'sf10'; } catch (e) {
      local = null;
      throw unavailable('The local engine could not start on this page: ' + e.message);
    }
  })();
  booting.catch(() => {});

  return {
    async analyze(fen, st, settings) {
      try {
        await booting;
        return await local.analyze(fen, st.depth, st.movetime);
      } catch (e) {
        if (!e.engineUnavailable || !settings.online) throw e;
        mode = 'online';
        return remoteEngine(fen, st.depth);
      }
    },
    cancelAll() { if (local) local.cancelAll(); },
    label: () => LABELS[mode],
  };
}

const SF19_WASM = 'https://gamernishant.github.io/chess-move-coach/engine/stockfish-19-lite-single.wasm';

const store = {
  get: async () => GM_getValue('cmc', null),
  set: (v) => GM_setValue('cmc', v),
};

startApp({ engine: makeEngine(), store, canUseOnline: true });
