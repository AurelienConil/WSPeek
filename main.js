const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { createProxy } = require('./ws-proxy');

let mainWindow;
let proxy;

// ============================================================================
// Create and configure main window
// ============================================================================

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ============================================================================
// App lifecycle
// ============================================================================

app.on('ready', () => {
  createWindow();
  proxy = createProxy((channel, data) => {
    if (mainWindow) {
      mainWindow.webContents.send(channel, data);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// ============================================================================
// IPC Handlers — delegate to proxy
// ============================================================================

ipcMain.handle('ws:connect', (_, opts) => proxy.connect(opts));
ipcMain.handle('ws:send', (_, opts) => proxy.send(opts));
ipcMain.handle('ws:disconnect', () => proxy.disconnect());
