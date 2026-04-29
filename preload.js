const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wspeekBridge', {
  // Invoke handlers (send + wait for response)
  connect: (opts) => ipcRenderer.invoke('ws:connect', opts),
  send: (opts) => ipcRenderer.invoke('ws:send', opts),
  disconnect: () => ipcRenderer.invoke('ws:disconnect'),

  // Event listeners (receive push messages from main process)
  // Each call replaces the previous listener for that channel (removeAllListeners first)
  onMessage: (callback) => {
    ipcRenderer.removeAllListeners('ws:message');
    ipcRenderer.on('ws:message', (e, data) => callback(data));
  },
  onConnected: (callback) => {
    ipcRenderer.removeAllListeners('ws:connected');
    ipcRenderer.on('ws:connected', (e, data) => callback(data));
  },
  onDisconnected: (callback) => {
    ipcRenderer.removeAllListeners('ws:disconnected');
    ipcRenderer.on('ws:disconnected', () => callback());
  },
  onBackendConnected: (callback) => {
    ipcRenderer.removeAllListeners('ws:backend_connected');
    ipcRenderer.on('ws:backend_connected', (e, data) => callback(data));
  },
  onFrontendConnected: (callback) => {
    ipcRenderer.removeAllListeners('ws:frontend_connected');
    ipcRenderer.on('ws:frontend_connected', (e, data) => callback(data));
  },
  onClientMessage: (callback) => {
    ipcRenderer.removeAllListeners('ws:client_message');
    ipcRenderer.on('ws:client_message', (e, data) => callback(data));
  },
  onError: (callback) => {
    ipcRenderer.removeAllListeners('ws:error');
    ipcRenderer.on('ws:error', (e, data) => callback(data));
  }
});
