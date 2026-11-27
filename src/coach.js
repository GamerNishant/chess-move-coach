/* coach.js — turns engine numbers + board motifs into two-phase feedback.
 *   quick: one headline (what the move did) + one "next" line (the consequence)
 *   deep:  what it did · the reply plan (opponent's idea) · your plan
 * Every sentence is grounded in the engine line, so the text is never generic
 * filler. Pure function of its inputs; no DOM, no engine calls. */

const CLASSES = {
  best:       { label: 'Best',       symbol: '★',  tone: 'best' },
  excellent:  { label: 'Excellent',  symbol: '!',  tone: 'good' },
  good:       { label: 'Good',       symbol: '✓',  tone: 'good' },
  forced:     { label: 'Forced',     symbol: '→',  tone: 'neutral' },
  inaccuracy: { label: 'Inaccuracy', symbol: '?!', tone: 'inacc' },
  mistake:    { label: 'Mistake',    symbol: '?',  tone: 'mistake' },
  miss:       { label: 'Missed win', symbol: '✕',  tone: 'mistake' },
  blunder:    { label: 'Blunder',    symbol: '??', tone: 'blunder' },
};
const BAD = ['inaccuracy', 'mistake', 'miss', 'blunder'];

function winPct(cp) {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}
function toCp(s) {
  if (s.mate != null) return s.mate > 0 ? 10000 - s.mate * 10 : -10000 - s.mate * 10;
  return s.cp || 0;
}
function fmtScore(s) {
  if (s.mate != null) return s.mate === 0 ? '#' : (s.mate > 0 ? '+M' : '−M') + Math.abs(s.mate);
  const p = (s.cp || 0) / 100;
  return (p > 0 ? '+' : p < 0 ? '−' : '') + Math.abs(p).toFixed(1);
}
function stateOf(s) {
  const cp = toCp(s);
  if (cp >= 300) return 'winning';
  if (cp >= 100) return 'better';
  if (cp > -100) return 'equal';
  if (cp > -300) return 'worse';
  return 'losing';
}
const STATE_PHRASE = {
  winning: 'a winning position', better: 'a clear edge', equal: 'a level game',
  worse: 'a worse position', losing: 'a losing position',
};
function shiftPhrase(sb, sa, own) {
  const a = stateOf(sb), b = stateOf(sa);
  if (a === b) return toCp(sb) - toCp(sa) >= 100 ? `Gives away a big part of ${own} edge` : 'Keeps roughly the same balance';
  return `Turns ${STATE_PHRASE[a]} into ${STATE_PHRASE[b]}`;
}
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const fmtSan = (color, san) => (color === 'b' ? '…' + san : san);

/** Replay a UCI list from fen → [{san, color, move, desc}] with motif text. */
function annotateLine(Chess, fen, uciList, ownerOf, maxPlies) {
  const c = new Chess(fen);
  const out = [];
  for (const u of (uciList || []).slice(0, maxPlies)) {
    const legal = c.moves({ verbose: true });
    const mv = legal.find((m) => m.from === u.slice(0, 2) && m.to === u.slice(2, 4) &&
      (!m.promotion || m.promotion === (u[4] || 'q')));
    if (!mv) break;
    const desc = Board.describeMove(c, mv, ownerOf(mv.color));
    c.move(mv);
    out.push({ san: mv.san, color: mv.color, move: mv, desc, label: fmtSan(mv.color, mv.san) });
  }
  return out;
}

/**
 * @param ctx.Chess     chess.js constructor
 * @param ctx.fenBefore position before the move
 * @param ctx.uci       the move played, e.g. "g1f3" / "e7e8q"
 * @param ctx.before    engine result for fenBefore  {cp|mate, pv[], bestMove}
 * @param ctx.after     engine result for the position after the move (null if game over)
 * @param ctx.userColor 'w' | 'b'
 */
