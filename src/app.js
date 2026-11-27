/* app.js — the controller shared by the extension and the userscript.
 * Every 400 ms: read the page → if the move to explain changed, ask the engine
 * about the position before and after it → hand both to Coach.explain → render.
 * Target-specific pieces (engine, settings storage) are passed in as adapters. */

// Depth is the target; movetime is a safety cap for slow machines.
// Stockfish 19 NNUE lite at depth 18 plays far above 2600, so Balanced is enough to
// judge master-level moves; bad verdicts are re-checked 4 plies deeper (VERIFY).
const STRENGTH = {
  fast: { depth: 12, movetime: 1500 },
  balanced: { depth: 18, movetime: 4000 },
  deep: { depth: 22, movetime: 10000 },
};
const VERIFY = ['mistake', 'blunder', 'miss'];
const DEFAULTS = { strength: 'balanced', autoDeep: false, explainOpponent: true, verify: true, online: false, collapsed: false, pos: null };

/**
 * @param adapters.engine  { analyze(fen, {depth, movetime}, settings) → Promise<result>, cancelAll(), label() }
 * @param adapters.store   { get() → Promise<object>, set(object) }
 * @param adapters.canUseOnline  show the online-engine option (userscript only)
 */
async function startApp({ engine, store, canUseOnline }) {
  const saved = (await store.get().catch(() => null)) || {};
  const settings = { ...DEFAULTS, ...saved };
  const cache = new Map();
  let lastSig = null;
  let token = 0;

  const ui = UI.createPanel({
    store, settings, canUseOnline,
    onChange: (s, patch) => { if (['strength', 'explainOpponent', 'online', 'verify'].some((k) => k in patch)) lastSig = null; },
    onRetry: () => { lastSig = null; tick(); },
    onUseOnline: () => { lastSig = null; tick(); },
  });

  async function evalFen(fen, st) {
    const key = fen.split(' ').slice(0, 4).join(' ') + '|' + st.depth;
    if (cache.has(key)) return cache.get(key);
    const r = await engine.analyze(fen, st, ui.settings);
    if (cache.size > 400) cache.delete(cache.keys().next().value);
    cache.set(key, r);
    return r;
  }

  async function tick() {
    let cur;
    try { cur = Reader.currentMove(Chess); } catch (e) { return; }
    const s = ui.settings;
    const sig = [location.pathname, cur.gate.allowed, cur.key || cur.idle, cur.userColor, s.strength, s.explainOpponent, s.verify, s.online].join('|');
    if (sig === lastSig) return;
    lastSig = sig;
    const my = ++token;
    const gate = cur.gate;

    if (!gate.allowed) {
      engine.cancelAll();
      const fairPlay = gate.mode === 'Live game';
      ui.render({ kind: 'paused', title: fairPlay ? 'Paused for fair play' : 'Not active here', text: gate.reason, gate });
      return;
    }
    if (!cur.key) { ui.render({ kind: 'idle', text: cur.idle, gate }); return; }

    const mover = cur.fenBefore.split(' ')[1];
    const fullmove = cur.fenBefore.split(' ')[5];
    const label = mover === 'w' ? `${fullmove}. ${cur.san}` : `${fullmove}… ${cur.san}`;
    if (!s.explainOpponent && mover !== cur.userColor) {
      engine.cancelAll();
      ui.render({ kind: 'idle', text: `They played ${label}. Your feedback appears after your move.`, gate });
      return;
    }

    engine.cancelAll();
    ui.render({ kind: 'loading', label, gate });
    try {
      const st = STRENGTH[s.strength] || STRENGTH.balanced;
      const c = new Chess(cur.fenBefore);
      c.move({ from: cur.uci.slice(0, 2), to: cur.uci.slice(2, 4), promotion: cur.uci[4] || 'q' });
      const fenAfter = c.game_over() ? null : c.fen();
      const run = async (lim) => {
        const before = await evalFen(cur.fenBefore, lim);
        if (my !== token) return null;
        const after = fenAfter ? await evalFen(fenAfter, lim) : null;
        if (my !== token) return null;
        const fb = Coach.explain({ Chess, fenBefore: cur.fenBefore, uci: cur.uci, before, after, userColor: cur.userColor });
        if (!fb) throw new Error('Could not replay that move.');
        fb.depth = Math.min(before.depth || 0, after ? after.depth || 0 : 99);
        return fb;
      };
      const footer = (fb, extra) => `${engine.label()} · depth ${fb.depth || '?'}${extra || ''} · ${cur.source}`;

      let fb = await run(st);
      if (!fb) return;
      // A "Mistake"/"Blunder" label must never be a shallow-search artefact:
      // show it right away, flagged, then confirm (or correct) it 4 plies deeper.
      if (s.verify !== false && VERIFY.includes(fb.cls.key)) {
        ui.render({ kind: 'feedback', fb, gate, verifying: true, engine: footer(fb) });
        const deeper = await run({ depth: st.depth + 4, movetime: st.movetime * 2 });
        if (!deeper) return;
        deeper.verified = true;
        fb = deeper;
      }
      ui.render({ kind: 'feedback', fb, gate, engine: footer(fb, fb.verified ? ' · double-checked' : '') });
    } catch (e) {
      if (my !== token || (e && e.message === 'cancelled')) return;
      ui.render({ kind: 'error', text: (e && e.message) || String(e), offerOnline: !!(e && e.engineUnavailable), gate });
    }
  }

  setInterval(tick, 400);
  tick();
}
