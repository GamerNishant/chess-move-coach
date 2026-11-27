/* board.js — pure board geometry on top of chess.js.
 * Attack maps, material counting and "what does this move do" motif detection.
 * No DOM, no engine: everything here is deterministic and unit-tested. */

const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const NAME = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const FILES = 'abcdefgh';

const sq = (f, r) => FILES[f] + (r + 1);
const fileOf = (s) => s.charCodeAt(0) - 97;
const rankOf = (s) => +s[1] - 1;
const other = (c) => (c === 'w' ? 'b' : 'w');

/** chess.js board() → { e4: {type, color}, ... } */
function grid(chess) {
  const g = {};
  const b = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = b[r][f];
      if (p) g[sq(f, 7 - r)] = { type: p.type, color: p.color };
    }
  }
  return g;
}

const N_STEPS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const K_STEPS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ORTHO = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Squares attacked by the piece standing on `from` (includes occupied squares). */
function attacksFrom(g, from) {
  const p = g[from];
  if (!p) return [];
  const f = fileOf(from), r = rankOf(from);
  const out = [];
  const add = (df, dr) => {
    const nf = f + df, nr = r + dr;
    if (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) out.push(sq(nf, nr));
  };
  const slide = (dirs) => {
    for (const [df, dr] of dirs) {
      let nf = f + df, nr = r + dr;
      while (nf >= 0 && nf < 8 && nr >= 0 && nr < 8) {
        const s = sq(nf, nr);
        out.push(s);
        if (g[s]) break;
        nf += df; nr += dr;
      }
    }
  };
  switch (p.type) {
    case 'p': { const d = p.color === 'w' ? 1 : -1; add(1, d); add(-1, d); break; }
    case 'n': N_STEPS.forEach(([a, b]) => add(a, b)); break;
    case 'k': K_STEPS.forEach(([a, b]) => add(a, b)); break;
    case 'b': slide(DIAG); break;
    case 'r': slide(ORTHO); break;
    case 'q': slide(DIAG); slide(ORTHO); break;
  }
  return out;
}

/** Pieces of `color` that attack `target`. */
function attackers(g, target, color) {
  const out = [];
  for (const s in g) {
    if (g[s].color === color && attacksFrom(g, s).includes(target)) out.push({ sq: s, piece: g[s] });
  }
  return out;
}

/** Pieces of `color` that are en prise: undefended, or attacked by something cheaper. */
function loosePieces(g, color) {
  const res = [];
  for (const s in g) {
    const p = g[s];
    if (p.color !== color || p.type === 'k') continue;
    const atk = attackers(g, s, other(color));
    if (!atk.length) continue;
    const def = attackers(g, s, color);
    const cheapest = Math.min(...atk.map((a) => VAL[a.piece.type]));
    const risk = def.length ? VAL[p.type] - cheapest : VAL[p.type];
    if (risk > 0) res.push({ sq: s, piece: p, risk, defended: def.length > 0 });
  }
  return res.sort((a, b) => b.risk - a.risk);
}

function material(g) {
  const m = { w: 0, b: 0 };
  for (const s in g) m[g[s].color] += VAL[g[s].type];
  return m;
}

function kingSquare(g, color) {
  for (const s in g) if (g[s].type === 'k' && g[s].color === color) return s;
  return null;
}

function dist(a, b) {
  return Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b)));
}

function isPassed(g, s, color) {
  const f = fileOf(s), r = rankOf(s), d = color === 'w' ? 1 : -1;
  for (let nr = r + d; nr >= 0 && nr < 8; nr += d) {
    for (let nf = f - 1; nf <= f + 1; nf++) {
      if (nf < 0 || nf > 7) continue;
      const p = g[sq(nf, nr)];
      if (p && p.type === 'p' && p.color !== color) return false;
    }
  }
  return true;
}

const CENTER = ['d4', 'e4', 'd5', 'e5'];

/**
 * Describe what a single move does. `chess` must be positioned BEFORE the move;
 * it is restored on return. Returns { tags:[...], text, detail } where tags are
 * machine-readable motifs and text is a short human phrase (no subject).
 * owner: 'your' | 'their' — whose pieces the *victims* are, for phrasing.
 */
