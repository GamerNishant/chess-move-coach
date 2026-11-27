// ==UserScript==
// @name         Chess Move Coach
// @namespace    https://github.com/GamerNishant/chess-move-coach
// @version      1.0.0
// @description  Move-by-move feedback on chess.com: a one-line quick take plus an optional deep dive into the opponent's plan. Runs Stockfish on your device. Pauses during live games (fair play).
// @author       GamerNishant
// @license      MIT
// @match        https://www.chess.com/*
// @icon         https://gamernishant.github.io/chess-move-coach/icon.svg
// @resource     stockfish https://cdn.jsdelivr.net/npm/stockfish@10.0.2/src/stockfish.asm.js
// @grant        GM_getResourceText
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      chess-api.com
// @run-at       document-idle
// @noframes
// @homepageURL  https://github.com/GamerNishant/chess-move-coach
// @supportURL   https://github.com/GamerNishant/chess-move-coach/issues
// @updateURL    https://gamernishant.github.io/chess-move-coach/chess-move-coach.user.js
// @downloadURL  https://gamernishant.github.io/chess-move-coach/chess-move-coach.user.js
// ==/UserScript==

/*! Chess Move Coach 1.0.0 (userscript) | MIT | bundles chess.js (BSD-2) — built file, edit src/ */
(function () {
'use strict';
/*
 * Copyright (c) 2022, Jeff Hlywa (jhlywa@gmail.com)
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 *
 *----------------------------------------------------------------------------*/

const SYMBOLS = 'pnbrqkPNBRQK'

const DEFAULT_POSITION =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

const TERMINATION_MARKERS = ['1-0', '0-1', '1/2-1/2', '*']

const PAWN_OFFSETS = {
  b: [16, 32, 17, 15],
  w: [-16, -32, -17, -15],
}

const PIECE_OFFSETS = {
  n: [-18, -33, -31, -14, 18, 33, 31, 14],
  b: [-17, -15, 17, 15],
  r: [-16, 1, 16, -1],
  q: [-17, -16, -15, 1, 17, 16, 15, -1],
  k: [-17, -16, -15, 1, 17, 16, 15, -1],
}

// prettier-ignore
const ATTACKS = [
  20, 0, 0, 0, 0, 0, 0, 24,  0, 0, 0, 0, 0, 0,20, 0,
   0,20, 0, 0, 0, 0, 0, 24,  0, 0, 0, 0, 0,20, 0, 0,
   0, 0,20, 0, 0, 0, 0, 24,  0, 0, 0, 0,20, 0, 0, 0,
   0, 0, 0,20, 0, 0, 0, 24,  0, 0, 0,20, 0, 0, 0, 0,
   0, 0, 0, 0,20, 0, 0, 24,  0, 0,20, 0, 0, 0, 0, 0,
   0, 0, 0, 0, 0,20, 2, 24,  2,20, 0, 0, 0, 0, 0, 0,
   0, 0, 0, 0, 0, 2,53, 56, 53, 2, 0, 0, 0, 0, 0, 0,
  24,24,24,24,24,24,56,  0, 56,24,24,24,24,24,24, 0,
   0, 0, 0, 0, 0, 2,53, 56, 53, 2, 0, 0, 0, 0, 0, 0,
   0, 0, 0, 0, 0,20, 2, 24,  2,20, 0, 0, 0, 0, 0, 0,
   0, 0, 0, 0,20, 0, 0, 24,  0, 0,20, 0, 0, 0, 0, 0,
   0, 0, 0,20, 0, 0, 0, 24,  0, 0, 0,20, 0, 0, 0, 0,
   0, 0,20, 0, 0, 0, 0, 24,  0, 0, 0, 0,20, 0, 0, 0,
   0,20, 0, 0, 0, 0, 0, 24,  0, 0, 0, 0, 0,20, 0, 0,
  20, 0, 0, 0, 0, 0, 0, 24,  0, 0, 0, 0, 0, 0,20
];

// prettier-ignore
const RAYS = [
   17,  0,  0,  0,  0,  0,  0, 16,  0,  0,  0,  0,  0,  0, 15, 0,
    0, 17,  0,  0,  0,  0,  0, 16,  0,  0,  0,  0,  0, 15,  0, 0,
    0,  0, 17,  0,  0,  0,  0, 16,  0,  0,  0,  0, 15,  0,  0, 0,
    0,  0,  0, 17,  0,  0,  0, 16,  0,  0,  0, 15,  0,  0,  0, 0,
    0,  0,  0,  0, 17,  0,  0, 16,  0,  0, 15,  0,  0,  0,  0, 0,
    0,  0,  0,  0,  0, 17,  0, 16,  0, 15,  0,  0,  0,  0,  0, 0,
    0,  0,  0,  0,  0,  0, 17, 16, 15,  0,  0,  0,  0,  0,  0, 0,
    1,  1,  1,  1,  1,  1,  1,  0, -1, -1,  -1,-1, -1, -1, -1, 0,
    0,  0,  0,  0,  0,  0,-15,-16,-17,  0,  0,  0,  0,  0,  0, 0,
    0,  0,  0,  0,  0,-15,  0,-16,  0,-17,  0,  0,  0,  0,  0, 0,
    0,  0,  0,  0,-15,  0,  0,-16,  0,  0,-17,  0,  0,  0,  0, 0,
    0,  0,  0,-15,  0,  0,  0,-16,  0,  0,  0,-17,  0,  0,  0, 0,
    0,  0,-15,  0,  0,  0,  0,-16,  0,  0,  0,  0,-17,  0,  0, 0,
    0,-15,  0,  0,  0,  0,  0,-16,  0,  0,  0,  0,  0,-17,  0, 0,
  -15,  0,  0,  0,  0,  0,  0,-16,  0,  0,  0,  0,  0,  0,-17
];

const SHIFTS = { p: 0, n: 1, b: 2, r: 3, q: 4, k: 5 }

const BITS = {
  NORMAL: 1,
  CAPTURE: 2,
  BIG_PAWN: 4,
  EP_CAPTURE: 8,
  PROMOTION: 16,
  KSIDE_CASTLE: 32,
  QSIDE_CASTLE: 64,
}

const RANK_1 = 7
const RANK_2 = 6
const RANK_3 = 5
const RANK_4 = 4
const RANK_5 = 3
const RANK_6 = 2
const RANK_7 = 1
const RANK_8 = 0

// prettier-ignore
const SQUARE_MAP = {
  a8:   0, b8:   1, c8:   2, d8:   3, e8:   4, f8:   5, g8:   6, h8:   7,
  a7:  16, b7:  17, c7:  18, d7:  19, e7:  20, f7:  21, g7:  22, h7:  23,
  a6:  32, b6:  33, c6:  34, d6:  35, e6:  36, f6:  37, g6:  38, h6:  39,
  a5:  48, b5:  49, c5:  50, d5:  51, e5:  52, f5:  53, g5:  54, h5:  55,
  a4:  64, b4:  65, c4:  66, d4:  67, e4:  68, f4:  69, g4:  70, h4:  71,
  a3:  80, b3:  81, c3:  82, d3:  83, e3:  84, f3:  85, g3:  86, h3:  87,
  a2:  96, b2:  97, c2:  98, d2:  99, e2: 100, f2: 101, g2: 102, h2: 103,
  a1: 112, b1: 113, c1: 114, d1: 115, e1: 116, f1: 117, g1: 118, h1: 119
};

const ROOKS = {
  w: [
    { square: SQUARE_MAP.a1, flag: BITS.QSIDE_CASTLE },
    { square: SQUARE_MAP.h1, flag: BITS.KSIDE_CASTLE },
  ],
  b: [
    { square: SQUARE_MAP.a8, flag: BITS.QSIDE_CASTLE },
    { square: SQUARE_MAP.h8, flag: BITS.KSIDE_CASTLE },
  ],
}

const PARSER_STRICT = 0
const PARSER_SLOPPY = 1

/* this function is used to uniquely identify ambiguous moves */
function get_disambiguator(move, moves) {
  var from = move.from
  var to = move.to
  var piece = move.piece

  var ambiguities = 0
  var same_rank = 0
  var same_file = 0

  for (var i = 0, len = moves.length; i < len; i++) {
    var ambig_from = moves[i].from
    var ambig_to = moves[i].to
    var ambig_piece = moves[i].piece

    /* if a move of the same piece type ends on the same to square, we'll
     * need to add a disambiguator to the algebraic notation
     */
    if (piece === ambig_piece && from !== ambig_from && to === ambig_to) {
      ambiguities++

      if (rank(from) === rank(ambig_from)) {
        same_rank++
      }

      if (file(from) === file(ambig_from)) {
        same_file++
      }
    }
  }

  if (ambiguities > 0) {
    /* if there exists a similar moving piece on the same rank and file as
     * the move in question, use the square as the disambiguator
     */
    if (same_rank > 0 && same_file > 0) {
      return algebraic(from)
    } else if (same_file > 0) {
      /* if the moving piece rests on the same file, use the rank symbol as the
       * disambiguator
       */
      return algebraic(from).charAt(1)
    } else {
      /* else use the file symbol */
      return algebraic(from).charAt(0)
    }
  }

  return ''
}

function infer_piece_type(san) {
  var piece_type = san.charAt(0)
  if (piece_type >= 'a' && piece_type <= 'h') {
    var matches = san.match(/[a-h]\d.*[a-h]\d/)
    if (matches) {
      return undefined
    }
    return PAWN
  }
  piece_type = piece_type.toLowerCase()
  if (piece_type === 'o') {
    return KING
  }
  return piece_type
}

// parses all of the decorators out of a SAN string
function stripped_san(move) {
  return move.replace(/=/, '').replace(/[+#]?[?!]*$/, '')
}

/*****************************************************************************
 * UTILITY FUNCTIONS
 ****************************************************************************/
function rank(i) {
  return i >> 4
}

function file(i) {
  return i & 15
}

function algebraic(i) {
  var f = file(i),
    r = rank(i)
  return 'abcdefgh'.substring(f, f + 1) + '87654321'.substring(r, r + 1)
}

function swap_color(c) {
  return c === WHITE ? BLACK : WHITE
}

function is_digit(c) {
  return '0123456789'.indexOf(c) !== -1
}

function clone(obj) {
  var dupe = obj instanceof Array ? [] : {}

  for (var property in obj) {
    if (typeof property === 'object') {
      dupe[property] = clone(obj[property])
    } else {
      dupe[property] = obj[property]
    }
  }

  return dupe
}

function trim(str) {
  return str.replace(/^\s+|\s+$/g, '')
}

/***************************************************************************
 * PUBLIC CONSTANTS
 **************************************************************************/

const BLACK = 'b'
const WHITE = 'w'

const EMPTY = -1

const PAWN = 'p'
const KNIGHT = 'n'
const BISHOP = 'b'
const ROOK = 'r'
const QUEEN = 'q'
const KING = 'k'

const SQUARES = (function () {
  /* from the ECMA-262 spec (section 12.6.4):
   * "The mechanics of enumerating the properties ... is
   * implementation dependent"
   * so: for (var sq in SQUARES) { keys.push(sq); } might not be
   * ordered correctly
   */
  var keys = []
  for (var i = SQUARE_MAP.a8; i <= SQUARE_MAP.h1; i++) {
    if (i & 0x88) {
      i += 7
      continue
    }
    keys.push(algebraic(i))
  }
  return keys
})()

const FLAGS = {
  NORMAL: 'n',
  CAPTURE: 'c',
  BIG_PAWN: 'b',
  EP_CAPTURE: 'e',
  PROMOTION: 'p',
  KSIDE_CASTLE: 'k',
  QSIDE_CASTLE: 'q',
}

const Chess = function (fen) {
  var board = new Array(128)
  var kings = { w: EMPTY, b: EMPTY }
  var turn = WHITE
  var castling = { w: 0, b: 0 }
  var ep_square = EMPTY
  var half_moves = 0
  var move_number = 1
  var history = []
  var header = {}
  var comments = {}

  /* if the user passes in a fen string, load it, else default to
   * starting position
   */
  if (typeof fen === 'undefined') {
    load(DEFAULT_POSITION)
  } else {
    load(fen)
  }

  function clear(keep_headers) {
    if (typeof keep_headers === 'undefined') {
      keep_headers = false
    }

    board = new Array(128)
    kings = { w: EMPTY, b: EMPTY }
    turn = WHITE
    castling = { w: 0, b: 0 }
    ep_square = EMPTY
    half_moves = 0
    move_number = 1
    history = []
    if (!keep_headers) header = {}
    comments = {}
    update_setup(generate_fen())
  }

  function prune_comments() {
    var reversed_history = []
    var current_comments = {}
    var copy_comment = function (fen) {
      if (fen in comments) {
        current_comments[fen] = comments[fen]
      }
    }
    while (history.length > 0) {
      reversed_history.push(undo_move())
    }
    copy_comment(generate_fen())
    while (reversed_history.length > 0) {
      make_move(reversed_history.pop())
      copy_comment(generate_fen())
    }
    comments = current_comments
  }

  function reset() {
    load(DEFAULT_POSITION)
  }

  function load(fen, keep_headers) {
    if (typeof keep_headers === 'undefined') {
      keep_headers = false
    }

    var tokens = fen.split(/\s+/)
    var position = tokens[0]
    var square = 0

    if (!validate_fen(fen).valid) {
      return false
    }

    clear(keep_headers)

    for (var i = 0; i < position.length; i++) {
      var piece = position.charAt(i)

      if (piece === '/') {
        square += 8
      } else if (is_digit(piece)) {
        square += parseInt(piece, 10)
      } else {
        var color = piece < 'a' ? WHITE : BLACK
        put({ type: piece.toLowerCase(), color: color }, algebraic(square))
        square++
      }
    }

    turn = tokens[1]

    if (tokens[2].indexOf('K') > -1) {
      castling.w |= BITS.KSIDE_CASTLE
    }
    if (tokens[2].indexOf('Q') > -1) {
      castling.w |= BITS.QSIDE_CASTLE
    }
    if (tokens[2].indexOf('k') > -1) {
      castling.b |= BITS.KSIDE_CASTLE
    }
    if (tokens[2].indexOf('q') > -1) {
      castling.b |= BITS.QSIDE_CASTLE
    }

    ep_square = tokens[3] === '-' ? EMPTY : SQUARE_MAP[tokens[3]]
    half_moves = parseInt(tokens[4], 10)
    move_number = parseInt(tokens[5], 10)

    update_setup(generate_fen())

    return true
  }

  /* TODO: this function is pretty much crap - it validates structure but
   * completely ignores content (e.g. doesn't verify that each side has a king)
   * ... we should rewrite this, and ditch the silly error_number field while
   * we're at it
   */
  function validate_fen(fen) {
    var errors = {
      0: 'No errors.',
      1: 'FEN string must contain six space-delimited fields.',
      2: '6th field (move number) must be a positive integer.',
      3: '5th field (half move counter) must be a non-negative integer.',
      4: '4th field (en-passant square) is invalid.',
      5: '3rd field (castling availability) is invalid.',
      6: '2nd field (side to move) is invalid.',
      7: "1st field (piece positions) does not contain 8 '/'-delimited rows.",
      8: '1st field (piece positions) is invalid [consecutive numbers].',
      9: '1st field (piece positions) is invalid [invalid piece].',
      10: '1st field (piece positions) is invalid [row too large].',
      11: 'Illegal en-passant square',
    }

    /* 1st criterion: 6 space-seperated fields? */
    var tokens = fen.split(/\s+/)
    if (tokens.length !== 6) {
      return { valid: false, error_number: 1, error: errors[1] }
    }

    /* 2nd criterion: move number field is a integer value > 0? */
    if (isNaN(parseInt(tokens[5])) || parseInt(tokens[5], 10) <= 0) {
      return { valid: false, error_number: 2, error: errors[2] }
    }

    /* 3rd criterion: half move counter is an integer >= 0? */
    if (isNaN(parseInt(tokens[4])) || parseInt(tokens[4], 10) < 0) {
      return { valid: false, error_number: 3, error: errors[3] }
    }

    /* 4th criterion: 4th field is a valid e.p.-string? */
    if (!/^(-|[abcdefgh][36])$/.test(tokens[3])) {
      return { valid: false, error_number: 4, error: errors[4] }
    }

    /* 5th criterion: 3th field is a valid castle-string? */
    if (!/^(KQ?k?q?|Qk?q?|kq?|q|-)$/.test(tokens[2])) {
      return { valid: false, error_number: 5, error: errors[5] }
    }

    /* 6th criterion: 2nd field is "w" (white) or "b" (black)? */
    if (!/^(w|b)$/.test(tokens[1])) {
      return { valid: false, error_number: 6, error: errors[6] }
    }

    /* 7th criterion: 1st field contains 8 rows? */
    var rows = tokens[0].split('/')
    if (rows.length !== 8) {
      return { valid: false, error_number: 7, error: errors[7] }
    }

    /* 8th criterion: every row is valid? */
    for (var i = 0; i < rows.length; i++) {
      /* check for right sum of fields AND not two numbers in succession */
      var sum_fields = 0
      var previous_was_number = false

      for (var k = 0; k < rows[i].length; k++) {
        if (!isNaN(rows[i][k])) {
          if (previous_was_number) {
            return { valid: false, error_number: 8, error: errors[8] }
          }
          sum_fields += parseInt(rows[i][k], 10)
          previous_was_number = true
        } else {
          if (!/^[prnbqkPRNBQK]$/.test(rows[i][k])) {
            return { valid: false, error_number: 9, error: errors[9] }
          }
          sum_fields += 1
          previous_was_number = false
        }
      }
      if (sum_fields !== 8) {
        return { valid: false, error_number: 10, error: errors[10] }
      }
    }

    if (
      (tokens[3][1] == '3' && tokens[1] == 'w') ||
      (tokens[3][1] == '6' && tokens[1] == 'b')
    ) {
      return { valid: false, error_number: 11, error: errors[11] }
    }

    /* everything's okay! */
    return { valid: true, error_number: 0, error: errors[0] }
  }

  function generate_fen() {
    var empty = 0
    var fen = ''

    for (var i = SQUARE_MAP.a8; i <= SQUARE_MAP.h1; i++) {
      if (board[i] == null) {
        empty++
      } else {
        if (empty > 0) {
          fen += empty
          empty = 0
        }
        var color = board[i].color
        var piece = board[i].type

        fen += color === WHITE ? piece.toUpperCase() : piece.toLowerCase()
      }

      if ((i + 1) & 0x88) {
        if (empty > 0) {
          fen += empty
        }

        if (i !== SQUARE_MAP.h1) {
          fen += '/'
        }

        empty = 0
        i += 8
      }
    }

    var cflags = ''
    if (castling[WHITE] & BITS.KSIDE_CASTLE) {
      cflags += 'K'
    }
    if (castling[WHITE] & BITS.QSIDE_CASTLE) {
      cflags += 'Q'
    }
    if (castling[BLACK] & BITS.KSIDE_CASTLE) {
      cflags += 'k'
    }
    if (castling[BLACK] & BITS.QSIDE_CASTLE) {
      cflags += 'q'
    }

    /* do we have an empty castling flag? */
    cflags = cflags || '-'
    var epflags = ep_square === EMPTY ? '-' : algebraic(ep_square)

    return [fen, turn, cflags, epflags, half_moves, move_number].join(' ')
  }

  function set_header(args) {
    for (var i = 0; i < args.length; i += 2) {
      if (typeof args[i] === 'string' && typeof args[i + 1] === 'string') {
        header[args[i]] = args[i + 1]
      }
    }
    return header
  }

  /* called when the initial board setup is changed with put() or remove().
   * modifies the SetUp and FEN properties of the header object.  if the FEN is
   * equal to the default position, the SetUp and FEN are deleted
   * the setup is only updated if history.length is zero, ie moves haven't been
   * made.
   */
  function update_setup(fen) {
    if (history.length > 0) return

    if (fen !== DEFAULT_POSITION) {
      header['SetUp'] = '1'
      header['FEN'] = fen
    } else {
      delete header['SetUp']
      delete header['FEN']
    }
  }

  function get(square) {
    var piece = board[SQUARE_MAP[square]]
    return piece ? { type: piece.type, color: piece.color } : null
  }

  function put(piece, square) {
    /* check for valid piece object */
    if (!('type' in piece && 'color' in piece)) {
      return false
    }

    /* check for piece */
    if (SYMBOLS.indexOf(piece.type.toLowerCase()) === -1) {
      return false
    }

    /* check for valid square */
    if (!(square in SQUARE_MAP)) {
      return false
    }

    var sq = SQUARE_MAP[square]

    /* don't let the user place more than one king */
    if (
      piece.type == KING &&
      !(kings[piece.color] == EMPTY || kings[piece.color] == sq)
    ) {
      return false
    }

    board[sq] = { type: piece.type, color: piece.color }
    if (piece.type === KING) {
      kings[piece.color] = sq
    }

    update_setup(generate_fen())

    return true
  }

  function remove(square) {
    var piece = get(square)
    board[SQUARE_MAP[square]] = null
    if (piece && piece.type === KING) {
      kings[piece.color] = EMPTY
    }

    update_setup(generate_fen())

    return piece
  }

  function build_move(board, from, to, flags, promotion) {
    var move = {
      color: turn,
      from: from,
      to: to,
      flags: flags,
      piece: board[from].type,
    }

    if (promotion) {
      move.flags |= BITS.PROMOTION
      move.promotion = promotion
    }

    if (board[to]) {
      move.captured = board[to].type
    } else if (flags & BITS.EP_CAPTURE) {
      move.captured = PAWN
    }
    return move
  }

  function generate_moves(options) {
    function add_move(board, moves, from, to, flags) {
      /* if pawn promotion */
      if (
        board[from].type === PAWN &&
        (rank(to) === RANK_8 || rank(to) === RANK_1)
      ) {
        var pieces = [QUEEN, ROOK, BISHOP, KNIGHT]
        for (var i = 0, len = pieces.length; i < len; i++) {
          moves.push(build_move(board, from, to, flags, pieces[i]))
        }
      } else {
        moves.push(build_move(board, from, to, flags))
      }
    }

    var moves = []
    var us = turn
    var them = swap_color(us)
    var second_rank = { b: RANK_7, w: RANK_2 }

    var first_sq = SQUARE_MAP.a8
    var last_sq = SQUARE_MAP.h1
    var single_square = false

    /* do we want legal moves? */
    var legal =
      typeof options !== 'undefined' && 'legal' in options
        ? options.legal
        : true

    var piece_type =
      typeof options !== 'undefined' &&
      'piece' in options &&
      typeof options.piece === 'string'
        ? options.piece.toLowerCase()
        : true

    /* are we generating moves for a single square? */
    if (typeof options !== 'undefined' && 'square' in options) {
      if (options.square in SQUARE_MAP) {
        first_sq = last_sq = SQUARE_MAP[options.square]
        single_square = true
      } else {
        /* invalid square */
        return []
      }
    }

    for (var i = first_sq; i <= last_sq; i++) {
      /* did we run off the end of the board */
      if (i & 0x88) {
        i += 7
        continue
      }

      var piece = board[i]
      if (piece == null || piece.color !== us) {
        continue
      }

      if (piece.type === PAWN && (piece_type === true || piece_type === PAWN)) {
        /* single square, non-capturing */
        var square = i + PAWN_OFFSETS[us][0]
        if (board[square] == null) {
          add_move(board, moves, i, square, BITS.NORMAL)

          /* double square */
          var square = i + PAWN_OFFSETS[us][1]
          if (second_rank[us] === rank(i) && board[square] == null) {
            add_move(board, moves, i, square, BITS.BIG_PAWN)
          }
        }

        /* pawn captures */
        for (j = 2; j < 4; j++) {
          var square = i + PAWN_OFFSETS[us][j]
          if (square & 0x88) continue

          if (board[square] != null && board[square].color === them) {
            add_move(board, moves, i, square, BITS.CAPTURE)
          } else if (square === ep_square) {
            add_move(board, moves, i, ep_square, BITS.EP_CAPTURE)
          }
        }
      } else if (piece_type === true || piece_type === piece.type) {
        for (var j = 0, len = PIECE_OFFSETS[piece.type].length; j < len; j++) {
          var offset = PIECE_OFFSETS[piece.type][j]
          var square = i

          while (true) {
            square += offset
            if (square & 0x88) break

            if (board[square] == null) {
              add_move(board, moves, i, square, BITS.NORMAL)
            } else {
              if (board[square].color === us) break
              add_move(board, moves, i, square, BITS.CAPTURE)
              break
            }

            /* break, if knight or king */
            if (piece.type === 'n' || piece.type === 'k') break
          }
        }
      }
    }

    /* check for castling if: a) we're generating all moves, or b) we're doing
     * single square move generation on the king's square
     */
    if (piece_type === true || piece_type === KING) {
      if (!single_square || last_sq === kings[us]) {
        /* king-side castling */
        if (castling[us] & BITS.KSIDE_CASTLE) {
          var castling_from = kings[us]
          var castling_to = castling_from + 2

          if (
            board[castling_from + 1] == null &&
            board[castling_to] == null &&
            !attacked(them, kings[us]) &&
            !attacked(them, castling_from + 1) &&
            !attacked(them, castling_to)
          ) {
            add_move(board, moves, kings[us], castling_to, BITS.KSIDE_CASTLE)
          }
        }

        /* queen-side castling */
        if (castling[us] & BITS.QSIDE_CASTLE) {
          var castling_from = kings[us]
          var castling_to = castling_from - 2

          if (
            board[castling_from - 1] == null &&
            board[castling_from - 2] == null &&
            board[castling_from - 3] == null &&
            !attacked(them, kings[us]) &&
            !attacked(them, castling_from - 1) &&
            !attacked(them, castling_to)
          ) {
            add_move(board, moves, kings[us], castling_to, BITS.QSIDE_CASTLE)
          }
        }
      }
    }

    /* return all pseudo-legal moves (this includes moves that allow the king
     * to be captured)
     */
    if (!legal) {
      return moves
    }

    /* filter out illegal moves */
    var legal_moves = []
    for (var i = 0, len = moves.length; i < len; i++) {
      make_move(moves[i])
      if (!king_attacked(us)) {
        legal_moves.push(moves[i])
      }
      undo_move()
    }

    return legal_moves
  }

  /* convert a move from 0x88 coordinates to Standard Algebraic Notation
   * (SAN)
   *
   * @param {boolean} sloppy Use the sloppy SAN generator to work around over
   * disambiguation bugs in Fritz and Chessbase.  See below:
   *
   * r1bqkbnr/ppp2ppp/2n5/1B1pP3/4P3/8/PPPP2PP/RNBQK1NR b KQkq - 2 4
   * 4. ... Nge7 is overly disambiguated because the knight on c6 is pinned
   * 4. ... Ne7 is technically the valid SAN
   */
  function move_to_san(move, moves) {
    var output = ''

    if (move.flags & BITS.KSIDE_CASTLE) {
      output = 'O-O'
    } else if (move.flags & BITS.QSIDE_CASTLE) {
      output = 'O-O-O'
    } else {
      if (move.piece !== PAWN) {
        var disambiguator = get_disambiguator(move, moves)
        output += move.piece.toUpperCase() + disambiguator
      }

      if (move.flags & (BITS.CAPTURE | BITS.EP_CAPTURE)) {
        if (move.piece === PAWN) {
          output += algebraic(move.from)[0]
        }
        output += 'x'
      }

      output += algebraic(move.to)

      if (move.flags & BITS.PROMOTION) {
        output += '=' + move.promotion.toUpperCase()
      }
    }

    make_move(move)
    if (in_check()) {
      if (in_checkmate()) {
        output += '#'
      } else {
        output += '+'
      }
    }
    undo_move()

    return output
  }

  function attacked(color, square) {
    for (var i = SQUARE_MAP.a8; i <= SQUARE_MAP.h1; i++) {
      /* did we run off the end of the board */
      if (i & 0x88) {
        i += 7
        continue
      }

      /* if empty square or wrong color */
      if (board[i] == null || board[i].color !== color) continue

      var piece = board[i]
      var difference = i - square
      var index = difference + 119

      if (ATTACKS[index] & (1 << SHIFTS[piece.type])) {
        if (piece.type === PAWN) {
          if (difference > 0) {
            if (piece.color === WHITE) return true
          } else {
            if (piece.color === BLACK) return true
          }
          continue
        }

        /* if the piece is a knight or a king */
        if (piece.type === 'n' || piece.type === 'k') return true

        var offset = RAYS[index]
        var j = i + offset

        var blocked = false
        while (j !== square) {
          if (board[j] != null) {
            blocked = true
            break
          }
          j += offset
        }

        if (!blocked) return true
      }
    }

    return false
  }

  function king_attacked(color) {
    return attacked(swap_color(color), kings[color])
  }

  function in_check() {
    return king_attacked(turn)
  }

  function in_checkmate() {
    return in_check() && generate_moves().length === 0
  }

  function in_stalemate() {
    return !in_check() && generate_moves().length === 0
  }

  function insufficient_material() {
    var pieces = {}
    var bishops = []
    var num_pieces = 0
    var sq_color = 0

    for (var i = SQUARE_MAP.a8; i <= SQUARE_MAP.h1; i++) {
      sq_color = (sq_color + 1) % 2
      if (i & 0x88) {
        i += 7
        continue
      }

      var piece = board[i]
      if (piece) {
        pieces[piece.type] = piece.type in pieces ? pieces[piece.type] + 1 : 1
        if (piece.type === BISHOP) {
          bishops.push(sq_color)
        }
        num_pieces++
      }
    }

    /* k vs. k */
    if (num_pieces === 2) {
      return true
    } else if (
      /* k vs. kn .... or .... k vs. kb */
      num_pieces === 3 &&
      (pieces[BISHOP] === 1 || pieces[KNIGHT] === 1)
    ) {
      return true
    } else if (num_pieces === pieces[BISHOP] + 2) {
      /* kb vs. kb where any number of bishops are all on the same color */
      var sum = 0
      var len = bishops.length
      for (var i = 0; i < len; i++) {
        sum += bishops[i]
      }
      if (sum === 0 || sum === len) {
        return true
      }
    }

    return false
  }

  function in_threefold_repetition() {
    /* TODO: while this function is fine for casual use, a better
     * implementation would use a Zobrist key (instead of FEN). the
     * Zobrist key would be maintained in the make_move/undo_move functions,
     * avoiding the costly that we do below.
     */
    var moves = []
    var positions = {}
    var repetition = false

    while (true) {
      var move = undo_move()
      if (!move) break
      moves.push(move)
    }

    while (true) {
      /* remove the last two fields in the FEN string, they're not needed
       * when checking for draw by rep */
      var fen = generate_fen().split(' ').slice(0, 4).join(' ')

      /* has the position occurred three or move times */
      positions[fen] = fen in positions ? positions[fen] + 1 : 1
      if (positions[fen] >= 3) {
        repetition = true
      }

      if (!moves.length) {
        break
      }
      make_move(moves.pop())
    }

    return repetition
  }

  function push(move) {
    history.push({
      move: move,
      kings: { b: kings.b, w: kings.w },
      turn: turn,
      castling: { b: castling.b, w: castling.w },
      ep_square: ep_square,
      half_moves: half_moves,
      move_number: move_number,
    })
  }

  function make_move(move) {
    var us = turn
    var them = swap_color(us)
    push(move)

    board[move.to] = board[move.from]
    board[move.from] = null

    /* if ep capture, remove the captured pawn */
    if (move.flags & BITS.EP_CAPTURE) {
      if (turn === BLACK) {
        board[move.to - 16] = null
      } else {
        board[move.to + 16] = null
      }
    }

    /* if pawn promotion, replace with new piece */
    if (move.flags & BITS.PROMOTION) {
      board[move.to] = { type: move.promotion, color: us }
    }

    /* if we moved the king */
    if (board[move.to].type === KING) {
      kings[board[move.to].color] = move.to

      /* if we castled, move the rook next to the king */
      if (move.flags & BITS.KSIDE_CASTLE) {
        var castling_to = move.to - 1
        var castling_from = move.to + 1
        board[castling_to] = board[castling_from]
        board[castling_from] = null
      } else if (move.flags & BITS.QSIDE_CASTLE) {
        var castling_to = move.to + 1
        var castling_from = move.to - 2
        board[castling_to] = board[castling_from]
        board[castling_from] = null
      }

      /* turn off castling */
      castling[us] = ''
    }

    /* turn off castling if we move a rook */
    if (castling[us]) {
      for (var i = 0, len = ROOKS[us].length; i < len; i++) {
        if (
          move.from === ROOKS[us][i].square &&
          castling[us] & ROOKS[us][i].flag
        ) {
          castling[us] ^= ROOKS[us][i].flag
          break
        }
      }
    }

    /* turn off castling if we capture a rook */
    if (castling[them]) {
      for (var i = 0, len = ROOKS[them].length; i < len; i++) {
        if (
          move.to === ROOKS[them][i].square &&
          castling[them] & ROOKS[them][i].flag
        ) {
          castling[them] ^= ROOKS[them][i].flag
          break
        }
      }
    }

    /* if big pawn move, update the en passant square */
    if (move.flags & BITS.BIG_PAWN) {
      if (turn === 'b') {
        ep_square = move.to - 16
      } else {
        ep_square = move.to + 16
      }
    } else {
      ep_square = EMPTY
    }

    /* reset the 50 move counter if a pawn is moved or a piece is captured */
    if (move.piece === PAWN) {
      half_moves = 0
    } else if (move.flags & (BITS.CAPTURE | BITS.EP_CAPTURE)) {
      half_moves = 0
    } else {
      half_moves++
    }

    if (turn === BLACK) {
      move_number++
    }
    turn = swap_color(turn)
  }

  function undo_move() {
    var old = history.pop()
    if (old == null) {
      return null
    }

    var move = old.move
    kings = old.kings
    turn = old.turn
    castling = old.castling
    ep_square = old.ep_square
    half_moves = old.half_moves
    move_number = old.move_number

    var us = turn
    var them = swap_color(turn)

    board[move.from] = board[move.to]
    board[move.from].type = move.piece // to undo any promotions
    board[move.to] = null

    if (move.flags & BITS.CAPTURE) {
      board[move.to] = { type: move.captured, color: them }
    } else if (move.flags & BITS.EP_CAPTURE) {
      var index
      if (us === BLACK) {
        index = move.to - 16
      } else {
        index = move.to + 16
      }
      board[index] = { type: PAWN, color: them }
    }

    if (move.flags & (BITS.KSIDE_CASTLE | BITS.QSIDE_CASTLE)) {
      var castling_to, castling_from
      if (move.flags & BITS.KSIDE_CASTLE) {
        castling_to = move.to + 1
        castling_from = move.to - 1
      } else if (move.flags & BITS.QSIDE_CASTLE) {
        castling_to = move.to - 2
        castling_from = move.to + 1
      }

      board[castling_to] = board[castling_from]
      board[castling_from] = null
    }

    return move
  }

  // convert a move from Standard Algebraic Notation (SAN) to 0x88 coordinates
  function move_from_san(move, sloppy) {
    // strip off any move decorations: e.g Nf3+?! becomes Nf3
    var clean_move = stripped_san(move)

    // the move parsers is a 2-step state
    for (var parser = 0; parser < 2; parser++) {
      if (parser == PARSER_SLOPPY) {
        // only run the sloppy parse if explicitly requested
        if (!sloppy) {
          return null
        }

        // The sloppy parser allows the user to parse non-standard chess
        // notations. This parser is opt-in (by specifying the
        // '{ sloppy: true }' setting) and is only run after the Standard
        // Algebraic Notation (SAN) parser has failed.
        //
        // When running the sloppy parser, we'll run a regex to grab the piece,
        // the to/from square, and an optional promotion piece. This regex will
        // parse common non-standard notation like: Pe2-e4, Rc1c4, Qf3xf7,
        // f7f8q, b1c3

        // NOTE: Some positions and moves may be ambiguous when using the
        // sloppy parser. For example, in this position:
        // 6k1/8/8/B7/8/8/8/BN4K1 w - - 0 1, the move b1c3 may be interpreted
        // as Nc3 or B1c3 (a disambiguated bishop move). In these cases, the
        // sloppy parser will default to the most most basic interpretation
        // (which is b1c3 parsing to Nc3).

        // FIXME: these var's are hoisted into function scope, this will need
        // to change when switching to const/let

        var overly_disambiguated = false

        var matches = clean_move.match(
          /([pnbrqkPNBRQK])?([a-h][1-8])x?-?([a-h][1-8])([qrbnQRBN])?/
        )
        if (matches) {
          var piece = matches[1]
          var from = matches[2]
          var to = matches[3]
          var promotion = matches[4]

          if (from.length == 1) {
            overly_disambiguated = true
          }
        } else {
          // The [a-h]?[1-8]? portion of the regex below handles moves that may
          // be overly disambiguated (e.g. Nge7 is unnecessary and non-standard
          // when there is one legal knight move to e7). In this case, the value
          // of 'from' variable will be a rank or file, not a square.
          var matches = clean_move.match(
            /([pnbrqkPNBRQK])?([a-h]?[1-8]?)x?-?([a-h][1-8])([qrbnQRBN])?/
          )

          if (matches) {
            var piece = matches[1]
            var from = matches[2]
            var to = matches[3]
            var promotion = matches[4]

            if (from.length == 1) {
              var overly_disambiguated = true
            }
          }
        }
      }

      var piece_type = infer_piece_type(clean_move)
      var moves = generate_moves({
        legal: true,
        piece: piece ? piece : piece_type,
      })

      for (var i = 0, len = moves.length; i < len; i++) {
        switch (parser) {
          case PARSER_STRICT: {
            if (clean_move === stripped_san(move_to_san(moves[i], moves))) {
              return moves[i]
            }
            break
          }
          case PARSER_SLOPPY: {
            if (matches) {
              // hand-compare move properties with the results from our sloppy
              // regex
              if (
                (!piece || piece.toLowerCase() == moves[i].piece) &&
                SQUARE_MAP[from] == moves[i].from &&
                SQUARE_MAP[to] == moves[i].to &&
                (!promotion || promotion.toLowerCase() == moves[i].promotion)
              ) {
                return moves[i]
              } else if (overly_disambiguated) {
                // SPECIAL CASE: we parsed a move string that may have an
                // unneeded rank/file disambiguator (e.g. Nge7).  The 'from'
                // variable will
                var square = algebraic(moves[i].from)
                if (
                  (!piece || piece.toLowerCase() == moves[i].piece) &&
                  SQUARE_MAP[to] == moves[i].to &&
                  (from == square[0] || from == square[1]) &&
                  (!promotion || promotion.toLowerCase() == moves[i].promotion)
                ) {
                  return moves[i]
                }
              }
            }
          }
        }
      }
    }

    return null
  }

  /* pretty = external move object */
  function make_pretty(ugly_move) {
    var move = clone(ugly_move)
    move.san = move_to_san(move, generate_moves({ legal: true }))
    move.to = algebraic(move.to)
    move.from = algebraic(move.from)

    var flags = ''

    for (var flag in BITS) {
      if (BITS[flag] & move.flags) {
        flags += FLAGS[flag]
      }
    }
    move.flags = flags

    return move
  }

  /*****************************************************************************
   * DEBUGGING UTILITIES
   ****************************************************************************/
  function perft(depth) {
    var moves = generate_moves({ legal: false })
    var nodes = 0
    var color = turn

    for (var i = 0, len = moves.length; i < len; i++) {
      make_move(moves[i])
      if (!king_attacked(color)) {
        if (depth - 1 > 0) {
          var child_nodes = perft(depth - 1)
          nodes += child_nodes
        } else {
          nodes++
        }
      }
      undo_move()
    }

    return nodes
  }

  return {
    /***************************************************************************
     * PUBLIC API
     **************************************************************************/
    load: function (fen) {
      return load(fen)
    },

    reset: function () {
      return reset()
    },

    moves: function (options) {
      /* The internal representation of a chess move is in 0x88 format, and
       * not meant to be human-readable.  The code below converts the 0x88
       * square coordinates to algebraic coordinates.  It also prunes an
       * unnecessary move keys resulting from a verbose call.
       */

      var ugly_moves = generate_moves(options)
      var moves = []

      for (var i = 0, len = ugly_moves.length; i < len; i++) {
        /* does the user want a full move object (most likely not), or just
         * SAN
         */
        if (
          typeof options !== 'undefined' &&
          'verbose' in options &&
          options.verbose
        ) {
          moves.push(make_pretty(ugly_moves[i]))
        } else {
          moves.push(
            move_to_san(ugly_moves[i], generate_moves({ legal: true }))
          )
        }
      }

      return moves
    },

    in_check: function () {
      return in_check()
    },

    in_checkmate: function () {
      return in_checkmate()
    },

    in_stalemate: function () {
      return in_stalemate()
    },

    in_draw: function () {
      return (
        half_moves >= 100 ||
        in_stalemate() ||
        insufficient_material() ||
        in_threefold_repetition()
      )
    },

    insufficient_material: function () {
      return insufficient_material()
    },

    in_threefold_repetition: function () {
      return in_threefold_repetition()
    },

    game_over: function () {
      return (
        half_moves >= 100 ||
        in_checkmate() ||
        in_stalemate() ||
        insufficient_material() ||
        in_threefold_repetition()
      )
    },

    validate_fen: function (fen) {
      return validate_fen(fen)
    },

    fen: function () {
      return generate_fen()
    },

    board: function () {
      var output = [],
        row = []

      for (var i = SQUARE_MAP.a8; i <= SQUARE_MAP.h1; i++) {
        if (board[i] == null) {
          row.push(null)
        } else {
          row.push({
            square: algebraic(i),
            type: board[i].type,
            color: board[i].color,
          })
        }
        if ((i + 1) & 0x88) {
          output.push(row)
          row = []
          i += 8
        }
      }

      return output
    },

    pgn: function (options) {
      /* using the specification from http://www.chessclub.com/help/PGN-spec
       * example for html usage: .pgn({ max_width: 72, newline_char: "<br />" })
       */
      var newline =
        typeof options === 'object' && typeof options.newline_char === 'string'
          ? options.newline_char
          : '\n'
      var max_width =
        typeof options === 'object' && typeof options.max_width === 'number'
          ? options.max_width
          : 0
      var result = []
      var header_exists = false

      /* add the PGN header information */
      for (var i in header) {
        /* TODO: order of enumerated properties in header object is not
         * guaranteed, see ECMA-262 spec (section 12.6.4)
         */
        result.push('[' + i + ' "' + header[i] + '"]' + newline)
        header_exists = true
      }

      if (header_exists && history.length) {
        result.push(newline)
      }

      var append_comment = function (move_string) {
        var comment = comments[generate_fen()]
        if (typeof comment !== 'undefined') {
          var delimiter = move_string.length > 0 ? ' ' : ''
          move_string = `${move_string}${delimiter}{${comment}}`
        }
        return move_string
      }

      /* pop all of history onto reversed_history */
      var reversed_history = []
      while (history.length > 0) {
        reversed_history.push(undo_move())
      }

      var moves = []
      var move_string = ''

      /* special case of a commented starting position with no moves */
      if (reversed_history.length === 0) {
        moves.push(append_comment(''))
      }

      /* build the list of moves.  a move_string looks like: "3. e3 e6" */
      while (reversed_history.length > 0) {
        move_string = append_comment(move_string)
        var move = reversed_history.pop()

        /* if the position started with black to move, start PGN with #. ... */
        if (!history.length && move.color === 'b') {
          const prefix = `${move_number}. ...`
          /* is there a comment preceding the first move? */
          move_string = move_string ? `${move_string} ${prefix}` : prefix
        } else if (move.color === 'w') {
          /* store the previous generated move_string if we have one */
          if (move_string.length) {
            moves.push(move_string)
          }
          move_string = move_number + '.'
        }

        move_string =
          move_string + ' ' + move_to_san(move, generate_moves({ legal: true }))
        make_move(move)
      }

      /* are there any other leftover moves? */
      if (move_string.length) {
        moves.push(append_comment(move_string))
      }

      /* is there a result? */
      if (typeof header.Result !== 'undefined') {
        moves.push(header.Result)
      }

      /* history should be back to what it was before we started generating PGN,
       * so join together moves
       */
      if (max_width === 0) {
        return result.join('') + moves.join(' ')
      }

      var strip = function () {
        if (result.length > 0 && result[result.length - 1] === ' ') {
          result.pop()
          return true
        }
        return false
      }

      /* NB: this does not preserve comment whitespace. */
      var wrap_comment = function (width, move) {
        for (var token of move.split(' ')) {
          if (!token) {
            continue
          }
          if (width + token.length > max_width) {
            while (strip()) {
              width--
            }
            result.push(newline)
            width = 0
          }
          result.push(token)
          width += token.length
          result.push(' ')
          width++
        }
        if (strip()) {
          width--
        }
        return width
      }

      /* wrap the PGN output at max_width */
      var current_width = 0
      for (var i = 0; i < moves.length; i++) {
        if (current_width + moves[i].length > max_width) {
          if (moves[i].includes('{')) {
            current_width = wrap_comment(current_width, moves[i])
            continue
          }
        }
        /* if the current move will push past max_width */
        if (current_width + moves[i].length > max_width && i !== 0) {
          /* don't end the line with whitespace */
          if (result[result.length - 1] === ' ') {
            result.pop()
          }

          result.push(newline)
          current_width = 0
        } else if (i !== 0) {
          result.push(' ')
          current_width++
        }
        result.push(moves[i])
        current_width += moves[i].length
      }

      return result.join('')
    },

    load_pgn: function (pgn, options) {
      // allow the user to specify the sloppy move parser to work around over
      // disambiguation bugs in Fritz and Chessbase
      var sloppy =
        typeof options !== 'undefined' && 'sloppy' in options
          ? options.sloppy
          : false

      function mask(str) {
        return str.replace(/\\/g, '\\')
      }

      function parse_pgn_header(header, options) {
        var newline_char =
          typeof options === 'object' &&
          typeof options.newline_char === 'string'
            ? options.newline_char
            : '\r?\n'
        var header_obj = {}
        var headers = header.split(new RegExp(mask(newline_char)))
        var key = ''
        var value = ''

        for (var i = 0; i < headers.length; i++) {
          var regex = /^\s*\[([A-Za-z]+)\s*"(.*)"\s*\]\s*$/
          key = headers[i].replace(regex, '$1')
          value = headers[i].replace(regex, '$2')
          if (trim(key).length > 0) {
            header_obj[key] = value
          }
        }

        return header_obj
      }

      // strip whitespace from head/tail of PGN block
      pgn = pgn.trim()

      var newline_char =
        typeof options === 'object' && typeof options.newline_char === 'string'
          ? options.newline_char
          : '\r?\n'

      // RegExp to split header. Takes advantage of the fact that header and movetext
      // will always have a blank line between them (ie, two newline_char's).
      // With default newline_char, will equal: /^(\[((?:\r?\n)|.)*\])(?:\s*\r?\n){2}/
      var header_regex = new RegExp(
        '^(\\[((?:' +
          mask(newline_char) +
          ')|.)*\\])' +
          '(?:\\s*' +
          mask(newline_char) +
          '){2}'
      )

      // If no header given, begin with moves.
      var header_string = header_regex.test(pgn)
        ? header_regex.exec(pgn)[1]
        : ''

      // Put the board in the starting position
      reset()

      /* parse PGN header */
      var headers = parse_pgn_header(header_string, options)
      var fen = ''

      for (var key in headers) {
        // check to see user is including fen (possibly with wrong tag case)
        if (key.toLowerCase() === 'fen') {
          fen = headers[key]
        }
        set_header([key, headers[key]])
      }

      /* sloppy parser should attempt to load a fen tag, even if it's
       * the wrong case and doesn't include a corresponding [SetUp "1"] tag */
      if (sloppy) {
        if (fen) {
          if (!load(fen, true)) {
            return false
          }
        }
      } else {
        /* strict parser - load the starting position indicated by [Setup '1']
         * and [FEN position] */
        if (headers['SetUp'] === '1') {
          if (!('FEN' in headers && load(headers['FEN'], true))) {
            // second argument to load: don't clear the headers
            return false
          }
        }
      }

      /* NB: the regexes below that delete move numbers, recursive
       * annotations, and numeric annotation glyphs may also match
       * text in comments. To prevent this, we transform comments
       * by hex-encoding them in place and decoding them again after
       * the other tokens have been deleted.
       *
       * While the spec states that PGN files should be ASCII encoded,
       * we use {en,de}codeURIComponent here to support arbitrary UTF8
       * as a convenience for modern users */

      var to_hex = function (string) {
        return Array.from(string)
          .map(function (c) {
            /* encodeURI doesn't transform most ASCII characters,
             * so we handle these ourselves */
            return c.charCodeAt(0) < 128
              ? c.charCodeAt(0).toString(16)
              : encodeURIComponent(c).replace(/\%/g, '').toLowerCase()
          })
          .join('')
      }

      var from_hex = function (string) {
        return string.length == 0
          ? ''
          : decodeURIComponent('%' + string.match(/.{1,2}/g).join('%'))
      }

      var encode_comment = function (string) {
        string = string.replace(new RegExp(mask(newline_char), 'g'), ' ')
        return `{${to_hex(string.slice(1, string.length - 1))}}`
      }

      var decode_comment = function (string) {
        if (string.startsWith('{') && string.endsWith('}')) {
          return from_hex(string.slice(1, string.length - 1))
        }
      }

      /* delete header to get the moves */
      var ms = pgn
        .replace(header_string, '')
        .replace(
          /* encode comments so they don't get deleted below */
          new RegExp(`(\{[^}]*\})+?|;([^${mask(newline_char)}]*)`, 'g'),
          function (match, bracket, semicolon) {
            return bracket !== undefined
              ? encode_comment(bracket)
              : ' ' + encode_comment(`{${semicolon.slice(1)}}`)
          }
        )
        .replace(new RegExp(mask(newline_char), 'g'), ' ')

      /* delete recursive annotation variations */
      var rav_regex = /(\([^\(\)]+\))+?/g
      while (rav_regex.test(ms)) {
        ms = ms.replace(rav_regex, '')
      }

      /* delete move numbers */
      ms = ms.replace(/\d+\.(\.\.)?/g, '')

      /* delete ... indicating black to move */
      ms = ms.replace(/\.\.\./g, '')

      /* delete numeric annotation glyphs */
      ms = ms.replace(/\$\d+/g, '')

      /* trim and get array of moves */
      var moves = trim(ms).split(new RegExp(/\s+/))

      /* delete empty entries */
      moves = moves.join(',').replace(/,,+/g, ',').split(',')
      var move = ''

      var result = ''

      for (var half_move = 0; half_move < moves.length; half_move++) {
        var comment = decode_comment(moves[half_move])
        if (comment !== undefined) {
          comments[generate_fen()] = comment
          continue
        }

        move = move_from_san(moves[half_move], sloppy)

        /* invalid move */
        if (move == null) {
          /* was the move an end of game marker */
          if (TERMINATION_MARKERS.indexOf(moves[half_move]) > -1) {
            result = moves[half_move]
          } else {
            return false
          }
        } else {
          /* reset the end of game marker if making a valid move */
          result = ''
          make_move(move)
        }
      }

      /* Per section 8.2.6 of the PGN spec, the Result tag pair must match
       * match the termination marker. Only do this when headers are present,
       * but the result tag is missing
       */
      if (result && Object.keys(header).length && !header['Result']) {
        set_header(['Result', result])
      }

      return true
    },

    header: function () {
      return set_header(arguments)
    },

    turn: function () {
      return turn
    },

    move: function (move, options) {
      /* The move function can be called with in the following parameters:
       *
       * .move('Nxb7')      <- where 'move' is a case-sensitive SAN string
       *
       * .move({ from: 'h7', <- where the 'move' is a move object (additional
       *         to :'h8',      fields are ignored)
       *         promotion: 'q',
       *      })
       */

      // allow the user to specify the sloppy move parser to work around over
      // disambiguation bugs in Fritz and Chessbase
      var sloppy =
        typeof options !== 'undefined' && 'sloppy' in options
          ? options.sloppy
          : false

      var move_obj = null

      if (typeof move === 'string') {
        move_obj = move_from_san(move, sloppy)
      } else if (typeof move === 'object') {
        var moves = generate_moves()

        /* convert the pretty move object to an ugly move object */
        for (var i = 0, len = moves.length; i < len; i++) {
          if (
            move.from === algebraic(moves[i].from) &&
            move.to === algebraic(moves[i].to) &&
            (!('promotion' in moves[i]) ||
              move.promotion === moves[i].promotion)
          ) {
            move_obj = moves[i]
            break
          }
        }
      }

      /* failed to find move */
      if (!move_obj) {
        return null
      }

      /* need to make a copy of move because we can't generate SAN after the
       * move is made
       */
      var pretty_move = make_pretty(move_obj)

      make_move(move_obj)

      return pretty_move
    },

    undo: function () {
      var move = undo_move()
      return move ? make_pretty(move) : null
    },

    clear: function () {
      return clear()
    },

    put: function (piece, square) {
      return put(piece, square)
    },

    get: function (square) {
      return get(square)
    },

    ascii() {
      var s = '   +------------------------+\n'
      for (var i = SQUARE_MAP.a8; i <= SQUARE_MAP.h1; i++) {
        /* display the rank */
        if (file(i) === 0) {
          s += ' ' + '87654321'[rank(i)] + ' |'
        }

        /* empty piece */
        if (board[i] == null) {
          s += ' . '
        } else {
          var piece = board[i].type
          var color = board[i].color
          var symbol =
            color === WHITE ? piece.toUpperCase() : piece.toLowerCase()
          s += ' ' + symbol + ' '
        }

        if ((i + 1) & 0x88) {
          s += '|\n'
          i += 8
        }
      }
      s += '   +------------------------+\n'
      s += '     a  b  c  d  e  f  g  h'

      return s
    },

    remove: function (square) {
      return remove(square)
    },

    perft: function (depth) {
      return perft(depth)
    },

    square_color: function (square) {
      if (square in SQUARE_MAP) {
        var sq_0x88 = SQUARE_MAP[square]
        return (rank(sq_0x88) + file(sq_0x88)) % 2 === 0 ? 'light' : 'dark'
      }

      return null
    },

    history: function (options) {
      var reversed_history = []
      var move_history = []
      var verbose =
        typeof options !== 'undefined' &&
        'verbose' in options &&
        options.verbose

      while (history.length > 0) {
        reversed_history.push(undo_move())
      }

      while (reversed_history.length > 0) {
        var move = reversed_history.pop()
        if (verbose) {
          move_history.push(make_pretty(move))
        } else {
          move_history.push(move_to_san(move, generate_moves({ legal: true })))
        }
        make_move(move)
      }

      return move_history
    },

    get_comment: function () {
      return comments[generate_fen()]
    },

    set_comment: function (comment) {
      comments[generate_fen()] = comment.replace('{', '[').replace('}', ']')
    },

    delete_comment: function () {
      var comment = comments[generate_fen()]
      delete comments[generate_fen()]
      return comment
    },

    get_comments: function () {
      prune_comments()
      return Object.keys(comments).map(function (fen) {
        return { fen: fen, comment: comments[fen] }
      })
    },

    delete_comments: function () {
      prune_comments()
      return Object.keys(comments).map(function (fen) {
        var comment = comments[fen]
        delete comments[fen]
        return { fen: fen, comment: comment }
      })
    },
  }
}


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


/* ui.js — the floating coach panel. Lives in a closed shadow root so chess.com's
 * CSS can't touch it (and ours can't touch chess.com). All text goes through
 * textContent; nothing from the page is ever parsed as HTML. */

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
button { box-sizing: border-box !important; }
.wrap {
  --bg: #262522; --bg2: #302e2b; --bg3: #3c3a37; --fg: #f1efe9; --muted: #a8a49c;
  --line: rgba(255,255,255,.08); --accent: #81b64c; --focus: #9ecbff;
  --best: #81b64c; --good: #96bc4b; --neutral: #9c9a96; --inacc: #e8b43a; --mistake: #f08a3c; --blunder: #e5533d;
  position: fixed; z-index: 2147483000; right: 20px; bottom: 20px; width: 340px; max-width: calc(100vw - 32px);
  font: 13.5px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--fg);
  background: var(--bg); border: 1px solid var(--line); border-radius: 14px;
  box-shadow: 0 12px 32px rgba(0,0,0,.45), 0 2px 6px rgba(0,0,0,.3); overflow: hidden;
}
@media (prefers-color-scheme: light) {
  .wrap.auto { --bg: #ffffff; --bg2: #f5f3ef; --bg3: #e8e5df; --fg: #1d1c1a; --muted: #67635c; --line: rgba(0,0,0,.09); --focus: #1a66d2;
    box-shadow: 0 12px 32px rgba(0,0,0,.16), 0 2px 6px rgba(0,0,0,.08); }
}
.head { display: flex; align-items: center; gap: 8px; padding: 9px 10px 9px 14px; cursor: grab; user-select: none;
  background: var(--bg2); border-bottom: 1px solid var(--line); touch-action: none; }
.head:active { cursor: grabbing; }
.logo { width: 18px; height: 18px; border-radius: 5px; background: var(--accent); display: grid; place-items: center;
  color: #1b2a10; font-weight: 800; font-size: 12px; flex: none; }
.title { font-weight: 650; font-size: 13px; letter-spacing: .1px; }
.mode { font-size: 11px; color: var(--muted); background: var(--bg3); padding: 2px 7px; border-radius: 999px; white-space: nowrap; }
.sp { flex: 1; }
.icon-btn { all: unset; width: 28px; height: 28px; display: grid; place-items: center; border-radius: 8px; color: var(--muted); cursor: pointer; font-size: 15px; }
.icon-btn:hover { background: var(--bg3); color: var(--fg); }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.body { padding: 12px 14px 14px; max-height: min(70vh, 560px); overflow-y: auto; overflow-x: hidden; scrollbar-width: thin; }
.row { display: flex; align-items: center; gap: 10px; }
.san { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }
.who { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .6px; }
.badge { margin-left: auto; display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px 3px 7px; border-radius: 999px;
  font-size: 12px; font-weight: 650; color: #fff; background: var(--tone); white-space: nowrap; }
.badge b { font-size: 12px; min-width: 14px; text-align: center; }
.evalrow { display: flex; align-items: center; gap: 8px; margin: 8px 0 10px; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
.bar { flex: 1; height: 6px; border-radius: 999px; background: #1a1917; overflow: hidden; border: 1px solid var(--line); }
.bar i { display: block; height: 100%; background: #eeeae2; transition: width .35s ease; }
.headline { font-size: 14.5px; font-weight: 600; margin: 0 0 4px; }
.next { color: var(--muted); margin: 0; }
.better { display: flex; gap: 6px; align-items: baseline; margin-top: 10px; padding: 8px 10px; border-radius: 10px;
  background: color-mix(in srgb, var(--best) 14%, transparent); border: 1px solid color-mix(in srgb, var(--best) 35%, transparent); }
.better strong { color: var(--best); white-space: nowrap; }
.deep-btn { all: unset; display: flex; align-items: center; gap: 6px; width: 100%; margin-top: 12px; padding: 8px 10px;
  border-radius: 10px; background: var(--bg2); cursor: pointer; font-weight: 600; font-size: 13px; }
.deep-btn:hover { background: var(--bg3); }
.deep-btn .chev { transition: transform .2s ease; display: inline-block; }
.deep-btn[aria-expanded="true"] .chev { transform: rotate(90deg); }
.kbd { margin-left: auto; font: 11px ui-monospace, monospace; color: var(--muted); border: 1px solid var(--line); padding: 1px 5px; border-radius: 5px; }
.deep { padding: 4px 2px 0; }
.sec { margin-top: 12px; }
.sec h4 { margin: 0 0 5px; font-size: 11px; text-transform: uppercase; letter-spacing: .7px; color: var(--muted); font-weight: 650; }
.sec p { margin: 0 0 5px; }
.sec ul { margin: 0; padding-left: 17px; }
.sec li { margin: 3px 0; }
.sec li::marker { color: var(--muted); }
.summary { font-weight: 600; }
.line { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.line span { font: 12px ui-monospace, "SFMono-Regular", Consolas, monospace; background: var(--bg3); padding: 2px 6px; border-radius: 6px; }
.state { display: flex; gap: 10px; align-items: flex-start; color: var(--muted); }
.state .big { font-size: 20px; line-height: 1; }
.state strong { color: var(--fg); display: block; margin-bottom: 2px; }
.btn { all: unset; cursor: pointer; padding: 6px 11px; border-radius: 8px; background: var(--bg3); color: var(--fg); font-weight: 600; font-size: 12.5px; margin: 8px 6px 0 0; display: inline-block; }
.btn:hover { filter: brightness(1.15); }
.btn.primary { background: var(--accent); color: #17230c; }
.sk { height: 12px; border-radius: 6px; background: linear-gradient(90deg, var(--bg2), var(--bg3), var(--bg2)); background-size: 200% 100%; animation: sh 1.1s linear infinite; margin: 8px 0; }
@keyframes sh { to { background-position: -200% 0; } }
.foot { padding: 7px 14px; font-size: 11px; color: var(--muted); border-top: 1px solid var(--line); display: flex; gap: 6px; }
/* settings */
.set { display: grid; gap: 14px; }
.set label.tg { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.set label.tg span { flex: 1; }
.set label.tg small { display: block; color: var(--muted); font-size: 11.5px; }
.set input[type=checkbox] { appearance: none; width: 34px; height: 20px; border-radius: 999px; background: var(--bg3); position: relative; cursor: pointer; flex: none; margin: 0; }
.set input[type=checkbox]::after { content: ""; position: absolute; top: 3px; left: 3px; width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: left .15s; }
.set input[type=checkbox]:checked { background: var(--accent); }
.set input[type=checkbox]:checked::after { left: 17px; }
.seg { display: flex; background: var(--bg3); border-radius: 9px; padding: 3px; gap: 3px; margin-top: 6px; }
.seg button { all: unset; flex: 1; text-align: center; padding: 5px 0; border-radius: 7px; cursor: pointer; font-size: 12.5px; color: var(--muted); }
.seg button[aria-pressed="true"] { background: var(--bg); color: var(--fg); font-weight: 650; }
.set .lbl { font-weight: 600; }
.set .lbl small { font-weight: 400; color: var(--muted); }
.hint { font-size: 11.5px; color: var(--muted); }
/* collapsed pill */
.pill { all: unset; position: fixed; z-index: 2147483000; right: 20px; bottom: 20px; display: flex; align-items: center; gap: 7px;
  padding: 8px 12px 8px 9px; border-radius: 999px; background: #262522; color: #f1efe9; cursor: pointer;
  font: 600 13px system-ui, -apple-system, "Segoe UI", sans-serif; box-shadow: 0 8px 22px rgba(0,0,0,.4); }
.pill .dot { width: 18px; height: 18px; border-radius: 50%; background: var(--tone, #81b64c); color: #fff; display: grid; place-items: center; font-size: 10px; font-weight: 800; }
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
`;

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') {
      for (const p in v) p.startsWith('--') ? el.style.setProperty(p, v[p]) : (el.style[p] = v[p]);
    }
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : String(kid));
  return el;
}

const TONE = (t) => `var(--${t})`;
const TONE_HEX = { best: '#81b64c', good: '#96bc4b', neutral: '#9c9a96', inacc: '#e8b43a', mistake: '#f08a3c', blunder: '#e5533d' };

function createPanel(opts) {
  const { store, onChange, onRetry, onUseOnline, canUseOnline } = opts;
  const host = h('div', { id: 'cmc-move-coach' });
  const root = host.attachShadow({ mode: 'closed' });
  root.append(h('style', {}, CSS));
  document.documentElement.append(host);

  let settings = opts.settings;
  let view = 'main';           // 'main' | 'settings'
  let collapsed = !!settings.collapsed;
  let deepOpen = !!settings.autoDeep;
  let lastState = { kind: 'idle', text: 'Starting…' };
  let lastKey = null;

  const wrap = h('section', { class: 'wrap auto', role: 'complementary', 'aria-label': 'Move Coach' });
  const pill = h('button', { class: 'pill', 'aria-label': 'Open Move Coach (Alt+M)' });
  root.append(wrap, pill);

  function applyPos() {
    const p = settings.pos;
    for (const el of [wrap, pill]) {
      el.style.right = (p ? p.right : 20) + 'px';
      el.style.bottom = (p ? p.bottom : 20) + 'px';
    }
  }

  function save(patch) {
    settings = { ...settings, ...patch };
    store.set(settings);
    onChange && onChange(settings, patch);
  }

  function toggleCollapsed(v) {
    collapsed = v == null ? !collapsed : v;
    save({ collapsed });
    draw();
    if (!collapsed) wrap.querySelector('.icon-btn') && wrap.querySelector('.icon-btn').focus({ preventScroll: true });
  }

  // ---- dragging (header) ----
  let drag = null;
  function onDown(e) {
    if (e.target.closest('button')) return;
    const r = wrap.getBoundingClientRect();
    drag = { x: e.clientX, y: e.clientY, right: innerWidth - r.right, bottom: innerHeight - r.bottom };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onMove(e) {
    if (!drag) return;
    const right = Math.min(Math.max(drag.right - (e.clientX - drag.x), 0), innerWidth - 120);
    const bottom = Math.min(Math.max(drag.bottom - (e.clientY - drag.y), 0), innerHeight - 60);
    settings.pos = { right, bottom };
    applyPos();
  }
  function onUp() { if (drag) { drag = null; save({ pos: settings.pos }); } }

  // ---- rendering ----
  function header() {
    const g = lastState.gate;
    return h('div', { class: 'head', onpointerdown: onDown, onpointermove: onMove, onpointerup: onUp },
      h('div', { class: 'logo', 'aria-hidden': 'true' }, '!'),
      h('div', { class: 'title' }, 'Move Coach'),
      g && g.mode ? h('span', { class: 'mode' }, g.mode) : null,
      h('div', { class: 'sp' }),
      h('button', { class: 'icon-btn', title: view === 'settings' ? 'Back' : 'Settings', 'aria-label': view === 'settings' ? 'Back to feedback' : 'Settings',
        onclick: () => { view = view === 'settings' ? 'main' : 'settings'; draw(); } }, view === 'settings' ? '←' : '⚙'),
      h('button', { class: 'icon-btn', title: 'Minimize (Alt+M)', 'aria-label': 'Minimize', onclick: () => toggleCollapsed(true) }, '—'),
    );
  }

  function stateView(icon, title, text, ...actions) {
    return h('div', {},
      h('div', { class: 'state' }, h('span', { class: 'big', 'aria-hidden': 'true' }, icon), h('div', {}, h('strong', {}, title), text)),
      actions.length ? h('div', {}, actions) : null);
  }

  function section(title, ...kids) { return h('div', { class: 'sec' }, h('h4', {}, title), kids); }
  const bullets = (arr) => (arr && arr.length ? h('ul', {}, arr.map((b) => h('li', {}, b))) : null);
  const line = (arr) => (arr && arr.length ? h('div', { class: 'line', 'aria-label': 'Engine line' }, arr.map((s) => h('span', {}, s))) : null);

  function feedbackView(fb) {
    const tone = fb.cls.tone;
    const whitePct = Math.max(2, Math.min(98, Coach.winPct(fb.whiteCp)));
    const deep = h('div', { class: 'deep', id: 'cmc-deep', hidden: !deepOpen },
      section(fb.isUser ? 'What your move did' : 'What their move did', bullets(fb.deep.did)),
      fb.deep.plan.summary ? section(fb.deep.plan.title,
        h('p', { class: 'summary' }, fb.deep.plan.summary), bullets(fb.deep.plan.bullets), line(fb.deep.plan.line)) : null,
      fb.deep.yours.bullets.length ? section(fb.deep.yours.title, bullets(fb.deep.yours.bullets), line(fb.deep.yours.line)) : null,
    );
    const deepBtn = h('button', { class: 'deep-btn', 'aria-expanded': String(deepOpen), 'aria-controls': 'cmc-deep',
      onclick: () => setDeep(!deepOpen) },
      h('span', { class: 'chev', 'aria-hidden': 'true' }, '▸'), 'Deep dive: plans & threats', h('span', { class: 'kbd' }, 'Alt+D'));
    return h('div', {},
      h('div', { class: 'row' },
        h('div', {}, h('div', { class: 'who' }, fb.isUser ? 'Your move' : 'Their move'), h('div', { class: 'san' }, fb.moveLabel)),
        h('span', { class: 'badge', style: { '--tone': TONE(tone) }, title: fb.cls.label },
          h('b', { 'aria-hidden': 'true' }, fb.cls.symbol), fb.cls.label)),
      h('div', { class: 'evalrow', title: 'White’s winning chances after the move' },
        h('span', {}, fb.evalBefore + ' → ' + fb.evalAfter),
        h('div', { class: 'bar', role: 'img', 'aria-label': `White ${Math.round(whitePct)} percent` }, h('i', { style: { width: whitePct + '%' } }))),
      h('div', { 'aria-live': 'polite' },
        h('p', { class: 'headline' }, fb.quick.headline),
        fb.quick.next ? h('p', { class: 'next' }, fb.quick.next) : null),
      fb.quick.better ? h('div', { class: 'better' }, h('strong', {}, 'Better: ' + fb.quick.better.label), h('span', {}, fb.quick.better.why)) : null,
      deepBtn, deep);
  }

  function setDeep(v) {
    deepOpen = v;
    const btn = wrap.querySelector('.deep-btn');
    const d = wrap.querySelector('#cmc-deep');
    if (btn) btn.setAttribute('aria-expanded', String(v));
    if (d) d.hidden = !v;
  }

  function settingsView() {
    const strength = [['fast', 'Fast'], ['balanced', 'Balanced'], ['deep', 'Deep']];
    const toggle = (key, label, hint) => h('label', { class: 'tg' },
      h('span', {}, label, hint ? h('small', {}, hint) : null),
      h('input', { type: 'checkbox', checked: !!settings[key], onchange: (e) => save({ [key]: e.target.checked }) }));
    return h('div', { class: 'set' },
      h('div', {}, h('div', { class: 'lbl' }, 'Engine strength ', h('small', {}, '(speed vs. accuracy)')),
        h('div', { class: 'seg', role: 'group', 'aria-label': 'Engine strength' },
          strength.map(([k, l]) => h('button', { 'aria-pressed': String(settings.strength === k), onclick: () => { save({ strength: k }); draw(); } }, l)))),
      toggle('autoDeep', 'Open the deep dive automatically', 'Otherwise it stays one click (or Alt+D) away.'),
      toggle('explainOpponent', 'Explain opponent moves too', 'Shows what their move threatens and your best reply.'),
      canUseOnline ? toggle('online', 'Online engine fallback', 'If the local engine can’t start, send positions (FEN only) to chess-api.com.') : null,
      h('div', { class: 'hint' }, 'Shortcuts: Alt+M show/hide · Alt+D deep dive. Drag the header to move the panel.'),
      h('div', {}, h('button', { class: 'btn', onclick: () => { save({ pos: null }); applyPos(); } }, 'Reset position')),
    );
  }

  function mainView() {
    const s = lastState;
    switch (s.kind) {
      case 'paused': return stateView('⏸', s.title || 'Paused', s.text);
      case 'idle': return stateView('♟', 'Ready', s.text);
      case 'loading':
        return h('div', { 'aria-busy': 'true' },
          s.label ? h('div', { class: 'row' }, h('div', { class: 'san' }, s.label), h('span', { class: 'who', style: { marginLeft: 'auto' } }, 'Thinking…')) : null,
          h('div', { class: 'sk', style: { width: '92%' } }), h('div', { class: 'sk', style: { width: '70%' } }), h('div', { class: 'sk', style: { width: '80%' } }));
      case 'error':
        return stateView('⚠', 'Couldn’t analyze', s.text,
          h('button', { class: 'btn', onclick: () => onRetry && onRetry() }, 'Retry'),
          canUseOnline && s.offerOnline ? h('button', { class: 'btn primary', onclick: () => { save({ online: true }); onUseOnline && onUseOnline(); } }, 'Use online engine') : null);
      case 'feedback': return feedbackView(s.fb);
      default: return null;
    }
  }

  function draw() {
    applyPos();
    wrap.hidden = collapsed;
    pill.hidden = !collapsed;
    if (collapsed) {
      const fb = lastState.kind === 'feedback' ? lastState.fb : null;
      pill.replaceChildren(
        h('span', { class: 'dot', style: { '--tone': fb ? TONE_HEX[fb.cls.tone] : '#81b64c' } }, fb ? fb.cls.symbol : '♞'),
        fb ? `${fb.san} · ${fb.cls.label}` : 'Move Coach');
      return;
    }
    wrap.replaceChildren(...[
      header(),
      h('div', { class: 'body' }, view === 'settings' ? settingsView() : mainView()),
      view === 'main' && lastState.engine ? h('div', { class: 'foot' }, lastState.engine) : null,
    ].filter(Boolean));
  }

  pill.addEventListener('click', () => toggleCollapsed(false));
  window.addEventListener('keydown', (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if (k === 'm' || e.code === 'KeyM') { e.preventDefault(); toggleCollapsed(); }
    else if ((k === 'd' || e.code === 'KeyD') && !collapsed && lastState.kind === 'feedback') { e.preventDefault(); setDeep(!deepOpen); }
  }, true);

  draw();
  return {
    render(state) {
      // New move → reset the deep dive to the user's preference.
      const key = state.kind === 'feedback' ? state.fb.fenBefore + state.fb.uci : null;
      if (key && key !== lastKey) { deepOpen = !!settings.autoDeep; lastKey = key; }
      lastState = state;
      if (view === 'main') draw();
      else if (collapsed) draw();
    },
    get settings() { return settings; },
  };
}

const UI = { createPanel };


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

})();
