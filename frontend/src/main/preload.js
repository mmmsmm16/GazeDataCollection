const { ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
  console.log('DOM fully loaded and parsed');
  
  for (const dependency of ['chrome', 'node', 'electron']) {
    console.log(`${dependency}-version`, process.versions[dependency]);
  }
});

// ipcRenderer のメソッドをグローバルに公開
window.ipcRenderer = ipcRenderer;

console.log('Preload script has been loaded');