function explain(ctx) {
  const { Chess, fenBefore, uci, before, after, userColor } = ctx;
  const c = new Chess(fenBefore);
  const legal = c.moves({ verbose: true });
  const move = legal.find((m) => m.from === uci.slice(0, 2) && m.to === uci.slice(2, 4) &&
    (!m.promotion || m.promotion === (uci[4] || 'q')));
  if (!move) return null;

  const mover = move.color;
  const isUser = mover === userColor;
  const own = isUser ? 'your' : 'their';       // mover's pieces
  const foe = isUser ? 'their' : 'your';       // opponent's pieces
  const ownerOf = (color) => (color === userColor ? 'their' : 'your'); // victims of a move by `color`
  const fullmove = +fenBefore.split(' ')[5];
  const moveLabel = mover === 'w' ? `${fullmove}. ${move.san}` : `${fullmove}… ${move.san}`;

  const what = Board.describeMove(c, move, foe);
  c.move(move);
  const fenAfter = c.fen();
  const mated = c.in_checkmate();
  const stalemate = c.in_stalemate();
  const drawn = !mated && c.in_draw();

  // Scores from the mover's point of view.
  const sb = { cp: before.cp, mate: before.mate };
  let sa;
  if (mated) sa = { mate: 0, cp: 10000 };
  else if (stalemate || drawn) sa = { cp: 0 };
  else sa = { cp: after.cp != null ? -after.cp : null, mate: after.mate != null ? -after.mate : null };
  const cpA = mated ? 10000 : toCp(sa);
  const drop = Math.max(0, winPct(toCp(sb)) - winPct(cpA));

  const bestUci = before.bestMove || (before.pv && before.pv[0]);
  const playedBest = bestUci && bestUci.slice(0, 4) === uci.slice(0, 4);
  let cls;
  if (mated) cls = 'best';
  else if (legal.length === 1) cls = 'forced';
  else if (sb.mate > 0 && !(sa.mate > 0)) cls = toCp(sa) >= 300 ? 'miss' : 'blunder';
  else if (playedBest) cls = 'best';
  else if (drop < 2) cls = 'excellent';
  else if (drop < 5) cls = 'good';
  else if (drop < 10) cls = 'inaccuracy';
  else if (drop < 20) cls = 'mistake';
  else cls = 'blunder';
  const isBad = BAD.includes(cls);

  // Engine lines, annotated.
  const bestLine = annotateLine(Chess, fenBefore, before.pv, ownerOf, 5);
  const replyLine = after && !mated ? annotateLine(Chess, fenAfter, after.pv, ownerOf, 6) : [];
  const best = bestLine[0];
  const reply = replyLine[0];

  // Material swing of (move + best reply sequence), mover's POV.
  const mat = Board.lineMaterial(Chess, fenBefore, [uci, ...((after && after.pv) || [])], mover, 1, 8);
  const loose = Board.loosePieces(Board.grid(new Chess(fenAfter)), mover);
  const hung = reply && reply.move.captured && loose.find((l) => l.sq === reply.move.to);

  // ---------- quick take ----------
  let headline;
  let tacticHeadline = false;
  if (mated) headline = 'Checkmate. Clean finish.';
  else if (stalemate) headline = toCp(sb) >= 300 ? 'Stalemate! That throws away a won game.' : 'Stalemate: the game is drawn.';
  else if (drawn) headline = 'That move ends the game in a draw.';
  else if (sb.mate > 0 && !(sa.mate > 0)) headline = `Misses mate in ${sb.mate}: ${best ? best.label : 'another move'} was the finish.`;
  else if (sa.mate < 0) { headline = `Allows mate in ${-sa.mate}, starting with ${reply ? reply.label : "their reply"}.`; tacticHeadline = true; }
  else if (sa.mate > 0) headline = `${what.tags.includes('check') ? 'Keeps the king in a net' : 'Keeps the mating attack'}: mate in ${sa.mate}.`;
  else if (hung && isBad) { headline = `Hangs ${own} ${Board.NAME[hung.piece.type]} on ${hung.sq}. ${reply.label} wins it.`; tacticHeadline = true; }
  else if (mat.swing <= -2 && isBad) {
    const lost = Board.materialPhrase(mat.lost), won = Board.materialPhrase(mat.won);
    headline = `Loses ${lost || 'material'}${won ? ' for ' + won : ''} after ${reply ? reply.label : 'the reply'}.`;
  } else if (mat.swing >= 2) {
    const lost = Board.materialPhrase(mat.lost), won = Board.materialPhrase(mat.won);
    headline = `Wins ${won || 'material'}${lost ? ' for ' + lost : ''}.`;
  } else if (isBad && reply && reply.desc.tags.some((t) => ['fork', 'capture', 'threat', 'check'].includes(t))) {
    // Lead with the concrete tactic the move allows; the eval story goes on the next line.
    headline = `Allows ${reply.label}, which ${reply.desc.text}.`;
    tacticHeadline = true;
  } else if (cls === 'blunder' || cls === 'mistake') {
    headline = shiftPhrase(sb, sa, own) + '.';
  } else {
    headline = cap(what.text) + '.';
    if (what.tags.includes('capture') && Math.abs(mat.swing) < 2 && mat.lost.length) headline = `Fair trade: ${what.text}, and it comes back.`;
    if (cls === 'inaccuracy') headline += ' A bit imprecise.';
  }

  let next = '';
  if (tacticHeadline) {
    next = `${shiftPhrase(sb, sa, own)}.`;
  } else if (reply) {
    next = isUser
      ? `Expect ${reply.label}: ${reply.desc.text}.`
      : `Your best reply: ${reply.label}, which ${reply.desc.text}.`;
  }
  const better = isBad && best && !playedBest ? { label: best.label, why: best.desc.text } : null;

  // ---------- deep dive ----------
  const didBullets = [];
  if (!headline.toLowerCase().startsWith(what.text.slice(0, 12).toLowerCase())) didBullets.push(cap(what.text) + '.');
  didBullets.push(drop >= 1
    ? `Evaluation ${fmtScore(sb)} → ${fmtScore(sa)}: about ${Math.round(drop)}% less winning chance.`
    : `Evaluation ${fmtScore(sb)} → ${fmtScore(sa)}: nothing lost.`);
  const loose2 = loose.find((l) => l.risk >= 2 && (!hung || l.sq !== hung.sq));
  if (loose2) didBullets.push(`Leaves ${own} ${Board.NAME[loose2.piece.type]} on ${loose2.sq} ${loose2.defended ? 'under-protected' : 'undefended'}.`);
  if (what.tags.includes('kingwalk')) didBullets.push('The king lost its castling rights and is still in the middle.');

  const replyPlan = buildPlan(Chess, fenAfter, after, replyLine, mover, isUser, sa);

  const yours = [];
  if (better) yours.push(`Stronger was ${better.label}: it ${better.why}.`);
  if (isUser && replyLine[1]) yours.push(`After ${replyLine[0].label}, answer with ${replyLine[1].label}: ${replyLine[1].desc.text}.`);

  return {
    fenBefore, fenAfter, uci, san: move.san, moveLabel, mover, isUser,
    cls: { key: cls, ...CLASSES[cls] },
    evalBefore: fmtScore(sb), evalAfter: fmtScore(sa), drop: Math.round(drop),
    whiteCp: mover === 'w' ? cpA : -cpA,
    quick: { headline, next, better },
    deep: {
      did: didBullets.slice(0, 3),
      plan: replyPlan,
      yours: { title: isUser ? 'Your plan' : 'What it means for you', bullets: yours, line: better ? bestLine.map((x) => x.label) : [] },
    },
  };
}

