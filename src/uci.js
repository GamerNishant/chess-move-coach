/* uci.js — a small UCI client around a Stockfish Web Worker.
 * One search at a time; later requests queue. cancelAll(owner) drops that
 * owner's queued jobs and stops its running search, so stale positions never
 * block fresh ones (owner = one browser tab, so tabs don't cancel each other).
 * Used by the extension's offscreen document and by the userscript. */

function UciEngine(worker) {
  const queue = [];
  let current = null;
  let booted = false;
  let readyResolve, readyReject;
  const ready = new Promise((res, rej) => { readyResolve = res; readyReject = rej; });
  ready.catch(() => {});

  worker.onmessage = (e) => onLine(String(e.data));
  worker.onerror = (e) => {
    const err = new Error('Engine failed to start: ' + (e.message || 'worker error'));
    err.engineUnavailable = true;
    if (!booted) { readyReject(err); while (queue.length) queue.shift().reject(err); }
    if (current) { current.reject(err); current = null; }
  };
  worker.postMessage('uci');

  function onLine(line) {
    if (line === 'uciok') { worker.postMessage('setoption name Hash value 32'); worker.postMessage('isready'); return; }
    if (line === 'readyok' && !booted) { booted = true; readyResolve(); pump(); return; }
    if (!current) return;
    if (line.startsWith('info') && line.includes(' pv ') && !/ multipv [2-9]/.test(line)) {
      if (/ (lower|upper)bound/.test(line)) return;
      const depth = +(line.match(/ depth (\d+)/) || [])[1];
      const cp = line.match(/ score cp (-?\d+)/);
      const mate = line.match(/ score mate (-?\d+)/);
      // Stockfish.js appends non-UCI tokens after the PV (e.g. "bmc 0.26"), so keep moves only.
      const pv = [];
      for (const t of line.split(' pv ')[1].trim().split(/\s+/)) {
        if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(t)) break;
        pv.push(t);
      }
      current.last = { depth, cp: cp ? +cp[1] : null, mate: mate ? +mate[1] : null, pv };
    } else if (line.startsWith('bestmove')) {
      const job = current;
      current = null;
      const best = line.split(/\s+/)[1];
      if (job.cancelled) job.reject(new Error('cancelled'));
      else {
        const r = job.last || { depth: 0, cp: null, mate: null, pv: [] };
        // "bestmove (none)" = side to move is mated or stalemated.
        if (best === '(none)') { r.bestMove = null; if (r.mate == null && r.cp == null) r.mate = 0; }
        else r.bestMove = best;
        job.resolve({ fen: job.fen, ...r });
      }
      pump();
    }
  }

  function pump() {
    if (current || !booted || !queue.length) return;
    current = queue.shift();
    worker.postMessage('position fen ' + current.fen);
    worker.postMessage(`go depth ${current.depth} movetime ${current.movetime}`);
  }

  return {
    ready,
    analyze(fen, depth = 14, movetime = 3000, owner = 'default') {
      return new Promise((resolve, reject) => {
        queue.push({ fen, depth, movetime, owner, resolve, reject, last: null });
        pump();
      });
    },
    cancelAll(owner = 'default') {
      for (let i = queue.length - 1; i >= 0; i--) {
        if (queue[i].owner === owner) queue.splice(i, 1)[0].reject(new Error('cancelled'));
      }
      if (current && current.owner === owner && !current.cancelled) { current.cancelled = true; worker.postMessage('stop'); }
    },
    terminate() { worker.terminate(); },
  };
}
