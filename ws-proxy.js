const { WebSocketServer, WebSocket } = require('ws');
const { Server: SocketIOServer } = require('socket.io');
const { io: ioClient } = require('socket.io-client');

function createProxy(emit) {
  let backendSocket = null;
  let backendMode = null; // 'native' or 'socketio'
  let bridgeServer = null;
  let bridgeClientSocket = null;
  let lastConnectOpts = null;
  let reconnectTimer = null;
  let intentionalDisconnect = false;

  function scheduleReconnect() {
    if (intentionalDisconnect) return;
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(async () => {
      if (intentionalDisconnect || !lastConnectOpts) return;
      console.log('[WSPeek] Auto-reconnecting to backend...');
      try {
        // Pass bridge=false to avoid recreating the bridge server (it's already running)
        const opts = { ...lastConnectOpts, bridge: false };
        if (opts.mode === 'socketio') {
          await connectSocketIOBackend(opts);
        } else {
          await connectWebSocketBackend(opts);
        }
      } catch {
        scheduleReconnect();
      }
    }, 2000);
  }

  return {
    async connect({ port, mode, bridge, bridgePort }) {
      console.log(`[WSPeek] Connect command: port=${port}, mode=${mode}, bridge=${bridge}`);

      intentionalDisconnect = false;
      clearTimeout(reconnectTimer);
      lastConnectOpts = { port, mode, bridge, bridgePort };

      // Close old connections if exist
      if (backendSocket) {
        backendSocket.close?.();
        backendSocket = null;
      }
      if (bridgeServer) {
        bridgeServer.close();
        bridgeServer = null;
      }
      bridgeClientSocket = null;

      try {
        if (mode === 'socketio') {
          await connectSocketIOBackend({ port, mode, bridge, bridgePort });
        } else {
          await connectWebSocketBackend({ port, mode, bridge, bridgePort });
        }
        return { success: true };
      } catch (err) {
        console.error('[WSPeek] Connection error:', err.message);
        emit('ws:error', { reason: err.message });
        return { success: false, error: err.message };
      }
    },

    async send({ eventName, data }) {
      const isConnected = backendMode === 'socketio'
        ? (backendSocket && backendSocket.connected)
        : (backendSocket && backendSocket.readyState === WebSocket.OPEN);

      if (!isConnected) {
        console.warn('[WSPeek] Backend not connected, cannot send');
        return { success: false, error: 'Backend not connected' };
      }

      try {
        console.log(`[WSPeek] Sending to backend: ${data.substring(0, 50)}...`);
        if (backendMode === 'socketio') {
          let payload;
          try { payload = JSON.parse(data); } catch { payload = data; }
          backendSocket.emit(eventName || 'message', payload);
        } else {
          backendSocket.send(data);
        }
        return { success: true };
      } catch (err) {
        console.error('[WSPeek] Send error:', err.message);
        return { success: false, error: err.message };
      }
    },

    async sendToFrontend({ eventName, data }) {
      console.log('[WSPeek][3] sendToFrontend called, data:', String(data).substring(0, 60));
      console.log('[WSPeek][3] bridgeClientSocket:', bridgeClientSocket ? 'exists' : 'NULL');

      if (!bridgeClientSocket) {
        console.error('[WSPeek][3] FAIL — bridgeClientSocket is null (frontend not connected or disconnected)');
        return { success: false, error: 'No frontend client connected' };
      }

      const isNativeWS = bridgeClientSocket.readyState !== undefined;
      const isOpen = isNativeWS
        ? bridgeClientSocket.readyState === WebSocket.OPEN
        : bridgeClientSocket.connected;

      console.log(`[WSPeek][3] socket type: ${isNativeWS ? 'native WS' : 'Socket.IO'}, isOpen: ${isOpen}`);
      if (isNativeWS) {
        console.log(`[WSPeek][3] readyState: ${bridgeClientSocket.readyState} (OPEN=${WebSocket.OPEN})`);
      }

      if (!isOpen) {
        console.error('[WSPeek][3] FAIL — socket exists but is not open');
        return { success: false, error: 'Frontend client socket not open' };
      }

      try {
        if (isNativeWS) {
          console.log('[WSPeek][3] Sending via native WS bridgeClientSocket.send()');
          bridgeClientSocket.send(data);
        } else {
          let payload;
          try { payload = JSON.parse(data); } catch { payload = data; }
          console.log('[WSPeek][3] Sending via Socket.IO bridgeClientSocket.emit("message")');
          bridgeClientSocket.emit(eventName || 'message', payload);
        }
        console.log('[WSPeek][3] OK — sent to frontend');
        return { success: true };
      } catch (err) {
        console.error('[WSPeek][3] FAIL — exception:', err.message);
        return { success: false, error: err.message };
      }
    },

    async disconnect() {
      console.log('[WSPeek] Disconnect command');
      intentionalDisconnect = true;
      clearTimeout(reconnectTimer);
      if (backendSocket) {
        backendSocket.close();
        backendSocket = null;
      }
      if (bridgeServer) {
        bridgeServer.close();
        bridgeServer = null;
      }
      bridgeClientSocket = null;
      return { success: true };
    }
  };

  // ============================================================================
  // Helper: Connect to WebSocket backend
  // ============================================================================

  function connectWebSocketBackend({ port, mode, bridge, bridgePort }) {
    return new Promise((resolve, reject) => {
      const backendUrl = `ws://localhost:${port}`;
      backendMode = 'native';
      backendSocket = new WebSocket(backendUrl);

      backendSocket.on('open', () => {
        console.log(`[WSPeek] ✓ Connected to backend at ${backendUrl}`);
        emit('ws:connected', { mode });
        emit('ws:backend_connected', { connected: true });
        resolve();
      });

      backendSocket.on('message', (data) => {
        console.log(`[WSPeek] → Browser: ${String(data).substring(0, 50)}...`);

        // Relay to browser (incoming panel)
        emit('ws:message', {
          eventName: null,
          rawData: String(data)
        });

        // In bridge mode: relay to frontend client
        if (bridgeClientSocket && bridgeClientSocket.readyState === WebSocket.OPEN) {
          console.log('[WSPeek] → Frontend: relaying');
          bridgeClientSocket.send(data);
        }
      });

      backendSocket.on('close', () => {
        console.log('[WSPeek] ✗ Backend disconnected');
        emit('ws:backend_connected', { connected: false });
        backendSocket = null;
        scheduleReconnect();
      });

      backendSocket.on('error', (err) => {
        console.error('[WSPeek] ✗ Backend error:', err.message);
        emit('ws:error', {
          reason: `Backend error: ${err.message}`
        });
        reject(err);
      });

      // ---- Bridge mode: open WebSocket server for frontend ----
      if (bridge) {
        console.log(`[WSPeek] Opening bridge server (WebSocket) on port ${bridgePort}`);
        bridgeServer = new WebSocketServer({ port: bridgePort });

        bridgeServer.on('connection', (frontendSocket) => {
          console.log('[WSPeek] ✓ Frontend connected to bridge');
          bridgeClientSocket = frontendSocket;
          emit('ws:frontend_connected', { connected: true });

          frontendSocket.on('message', (data) => {
            console.log(`[WSPeek] ← Frontend: ${String(data).substring(0, 50)}...`);

            emit('ws:client_message', {
              eventName: null,
              rawData: String(data)
            });

            if (backendSocket && backendSocket.readyState === WebSocket.OPEN) {
              console.log('[WSPeek] → Backend: relaying');
              backendSocket.send(data);
            } else {
              console.warn('[WSPeek] Backend not connected, cannot relay from frontend');
            }
          });

          frontendSocket.on('close', () => {
            console.log('[WSPeek] ✗ Frontend disconnected from bridge');
            bridgeClientSocket = null;
            emit('ws:frontend_connected', { connected: false });
          });

          frontendSocket.on('error', (err) => {
            console.error('[WSPeek] Frontend socket error:', err.message);
          });
        });

        bridgeServer.on('error', (err) => {
          console.error('[WSPeek] Bridge server error:', err.message);
          emit('ws:error', {
            reason: `Bridge server error: ${err.message}`
          });
        });
      }
    });
  }

  // ============================================================================
  // Helper: Connect to Socket.IO backend
  // ============================================================================

  function connectSocketIOBackend({ port, mode, bridge, bridgePort }) {
    return new Promise((resolve, reject) => {
      const backendUrl = `http://localhost:${port}`;
      backendMode = 'socketio';
      backendSocket = ioClient(backendUrl, { transports: ['websocket'] });

      backendSocket.on('connect', () => {
        console.log(`[WSPeek] ✓ Connected to backend at ${backendUrl} (Socket.IO)`);
        emit('ws:connected', { mode });
        emit('ws:backend_connected', { connected: true });
        resolve();
      });

      backendSocket.onAny((eventName, data) => {
        const rawData = data === undefined ? '' : (typeof data === 'string' ? data : JSON.stringify(data));
        console.log(`[WSPeek] → Browser: ${eventName} | ${rawData.substring(0, 50)}...`);

        // Relay to browser (incoming panel)
        emit('ws:message', {
          eventName: eventName,
          rawData: rawData
        });

        // In bridge mode: relay to frontend client
        if (bridgeClientSocket && bridgeClientSocket.connected) {
          console.log('[WSPeek] → Frontend: relaying');
          bridgeClientSocket.emit(eventName, data);
        }
      });

      backendSocket.on('disconnect', () => {
        console.log('[WSPeek] ✗ Backend disconnected');
        emit('ws:backend_connected', { connected: false });
        backendSocket = null;
        scheduleReconnect();
      });

      backendSocket.on('connect_error', (err) => {
        console.error('[WSPeek] ✗ Backend error:', err.message);
        emit('ws:error', {
          reason: `Backend error: ${err.message}`
        });
        reject(err);
      });

      // ---- Bridge mode: open Socket.IO server for frontend ----
      if (bridge) {
        console.log(`[WSPeek] Opening bridge server (Socket.IO) on port ${bridgePort}`);
        bridgeServer = new SocketIOServer(bridgePort, {
          transports: ['websocket']
        });

        bridgeServer.on('connection', (frontendSocket) => {
          console.log('[WSPeek] ✓ Frontend connected to bridge');
          bridgeClientSocket = frontendSocket;
          emit('ws:frontend_connected', { connected: true });

          // Forward all events from frontend to backend
          frontendSocket.onAny((eventName, data) => {
            const rawData = data === undefined ? '' : (typeof data === 'string' ? data : JSON.stringify(data));
            console.log(`[WSPeek] ← Frontend: ${eventName} | ${rawData.substring(0, 50)}...`);

            emit('ws:client_message', {
              eventName: eventName,
              rawData: rawData
            });

            if (backendSocket && backendSocket.connected) {
              console.log('[WSPeek] → Backend: relaying');
              backendSocket.emit(eventName, data);
            } else {
              console.warn('[WSPeek] Backend not connected, cannot relay from frontend');
            }
          });

          frontendSocket.on('disconnect', () => {
            console.log('[WSPeek] ✗ Frontend disconnected from bridge');
            bridgeClientSocket = null;
            emit('ws:frontend_connected', { connected: false });
          });

          frontendSocket.on('error', (err) => {
            console.error('[WSPeek] Frontend socket error:', err.message);
          });
        });

        bridgeServer.on('error', (err) => {
          console.error('[WSPeek] Bridge server error:', err.message);
          emit('ws:error', {
            reason: `Bridge server error: ${err.message}`
          });
        });
      }
    });
  }
}

module.exports = { createProxy };
