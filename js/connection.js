/**
 * <wspeek-connection> Web Component
 *
 * Manages WebSocket connection lifecycle. Fires custom events:
 * - wspeek:connected -> { ws: WebSocket }
 * - wspeek:disconnected
 *
 * Reads/writes port to localStorage('wspeek-port') and auto-connects on startup.
 */

class WSPeekConnection extends HTMLElement {
  constructor() {
    super();
    this.ws = null;
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
    this.loadStoredPort();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          border-bottom: 1px solid #3c3c3c;
        }

        .connection-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 12px;
          background-color: #252526;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
          font-size: 12px;
          flex-wrap: wrap;
        }

        input[type="number"],
        input[type="text"] {
          padding: 4px 8px;
          background-color: #2d2d30;
          border: 1px solid #3c3c3c;
          color: #d4d4d4;
          border-radius: 3px;
          font-family: inherit;
          font-size: 11px;
          width: 80px;
        }

        input[type="number"]:focus,
        input[type="text"]:focus {
          outline: none;
          border-color: #0e639c;
          background-color: #1e1e1e;
        }

        button {
          padding: 4px 12px;
          background-color: #0e639c;
          color: white;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          font-family: inherit;
          font-size: 11px;
          transition: background-color 0.2s;
        }

        button:hover {
          background-color: #1177bb;
        }

        button:active {
          background-color: #0d5a8a;
        }

        button:disabled {
          background-color: #555;
          cursor: not-allowed;
          opacity: 0.6;
        }

        .mode-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #858585;
          font-size: 11px;
          cursor: pointer;
          user-select: none;
        }

        input[type="checkbox"] {
          cursor: pointer;
          width: auto;
        }

        .bridge-controls {
          display: none;
          align-items: center;
          gap: 8px;
        }

        .bridge-controls.visible {
          display: flex;
        }

        #bridge-port-input {
          width: 100px;
        }

        .status {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-left: auto;
        }

        .status-item {
          display: flex;
          align-items: center;
          gap: 6px;
          padding-left: 12px;
          border-left: 1px solid #3c3c3c;
        }

        .status-item:first-child {
          padding-left: 0;
          border-left: none;
        }

        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: #f48771;
          transition: background-color 0.2s;
        }

        .dot.green {
          background-color: #4ec9b0;
        }

        .dot.orange {
          background-color: #dcdcaa;
        }

        .dot.red {
          background-color: #f48771;
        }

        #status-text {
          font-size: 11px;
          color: #858585;
        }
      </style>

      <div class="connection-bar">
        <input id="port-input" type="number" placeholder="Backend Port" min="1" max="65535">
        <label class="mode-toggle">
          <input type="checkbox" id="socketio-mode">
          Socket.IO
        </label>
        <label class="mode-toggle">
          <input type="checkbox" id="bridge-mode">
          Bridge
        </label>
        <div id="bridge-controls" class="bridge-controls">
          <label class="mode-toggle" style="margin: 0;">Bridge Port:</label>
          <input id="bridge-port-input" type="number" placeholder="3457" min="1" max="65535">
        </div>
        <button id="btn-connect">Connect</button>
        <div class="status">
          <div class="status-item" id="server-status">
            <span class="dot red" id="server-dot"></span>
            <span id="server-text">Server: Offline</span>
          </div>
          <div class="status-item" id="backend-status">
            <span class="dot red" id="backend-dot"></span>
            <span id="backend-text">Backend: Offline</span>
          </div>
          <div class="status-item" id="frontend-status" style="display: none;">
            <span class="dot red" id="frontend-dot"></span>
            <span id="frontend-text">Frontend: Offline</span>
          </div>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    const portInput = this.shadowRoot.getElementById('port-input');
    const btnConnect = this.shadowRoot.getElementById('btn-connect');
    const socketioCheckbox = this.shadowRoot.getElementById('socketio-mode');
    const bridgeCheckbox = this.shadowRoot.getElementById('bridge-mode');
    const bridgePortInput = this.shadowRoot.getElementById('bridge-port-input');
    const bridgeControls = this.shadowRoot.getElementById('bridge-controls');

    portInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.toggleConnection();
      }
    });

    bridgePortInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.toggleConnection();
      }
    });

    btnConnect.addEventListener('click', () => this.toggleConnection());

    socketioCheckbox.addEventListener('change', () => {
      localStorage.setItem(
        'wspeek-connection-type',
        socketioCheckbox.checked ? 'socketio' : 'native'
      );
    });

    bridgeCheckbox.addEventListener('change', () => {
      bridgeControls.classList.toggle('visible');
      localStorage.setItem('wspeek-bridge-enabled', bridgeCheckbox.checked);
    });

    bridgePortInput.addEventListener('change', () => {
      localStorage.setItem('wspeek-bridge-port', bridgePortInput.value);
    });

    // Backend status
    document.addEventListener('wspeek:backend_status', ({ detail }) => {
      const backendStatus = this.shadowRoot.getElementById('backend-status');
      const backendDot = this.shadowRoot.getElementById('backend-dot');
      const backendText = this.shadowRoot.getElementById('backend-text');

      if (detail.connected) {
        backendDot.classList.remove('red', 'orange');
        backendDot.classList.add('green');
        backendText.textContent = 'Backend: Connected';
        backendStatus.style.display = 'flex';
      } else {
        backendDot.classList.remove('green', 'orange');
        backendDot.classList.add('red');
        backendText.textContent = 'Backend: Offline';
        backendStatus.style.display = 'flex';
      }
    });

    // Bridge frontend status
    document.addEventListener('wspeek:bridge_frontend_status', ({ detail }) => {
      const frontendStatus = this.shadowRoot.getElementById('frontend-status');
      const frontendDot = this.shadowRoot.getElementById('frontend-dot');
      const frontendText = this.shadowRoot.getElementById('frontend-text');

      if (detail.connected) {
        frontendDot.classList.remove('red', 'orange');
        frontendDot.classList.add('green');
        frontendText.textContent = 'Frontend: Connected';
      } else {
        frontendDot.classList.remove('green', 'orange');
        frontendDot.classList.add('red');
        frontendText.textContent = 'Frontend: Offline';
      }
    });
  }

  loadStoredPort() {
    const storedPort = localStorage.getItem('wspeek-port');
    const storedMode = localStorage.getItem('wspeek-connection-type');
    const storedBridgeEnabled = localStorage.getItem('wspeek-bridge-enabled') === 'true';
    const storedBridgePort = localStorage.getItem('wspeek-bridge-port');

    if (storedPort) {
      const portInput = this.shadowRoot.getElementById('port-input');
      portInput.value = storedPort;
    }

    if (storedMode === 'socketio') {
      const socketioCheckbox = this.shadowRoot.getElementById('socketio-mode');
      socketioCheckbox.checked = true;
    }

    if (storedBridgeEnabled) {
      const bridgeCheckbox = this.shadowRoot.getElementById('bridge-mode');
      const bridgeControls = this.shadowRoot.getElementById('bridge-controls');
      const bridgePortInput = this.shadowRoot.getElementById('bridge-port-input');
      bridgeCheckbox.checked = true;
      bridgeControls.classList.add('visible');
      if (storedBridgePort) {
        bridgePortInput.value = storedBridgePort;
      }
    }

    if (storedPort) {
      this.connect(storedPort);
    }
  }

  toggleConnection() {
    if (this.ws) {
      this.disconnect();
    } else {
      const portInput = this.shadowRoot.getElementById('port-input');
      const port = portInput.value.trim();
      if (port) {
        this.connect(port);
      }
    }
  }

  connect(port) {
    if (this.ws) {
      this.ws.close?.();
      this.ws = null;
    }

    this.updateStatus('connecting');
    const isSocketIO = this.shadowRoot.getElementById('socketio-mode').checked;
    const isBridge = this.shadowRoot.getElementById('bridge-mode').checked;
    const bridgePort = this.shadowRoot.getElementById('bridge-port-input').value;

    // Save settings
    localStorage.setItem('wspeek-port', port);
    localStorage.setItem('wspeek-connection-type', isSocketIO ? 'socketio' : 'native');
    localStorage.setItem('wspeek-bridge-enabled', isBridge);
    if (bridgePort) localStorage.setItem('wspeek-bridge-port', bridgePort);

    // Socket.IO standalone (not bridge) connects directly
    // Bridge mode only supports WebSocket native for now
    if (isSocketIO && !isBridge) {
      this._connectSocketIO(port);
    } else {
      // WebSocket or bridge mode: use server via control channel
      this._connectViaServer(port, isSocketIO, isBridge, bridgePort);
    }
  }

  _connectNative(port) {
    const url = `ws://localhost:${port}`;

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log(`[WSPeek] Connected to ${url} (native WebSocket)`);
        this.updateStatus('connected');
        this.ws = ws;

        // Fire connected event with adapter
        this._fireConnected({
          send: (eventName, data) => ws.send(data),
          onMessage: (cb) => {
            ws.onmessage = (e) => cb({ eventName: null, rawData: e.data });
          },
          close: () => ws.close(),
        }, 'native', false);
      };

      ws.onerror = (err) => {
        console.error('[WSPeek] WebSocket error:', err);
        this.updateStatus('disconnected');
      };

      ws.onclose = () => {
        console.log('[WSPeek] Connection closed');
        this.updateStatus('disconnected');
        this._fireDisconnected();
      };
    } catch (err) {
      console.error('[WSPeek] Connection error:', err);
      this.updateStatus('disconnected');
    }
  }

  _connectViaServer(port, isSocketIO, isBridge, bridgePort) {
    const controlUrl = 'ws://localhost:3099/ws';

    try {
      const control = new WebSocket(controlUrl);
      this.ws = control;

      control.onopen = () => {
        console.log('[WSPeek] Connected to control channel');
        const cmd = {
          cmd: 'connect',
          port: parseInt(port),
          mode: isSocketIO ? 'socketio' : 'native',
          bridge: isBridge,
          bridgePort: isBridge ? parseInt(bridgePort) : null
        };
        control.send(JSON.stringify(cmd));
      };

      control.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);

          if (msg.type === 'connected') {
            console.log('[WSPeek] Server confirmed connection');
            this.updateStatus('connected');

            // Show/hide status items based on mode
            const backendStatus = this.shadowRoot.getElementById('backend-status');
            const frontendStatus = this.shadowRoot.getElementById('frontend-status');

            // Always show backend status when connected
            backendStatus.style.display = 'flex';

            // Show frontend status only in bridge mode
            if (isBridge) {
              frontendStatus.style.display = 'flex';
            } else {
              frontendStatus.style.display = 'none';
            }

            this._fireConnected({
              send: (eventName, data) => {
                if (control.readyState === WebSocket.OPEN) {
                  control.send(JSON.stringify({
                    cmd: 'send',
                    eventName,
                    data
                  }));
                }
              },
              onMessage: (cb) => {
                this._onMessageCb = cb;
              },
              close: () => {
                if (control.readyState === WebSocket.OPEN) {
                  control.send(JSON.stringify({ cmd: 'disconnect' }));
                  control.close();
                }
              }
            }, msg.mode, isBridge);
          }

          if (msg.type === 'backend_connected') {
            console.log('[WSPeek] Backend connected');
            document.dispatchEvent(new CustomEvent('wspeek:backend_status', {
              detail: { connected: true },
              bubbles: true
            }));
          }

          if (msg.type === 'backend_disconnected') {
            console.log('[WSPeek] Backend disconnected');
            document.dispatchEvent(new CustomEvent('wspeek:backend_status', {
              detail: { connected: false },
              bubbles: true
            }));
          }

          if (msg.type === 'message') {
            // Backend message
            this._onMessageCb?.({
              eventName: msg.eventName,
              rawData: msg.rawData
            });
          }

          if (msg.type === 'client_message') {
            // Message from frontend in bridge mode
            // Dispatch to outgoing component
            document.dispatchEvent(new CustomEvent('wspeek:client_message', {
              detail: {
                eventName: msg.eventName,
                rawData: msg.rawData
              },
              bubbles: true
            }));
          }

          if (msg.type === 'bridge_frontend_connected') {
            console.log('[WSPeek] Frontend client connected to bridge');
            document.dispatchEvent(new CustomEvent('wspeek:bridge_frontend_status', {
              detail: { connected: true },
              bubbles: true
            }));
          }

          if (msg.type === 'bridge_frontend_disconnected') {
            console.log('[WSPeek] Frontend client disconnected from bridge');
            document.dispatchEvent(new CustomEvent('wspeek:bridge_frontend_status', {
              detail: { connected: false },
              bubbles: true
            }));
          }

          if (msg.type === 'disconnected') {
            console.log('[WSPeek] Server disconnected');
            this.updateStatus('disconnected');
            this._fireDisconnected();
          }

          if (msg.type === 'error') {
            console.error('[WSPeek] Server error:', msg.reason);
            this.updateStatus('disconnected');
          }
        } catch (err) {
          console.error('[WSPeek] Message parse error:', err);
        }
      };

      control.onerror = (err) => {
        console.error('[WSPeek] Control channel error:', err);
        this.updateStatus('disconnected');
      };

      control.onclose = () => {
        console.log('[WSPeek] Control channel closed');
        this.updateStatus('disconnected');
        this._fireDisconnected();
      };
    } catch (err) {
      console.error('[WSPeek] Connection error:', err);
      this.updateStatus('disconnected');
    }
  }

  async _connectSocketIO(port) {
    try {
      // Load Socket.IO client library if not already present
      if (!window.io) {
        await this._loadScript('https://cdn.socket.io/4.7.5/socket.io.min.js');
      }

      const url = `http://localhost:${port}`;
      const socket = window.io(url, { transports: ['websocket'] });

      socket.on('connect', () => {
        console.log(`[WSPeek] Connected to ${url} (Socket.IO)`);
        this.updateStatus('connected');
        this.ws = socket;

        // Fire connected event with adapter
        this._fireConnected({
          send: (eventName, data) => socket.emit(eventName, data),
          onMessage: (cb) => {
            socket.onAny((eventName, data) => {
              const rawData = typeof data === 'string' ? data : JSON.stringify(data);
              cb({ eventName, rawData });
            });
          },
          close: () => socket.disconnect(),
        }, 'socketio', false);
      });

      socket.on('connect_error', (err) => {
        console.error('[WSPeek] Socket.IO connection error:', err);
        this.updateStatus('disconnected');
      });

      socket.on('disconnect', () => {
        console.log('[WSPeek] Socket.IO connection closed');
        this.updateStatus('disconnected');
        this._fireDisconnected();
      });
    } catch (err) {
      console.error('[WSPeek] Socket.IO connection error:', err);
      this.updateStatus('disconnected');
    }
  }

  _loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.head.appendChild(script);
    });
  }

  _fireConnected(adapter, mode, isBridgeMode = false) {
    const event = new CustomEvent('wspeek:connected', {
      detail: { adapter, mode, isBridgeMode },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  _fireDisconnected() {
    const event = new CustomEvent('wspeek:disconnected', {
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close?.();
      this.ws = null;
    }
    this.updateStatus('disconnected');
  }

  updateStatus(state) {
    const dot = this.shadowRoot.getElementById('server-dot');
    const text = this.shadowRoot.getElementById('server-text');
    const btn = this.shadowRoot.getElementById('btn-connect');

    dot.classList.remove('green', 'orange', 'red');

    switch (state) {
      case 'connecting':
        dot.classList.add('orange');
        text.textContent = 'Server: Connecting…';
        btn.textContent = 'Disconnect';
        btn.disabled = false;
        break;
      case 'connected':
        dot.classList.add('green');
        text.textContent = 'Server: Connected';
        btn.textContent = 'Disconnect';
        btn.disabled = false;
        break;
      case 'disconnected':
      default:
        dot.classList.add('red');
        text.textContent = 'Server: Offline';
        btn.textContent = 'Connect';
        btn.disabled = false;
        break;
    }
  }
}

customElements.define('wspeek-connection', WSPeekConnection);
