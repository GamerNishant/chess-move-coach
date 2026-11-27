/*! Chess Move Coach 1.1.0 (page bridge) | MIT | bundles chess.js (BSD-2) — built file, edit src/ */
(function () {
'use strict';
/* bridge.js — runs in the PAGE's JavaScript world (not the extension's isolated one),
 * because chess.com keeps its game object on the <wc-chess-board> element where
 * content scripts can't see it. It only READS: every 300 ms it copies the shown
 * position, which side you play and whether the game is over into
 * <html data-cmc-fen / data-cmc-as / data-cmc-over>. Nothing is ever written to
 * the game. If chess.com renames these methods, the reader falls back to the
 * DOM move list. */
function cmcBridge(win) {
  if (!win || win.__cmcBridge) return;
  win.__cmcBridge = true;
  const doc = win.document;
  const call = (g, name) => { try { return typeof g[name] === 'function' ? g[name]() : undefined; } catch (e) { return undefined; } };
  win.setInterval(() => {
    const root = doc.documentElement;
    const el = doc.querySelector('wc-chess-board, chess-board');
    const g = el && el.game;
    if (!g) { delete root.dataset.cmcFen; return; }
    const fen = call(g, 'getFEN');
    if (typeof fen === 'string') root.dataset.cmcFen = fen; else delete root.dataset.cmcFen;
    const as = call(g, 'getPlayingAs');
    if (as === 1 || as === 2) root.dataset.cmcAs = String(as); else delete root.dataset.cmcAs;
    const over = call(g, 'isGameOver');
    root.dataset.cmcOver = over === true ? '1' : '0';
  }, 300);
}


cmcBridge(window);
})();
