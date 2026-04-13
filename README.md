

# Spec

# WSPeek — Spec

## Context

WSPeek is a generic WebSocket debugging tool. It allows sending and receiving WebSocket messages, with a clean interface to inspect payloads and manage reusable messages.

Single autonomous HTML file (inline styles and scripts). No framework, no bundler, no Node.js. Vanilla JS only. Designed for desktop use in Chromium-based browsers, minimum width 1024px.

---

## General layout

The page is split into two equal-width columns:
- Left column: incoming messages (reception)
- Right column: outgoing messages (emission)

A connection bar spans the full width at the top of the page.

---

## 1. Connection bar (full width, top of page)

- Text input for the port number (e.g. `3456`). The full URL is built automatically: `ws://localhost:[port]`
- "Connect" / "Disconnect" button depending on current state
- Visual status indicator: colored dot + text label
  - Green + "Connected"
  - Orange + "Connecting…"
  - Red + "Disconnected"
- On startup, the app automatically attempts to connect to the last used port (stored in localStorage). If no port is stored, the field is empty and the app starts disconnected.
- On unexpected disconnection, the status switches to "Disconnected" with no automatic reconnection attempt.

---

## 2. Left column — Incoming messages

### 2a. List view (default view)

List of received messages, most recent at the top. Maximum 100 messages kept in memory — oldest are discarded when the limit is reached. Received messages are not persisted in localStorage.

Each list entry shows:
- The `type` field of the JSON (or "(no type)" if absent)
- A one-line truncated preview of the payload
- The time of reception (HH:MM:SS)

Clicking an entry opens the detail view.

### 2b. Detail view

The detail view replaces the list view entirely within the left column.

A back arrow "← Back" in the top-left returns to the list.

The message is displayed as an interactive JSON tree viewer:
- All nodes are expanded by default
- Each object and array can be collapsed/expanded by clicking a chevron icon
- When collapsed, display `{…}` or `[…]` as a placeholder
- Syntax highlighting:
  - Keys: one color
  - Strings: another color
  - Numbers: another color
  - Booleans / null: another color

A "Copy JSON" button copies the raw message to the clipboard.

---

## 3. Right column — Outgoing messages

### 3a. Input area

- Textarea to type or paste a JSON message
- "Format" button: reformats the JSON with 2-space indentation (`JSON.stringify` + indent 2)
- Inline error message below the textarea if the JSON is invalid — disappears as soon as the JSON becomes valid again
- "Send" button: sends the message over WebSocket. Disabled when disconnected or when JSON is invalid.

### 3b. Send history

List of messages sent during the current session. Ephemeral — not persisted in localStorage. Most recent at the top. Maximum 50 entries.

Each entry shows:
- The `type` of the message
- The time it was sent
- A star icon ☆ / ★ to add or remove from favorites
- Clicking the entry loads the message into the textarea for editing or resending

### 3c. Favorites

Favorites are persisted in localStorage and survive page reloads and port changes.

A message is added to favorites by clicking the star icon in the send history. Clicking again removes it.

Favorites are displayed in a separate section below the send history, with a clear visual separator.

Each favorite entry shows:
- The `type` of the message
- A delete button to remove the favorite
- Clicking the entry loads the message into the textarea

---

## 4. Technical constraints

- Vanilla JS only — no React, Vue, or any other framework
- No bundler, no npm dependencies
- Single file: everything in one `index.html` (CSS in `<style>`, JS in `<script>`)
- External CDN libraries are allowed if strictly necessary, but a hand-rolled implementation is preferred (e.g. the JSON tree viewer is ~50 lines of vanilla JS and does not need a library)
- Target browser: modern Chromium (Chrome / Electron webview)
- Responsive design is not required

---

## 5. Out of scope

- WebSocket authentication
- Multiple simultaneous connections
- Log export
- Light / dark theme toggle