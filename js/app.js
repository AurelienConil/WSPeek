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

// Listen for send events from <wspeek-outgoing>
document.addEventListener('wspeek:send', ({ detail }) => {
  if (adapter) {
    console.log('[WSPeek] Sending:', detail);
    adapter.send(detail.eventName, detail.json);
  } else {
    console.warn('[WSPeek] Not connected');
  }
});

console.log('[WSPeek] App initialized');
