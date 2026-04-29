/**
 * <wspeek-outgoing> Web Component
 *
 * Right column: send history + bridge client messages, with 4 tabs — List, Tree, Edit & Send, Favs.
 * Favorites are persisted in localStorage.
 *
 * Listens to: wspeek:connected, wspeek:disconnected, wspeek:client_message
 * Fires: wspeek:send
 */

import { renderJsonTree } from './json-tree.js';

class WSPeekOutgoing extends HTMLElement {
  constructor() {
    super();
    this.history = [];
    this.clientMessages = [];
    this.favorites = [];
    this.maxHistory = 50;
    this.maxClientMessages = 50;
    this._isConnected = false;
    this._mode = 'native';
    this._isBridgeMode = false;
    this._activeTab = 'list';
    this._selectedMessage = null;
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
    this.loadFavorites();
    this.renderFavorites();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
          font-size: 12px;
          color: #d4d4d4;
        }

        .outgoing-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        /* ---- Tab bar ---- */
        .tab-bar {
          display: flex;
          border-bottom: 1px solid #3c3c3c;
          background-color: #252526;
          flex-shrink: 0;
        }

        .tab-btn {
          padding: 6px 12px;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          color: #858585;
          cursor: pointer;
          font-size: 10px;
          font-family: inherit;
          transition: color 0.15s;
        }

