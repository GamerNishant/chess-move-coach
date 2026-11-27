# Chess Move Coach

Move-by-move feedback on chess.com, as a **Chromium extension** and a **Tampermonkey/Violentmonkey userscript**.

Every move gets two levels of feedback:

- **Quick take** (always visible): one line on what the move did, one line on what happens next, and a better move if there was one.
- **Deep dive** (one click or <kbd>Alt</kbd>+<kbd>D</kbd>): what the move changed, the opponent's plan move by move, and how to answer it.

Stockfish runs on your device. Every sentence comes from the engine's best line plus a board check for forks, hanging pieces, threats and material.

Install page: **https://gamernishant.github.io/chess-move-coach/**

## Fair play

Using an engine during a game against a person breaks chess.com's rules. The coach **pauses itself** while that kind of game is running, and on puzzles. It works in Analysis, in games against the computer, and on any game once it has ended.

## Install

**Userscript:** install Tampermonkey, then open
[chess-move-coach.user.js](https://gamernishant.github.io/chess-move-coach/chess-move-coach.user.js).

**Extension (Chrome / Edge / Brave):** download `chess-move-coach-extension.zip` from the
[latest release](https://github.com/GamerNishant/chess-move-coach/releases/latest), unzip it, open `chrome://extensions`, turn on Developer mode, then click **Load unpacked** and pick the folder. You can also load the `extension/` folder of this repo directly.

## Use

1. Open a finished game, the Analysis board, or a game vs the computer.
2. Step through the moves. The panel (bottom right) updates for each move.
3. <kbd>Alt</kbd>+<kbd>D</kbd> opens the deep dive. <kbd>Alt</kbd>+<kbd>M</kbd> hides or shows the panel. Drag the header to move it.
4. ⚙ Settings: engine strength (Fast / Balanced / Deep), open the deep dive automatically, explain opponent moves, and (userscript only) an online-engine fallback.

## Develop

```sh
npm test          # unit tests (board motifs, coach text, UCI client, SAN reader)
npm run build     # regenerate extension/ and userscript/ from src/
npm run icons     # redraw the PNG icons
npm run package   # build + dist/chess-move-coach-extension.zip
```

Edit code in `src/`, never the built files. See [DESIGN.md](DESIGN.md) and [FLOW.md](FLOW.md).

## License

MIT for this project's code. Bundled: [chess.js](https://github.com/jhlywa/chess.js) 0.13.4 (BSD-2-Clause) and
[Stockfish.js](https://github.com/nmrugg/stockfish.js) 10.0.2 (GPL-3.0; it runs as a separate engine process; source and license in `vendor/`).
Not affiliated with Chess.com.
