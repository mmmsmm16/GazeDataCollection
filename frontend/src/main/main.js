const { app, BrowserWindow, ipcMain, dialog, session, screen } = require('electron');
const path = require('path');
const fs = require('fs').promises;

let mainWindow;

// 画像セットを読み込む関数
async function loadImageSets(baseDir) {
  const imageSets = {};
  const entries = await fs.readdir(baseDir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const setPath = path.join(baseDir, entry.name);
      const images = await fs.readdir(setPath);
      imageSets[entry.name] = images
        .filter(file => ['.jpg', '.jpeg', '.png', '.gif'].includes(path.extname(file).toLowerCase()))
        .map(file => ({
          id: path.basename(file, path.extname(file)),
          src: `file://${path.join(setPath, file)}`,
          alt: path.basename(file, path.extname(file))
        }));
    }
  }
  
  return imageSets;
}

function selectDisplay() {
  const displays = screen.getAllDisplays();
  const options = displays.map((display, index) => ({
    label: `Display ${index + 1} (${display.size.width}x${display.size.height})`,
    value: index
  }));

  const selection = dialog.showMessageBoxSync({
    type: 'question',
    buttons: options.map(option => option.label),
    message: 'Select a display to use:',
    cancelId: 0 // デフォルトでプライマリディスプレイを使用
  });

  return displays[selection];
}

function createWindow() {
  console.log('Creating main window');

  const selectedDisplay = selectDisplay();
  const { width, height } = selectedDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    x: selectedDisplay.bounds.x,
    y: selectedDisplay.bounds.y,
    width: width,
    height: height,
    fullscreen: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // CSPの設定を更新してWebSocket接続を許可
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self';" +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval';" +
          "style-src 'self' 'unsafe-inline';" +
          "img-src 'self' data:;" +
          "connect-src 'self' ws: wss:;"  // WebSocket接続を許可
        ]
      }
    });
  });

  const indexPath = path.join(__dirname, '../../public/index.html');
  console.log('Loading index.html from:', indexPath);
  mainWindow.loadFile(indexPath);
  
  mainWindow.webContents.openDevTools();

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Main window loaded successfully');
    // ページ内のコンソールログをメインプロセスにも出力
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log('Renderer Log:', message);
    });
  });

  mainWindow.on('closed', () => {
    console.log('Main window closed');
    mainWindow = null;
  });
}

app.on('ready', () => {
  console.log('App is ready');
  createWindow();
});

app.on('window-all-closed', () => {
  console.log('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  console.log('App activated');
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('get-initial-save-directory', async () => {
  console.log('Getting initial save directory');
  const dataDir = path.join(app.getAppPath(), 'data');
  const sessionDir = path.join(dataDir, Date.now().toString());
  try {
    await fs.mkdir(sessionDir, { recursive: true });
    console.log('Created initial save directory:', sessionDir);
    return sessionDir;
  } catch (error) {
    console.error('Error creating initial save directory:', error);
    throw error;
  }
});

// データ保存場所を明示的に指定
const DATA_DIR = path.join(app.getAppPath(), 'data');

ipcMain.handle('create-session-folder', async (event, userType) => {
  try {
    const userTypeDir = path.join(DATA_DIR, userType);
    await fs.mkdir(userTypeDir, { recursive: true });

    const sessions = await fs.readdir(userTypeDir);
    const sessionNumbers = sessions
      .filter(name => /^\d+$/.test(name))
      .map(name => parseInt(name, 10));

    const newSessionId = sessionNumbers.length > 0 ? Math.max(...sessionNumbers) + 1 : 1;
    const sessionDir = path.join(userTypeDir, newSessionId.toString());
    
    await fs.mkdir(sessionDir);

    const infoFilePath = path.join(userTypeDir, 'sessions_info.txt');
    await fs.appendFile(infoFilePath, `SessionID: ${newSessionId}, Data Count: 0\n`);

    console.log('Created new session directory:', sessionDir);
    return { sessionId: newSessionId, directory: sessionDir, userType };
  } catch (error) {
    console.error('Error creating session folder:', error);
    throw error;
  }
});

// デバッグ用：アプリケーション起動時にデータディレクトリのパスをログ出力
console.log('Data directory path:', DATA_DIR);

ipcMain.handle('save-data', async (event, directory, filename, data) => {
  const filePath = path.join(directory, filename);
  await fs.writeFile(filePath, data);
  return { success: true, filePath };
});

ipcMain.handle('update-session-info', async (event, userType, sessionId, dataCount) => {
  try {
    const userTypeDir = path.join(DATA_DIR, userType);
    await fs.mkdir(userTypeDir, { recursive: true });
    const infoFilePath = path.join(userTypeDir, 'sessions_info.txt');
    
    let content = '';
    try {
      content = await fs.readFile(infoFilePath, 'utf-8');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // ファイルが存在しない場合は、新しく作成します
    }

    const lines = content.split('\n');
    const updatedLines = lines.map(line => {
      if (line.startsWith(`SessionID: ${sessionId},`)) {
        return `SessionID: ${sessionId}, Data Count: ${dataCount}`;
      }
      return line;
    });

    if (!updatedLines.some(line => line.startsWith(`SessionID: ${sessionId},`))) {
      updatedLines.push(`SessionID: ${sessionId}, Data Count: ${dataCount}`);
    }

    await fs.writeFile(infoFilePath, updatedLines.join('\n'));
    console.log(`Updated session info for ${userType} session ${sessionId}`);
  } catch (error) {
    console.error('Error updating session info:', error);
    throw error;
  }
});

// IPC handler to load image sets
ipcMain.handle('load-image-sets', async (event) => {
  const baseDir = path.join(app.getAppPath(), 'image_sets');
  try {
    const imageSets = await loadImageSets(baseDir);
    return imageSets;
  } catch (error) {
    console.error('Error loading image sets:', error);
    throw error;
  }
});

// アプリケーションの詳細情報をログに出力
console.log('Application Details:');
console.log('  App Name:', app.getName());
console.log('  App Version:', app.getVersion());
console.log('  Electron Version:', process.versions.electron);
console.log('  Chrome Version:', process.versions.chrome);
console.log('  Node Version:', process.versions.node);
console.log('  App Path:', app.getAppPath());