/** The opponent's (reply side's) idea, from the engine's best line after the move. */
function buildPlan(Chess, fenAfter, after, line, mover, isUser, sa) {
  const title = isUser ? 'Their plan' : 'Your best plan';
  if (!after || !line.length) return { title, summary: '', bullets: [], line: [] };
  const replier = Board.other(mover);
  const subj = isUser ? 'They' : 'You';
  const theirMoves = line.filter((x) => x.color === replier);
  let summary;

  const g = Board.grid(new Chess(fenAfter));
  const moverKing = Board.kingSquare(g, mover);
  const nearKing = theirMoves.filter((x) => x.desc.tags.includes('check') ||
    (moverKing && Board.dist(x.move.to, moverKing) <= 2)).length;
  // Count material over the whole visible plan (not just to the first quiet move),
  // so "Nxf7 … Nxh8" reads as winning the rook, not a pawn.
  const gain = Board.lineMaterial(Chess, fenAfter, after.pv, replier, Math.min(after.pv.length, 5), 6);

  if (sa.mate < 0) summary = `${subj} have a forced mate in ${-sa.mate}.`;
  else if (gain.swing >= 2) summary = `${subj} cash in: winning ${Board.materialPhrase(gain.won) || 'material'}.`;
  else if (nearKing >= 2) summary = `${subj} go after ${isUser ? 'your' : 'their'} king${moverKing ? ' on ' + moverKing : ''}.`;
  else if (theirMoves.some((x) => x.desc.tags.includes('fork') || x.desc.tags.includes('threat')))
    summary = `${subj} play with threats and keep the initiative.`;
  else if (theirMoves.some((x) => x.desc.tags.includes('center')))
    summary = `${subj} fight for the center.`;
  else if (theirMoves.some((x) => x.desc.tags.includes('castle') || x.desc.tags.includes('develop')))
    summary = `${subj} finish development and get the king safe.`;
  else summary = `${subj} improve the pieces quietly; no immediate threat.`;

  const bullets = theirMoves.slice(0, 3).map((x) => `${x.label}: ${x.desc.text}.`);
  return { title, summary, bullets, line: line.slice(0, 5).map((x) => x.label) };
}

const Coach = { explain, winPct, fmtScore, CLASSES };