        .tab-btn:hover { color: #d4d4d4; }

        .tab-btn.active {
          color: #d4d4d4;
          border-bottom-color: #0e639c;
        }

        .tab-content {
          display: none;
          flex: 1;
          overflow: hidden;
          flex-direction: column;
        }

        .tab-content.active { display: flex; }

        /* ---- List tab ---- */
        .list-scroll {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .list-section {
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
        }

        .list-section h3 {
          font-size: 10px;
          font-weight: bold;
          color: #858585;
          margin: 0;
          padding: 6px 12px;
          background-color: #252526;
          border-bottom: 1px solid #3c3c3c;
          position: sticky;
          top: 0;
          z-index: 1;
        }

        .history-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .history-entry {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 8px 6px 12px;
          border-bottom: 1px solid #3c3c3c;
          cursor: pointer;
          transition: background-color 0.15s;
          font-size: 10px;
        }

        .history-entry:hover { background-color: #2d2d30; }

        .entry-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
          overflow: hidden;
        }

        .entry-type { color: #9cdcfe; font-weight: bold; font-size: 10px; }
        .entry-time { color: #858585; font-size: 9px; }

        .entry-actions { display: flex; gap: 6px; flex-shrink: 0; }

        .star-btn {
          background-color: transparent;
          border: none;
          color: #858585;
          cursor: pointer;
          padding: 0;
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          transition: color 0.15s;
        }

        .star-btn:hover { color: #d4d4d4; }
        .star-btn.active { color: #dcdcaa; }

        /* ---- Tree tab ---- */
        .tree-header {
          padding: 8px 12px;
          background-color: #252526;
          border-bottom: 1px solid #3c3c3c;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-shrink: 0;
        }

        #json-tree-container {
          flex: 1;
          overflow-y: auto;
          padding: 8px 12px;
          background-color: #1e1e1e;
        }

        .json-tree { list-style: none; padding-left: 0; margin: 0; font-size: 11px; }
        .json-tree li { padding: 0; margin-left: 0; list-style: none; }
        .json-tree .tree-node { display: flex; align-items: flex-start; gap: 4px; padding: 2px 0; }
        .json-tree .chevron { width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; cursor: pointer; user-select: none; color: #858585; font-size: 10px; flex-shrink: 0; }
        .json-tree .chevron:hover { color: #d4d4d4; }
        .json-tree .chevron.empty { cursor: default; }
        .json-tree .key { color: #9cdcfe; font-weight: bold; }
        .json-tree .str { color: #ce9178; }
        .json-tree .num { color: #b5cea8; }
        .json-tree .bool-null { color: #569cd6; }
        .json-tree .placeholder { color: #858585; }
        .json-tree .children { display: none; margin-left: 16px; border-left: 1px solid #3c3c3c; padding-left: 8px; margin-top: 2px; }
        .json-tree .children.visible { display: block; }

        /* ---- Edit & Send tab ---- */
        .edit-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px;
          flex: 1;
          overflow: hidden;
        }

        .event-row {
          display: none;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .event-row.visible { display: flex; }

        .event-label { color: #858585; font-size: 11px; flex-shrink: 0; }

        #event-input {
          flex: 1;
          padding: 4px 8px;
          background-color: #2d2d30;
          border: 1px solid #3c3c3c;
          color: #9cdcfe;
          border-radius: 3px;
          font-family: inherit;
          font-size: 11px;
        }

        #event-input:focus {
          outline: none;
          border-color: #0e639c;
          background-color: #1e1e1e;
        }

        #msg-input {
          padding: 8px;
          background-color: #2d2d30;
          border: 1px solid #3c3c3c;
          color: #d4d4d4;
          border-radius: 3px;
          font-family: inherit;
          font-size: 11px;
          resize: none;
          flex: 1;
        }

        #msg-input:focus {
          outline: none;
          border-color: #0e639c;
          background-color: #1e1e1e;
        }

        .edit-actions { display: flex; gap: 8px; flex-shrink: 0; }

        .json-error { display: none; color: #f48771; font-size: 10px; flex-shrink: 0; }
        .json-error.visible { display: block; }

        .json-warn { display: none; color: #dcdcaa; font-size: 10px; flex-shrink: 0; }
        .json-warn.visible { display: block; }

        /* ---- Favs tab ---- */
        #favorites-list {
          list-style: none;
          padding: 0;
          margin: 0;
          overflow-y: auto;
          flex: 1;
        }

        .favorite-entry {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 8px 6px 12px;
          border-bottom: 1px solid #3c3c3c;
          cursor: pointer;
          transition: background-color 0.15s;
          font-size: 10px;
        }

        .favorite-entry:hover { background-color: #2d2d30; }

        .delete-btn {
          background-color: transparent;
          border: none;
          color: #858585;
          cursor: pointer;
          padding: 0;
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          transition: color 0.15s;
        }

        .delete-btn:hover { color: #f48771; }

        /* ---- Shared buttons ---- */
        button.action-btn {
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

        button.action-btn:hover { background-color: #1177bb; }
        button.action-btn:disabled { background-color: #555; cursor: not-allowed; opacity: 0.6; }
        button.action-btn.sent { background-color: #4ec9b0; pointer-events: none; }

        ::-webkit-scrollbar { width: 10px; }
        ::-webkit-scrollbar-track { background-color: #252526; }
        ::-webkit-scrollbar-thumb { background-color: #3c3c3c; border-radius: 5px; }
        ::-webkit-scrollbar-thumb:hover { background-color: #555; }
      </style>

      <div class="outgoing-container">

        <div class="tab-bar">
          <button class="tab-btn active" data-tab="list">List</button>
          <button class="tab-btn" data-tab="tree">Tree</button>
          <button class="tab-btn" data-tab="edit">Edit &amp; Send</button>
          <button class="tab-btn" data-tab="favs">Favs</button>
        </div>

        <!-- Tab: List -->
        <div id="tab-list" class="tab-content active">
          <div class="list-scroll">
            <div class="list-section" id="history-section">
              <h3>Send History</h3>
              <ul id="history-list" class="history-list"></ul>
            </div>
            <div class="list-section" id="client-messages-section" style="display:none;">
              <h3>&#8592; Client Messages</h3>
              <ul id="client-messages-list" class="history-list"></ul>
            </div>
          </div>
        </div>

        <!-- Tab: Tree -->
        <div id="tab-tree" class="tab-content">
          <div class="tree-header">
            <span id="tree-msg-type" style="font-size:11px; color:#9cdcfe; font-weight:bold;"></span>
            <button id="btn-edit-send" class="action-btn">Edit &amp; Send</button>
          </div>
          <div id="json-tree-container"></div>
        </div>

        <!-- Tab: Edit & Send -->
        <div id="tab-edit" class="tab-content">
          <div class="edit-section">
            <div id="event-row" class="event-row">
              <label class="event-label">Event</label>
              <input type="text" id="event-input" placeholder="e.g. devices:add">
            </div>
            <textarea id="msg-input" placeholder="Enter JSON or select a message from the list…"></textarea>
            <div class="edit-actions">
              <button id="btn-format" class="action-btn">Format</button>
              <button id="btn-send" class="action-btn" disabled>Send</button>
            </div>
            <span id="json-error" class="json-error"></span>
            <span id="json-warn" class="json-warn">⚠ Not valid JSON — will be sent as plain text</span>
          </div>
        </div>

        <!-- Tab: Favs -->
        <div id="tab-favs" class="tab-content">
          <ul id="favorites-list"></ul>
        </div>

      </div>
    `;
  }

  setupEventListeners() {
    document.addEventListener('wspeek:connected', ({ detail }) => {
      this._isConnected = true;
      this._mode = detail.mode;
      this._isBridgeMode = detail.isBridgeMode || false;

      const eventRow = this.shadowRoot.getElementById('event-row');
      eventRow.classList.toggle('visible', detail.mode === 'socketio');

      const clientSection = this.shadowRoot.getElementById('client-messages-section');
      clientSection.style.display = this._isBridgeMode ? 'flex' : 'none';
      if (this._isBridgeMode) clientSection.style.flexDirection = 'column';

      this.updateSendButtonState();
    });

    document.addEventListener('wspeek:disconnected', () => {
      this._isConnected = false;
      this.updateSendButtonState();
    });

    document.addEventListener('wspeek:client_message', ({ detail }) => {
      this.addClientMessage(detail.rawData, detail.eventName);
    });

    // Tab bar
    this.shadowRoot.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this._switchTab(btn.dataset.tab));
    });

    // List: history + client messages click
    this.shadowRoot.addEventListener('click', (e) => {
      const starBtn = e.target.closest('.star-btn');
      if (starBtn) {
        e.stopPropagation();
        const entry = starBtn.closest('.history-entry');
        const index = parseInt(entry.dataset.index);
        if (entry.dataset.isClientMessage === 'true') {
          this.toggleFavoriteClientMessage(index);
        } else {
          this.toggleFavorite(index);
        }
        return;
      }

      const deleteBtn = e.target.closest('.delete-btn');
      if (deleteBtn) {
        e.stopPropagation();
        const entry = deleteBtn.closest('.favorite-entry');
        const favIndex = parseInt(entry.dataset.favIndex);
        this.removeFavorite(favIndex);
        return;
      }

      const historyEntry = e.target.closest('.history-entry');
      if (historyEntry) {
        const index = parseInt(historyEntry.dataset.index);
        if (historyEntry.dataset.isClientMessage === 'true') {
          this._selectMessage(this.clientMessages[index]);
        } else {
          this._selectMessage(this.history[index]);
        }
        return;
      }

      const favEntry = e.target.closest('.favorite-entry');
      if (favEntry) {
        const favIndex = parseInt(favEntry.dataset.favIndex);
        this._selectMessage(this.favorites[favIndex]);
      }
    });

    // Tree: Edit & Send button
    this.shadowRoot.getElementById('btn-edit-send').addEventListener('click', () => {
      this._loadIntoEdit();
    });

    // Edit & Send tab
    this.shadowRoot.getElementById('msg-input').addEventListener('input', () => {
      this.validateJSON();
    });

    this.shadowRoot.getElementById('btn-format').addEventListener('click', () => {
      this.formatJSON();
    });

    this.shadowRoot.getElementById('btn-send').addEventListener('click', () => {
      this.sendMessage();
    });
  }

  // ---- Tab management ----

  _switchTab(name) {
    this._activeTab = name;
    this.shadowRoot.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === name);
    });
    this.shadowRoot.querySelectorAll('.tab-content').forEach(el => {
      el.classList.toggle('active', el.id === `tab-${name}`);
    });
  }

  // ---- Message selection ----

  _selectMessage(entry) {
    if (!entry) return;
    this._selectedMessage = entry;
    this._renderTree();
    this._switchTab('tree');
  }

  _renderTree() {
    const container = this.shadowRoot.getElementById('json-tree-container');
    const typeEl = this.shadowRoot.getElementById('tree-msg-type');
    if (!this._selectedMessage) return;
    typeEl.textContent = this._selectedMessage.type;
    container.innerHTML = '';
    container.appendChild(renderJsonTree(this._selectedMessage.obj));
  }

  _loadIntoEdit() {
    if (!this._selectedMessage) return;
    this.shadowRoot.getElementById('msg-input').value = this._selectedMessage.raw;
    const eventInput = this.shadowRoot.getElementById('event-input');
    eventInput.value = this._selectedMessage.eventName || '';
    this.validateJSON();
    this._switchTab('edit');
  }

  // ---- Edit & Send tab ----

  validateJSON() {
    const textarea = this.shadowRoot.getElementById('msg-input');
    const errorEl = this.shadowRoot.getElementById('json-error');
    const warnEl = this.shadowRoot.getElementById('json-warn');
    const value = textarea.value.trim();

    errorEl.classList.remove('visible');
    warnEl.classList.remove('visible');

    if (value) {
      try {
        JSON.parse(value);
      } catch {
        // Non-JSON is allowed — show a warning but don't block
        warnEl.classList.add('visible');
      }
    }

    this.updateSendButtonState();
  }

  updateSendButtonState() {
    const textarea = this.shadowRoot.getElementById('msg-input');
    const btnSend = this.shadowRoot.getElementById('btn-send');
    if (!textarea || !btnSend) return;
    // Any non-empty content can be sent (JSON or plain text)
    btnSend.disabled = !this._isConnected || !textarea.value.trim();
  }

  formatJSON() {
    const textarea = this.shadowRoot.getElementById('msg-input');
    const value = textarea.value.trim();
    if (!value) return;
    try {
      textarea.value = JSON.stringify(JSON.parse(value), null, 2);
      this.validateJSON();
    } catch { /* invalid JSON, ignore */ }
  }

  sendMessage() {
    const textarea = this.shadowRoot.getElementById('msg-input');
    const value = textarea.value.trim();
    const eventInput = this.shadowRoot.getElementById('event-input');
    const eventName = eventInput.value.trim() || 'message';

    if (!value || !this._isConnected) return;

    this.dispatchEvent(new CustomEvent('wspeek:send', {
      detail: { eventName, json: value },
      bubbles: true,
      composed: true,
    }));

    this.addToHistory(value, eventName);
    textarea.value = '';
    eventInput.value = '';
    this.validateJSON();
    this._flashSent(this.shadowRoot.getElementById('btn-send'));
    this._switchTab('list');
  }

  _flashSent(btn) {
    const original = btn.textContent;
    btn.textContent = '✓ Sent';
    btn.classList.add('sent');
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove('sent');
      this.updateSendButtonState();
    }, 1500);
  }

  // ---- History ----

  addToHistory(jsonString, eventName = 'message') {
    try {
      const obj = JSON.parse(jsonString);
      const entry = {
        raw: jsonString,
        obj,
        eventName,
        type: eventName !== 'message' ? eventName : (obj.type || '(no type)'),
        timestamp: new Date(),
      };
      this.history.unshift(entry);
      if (this.history.length > this.maxHistory) this.history.pop();
      this.renderHistory();
    } catch (err) {
      console.error('[WSPeek] Failed to add to history:', err);
    }
  }

  renderHistory() {
    const list = this.shadowRoot.getElementById('history-list');
    list.innerHTML = '';
    this.history.forEach((entry, index) => {
      list.appendChild(this._buildHistoryItem(entry, index, false));
    });
  }

  // ---- Client messages ----

  addClientMessage(jsonString, eventName = null) {
    try {
      let obj;
      try { obj = JSON.parse(jsonString); } catch { obj = jsonString; }

      const entry = {
        raw: jsonString,
        obj,
        eventName,
        type: eventName || (typeof obj === 'object' && obj !== null ? obj.type : null) || '(no type)',
        timestamp: new Date(),
      };

      this.clientMessages.unshift(entry);
      if (this.clientMessages.length > this.maxClientMessages) this.clientMessages.pop();
      this.renderClientMessages();
    } catch (err) {
      console.error('[WSPeek] Failed to add client message:', err);
    }
  }

  renderClientMessages() {
    const list = this.shadowRoot.getElementById('client-messages-list');
    list.innerHTML = '';
    this.clientMessages.forEach((entry, index) => {
      list.appendChild(this._buildHistoryItem(entry, index, true));
    });
  }

  _buildHistoryItem(entry, index, isClientMessage) {
    const li = document.createElement('li');
    li.className = 'history-entry';
    li.dataset.index = index;
    if (isClientMessage) li.dataset.isClientMessage = 'true';

    const info = document.createElement('div');
    info.className = 'entry-info';

    const type = document.createElement('span');
    type.className = 'entry-type';
    type.textContent = entry.type;

    const time = document.createElement('span');
    time.className = 'entry-time';
    time.textContent = this.formatTime(entry.timestamp);

    info.appendChild(type);
    info.appendChild(time);

    const actions = document.createElement('div');
    actions.className = 'entry-actions';

    const starBtn = document.createElement('button');
    starBtn.className = 'star-btn';
    const isFav = this.isFavorited(entry.raw, entry.eventName);
    starBtn.textContent = isFav ? '★' : '☆';
    if (isFav) starBtn.classList.add('active');

    actions.appendChild(starBtn);
    li.appendChild(info);
    li.appendChild(actions);
    return li;
  }

  // ---- Favorites ----

  toggleFavorite(historyIndex) {
    if (historyIndex < 0 || historyIndex >= this.history.length) return;
    const entry = this.history[historyIndex];
    const idx = this.favorites.findIndex(f => f.raw === entry.raw);
    if (idx !== -1) this.favorites.splice(idx, 1);
    else this.favorites.push(entry);
    this.saveFavorites();
    this.renderHistory();
    this.renderFavorites();
  }

  toggleFavoriteClientMessage(clientIndex) {
    if (clientIndex < 0 || clientIndex >= this.clientMessages.length) return;
    const entry = this.clientMessages[clientIndex];
    const idx = this.favorites.findIndex(f => f.raw === entry.raw);
    if (idx !== -1) this.favorites.splice(idx, 1);
    else this.favorites.push(entry);
    this.saveFavorites();
    this.renderClientMessages();
    this.renderFavorites();
  }

  removeFavorite(favIndex) {
    if (favIndex < 0 || favIndex >= this.favorites.length) return;
    this.favorites.splice(favIndex, 1);
    this.saveFavorites();
    this.renderFavorites();
    this.renderHistory();
  }

  renderFavorites() {
    const list = this.shadowRoot.getElementById('favorites-list');
    list.innerHTML = '';
    this.favorites.forEach((entry, index) => {
      const li = document.createElement('li');
      li.className = 'favorite-entry';
      li.dataset.favIndex = index;

      const info = document.createElement('div');
      info.className = 'entry-info';

      const type = document.createElement('span');
      type.className = 'entry-type';
      type.textContent = entry.type;

      info.appendChild(type);

      const actions = document.createElement('div');
      actions.className = 'entry-actions';

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.textContent = '✕';

      actions.appendChild(deleteBtn);
      li.appendChild(info);
      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  isFavorited(jsonString, eventName = 'message') {
    return this.favorites.some(f => f.raw === jsonString && f.eventName === eventName);
  }

  saveFavorites() {
    const data = this.favorites.map(f => ({ type: f.type, raw: f.raw, eventName: f.eventName }));
    localStorage.setItem('wspeek-favorites', JSON.stringify(data));
  }

  loadFavorites() {
    const stored = localStorage.getItem('wspeek-favorites');
    if (!stored) return;
    try {
      const data = JSON.parse(stored);
      this.favorites = data.map(item => ({
        raw: item.raw,
        obj: (() => { try { return JSON.parse(item.raw); } catch { return item.raw; } })(),
        type: item.type,
        eventName: item.eventName || 'message',
        timestamp: new Date(),
      }));
    } catch (err) {
      console.error('[WSPeek] Failed to load favorites:', err);
      this.favorites = [];
    }
  }

  formatTime(date) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }
}

customElements.define('wspeek-outgoing', WSPeekOutgoing);
