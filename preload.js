const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wspeekBridge', {
  // Invoke handlers (send + wait for response)
  connect: (opts) => ipcRenderer.invoke('ws:connect', opts),
  send: (opts) => ipcRenderer.invoke('ws:send', opts),
  disconnect: () => ipcRenderer.invoke('ws:disconnect'),

  // Event listeners (receive push messages from main process)
  onMessage: (callback) => ipcRenderer.on('ws:message', (e, data) => callback(data)),
  onConnected: (callback) => ipcRenderer.on('ws:connected', (e, data) => callback(data)),
  onDisconnected: (callback) => ipcRenderer.on('ws:disconnected', () => callback()),
  onBackendConnected: (callback) => ipcRenderer.on('ws:backend_connected', (e, data) => callback(data)),
  onFrontendConnected: (callback) => ipcRenderer.on('ws:frontend_connected', (e, data) => callback(data)),
  onClientMessage: (callback) => ipcRenderer.on('ws:client_message', (e, data) => callback(data)),
  onError: (callback) => ipcRenderer.on('ws:error', (e, data) => callback(data))
});
