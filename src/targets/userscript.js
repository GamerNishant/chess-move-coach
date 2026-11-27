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
  let mode = 'local';
  const boot = () => {
    try {
      const src = GM_getResourceText('stockfish');
      if (!src) throw new Error('engine file missing');
      const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      local = UciEngine(new Worker(url));
      const timeout = new Promise((_, rej) => setTimeout(() => rej(unavailable('The local engine did not start (this page may block it).')), 12000));
      return Promise.race([local.ready, timeout]);
    } catch (e) {
      return Promise.reject(unavailable('The local engine could not start: ' + e.message));
    }
  };
  const booting = boot();
  booting.catch(() => { local = null; });
  return {
    async analyze(fen, st, settings) {
      try {
        await booting;
        mode = 'local';
        return await local.analyze(fen, st.depth, st.movetime);
      } catch (e) {
        if (!e.engineUnavailable || !settings.online) throw e;
        mode = 'online';
        return remoteEngine(fen, st.depth);
      }
    },
    cancelAll() { if (local) local.cancelAll(); },
    label: () => (mode === 'online' ? 'Stockfish · chess-api.com (online)' : 'Stockfish 10 · on-device'),
  };
}

const store = {
  get: async () => GM_getValue('cmc', null),
  set: (v) => GM_setValue('cmc', v),
};

startApp({ engine: makeEngine(), store, canUseOnline: true });
