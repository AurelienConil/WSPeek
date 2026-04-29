/**
 * <wspeek-incoming> Web Component
 *
 * Left column: displays received messages with 3 tabs — List, Tree, Edit & Send.
 * Each message is tagged isJson=true|false and displayed accordingly.
 * Listens to 'wspeek:message' events dispatched from app.js.
 * Max 100 messages kept in memory (FIFO).
 */

import { renderJsonTree } from './json-tree.js';

class WSPeekIncoming extends HTMLElement {
  constructor() {
    super();
    this.messages = [];
    this.maxMessages = 100;
    this._activeTab = 'list';
    this._selectedMessage = null;
    this._isConnected = false;
    this._mode = 'native';
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          border-right: 1px solid #3c3c3c;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace;
          font-size: 12px;
          color: #d4d4d4;
        }

        .incoming-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        /* ---- Tabs ---- */
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
        .tab-btn.active { color: #d4d4d4; border-bottom-color: #0e639c; }

        .tab-content {
          display: none;
          flex: 1;
          overflow: hidden;
          flex-direction: column;
        }

        .tab-content.active { display: flex; }

        /* ---- Type badge ---- */
        .type-badge {
          display: inline-block;
          font-size: 9px;
          font-weight: bold;
          padding: 1px 5px;
          border-radius: 3px;
          flex-shrink: 0;
          line-height: 14px;
        }

        .type-badge.json { background-color: #0e639c; color: #fff; }
        .type-badge.str  { background-color: #6a4f00; color: #dcdcaa; }

        /* ---- List tab ---- */
        .list-header {
          padding: 6px 12px;
          background-color: #252526;
          border-bottom: 1px solid #3c3c3c;
          display: flex;
          justify-content: flex-end;
          flex-shrink: 0;
        }

        #msg-list {
          list-style: none;
          padding: 0;
          margin: 0;
          overflow-y: auto;
          flex: 1;
        }

        .msg-entry {
          padding: 8px 12px;
          border-bottom: 1px solid #3c3c3c;
          cursor: pointer;
          transition: background-color 0.15s;
          display: flex;
          flex-direction: row;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
        }

        .msg-entry:hover { background-color: #2d2d30; }

        .msg-entry-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
          min-width: 0;
        }

        .msg-entry-top {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .msg-type { color: #9cdcfe; font-weight: bold; font-size: 11px; }
        .msg-preview { color: #858585; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
        .msg-time { color: #666; font-size: 9px; }

        .msg-delete-btn {
          background: transparent;
          border: none;
          color: #858585;
          cursor: pointer;
          font-size: 12px;
          padding: 0 4px;
          line-height: 1;
          flex-shrink: 0;
          align-self: flex-start;
          opacity: 0;
          transition: opacity 0.15s, color 0.15s;
        }

        .msg-entry:hover .msg-delete-btn { opacity: 1; }
        .msg-delete-btn:hover { color: #f48771; }

        /* ---- Tree tab ---- */
        .tree-header {
          padding: 8px 12px;
          background-color: #252526;
          border-bottom: 1px solid #3c3c3c;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .tree-header-left {
          display: flex;
          align-items: center;
          gap: 8px;
          overflow: hidden;
        }

        #tree-msg-type { font-size: 11px; color: #9cdcfe; font-weight: bold; }

        #json-tree-container {
          flex: 1;
          overflow-y: auto;
          padding: 8px 12px;
          background-color: #1e1e1e;
        }

        .plain-text-display {
          font-size: 12px;
          color: #dcdcaa;
          white-space: pre-wrap;
          word-break: break-all;
          padding: 8px;
          background-color: #1e1e1e;
          flex: 1;
          overflow-y: auto;
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

        .edit-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          font-size: 10px;
          color: #858585;
        }

        .event-row {
          display: none;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        .event-row.visible { display: flex; }

        .event-label { color: #858585; font-size: 11px; flex-shrink: 0; }

        #resend-event-input {
          flex: 1;
          padding: 4px 8px;
          background-color: #2d2d30;
          border: 1px solid #3c3c3c;
          color: #9cdcfe;
          border-radius: 3px;
          font-family: inherit;
          font-size: 11px;
        }

        #resend-event-input:focus {
          outline: none;
          border-color: #0e639c;
          background-color: #1e1e1e;
        }

        #resend-input {
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

        #resend-input:focus {
          outline: none;
          border-color: #0e639c;
          background-color: #1e1e1e;
        }

        .edit-actions { display: flex; gap: 8px; flex-shrink: 0; }

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

        button.ghost-btn {
          padding: 4px 8px;
          background-color: transparent;
          color: #858585;
          border: 1px solid #3c3c3c;
          border-radius: 3px;
          cursor: pointer;
          font-family: inherit;
          font-size: 10px;
          transition: all 0.15s;
        }

        button.ghost-btn:hover { color: #d4d4d4; border-color: #858585; }

        ::-webkit-scrollbar { width: 10px; }
        ::-webkit-scrollbar-track { background-color: #252526; }
        ::-webkit-scrollbar-thumb { background-color: #3c3c3c; border-radius: 5px; }
        ::-webkit-scrollbar-thumb:hover { background-color: #555; }
      </style>

      <div class="incoming-container">

        <div class="tab-bar">
          <button class="tab-btn active" data-tab="list">List</button>
          <button class="tab-btn" data-tab="tree">Tree</button>
          <button class="tab-btn" data-tab="edit">Edit &amp; Send</button>
        </div>

        <!-- Tab: List -->
        <div id="tab-list" class="tab-content active">
          <div class="list-header">
            <button id="btn-clear-messages" class="ghost-btn">Clear</button>
          </div>
          <ul id="msg-list"></ul>
        </div>

        <!-- Tab: Tree -->
        <div id="tab-tree" class="tab-content">
          <div class="tree-header">
            <div class="tree-header-left">
              <span id="tree-badge"></span>
              <span id="tree-msg-type"></span>
            </div>
            <button id="btn-edit-send" class="action-btn">Edit &amp; Send</button>
          </div>
          <div id="json-tree-container"></div>
        </div>

        <!-- Tab: Edit & Send -->
        <div id="tab-edit" class="tab-content">
          <div class="edit-section">
            <div class="edit-meta">
              <span id="edit-badge"></span>
              <span id="edit-mode-label"></span>
            </div>
            <div id="resend-event-row" class="event-row">
              <label class="event-label">Event</label>
              <input type="text" id="resend-event-input" placeholder="e.g. devices:add">
            </div>
            <textarea id="resend-input" placeholder="Select a message from the list first…"></textarea>
            <div class="edit-actions">
              <button id="btn-format" class="action-btn">Format JSON</button>
              <button id="btn-resend" class="action-btn" disabled>Re-send</button>
            </div>
          </div>
        </div>

      </div>
    `;
  }

  setupEventListeners() {
    document.addEventListener('wspeek:message', (e) => {
      this.addMessage(e.detail);
    });

    document.addEventListener('wspeek:connected', ({ detail }) => {
      this._isConnected = true;
      this._mode = detail.mode || 'native';
      const eventRow = this.shadowRoot.getElementById('resend-event-row');
      eventRow.classList.toggle('visible', this._mode === 'socketio');
      this._updateResendButton();
    });

    document.addEventListener('wspeek:disconnected', () => {
      this._isConnected = false;
      this._updateResendButton();
    });

    this.shadowRoot.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this._switchTab(btn.dataset.tab));
    });

    this.shadowRoot.addEventListener('click', (e) => {
      const deleteBtn = e.target.closest('.msg-delete-btn');
      if (deleteBtn) {
        this.deleteMessage(parseInt(deleteBtn.dataset.index));
        e.stopPropagation();
        return;
      }
      const entry = e.target.closest('.msg-entry');
      if (entry) {
        this._selectMessage(parseInt(entry.dataset.index));
      }
    });

    this.shadowRoot.getElementById('btn-clear-messages').addEventListener('click', () => {
      this.messages = [];
      this._selectedMessage = null;
      this.renderList();
      this._switchTab('list');
    });

    this.shadowRoot.getElementById('btn-edit-send').addEventListener('click', () => {
      this._loadIntoEdit();
    });

    this.shadowRoot.getElementById('resend-input').addEventListener('input', () => {
      this._updateResendButton();
    });

    this.shadowRoot.getElementById('btn-format').addEventListener('click', () => {
      this._formatEdit();
    });

    this.shadowRoot.getElementById('btn-resend').addEventListener('click', () => {
      this._resend();
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

  // ---- Badge helper ----

  _makeBadge(isJson) {
    const span = document.createElement('span');
    span.className = `type-badge ${isJson ? 'json' : 'str'}`;
    span.textContent = isJson ? 'JSON' : 'STR';
    return span;
  }

  // ---- Message selection ----

  _selectMessage(index) {
    if (index < 0 || index >= this.messages.length) return;
    this._selectedMessage = this.messages[index];
    this._renderTree();
    this._switchTab('tree');
  }

  _renderTree() {
    const container = this.shadowRoot.getElementById('json-tree-container');
    const typeEl = this.shadowRoot.getElementById('tree-msg-type');
    const badgeEl = this.shadowRoot.getElementById('tree-badge');
    if (!this._selectedMessage) return;

    const msg = this._selectedMessage;
    typeEl.textContent = msg.type;
    badgeEl.innerHTML = '';
    badgeEl.appendChild(this._makeBadge(msg.isJson));

    container.innerHTML = '';
    if (msg.isJson) {
      container.appendChild(renderJsonTree(msg.obj));
    } else {
      const pre = document.createElement('div');
      pre.className = 'plain-text-display';
      pre.textContent = msg.raw;
      container.appendChild(pre);
    }
  }

  _loadIntoEdit() {
    if (!this._selectedMessage) return;
    const msg = this._selectedMessage;

    const textarea = this.shadowRoot.getElementById('resend-input');
    // For JSON: pretty-print. For plain string: raw value as-is.
    textarea.value = msg.isJson
      ? JSON.stringify(msg.obj, null, 2)
      : msg.raw;

    const eventInput = this.shadowRoot.getElementById('resend-event-input');
    eventInput.value = msg.eventName || '';

    const badgeEl = this.shadowRoot.getElementById('edit-badge');
    const labelEl = this.shadowRoot.getElementById('edit-mode-label');
    badgeEl.innerHTML = '';
    badgeEl.appendChild(this._makeBadge(msg.isJson));
    labelEl.textContent = msg.isJson
      ? 'Editing as JSON'
      : 'Plain text — will be sent as-is';

    const btnFormat = this.shadowRoot.getElementById('btn-format');
    btnFormat.disabled = !msg.isJson;

    this._updateResendButton();
    this._switchTab('edit');
  }

  // ---- Edit & Send tab ----

  _updateResendButton() {
    const textarea = this.shadowRoot.getElementById('resend-input');
    const btnResend = this.shadowRoot.getElementById('btn-resend');
    if (!textarea || !btnResend) return;
    btnResend.disabled = !this._isConnected || !textarea.value.trim();
  }

  _formatEdit() {
    const textarea = this.shadowRoot.getElementById('resend-input');
    const value = textarea.value.trim();
    if (!value) return;
    try {
      textarea.value = JSON.stringify(JSON.parse(value), null, 2);
    } catch { /* not JSON */ }
  }

  _resend() {
    const textarea = this.shadowRoot.getElementById('resend-input');
    const value = textarea.value.trim();
    if (!value || !this._isConnected) return;

    const eventInput = this.shadowRoot.getElementById('resend-event-input');
    const eventName = this._mode === 'socketio'
      ? (eventInput.value.trim() || 'message')
      : null;

    console.log('[WSPeek][1] Dispatching wspeek:resend_to_frontend, value:', value.substring(0, 60));
    this.dispatchEvent(new CustomEvent('wspeek:resend_to_frontend', {
      detail: { eventName, json: value },
      bubbles: true,
      composed: true,
    }));

    this._flashSent(this.shadowRoot.getElementById('btn-resend'));
  }

  _flashSent(btn) {
    const original = btn.textContent;
    btn.textContent = '✓ Sent';
    btn.classList.add('sent');
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove('sent');
    }, 1500);
  }

  // ---- Message management ----

  addMessage(msgData) {
    try {
      const rawData = typeof msgData === 'string' ? msgData : msgData.rawData;
      const eventName = typeof msgData === 'string' ? null : msgData.eventName;

      let obj;
      let isJson = false;
      try {
        obj = JSON.parse(rawData);
        isJson = true;
      } catch {
        obj = rawData;
        isJson = false;
      }

      const msg = {
        raw: rawData,
        obj,
        isJson,
        eventName,
        type: eventName || (isJson && typeof obj === 'object' && obj !== null ? obj.type : null) || (isJson ? '(no type)' : rawData.substring(0, 20)),
        timestamp: new Date(),
      };

      this.messages.unshift(msg);
      if (this.messages.length > this.maxMessages) this.messages.pop();
      this.renderList();
    } catch (err) {
      console.error('[WSPeek] Failed to add message:', err);
    }
  }

  renderList() {
    const msgList = this.shadowRoot.getElementById('msg-list');
    msgList.innerHTML = '';

    this.messages.forEach((msg, index) => {
      const li = document.createElement('li');
      li.className = 'msg-entry';
      li.dataset.index = index;

      const content = document.createElement('div');
      content.className = 'msg-entry-content';

      const top = document.createElement('div');
      top.className = 'msg-entry-top';

      top.appendChild(this._makeBadge(msg.isJson));

      const typeEl = document.createElement('span');
      typeEl.className = 'msg-type';
      typeEl.textContent = msg.type;
      top.appendChild(typeEl);

      const previewEl = document.createElement('span');
      previewEl.className = 'msg-preview';
      previewEl.textContent = this.truncatePreview(msg.raw, 60);

      const timeEl = document.createElement('span');
      timeEl.className = 'msg-time';
      timeEl.textContent = this.formatTime(msg.timestamp);

      content.appendChild(top);
      content.appendChild(previewEl);
      content.appendChild(timeEl);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'msg-delete-btn';
      deleteBtn.dataset.index = index;
      deleteBtn.textContent = '✕';
      deleteBtn.setAttribute('type', 'button');

      li.appendChild(content);
      li.appendChild(deleteBtn);
      msgList.appendChild(li);
    });
  }

  deleteMessage(index) {
    if (index < 0 || index >= this.messages.length) return;
    if (this._selectedMessage === this.messages[index]) {
      this._selectedMessage = null;
      this._switchTab('list');
    }
    this.messages.splice(index, 1);
    this.renderList();
  }

  truncatePreview(str, maxLen) {
    return str.length > maxLen ? str.substring(0, maxLen) + '…' : str;
  }

  formatTime(date) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }
}

customElements.define('wspeek-incoming', WSPeekIncoming);
