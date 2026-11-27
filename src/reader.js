/* reader.js — reads the game from chess.com's page.
 * Two independent sources, cross-checked:
 *   1. the move list in the DOM (works everywhere, gives the selected move in reviews)
 *   2. the "bridge": page-world code that copies the board's FEN / side / game-over
 *      state into <html data-cmc-*> attributes (see bridge.js)
 * Also owns the fair-play gate: feedback is only allowed in Analysis, vs-computer
 * games and finished games, never while a game against a person is running. */

const SAN_RE = /(O-O-O|O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=?[QRBN])?[+#]?)/;

function bridgeState() {
  const d = document.documentElement.dataset;
  return {
    fen: d.cmcFen || null,
    as: d.cmcAs === '1' ? 'w' : d.cmcAs === '2' ? 'b' : null,
    over: d.cmcOver === '1',
  };
}

function moveNodes() {
  const main = document.querySelectorAll('.main-line-ply');
  if (main.length) return [...main];
  return [...document.querySelectorAll(
    'wc-simple-move-list .node, vertical-move-list .node, .move-list .node, .move-list-wrapper .node'
  )].filter((n) => !n.closest('.variation, .subline, .move-list-variation'));
}

function nodeSan(node) {
  const fig = node.querySelector('[data-figurine]');
  const text = (node.textContent || '').replace(/\s+/g, '').replace(/0-0-0/g, 'O-O-O').replace(/0-0/g, 'O-O');
  const m = ((fig ? fig.getAttribute('data-figurine') : '') + text).match(SAN_RE);
  return m ? m[1] : null;
}

/** Replays the DOM move list. → { positions:[fen0..fenN], moves:[{uci,san}], selected } | null */
function readMoveList(Chess) {
  const nodes = moveNodes();
  if (!nodes.length) return null;
  const c = new Chess();
  const positions = [c.fen()];
  const moves = [];
  let selected = -1;
  for (let i = 0; i < nodes.length; i++) {
    const san = nodeSan(nodes[i]);
    if (!san) return null;
    const m = c.move(san, { sloppy: true });
    if (!m) return null; // custom start position or unreadable list: let the bridge handle it
    moves.push({ uci: m.from + m.to + (m.promotion || ''), san: m.san });
    positions.push(c.fen());
    const n = nodes[i];
    if (n.classList.contains('selected') || n.querySelector('.selected')) selected = i;
  }
  if (selected === -1) selected = moves.length - 1;
  return { positions, moves, selected };
}

const placement = (fen) => (fen || '').split(' ')[0];

function boardFlipped() {
  const b = document.querySelector('wc-chess-board, chess-board, .board');
  return !!(b && (b.classList.contains('flipped') || b.getAttribute('flipped') === 'true'));
}

function gameOverInDom() {
  return !!document.querySelector(
    '.game-over-modal-content, .game-over-header-component, .game-result, ' +
    '.game-over-buttons-component, [data-cy="game-over-modal"]'
  );
}

/** Fair-play gate. → { allowed, mode, reason } */
function gate(over) {
  const p = location.pathname;
  if (/^\/(analysis|explorer)\b/.test(p)) return { allowed: true, mode: 'Analysis' };
  if (/^\/(play\/computer|game\/computer|computer)\b/.test(p)) return { allowed: true, mode: 'vs Computer' };
  if (/^\/(puzzles?|puzzle-rush|battle)\b/.test(p))
    return { allowed: false, mode: 'Puzzles', reason: 'Move feedback is off on puzzles so it never solves them for you.' };
  if (/^\/(game|play|live|daily)\b/.test(p)) {
    if (over) return { allowed: true, mode: 'Game review' };
    return { allowed: false, mode: 'Live game', reason: 'You’re playing a person, so feedback is off (chess.com fair play). It unlocks the moment the game ends.' };
  }
  return { allowed: false, mode: 'Idle', reason: 'Open a game review, Analysis or a vs-computer game to get feedback.' };
}

let lastBridgeFen = null;
let lastBridgeMove = null;

/**
 * Work out which move to explain right now.
 * → { fenBefore, uci, san, key, userColor, gate, source } | { gate, error }
 */
function currentMove(Chess) {
  const br = bridgeState();
  const g = gate(br.over || gameOverInDom());
  const userColor = br.as || (boardFlipped() ? 'b' : 'w');
  if (!g.allowed) return { gate: g, userColor };

  const list = readMoveList(Chess);
  let pick = null;

  if (list && list.moves.length) {
    let i = list.selected;
    // Cross-check with the board's real position when the bridge is available.
    if (br.fen && placement(list.positions[i + 1]) !== placement(br.fen)) {
      const j = list.positions.findIndex((f, k) => k > 0 && placement(f) === placement(br.fen));
      i = j > 0 ? j - 1 : -2;
      if (j === 0) i = -1; // start position shown
    }
    if (i >= 0) pick = { fenBefore: list.positions[i], ...list.moves[i], source: 'move list' };
    else if (i === -1) return { gate: g, userColor, idle: 'Start position. Make or select a move.' };
  }

  // Fallback: follow the bridge FEN one move at a time.
  if (!pick && br.fen) {
    if (lastBridgeFen && br.fen !== lastBridgeFen) {
      const c = new Chess(lastBridgeFen);
      const mv = c.moves({ verbose: true }).find((m) => {
        c.move(m); const ok = placement(c.fen()) === placement(br.fen); c.undo(); return ok;
      });
      lastBridgeMove = mv ? { fenBefore: lastBridgeFen, uci: mv.from + mv.to + (mv.promotion || ''), san: mv.san, source: 'board' } : null;
    }
    lastBridgeFen = br.fen;
    pick = lastBridgeMove;
  }

  if (!pick) return { gate: g, userColor, idle: 'Waiting for a move…' };
  return { ...pick, key: pick.fenBefore + '|' + pick.uci, userColor, gate: g };
}

const Reader = { currentMove, gate, readMoveList, nodeSan, bridgeState };
