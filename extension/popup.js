document.getElementById('open').addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://www.chess.com/analysis' });
  window.close();
});
