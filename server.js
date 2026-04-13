/**
 * WSPeek Server
 *
 * Serves static files (HTML/CSS/JS) on HTTP port 3000
 * Provides WebSocket control channel on port 3099 for browser ↔ server communication
 * Manages bridge mode: relays messages between backend, browser, and frontend
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');
const { Server: SocketIOServer } = require('socket.io');
const { io: ioClient } = require('socket.io-client');

// ============================================================================
// HTTP Server — serve static files
// ============================================================================

const httpServer = http.createServer((req, res) => {
  // Serve index.html for root, otherwise serve the requested file
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    // Determine content type
    const ext = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
    };

    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
    res.end(data);
  });
});

// ============================================================================
// WebSocket Control Server (port 3099, path /ws)
// Handles communication between browser and server
// ============================================================================

const controlWss = new WebSocketServer({ server: httpServer, path: '/ws' });

controlWss.on('connection', (browserSocket) => {
  console.log('[WSPeek] Browser connected to control channel');

  let backendSocket = null;
  let backendMode = null; // 'native' or 'socketio'
  let bridgeServer = null;
  let bridgeClientSocket = null;

  browserSocket.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);

      // ---- CONNECT command ----
      if (msg.cmd === 'connect') {
        console.log(`[WSPeek] Connect command: port=${msg.port}, mode=${msg.mode}, bridge=${msg.bridge}`);

        // Close old backend connection if exists
        if (backendSocket) {
          backendSocket.close?.();
          backendSocket = null;
        }
        if (bridgeServer) {
          bridgeServer.close();
          bridgeServer = null;
        }
        bridgeClientSocket = null;

        // ---- Connect to backend (WebSocket native or Socket.IO) ----
        if (msg.mode === 'socketio') {
          connectSocketIOBackend(msg, browserSocket);
        } else {
          connectWebSocketBackend(msg, browserSocket);
        }

        // Helper function for WebSocket native backend
        function connectWebSocketBackend(msg, browserSocket) {
          const backendUrl = `ws://localhost:${msg.port}`;
          backendMode = 'native';
          backendSocket = new WebSocket(backendUrl);

          backendSocket.on('open', () => {
            console.log(`[WSPeek] ✓ Connected to backend at ${backendUrl}`);
            browserSocket.send(JSON.stringify({
              type: 'connected',
              mode: msg.mode
            }));
            browserSocket.send(JSON.stringify({
              type: 'backend_connected'
            }));
          });

          backendSocket.on('message', (data) => {
            console.log(`[WSPeek] → Browser: ${String(data).substring(0, 50)}...`);

            // Relay to browser (incoming panel)
            browserSocket.send(JSON.stringify({
              type: 'message',
              eventName: null,
              rawData: String(data)
            }));

            // In bridge mode: relay to frontend client
            if (bridgeClientSocket && bridgeClientSocket.readyState === WebSocket.OPEN) {
              console.log('[WSPeek] → Frontend: relaying');
              bridgeClientSocket.send(data);
            }
          });

          backendSocket.on('close', () => {
            console.log('[WSPeek] ✗ Backend disconnected');
            browserSocket.send(JSON.stringify({ type: 'backend_disconnected' }));
            backendSocket = null;
          });

          backendSocket.on('error', (err) => {
            console.error('[WSPeek] ✗ Backend error:', err.message);
            browserSocket.send(JSON.stringify({
              type: 'error',
              reason: `Backend error: ${err.message}`
            }));
          });

          // ---- Bridge mode: open WebSocket server for frontend ----
          if (msg.bridge) {
            console.log(`[WSPeek] Opening bridge server (WebSocket) on port ${msg.bridgePort}`);
            bridgeServer = new WebSocketServer({ port: msg.bridgePort });

            bridgeServer.on('connection', (frontendSocket) => {
              console.log('[WSPeek] ✓ Frontend connected to bridge');
              bridgeClientSocket = frontendSocket;

              browserSocket.send(JSON.stringify({
                type: 'bridge_frontend_connected'
              }));

              frontendSocket.on('message', (data) => {
                console.log(`[WSPeek] ← Frontend: ${String(data).substring(0, 50)}...`);

                browserSocket.send(JSON.stringify({
                  type: 'client_message',
                  eventName: null,
                  rawData: String(data)
                }));

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
                browserSocket.send(JSON.stringify({
                  type: 'bridge_frontend_disconnected'
                }));
              });

              frontendSocket.on('error', (err) => {
                console.error('[WSPeek] Frontend socket error:', err.message);
              });
            });

            bridgeServer.on('error', (err) => {
              console.error('[WSPeek] Bridge server error:', err.message);
              browserSocket.send(JSON.stringify({
                type: 'error',
                reason: `Bridge server error: ${err.message}`
              }));
            });
          }
        }

        // Helper function for Socket.IO backend
        function connectSocketIOBackend(msg, browserSocket) {
          const backendUrl = `http://localhost:${msg.port}`;
          backendMode = 'socketio';
          backendSocket = ioClient(backendUrl, { transports: ['websocket'] });

          backendSocket.on('connect', () => {
            console.log(`[WSPeek] ✓ Connected to backend at ${backendUrl} (Socket.IO)`);
            browserSocket.send(JSON.stringify({
              type: 'connected',
              mode: msg.mode
            }));
            browserSocket.send(JSON.stringify({
              type: 'backend_connected'
            }));
          });

          backendSocket.onAny((eventName, data) => {
            const rawData = data === undefined ? '' : (typeof data === 'string' ? data : JSON.stringify(data));
            console.log(`[WSPeek] → Browser: ${eventName} | ${rawData.substring(0, 50)}...`);

            // Relay to browser (incoming panel)
            browserSocket.send(JSON.stringify({
              type: 'message',
              eventName: eventName,
              rawData: rawData
            }));

            // In bridge mode: relay to frontend client
            if (bridgeClientSocket && bridgeClientSocket.connected) {
              console.log('[WSPeek] → Frontend: relaying');
              bridgeClientSocket.emit(eventName, data);
            }
          });

          backendSocket.on('disconnect', () => {
            console.log('[WSPeek] ✗ Backend disconnected');
            browserSocket.send(JSON.stringify({ type: 'backend_disconnected' }));
            backendSocket = null;
          });

          backendSocket.on('connect_error', (err) => {
            console.error('[WSPeek] ✗ Backend error:', err.message);
            browserSocket.send(JSON.stringify({
              type: 'error',
              reason: `Backend error: ${err.message}`
            }));
          });

          // ---- Bridge mode: open Socket.IO server for frontend ----
          if (msg.bridge) {
            console.log(`[WSPeek] Opening bridge server (Socket.IO) on port ${msg.bridgePort}`);
            bridgeServer = new SocketIOServer(msg.bridgePort, {
              transports: ['websocket']
            });

            bridgeServer.on('connection', (frontendSocket) => {
              console.log('[WSPeek] ✓ Frontend connected to bridge');
              bridgeClientSocket = frontendSocket;

              browserSocket.send(JSON.stringify({
                type: 'bridge_frontend_connected'
              }));

              // Forward all events from frontend to backend
              frontendSocket.onAny((eventName, data) => {
                const rawData = data === undefined ? '' : (typeof data === 'string' ? data : JSON.stringify(data));
                console.log(`[WSPeek] ← Frontend: ${eventName} | ${rawData.substring(0, 50)}...`);

                browserSocket.send(JSON.stringify({
                  type: 'client_message',
                  eventName: eventName,
                  rawData: rawData
                }));

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
                browserSocket.send(JSON.stringify({
                  type: 'bridge_frontend_disconnected'
                }));
              });

              frontendSocket.on('error', (err) => {
                console.error('[WSPeek] Frontend socket error:', err.message);
              });
            });

            bridgeServer.on('error', (err) => {
              console.error('[WSPeek] Bridge server error:', err.message);
              browserSocket.send(JSON.stringify({
                type: 'error',
                reason: `Bridge server error: ${err.message}`
              }));
            });
          }
        }
      }

      // ---- SEND command ----
      if (msg.cmd === 'send') {
        const isConnected = backendMode === 'socketio'
          ? (backendSocket && backendSocket.connected)
          : (backendSocket && backendSocket.readyState === WebSocket.OPEN);

        if (isConnected) {
          console.log(`[WSPeek] Sending to backend: ${msg.data.substring(0, 50)}...`);
          if (backendMode === 'socketio') {
            backendSocket.emit(msg.eventName || 'message', JSON.parse(msg.data));
          } else {
            backendSocket.send(msg.data);
          }
        } else {
          console.warn('[WSPeek] Backend not connected, cannot send');
        }
      }

      // ---- DISCONNECT command ----
      if (msg.cmd === 'disconnect') {
        console.log('[WSPeek] Disconnect command');
        if (backendSocket) {
          backendSocket.close();
          backendSocket = null;
        }
        if (bridgeServer) {
          bridgeServer.close();
          bridgeServer = null;
        }
        bridgeClientSocket = null;
      }
    } catch (err) {
      console.error('[WSPeek] Message parse error:', err.message);
      browserSocket.send(JSON.stringify({
        type: 'error',
        reason: `Parse error: ${err.message}`
      }));
    }
  });

  browserSocket.on('close', () => {
    console.log('[WSPeek] Browser disconnected');
    if (backendSocket) backendSocket.close();
    if (bridgeServer) bridgeServer.close();
  });

  browserSocket.on('error', (err) => {
    console.error('[WSPeek] Browser socket error:', err.message);
  });
});

// ============================================================================
// Start servers
// ============================================================================

httpServer.listen(3099, () => {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  WSPeek Server');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  HTTP Server:      http://localhost:3099');
  console.log('  Control WS:       ws://localhost:3099/ws');
  console.log('═══════════════════════════════════════════════════════\n');
});

controlWss.on('error', (err) => {
  console.error('[WSPeek] Control WS server error:', err.message);
});
