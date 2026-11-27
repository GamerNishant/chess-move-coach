/* Background service worker: relays engine requests from chess.com tabs to the
 * offscreen document (a service worker cannot start the engine's Web Worker). */
let creating = null;

async function ensureOffscreen() {
  if (await chrome.offscreen.hasDocument()) return;
  if (!creating) {
    creating = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['WORKERS'],
      justification: 'Runs the Stockfish chess engine in a Web Worker to analyze moves on-device.',
    }).finally(() => { creating = null; });
  }
  await creating;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.target === 'offscreen') return;
  if (msg.type !== 'cmc:analyze' && msg.type !== 'cmc:cancel') return;
  const owner = (sender.tab ? sender.tab.id : 'x') + ':' + msg.owner;
  ensureOffscreen()
    .then(() => chrome.runtime.sendMessage({ ...msg, owner, target: 'offscreen' }))
    .then(sendResponse, (e) => sendResponse({ error: String((e && e.message) || e), engineUnavailable: true }));
  return true; // async response
});
