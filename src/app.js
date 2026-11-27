/* app.js — the controller shared by the extension and the userscript.
 * Every 400 ms: read the page → if the move to explain changed, ask the engine
 * about the position before and after it → hand both to Coach.explain → render.
 * Target-specific pieces (engine, settings storage) are passed in as adapters. */

const STRENGTH = {
  fast: { depth: 10, movetime: 1200 },
  balanced: { depth: 14, movetime: 2500 },
  deep: { depth: 18, movetime: 6000 },
};
const DEFAULTS = { strength: 'balanced', autoDeep: false, explainOpponent: true, online: false, collapsed: false, pos: null };

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
    onChange: (s, patch) => { if ('strength' in patch || 'explainOpponent' in patch || 'online' in patch) lastSig = null; },
    onRetry: () => { lastSig = null; tick(); },
    onUseOnline: () => { lastSig = null; tick(); },
  });

  async function evalFen(fen) {
    const st = STRENGTH[ui.settings.strength] || STRENGTH.balanced;
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
    const sig = [location.pathname, cur.gate.allowed, cur.key || cur.idle, cur.userColor, s.strength, s.explainOpponent, s.online].join('|');
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
      const before = await evalFen(cur.fenBefore);
      if (my !== token) return;
      const c = new Chess(cur.fenBefore);
      c.move({ from: cur.uci.slice(0, 2), to: cur.uci.slice(2, 4), promotion: cur.uci[4] || 'q' });
      const after = c.game_over() ? null : await evalFen(c.fen());
      if (my !== token) return;
      const fb = Coach.explain({ Chess, fenBefore: cur.fenBefore, uci: cur.uci, before, after, userColor: cur.userColor });
      if (!fb) throw new Error('Could not replay that move.');
      ui.render({ kind: 'feedback', fb, gate, engine: `${engine.label()} · depth ${before.depth || '?'} · ${cur.source}` });
    } catch (e) {
      if (my !== token || (e && e.message === 'cancelled')) return;
      ui.render({ kind: 'error', text: (e && e.message) || String(e), offerOnline: !!(e && e.engineUnavailable), gate });
    }
  }

  setInterval(tick, 400);
  tick();
}
