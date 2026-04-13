/**
 * <wspeek-outgoing> Web Component
 *
 * Right column: allows composing and sending messages. Maintains send history (in-memory)
 * and favorites (persisted in localStorage).
 *
 * Listens to: wspeek:connected, wspeek:disconnected
 * Fires: wspeek:send
 */

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

        .input-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 12px;
          background-color: #252526;
          border-bottom: 1px solid #3c3c3c;
          flex-shrink: 0;
        }

        textarea {
          padding: 8px;
          background-color: #2d2d30;
          border: 1px solid #3c3c3c;
          color: #d4d4d4;
          border-radius: 3px;
          font-family: inherit;
          font-size: 11px;
          resize: vertical;
          min-height: 80px;
          max-height: 120px;
        }

        textarea:focus {
          outline: none;
          border-color: #0e639c;
          background-color: #1e1e1e;
        }

        .input-actions {
          display: flex;
          gap: 8px;
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

        .error {
          display: none;
          color: #f48771;
          font-size: 10px;
          padding: 4px 0;
        }

        .error.visible {
          display: block;
        }

        .scrollable-section {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          gap: 8px;
          flex: 1;
        }

        .history-section,
        .favorites-section {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          gap: 8px;
          padding: 0 12px;
        }

        .history-section h3,
        .favorites-section h3 {
          font-size: 11px;
          font-weight: bold;
          color: #858585;
          margin-top: 12px;
          margin-bottom: 4px;
        }

        #history-list,
        #favorites-list {
          list-style: none;
          padding: 0;
          margin: 0;
          overflow-y: auto;
          flex: 1;
        }

        .history-entry,
        .favorite-entry {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 8px;
          background-color: #2d2d30;
          border: 1px solid #3c3c3c;
          border-radius: 3px;
          margin-bottom: 4px;
          cursor: pointer;
          transition: background-color 0.15s;
          font-size: 10px;
        }

        .history-entry:hover,
        .favorite-entry:hover {
          background-color: #333;
        }

        .entry-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
          overflow: hidden;
        }

        .entry-type {
          color: #9cdcfe;
          font-weight: bold;
          font-size: 10px;
        }

        .entry-time {
          color: #858585;
          font-size: 9px;
        }

        .entry-actions {
          display: flex;
          gap: 6px;
          flex-shrink: 0;
        }

        .star-btn,
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

        .star-btn:hover,
        .delete-btn:hover {
          color: #d4d4d4;
        }

        .star-btn.active {
          color: #dcdcaa;
        }

        .event-row {
          display: none;
          align-items: center;
          gap: 8px;
          padding: 0 12px;
          margin-bottom: 8px;
        }

        .event-label {
          color: #858585;
          font-size: 11px;
          flex-shrink: 0;
        }

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

        hr {
          border: none;
          border-top: 1px solid #3c3c3c;
          margin: 8px 12px;
          flex-shrink: 0;
        }

        ::-webkit-scrollbar {
          width: 10px;
        }

        ::-webkit-scrollbar-track {
          background-color: #252526;
        }

        ::-webkit-scrollbar-thumb {
          background-color: #3c3c3c;
          border-radius: 5px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background-color: #555;
        }
      </style>

      <div class="outgoing-container">
        <div class="input-section">
          <div id="event-row" class="event-row">
            <label class="event-label">Event</label>
            <input type="text" id="event-input" placeholder="e.g. devices:add">
          </div>
          <textarea id="msg-input" placeholder="Enter JSON..."></textarea>
          <div class="input-actions">
            <button id="btn-format">Format</button>
            <button id="btn-send" disabled>Send</button>
          </div>
          <span id="json-error" class="error"></span>
        </div>

        <div class="scrollable-section">
          <div class="history-section">
            <h3>Send History</h3>
            <ul id="history-list"></ul>
          </div>

          <div id="client-messages-section" class="history-section" style="display: none;">
            <h3>← Client Messages</h3>
            <ul id="client-messages-list"></ul>
          </div>

          <hr>

          <div class="favorites-section">
            <h3>Favorites</h3>
            <ul id="favorites-list"></ul>
          </div>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    const textarea = this.shadowRoot.getElementById('msg-input');
    const btnFormat = this.shadowRoot.getElementById('btn-format');
    const btnSend = this.shadowRoot.getElementById('btn-send');

    textarea.addEventListener('input', () => {
      this.validateJSON();
    });

    btnFormat.addEventListener('click', () => {
      this.formatJSON();
    });

    btnSend.addEventListener('click', () => {
      this.sendMessage();
    });

    // Connection state
    document.addEventListener('wspeek:connected', ({ detail }) => {
      this._isConnected = true;
      this._mode = detail.mode;
      this._isBridgeMode = detail.isBridgeMode || false;
      const eventRow = this.shadowRoot.getElementById('event-row');
      eventRow.style.display = detail.mode === 'socketio' ? 'flex' : 'none';
      const clientMessagesSection = this.shadowRoot.getElementById('client-messages-section');
      clientMessagesSection.style.display = this._isBridgeMode ? 'flex' : 'none';
      this.updateSendButtonState();
    });

    document.addEventListener('wspeek:disconnected', () => {
      this._isConnected = false;
      this.updateSendButtonState();
    });

    // Bridge mode: messages from client
    document.addEventListener('wspeek:client_message', ({ detail }) => {
      this.addClientMessage(detail.rawData, detail.eventName);
    });

    // History, client messages, and favorites click handlers
    this.shadowRoot.addEventListener('click', (e) => {
      const historyEntry = e.target.closest('.history-entry');
      const favEntry = e.target.closest('.favorite-entry');
      const starBtn = e.target.closest('.star-btn');
      const deleteBtn = e.target.closest('.delete-btn');

      if (starBtn) {
        e.stopPropagation();
        const entry = starBtn.closest('.history-entry');
        const index = parseInt(entry.dataset.index);
        if (entry.dataset.isClientMessage === 'true') {
          this.toggleFavoriteClientMessage(index);
        } else {
          this.toggleFavorite(index);
        }
      } else if (deleteBtn) {
        e.stopPropagation();
        const entry = deleteBtn.closest('.favorite-entry');
        const favIndex = parseInt(entry.dataset.fav-index);
        this.removeFavorite(favIndex);
      } else if (historyEntry) {
        const index = parseInt(historyEntry.dataset.index);
        // Check if it's a client message or history message
        if (historyEntry.dataset.isClientMessage === 'true') {
          this.loadClientMessage(index);
        } else {
          this.loadHistoryMessage(index);
        }
      } else if (favEntry) {
        const favIndex = parseInt(favEntry.dataset.index);
        this.loadFavoriteMessage(favIndex);
      }
    });
  }

  validateJSON() {
    const textarea = this.shadowRoot.getElementById('msg-input');
    const errorEl = this.shadowRoot.getElementById('json-error');
    const value = textarea.value.trim();

    if (!value) {
      errorEl.classList.remove('visible');
      this.updateSendButtonState();
      return;
    }

    try {
      JSON.parse(value);
      errorEl.classList.remove('visible');
    } catch (err) {
      errorEl.textContent = `Invalid JSON: ${err.message}`;
      errorEl.classList.add('visible');
    }

    this.updateSendButtonState();
  }

  updateSendButtonState() {
    const textarea = this.shadowRoot.getElementById('msg-input');
    const btnSend = this.shadowRoot.getElementById('btn-send');
    const value = textarea.value.trim();

    let isValid = false;
    if (value) {
      try {
        JSON.parse(value);
        isValid = true;
      } catch {
        isValid = false;
      }
    }

    btnSend.disabled = !this._isConnected || !isValid;
  }

  formatJSON() {
    const textarea = this.shadowRoot.getElementById('msg-input');
    const value = textarea.value.trim();

    if (!value) return;

    try {
      const obj = JSON.parse(value);
      textarea.value = JSON.stringify(obj, null, 2);
      this.validateJSON();
    } catch (err) {
      console.error('[WSPeek] Format failed:', err);
    }
  }

  sendMessage() {
    const textarea = this.shadowRoot.getElementById('msg-input');
    const value = textarea.value.trim();
    const eventInput = this.shadowRoot.getElementById('event-input');
    const eventName = eventInput.value.trim() || 'message';

    if (!value || !this._isConnected) return;

    try {
      JSON.parse(value);
    } catch {
      return;
    }

    // Fire custom event for app.js to handle
    const event = new CustomEvent('wspeek:send', {
      detail: { eventName, json: value },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);

    // Add to history
    this.addToHistory(value, eventName);

    // Clear textarea
    textarea.value = '';
    eventInput.value = '';
    this.validateJSON();
  }

  addToHistory(jsonString, eventName = 'message') {
    try {
      const obj = JSON.parse(jsonString);
      const entry = {
        raw: jsonString,
        obj: obj,
        eventName: eventName,
        type: eventName !== 'message' ? eventName : (obj.type || '(no type)'),
        timestamp: new Date(),
      };

      this.history.unshift(entry);
      if (this.history.length > this.maxHistory) {
        this.history.pop();
      }

      this.renderHistory();
    } catch (err) {
      console.error('[WSPeek] Failed to add to history:', err);
    }
  }

  renderHistory() {
    const historyList = this.shadowRoot.getElementById('history-list');
    historyList.innerHTML = '';

    this.history.forEach((entry, index) => {
      const li = document.createElement('li');
      li.className = 'history-entry';
      li.dataset.index = index;

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
      starBtn.textContent = this.isFavorited(entry.raw, entry.eventName) ? '★' : '☆';
      if (this.isFavorited(entry.raw, entry.eventName)) {
        starBtn.classList.add('active');
      }

      actions.appendChild(starBtn);

      li.appendChild(info);
      li.appendChild(actions);

      historyList.appendChild(li);
    });
  }

  toggleFavorite(historyIndex) {
    if (historyIndex < 0 || historyIndex >= this.history.length) return;

    const entry = this.history[historyIndex];
    const index = this.favorites.findIndex((fav) => fav.raw === entry.raw);

    if (index !== -1) {
      this.favorites.splice(index, 1);
    } else {
      this.favorites.push(entry);
    }

    this.saveFavorites();
    this.renderHistory();
    this.renderFavorites();
  }

  toggleFavoriteClientMessage(clientMessageIndex) {
    if (clientMessageIndex < 0 || clientMessageIndex >= this.clientMessages.length) return;

    const entry = this.clientMessages[clientMessageIndex];
    const index = this.favorites.findIndex((fav) => fav.raw === entry.raw);

    if (index !== -1) {
      this.favorites.splice(index, 1);
    } else {
      this.favorites.push(entry);
    }

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
    const favList = this.shadowRoot.getElementById('favorites-list');
    favList.innerHTML = '';

    this.favorites.forEach((entry, index) => {
      const li = document.createElement('li');
      li.className = 'favorite-entry';
      li.dataset.index = index;

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

      favList.appendChild(li);
    });
  }

  isFavorited(jsonString, eventName = 'message') {
    return this.favorites.some((fav) => fav.raw === jsonString && fav.eventName === eventName);
  }

  loadHistoryMessage(index) {
    if (index < 0 || index >= this.history.length) return;

    const textarea = this.shadowRoot.getElementById('msg-input');
    const eventInput = this.shadowRoot.getElementById('event-input');
    const entry = this.history[index];
    textarea.value = entry.raw;
    eventInput.value = entry.eventName || '';
    this.validateJSON();
  }

  loadClientMessage(index) {
    if (index < 0 || index >= this.clientMessages.length) return;

    const textarea = this.shadowRoot.getElementById('msg-input');
    const eventInput = this.shadowRoot.getElementById('event-input');
    const entry = this.clientMessages[index];
    textarea.value = entry.raw;
    eventInput.value = entry.eventName || '';
    this.validateJSON();
  }

  loadFavoriteMessage(index) {
    if (index < 0 || index >= this.favorites.length) return;

    const textarea = this.shadowRoot.getElementById('msg-input');
    const eventInput = this.shadowRoot.getElementById('event-input');
    const entry = this.favorites[index];
    textarea.value = entry.raw;
    eventInput.value = entry.eventName || '';
    this.validateJSON();
  }

  saveFavorites() {
    const data = this.favorites.map((fav) => ({
      type: fav.type,
      raw: fav.raw,
      eventName: fav.eventName,
    }));
    localStorage.setItem('wspeek-favorites', JSON.stringify(data));
  }

  loadFavorites() {
    const stored = localStorage.getItem('wspeek-favorites');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        this.favorites = data.map((item) => ({
          raw: item.raw,
          obj: JSON.parse(item.raw),
          type: item.type,
          eventName: item.eventName || 'message',
          timestamp: new Date(),
        }));
      } catch (err) {
        console.error('[WSPeek] Failed to load favorites:', err);
        this.favorites = [];
      }
    }
  }

  addClientMessage(jsonString, eventName = null) {
    try {
      const obj = JSON.parse(jsonString);
      const entry = {
        raw: jsonString,
        obj,
        eventName,
        type: eventName || obj.type || '(no type)',
        timestamp: new Date(),
      };

      this.clientMessages.unshift(entry);
      if (this.clientMessages.length > this.maxClientMessages) {
        this.clientMessages.pop();
      }

      this.renderClientMessages();
    } catch (err) {
      console.error('[WSPeek] Failed to add client message:', err);
    }
  }

  renderClientMessages() {
    const clientList = this.shadowRoot.getElementById('client-messages-list');
    clientList.innerHTML = '';

    this.clientMessages.forEach((entry, index) => {
      const li = document.createElement('li');
      li.className = 'history-entry';
      li.dataset.index = index;
      li.dataset.isClientMessage = 'true';

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
      starBtn.textContent = this.isFavorited(entry.raw, entry.eventName) ? '★' : '☆';
      if (this.isFavorited(entry.raw, entry.eventName)) {
        starBtn.classList.add('active');
      }

      actions.appendChild(starBtn);

      li.appendChild(info);
      li.appendChild(actions);

      clientList.appendChild(li);
    });
  }

  formatTime(date) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }
}

customElements.define('wspeek-outgoing', WSPeekOutgoing);
