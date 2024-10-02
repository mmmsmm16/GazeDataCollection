const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;

let mainWindow;

// グローバルエラーハンドリング
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  dialog.showErrorBox('Uncaught Exception', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  dialog.showErrorBox('Unhandled Rejection', reason.message || 'Unknown reason');
});

function createWindow() {
  console.log('Creating main window');
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 1300,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const indexPath = path.join(__dirname, '../../public/index.html');
  console.log('Loading index.html from:', indexPath);
  mainWindow.loadFile(indexPath);
  mainWindow.webContents.openDevTools();

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Main window loaded successfully');
  });

  mainWindow.on('closed', () => {
    console.log('Main window closed');
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  console.log('App is ready, creating window');
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

ipcMain.handle('create-session-folder', async (event, directory) => {
  console.log('Creating session folder in:', directory);
  const sessionFolder = path.join(directory, Date.now().toString());
  try {
    await fs.mkdir(sessionFolder, { recursive: true });
    console.log('Created session folder:', sessionFolder);
    return sessionFolder;
  } catch (error) {
    console.error('Error creating session folder:', error);
    throw error;
  }
});

ipcMain.handle('select-directory', async () => {
  console.log('Opening directory selection dialog');
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    if (result.canceled) {
      console.log('Directory selection canceled');
      return null;
    } else {
      console.log('Selected directory:', result.filePaths[0]);
      return result.filePaths[0];
    }
  } catch (error) {
    console.error('Error in directory selection:', error);
    throw error;
  }
});

ipcMain.handle('save-data', async (event, folder, filename, data) => {
  console.log('Saving data to file:', path.join(folder, filename));
  const filePath = path.join(folder, filename);
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    console.log('Data saved successfully');
    return { success: true, filePath };
  } catch (error) {
    console.error('Error saving data:', error);
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
