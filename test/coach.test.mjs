// Unit tests for the pure parts (board motifs, coach text, UCI client, SAN reader).
// Engine output is faked so the tests are fast and deterministic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (p) => readFileSync(join(root, p), 'utf8');
const code = [
  src('vendor/chess.js').replace(/^export /gm, ''),
  src('src/board.js'), src('src/coach.js'), src('src/uci.js'), src('src/reader.js'),
  ';({ Chess, Board, Coach, UciEngine, Reader })',
].join('\n');
const { Chess, Board, Coach, UciEngine, Reader } = vm.runInNewContext(code, { console });

const explain = (fenBefore, uci, before, after, userColor) =>
  Coach.explain({ Chess, fenBefore, uci, before, after, userColor });

test('hanging the queen is a blunder and names the capture', () => {
  const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
  const fb = explain(fen, 'd8g5',
    { cp: -30, pv: ['b8c6', 'f1b5'], bestMove: 'b8c6', depth: 14 },
    { cp: 900, pv: ['f3g5', 'f8e7'], depth: 14 }, 'b');
  assert.equal(fb.cls.key, 'blunder');
  assert.match(fb.quick.headline, /Hangs your queen on g5/);
  assert.match(fb.quick.headline, /Nxg5/);
  assert.match(fb.quick.next, /into a losing position/);
  assert.equal(fb.quick.better.label, '…Nc6');
  assert.equal(fb.moveLabel, '2… Qg5');
});

test('knight fork that wins a rook', () => {
  const fen = 'r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1';
  const fb = explain(fen, 'd5c7',
    { cp: 500, pv: ['d5c7', 'e8d7', 'c7a8'], bestMove: 'd5c7', depth: 14 },
    { cp: -500, pv: ['e8d7', 'c7a8'], depth: 14 }, 'w');
  assert.equal(fb.cls.key, 'best');
  assert.match(fb.quick.headline, /Wins a rook/);
  assert.ok(fb.deep.did.some((b) => /forks their king and rook/i.test(b)), fb.deep.did.join(' | '));
});

test('allowing mate in one', () => {
  const fen = 'rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2';
  const fb = explain(fen, 'g2g4',
    { cp: -60, pv: ['b1c3', 'd7d5'], bestMove: 'b1c3', depth: 14 },
    { mate: 1, cp: null, pv: ['d8h4'], depth: 14 }, 'w');
  assert.equal(fb.cls.key, 'blunder');
  assert.match(fb.quick.headline, /Allows mate in 1, starting with …Qh4#/);
  assert.match(fb.deep.plan.summary, /They have a forced mate in 1/);
  assert.equal(fb.evalAfter, '−M1');
});

test('delivering checkmate', () => {
  const fen = 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2';
  const fb = explain(fen, 'd8h4', { mate: 1, cp: null, pv: ['d8h4'], bestMove: 'd8h4', depth: 14 }, null, 'b');
  assert.equal(fb.cls.key, 'best');
  assert.match(fb.quick.headline, /Checkmate/);
});

test('quiet developing move reads as development, opponent move explained for you', () => {
  const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
  const fb = explain(fen, 'g1f3',
    { cp: 35, pv: ['g1f3', 'b8c6'], bestMove: 'g1f3', depth: 14 },
    { cp: -35, pv: ['b8c6', 'f1b5', 'a7a6'], depth: 14 }, 'b');
  assert.equal(fb.isUser, false);
  assert.match(fb.quick.headline, /attacks your pawn on e5/i);
  assert.match(fb.quick.next, /^Your best reply: …Nc6/);
  assert.equal(fb.deep.plan.title, 'Your best plan');
});

test('inaccuracy gets a "better" suggestion with a reason', () => {
  const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
  const fb = explain(fen, 'a2a3',
    { cp: 35, pv: ['g1f3', 'b8c6'], bestMove: 'g1f3', depth: 14 },
    { cp: 30, pv: ['g8f6', 'b1c3'], depth: 14 }, 'w');
  assert.ok(['inaccuracy', 'good', 'excellent'].includes(fb.cls.key));
  const fb2 = explain(fen, 'a2a3',
    { cp: 35, pv: ['g1f3', 'b8c6'], bestMove: 'g1f3', depth: 14 },
    { cp: 60, pv: ['g8f6', 'b1c3'], depth: 14 }, 'w');
  assert.equal(fb2.cls.key, 'inaccuracy');
  assert.equal(fb2.quick.better.label, 'Nf3');
  assert.match(fb2.quick.better.why, /attacks their pawn on e5|develops the knight/);
});

test('loose pieces and attack maps', () => {
  const g = Board.grid(new Chess('4k3/8/8/3n4/8/8/8/3RK3 w - - 0 1'));
  assert.deepEqual([...Board.attackers(g, 'd5', 'w').map((a) => a.sq)], ['d1']);
  assert.equal(Board.loosePieces(g, 'b')[0].sq, 'd5');
  assert.equal(Board.materialPhrase(['p', 'p', 'n']), 'a knight and two pawns');
});

test('SAN is rebuilt from chess.com figurine nodes', () => {
  const node = (fig, text) => ({ querySelector: () => (fig ? { getAttribute: () => fig } : null), textContent: text });
  assert.equal(Reader.nodeSan(node('N', 'f3')), 'Nf3');
  assert.equal(Reader.nodeSan(node(null, ' e4 ')), 'e4');
  assert.equal(Reader.nodeSan(node('Q', 'xf7#')), 'Qxf7#');
  assert.equal(Reader.nodeSan(node(null, '0-0')), 'O-O');
  assert.equal(Reader.nodeSan(node(null, 'e8=Q+')), 'e8=Q+');
});

test('UCI client parses results and cancels stale searches', async () => {
  const sent = [];
  const worker = { postMessage: (m) => { sent.push(m); reply(m); }, terminate() {} };
  const out = (l) => queueMicrotask(() => worker.onmessage({ data: l }));
  function reply(m) {
    if (m === 'uci') out('uciok');
    if (m === 'isready') out('readyok');
    if (m.startsWith('go')) {
      out('info depth 5 seldepth 7 multipv 1 score cp 31 nodes 900 pv e2e4 e7e5');
      out('info depth 5 seldepth 7 multipv 1 score cp 40 lowerbound nodes 950 pv d2d4');
      setTimeout(() => out('bestmove e2e4 ponder e7e5'), 5);
    }
    if (m === 'stop') out('bestmove e2e4');
  }
  const eng = UciEngine(worker);
  await eng.ready;
  const r = await eng.analyze('startpos-fen', 5, 100, 'a');
  assert.equal(r.cp, 31);
  assert.deepEqual([...r.pv], ['e2e4', 'e7e5']);
  assert.equal(r.bestMove, 'e2e4');

  const p1 = eng.analyze('fen1', 5, 100, 'a');
  const p2 = eng.analyze('fen2', 5, 100, 'a');
  const p3 = eng.analyze('fen3', 5, 100, 'b');
  eng.cancelAll('a');
  await assert.rejects(p1, /cancelled/);
  await assert.rejects(p2, /cancelled/);
  assert.equal((await p3).bestMove, 'e2e4'); // other tab's job survives
});