function describeMove(chess, move, victimOwner) {
  const fullmove = +chess.fen().split(' ')[5];
  const mover = move.color;
  const m = chess.move({ from: move.from, to: move.to, promotion: move.promotion || 'q' });
  if (!m) return { tags: [], text: '' };
  const g = grid(chess);
  const tags = [];
  const bits = [];
  const v = victimOwner;

  if (chess.in_checkmate()) {
    chess.undo();
    return { tags: ['mate'], text: 'checkmate' };
  }

  if (m.flags.includes('k') || m.flags.includes('q')) {
    tags.push('castle');
    bits.push(`castles ${m.flags.includes('k') ? 'kingside' : 'queenside'}, tucking the king away`);
  } else if (m.promotion) {
    tags.push('promote');
    bits.push(`promotes to a ${NAME[m.promotion]}`);
  } else if (m.captured) {
    tags.push('capture');
    bits.push(`takes ${v} ${NAME[m.captured]} on ${m.to}`);
  }

  // Threats made by the moved piece (or any piece, for discovered attacks).
  const targets = attacksFrom(g, m.to)
    .map((s) => ({ s, p: g[s] }))
    .filter((t) => t.p && t.p.color !== mover)
    .filter((t) => {
      if (t.p.type === 'k') return true;
      const defended = attackers(g, t.s, t.p.color).length > 0;
      return !defended || VAL[t.p.type] > VAL[m.piece];
    });
  const check = chess.in_check();
  if (check) tags.push('check');

  const valuable = targets.filter((t) => t.p.type === 'k' || VAL[t.p.type] >= 3);
  if (valuable.length >= 2 && m.piece !== 'k') {
    tags.push('fork');
    const names = valuable.slice(0, 2).map((t) => NAME[t.p.type]);
    bits.push(`forks ${v} ${names[0]} and ${names[1]}`);
  } else if (check) {
    bits.push(bits.length ? 'with check' : 'gives check');
  } else if (targets.length && !m.captured) {
    const t = targets.sort((a, b) => VAL[b.p.type] - VAL[a.p.type])[0];
    tags.push('threat');
    bits.push(`attacks ${v} ${NAME[t.p.type]} on ${t.s}`);
  } else if (!m.captured) {
    // Piling up: the moved piece joins an attack that now outnumbers the defence.
    const pile = attacksFrom(g, m.to)
      .filter((s) => g[s] && g[s].color !== mover && g[s].type !== 'k')
      .find((s) => attackers(g, s, mover).length > attackers(g, s, g[s].color).length);
    if (pile) {
      tags.push('threat');
      bits.push(`piles up on ${v} ${NAME[g[pile].type]} on ${pile}`);
    }
  }

  if (!bits.length) {
    const backRank = mover === 'w' ? 0 : 7;
    if ((m.piece === 'n' || m.piece === 'b') && rankOf(m.from) === backRank && fullmove <= 15) {
      tags.push('develop');
      bits.push(`develops the ${NAME[m.piece]} to ${m.to}`);
    } else if (m.piece === 'p' && CENTER.includes(m.to)) {
      tags.push('center');
      bits.push(`stakes a claim in the center with ${m.to}`);
    } else if (m.piece === 'p' && isPassed(g, m.to, mover) && rankOf(m.to) >= 4 - (mover === 'b' ? 1 : 0)) {
      tags.push('passer');
      bits.push(`pushes the passed pawn to ${m.to}`);
    } else if (m.piece === 'k' && fullmove <= 20) {
      tags.push('kingwalk');
      bits.push('moves the king and gives up castling');
    } else if (m.piece === 'p') {
      bits.push(`pushes the ${m.from[0]}-pawn to ${m.to}`);
    } else {
      bits.push(`brings the ${NAME[m.piece]} to ${m.to}`);
    }
  }

  // Did the move abandon a piece? (own piece now loose that wasn't before)
  chess.undo();
  return { tags, text: bits.join(', '), san: m.san };
}

/**
 * Replay a UCI line from `fen` and report the material swing for `pov`.
 * Stops at the first quiet point after `minPlies` (no capture next).
 */
function lineMaterial(Chess, fen, uciLine, pov, minPlies = 1, maxPlies = 8) {
  const c = new Chess(fen);
  const start = material(grid(c));
  const won = [], lost = [];
  const sans = [];
  let i = 0;
  for (; i < uciLine.length && i < maxPlies; i++) {
    const u = uciLine[i];
    const m = c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || 'q' });
    if (!m) break;
    sans.push(m.san);
    if (m.captured) (m.color === pov ? won : lost).push(m.captured);
    if (m.promotion) (m.color === pov ? won : lost).push('promo:' + m.promotion);
    const nextU = uciLine[i + 1];
    const nextCap = nextU && c.get(nextU.slice(2, 4));
    if (i + 1 >= minPlies && !nextCap && !c.in_check()) { i++; break; }
  }
  const end = material(grid(c));
  const swing = (end[pov] - end[other(pov)]) - (start[pov] - start[other(pov)]);
  return { swing, won, lost, sans, plies: i };
}

/** "a knight", "the exchange", "two pawns" … from a list of piece letters. */
function materialPhrase(list) {
  const pieces = list.filter((x) => !x.startsWith('promo:'));
  if (!pieces.length) return '';
  const counts = {};
  pieces.forEach((p) => (counts[p] = (counts[p] || 0) + 1));
  const order = ['q', 'r', 'b', 'n', 'p'];
  const words = ['', 'a', 'two', 'three', 'four'];
  return order
    .filter((p) => counts[p])
    .map((p) => (counts[p] === 1 ? `${p === 'q' ? 'the' : 'a'} ${NAME[p]}` : `${words[counts[p]] || counts[p]} ${NAME[p]}s`))
    .join(' and ');
}

const Board = {
  VAL, NAME, sq, fileOf, rankOf, other, grid, attacksFrom, attackers, loosePieces,
  material, kingSquare, dist, isPassed, describeMove, lineMaterial, materialPhrase,
};
