// build.mjs — no bundler needed: the sources are plain scripts that share one
// scope, so each target is just "concatenate in order inside an IIFE".
//   extension/  content.js, bridge.js, background.js, offscreen.js, engine/stockfish.asm.js
//   userscript/ chess-move-coach.user.js  (+ a copy in docs/ for the install link)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const write = (p, s) => { mkdirSync(dirname(join(root, p)), { recursive: true }); writeFileSync(join(root, p), s); };
const { version } = JSON.parse(read('package.json'));

// chess.js 0.13 ships as an ES module; inside our IIFE we just drop the `export`s.
const chess = read('vendor/chess.js').replace(/^export /gm, '');
const banner = (what) => `/*! Chess Move Coach ${version} (${what}) | MIT | bundles chess.js (BSD-2) — built file, edit src/ */\n`;
const iife = (...parts) => `(function () {\n'use strict';\n${parts.join('\n\n')}\n})();\n`;
const core = ['src/board.js', 'src/coach.js', 'src/uci.js', 'src/reader.js', 'src/ui.js', 'src/app.js'].map(read);

// ---- extension ----
write('extension/content.js', banner('extension') + iife(chess, ...core, read('src/targets/extension-content.js')));
write('extension/bridge.js', banner('page bridge') + iife(read('src/bridge.js'), 'cmcBridge(window);'));
write('extension/background.js', banner('background') + read('src/targets/extension-background.js'));
write('extension/offscreen.js', banner('offscreen') + iife(read('src/uci.js'), read('src/targets/extension-offscreen.js')));
mkdirSync(join(root, 'extension/engine'), { recursive: true });
for (const f of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm', 'stockfish.COPYING.txt']) {
  copyFileSync(join(root, 'vendor', f), join(root, 'extension/engine', f === 'stockfish.COPYING.txt' ? 'COPYING.txt' : f));
}
// The userscript loads Stockfish 19 from our own GitHub Pages (jsDelivr refuses the
// 200 MB npm package), so publish the engine pair next to the install page.
mkdirSync(join(root, 'docs/engine'), { recursive: true });
for (const f of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) {
  copyFileSync(join(root, 'vendor', f), join(root, 'docs/engine', f));
}
const manifest = JSON.parse(read('extension/manifest.json'));
manifest.version = version;
write('extension/manifest.json', JSON.stringify(manifest, null, 2) + '\n');

// ---- userscript ----
const header = read('src/targets/userscript-header.txt').replace('__VERSION__', version);
const us = header + '\n' + banner('userscript') + iife(chess, ...core, read('src/bridge.js'), read('src/targets/userscript.js'));
write('userscript/chess-move-coach.user.js', us);
write('docs/chess-move-coach.user.js', us);

console.log(`built v${version}: extension/ and userscript/ (${(us.length / 1024).toFixed(0)} KB userscript)`);
