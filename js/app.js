/**
 * app.js — Main entry point for WSPeek
 *
 * Imports all Web Components and wires global state:
 * - Connection adapter (handles both WebSocket and Socket.IO)
 * - Event dispatching for inter-component communication
 * - Message forwarding from adapter to <wspeek-incoming>
 * - Message sending from <wspeek-outgoing> to adapter
 */

// Import Web Components
import './connection.js';
import './incoming.js';
import './outgoing.js';

// Global connection adapter
let adapter = null;

// Listen for connection events from <wspeek-connection>
document.addEventListener('wspeek:connected', ({ detail }) => {
  console.log('[WSPeek] Connected');
  adapter = detail.adapter;

  // Forward incoming messages to <wspeek-incoming>
  adapter.onMessage(({ eventName, rawData }) => {
    console.log('[WSPeek] Received:', { eventName, rawData });
    const customEvent = new CustomEvent('wspeek:message', {
      detail: { eventName, rawData },
      bubbles: true,
    });
    document.dispatchEvent(customEvent);
  });
});

// Listen for disconnection events
document.addEventListener('wspeek:disconnected', () => {
  console.log('[WSPeek] Disconnected');
  adapter = null;
});

// Listen for send events from <wspeek-outgoing> — sends to backend
document.addEventListener('wspeek:send', ({ detail }) => {
  if (adapter) {
    console.log('[WSPeek] Sending to backend:', detail);
    adapter.send(detail.eventName, detail.json);
  } else {
    console.warn('[WSPeek] Not connected');
  }
});

// Listen for resend events from <wspeek-incoming> — sends to frontend client (bridge mode)
document.addEventListener('wspeek:resend_to_frontend', ({ detail }) => {
  console.log('[WSPeek][2] wspeek:resend_to_frontend received, json:', String(detail.json).substring(0, 60));
  if (window.wspeekBridge) {
    window.wspeekBridge.sendToFrontend({ eventName: detail.eventName, data: detail.json })
      .then(result => {
        if (result.success) {
          console.log('[WSPeek][2] sendToFrontend IPC → success');
        } else {
          console.error('[WSPeek][2] sendToFrontend IPC → FAIL:', result.error);
        }
      })
      .catch(err => {
        console.error('[WSPeek][2] sendToFrontend IPC → exception:', err);
      });
  } else {
    console.error('[WSPeek][2] window.wspeekBridge not available');
  }
});

console.log('[WSPeek] App initialized');
