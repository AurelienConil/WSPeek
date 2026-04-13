/**
 * <wspeek-incoming> Web Component
 *
 * Left column: displays received messages in a list view (default) or detail view.
 * Listens to 'wspeek:message' events dispatched from app.js.
 * Max 100 messages kept in memory (FIFO).
 */

import { renderJsonTree } from './json-tree.js';

class WSPeekIncoming extends HTMLElement {
  constructor() {
    super();
    this.messages = [];
    this.currentMessageIndex = -1;
    this.maxMessages = 100;
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

        #list-view {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
        }

        #detail-view {
          display: none;
          flex-direction: column;
          padding: 12px;
          overflow-y: auto;
          gap: 12px;
        }

        #detail-view.active {
          display: flex;
        }

        #msg-list {
          list-style: none;
          padding: 0;
          margin: 0;
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

        .msg-entry:hover {
          background-color: #2d2d30;
        }

        .msg-entry-content {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
          min-width: 0;
        }

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

        .msg-entry:hover .msg-delete-btn {
          opacity: 1;
        }

        .msg-delete-btn:hover {
          color: #f48771;
        }

        .msg-type {
          color: #9cdcfe;
          font-weight: bold;
          font-size: 11px;
        }

        .msg-preview {
          color: #858585;
          font-size: 10px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 100%;
        }

        .msg-time {
          color: #666;
          font-size: 9px;
        }

        #btn-back {
          padding: 4px 8px;
          background-color: transparent;
          color: #9cdcfe;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          text-align: left;
          font-family: inherit;
          font-size: 11px;
          width: fit-content;
          transition: background-color 0.15s;
        }

        #btn-back:hover {
          background-color: #2d2d30;
        }

        #json-tree-container {
          flex: 1;
          overflow-y: auto;
          background-color: #1e1e1e;
          padding: 8px;
          border: 1px solid #3c3c3c;
          border-radius: 3px;
        }

        .json-tree {
          list-style: none;
          padding-left: 0;
          margin: 0;
          font-size: 11px;
        }

        .json-tree li {
          padding: 0;
          margin-left: 0;
          list-style: none;
        }

        .json-tree .tree-node {
          display: flex;
          align-items: flex-start;
          gap: 4px;
          padding: 2px 0;
        }

        .json-tree .chevron {
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          user-select: none;
          color: #858585;
          font-size: 10px;
          flex-shrink: 0;
        }

        .json-tree .chevron:hover {
          color: #d4d4d4;
        }

        .json-tree .chevron.empty {
          cursor: default;
        }

        .json-tree .key {
          color: #9cdcfe;
          font-weight: bold;
        }

        .json-tree .str {
          color: #ce9178;
        }

        .json-tree .num {
          color: #b5cea8;
        }

        .json-tree .bool-null {
          color: #569cd6;
        }

        .json-tree .placeholder {
          color: #858585;
        }

        .json-tree .children {
          display: none;
          margin-left: 16px;
          border-left: 1px solid #3c3c3c;
          padding-left: 8px;
          margin-top: 2px;
        }

        .json-tree .children.visible {
          display: block;
        }

        #btn-copy {
          padding: 4px 12px;
          background-color: #0e639c;
          color: white;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          font-family: inherit;
          font-size: 11px;
          align-self: flex-start;
          transition: background-color 0.2s;
        }

        #btn-copy:hover {
          background-color: #1177bb;
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

      <div class="incoming-container">
        <div style="padding: 8px 12px; background-color: #252526; border-bottom: 1px solid #3c3c3c; display: flex; gap: 8px; justify-content: space-between; align-items: center;">
          <span style="font-size: 11px; color: #858585;">Incoming Messages</span>
          <button id="btn-clear-messages" style="padding: 4px 8px; background-color: transparent; color: #858585; border: 1px solid #3c3c3c; border-radius: 3px; cursor: pointer; font-family: inherit; font-size: 10px; transition: all 0.15s;">Clear</button>
        </div>
        <div id="list-view">
          <ul id="msg-list"></ul>
        </div>

        <div id="detail-view">
          <button id="btn-back">← Back</button>
          <div id="json-tree-container"></div>
          <button id="btn-copy">Copy JSON</button>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    // Listen for messages from app.js
    document.addEventListener('wspeek:message', (e) => {
      this.addMessage(e.detail);
    });

    // List entries click handler
    this.shadowRoot.addEventListener('click', (e) => {
      // Handle delete button click
      const deleteBtn = e.target.closest('.msg-delete-btn');
      if (deleteBtn) {
        const index = parseInt(deleteBtn.dataset.index);
        this.deleteMessage(index);
        e.stopPropagation();
        return;
      }

      // Handle message entry click
      const entry = e.target.closest('.msg-entry');
      if (entry) {
        const index = parseInt(entry.dataset.index);
        this.showDetail(index);
      }
    });

    // Back button
    this.shadowRoot.getElementById('btn-back').addEventListener('click', () => {
      this.showList();
    });

    // Copy button
    this.shadowRoot.getElementById('btn-copy').addEventListener('click', () => {
      this.copyCurrentMessage();
    });

    // Clear messages button
    this.shadowRoot.getElementById('btn-clear-messages').addEventListener('click', () => {
      this.messages = [];
      this.currentMessageIndex = -1;
      this.renderList();
      this.showList();
    });

    // Reset on connection/disconnection (optional)
    document.addEventListener('wspeek:connected', () => {
      this.showList();
    });
  }

  addMessage(msgData) {
    try {
      // msgData can be either a string (legacy) or { eventName, rawData }
      const rawData = typeof msgData === 'string' ? msgData : msgData.rawData;
      const eventName = typeof msgData === 'string' ? null : msgData.eventName;

      let obj;
      try {
        obj = JSON.parse(rawData);
      } catch (parseErr) {
        // If rawData is not valid JSON (e.g. plain string), use it as-is
        console.warn('[WSPeek] Raw data is not valid JSON, treating as plain string');
        obj = rawData;
      }

      const msg = {
        raw: rawData,
        obj: obj,
        eventName: eventName,
        type: eventName || (typeof obj === 'object' ? obj.type : null) || '(no type)',
        timestamp: new Date(),
      };

      // Add to beginning of array (most recent first)
      this.messages.unshift(msg);

      // Keep max 100 messages
      if (this.messages.length > this.maxMessages) {
        this.messages.pop();
      }

      this.renderList();
    } catch (err) {
      console.error('[WSPeek] Failed to add message:', err);
    }
  }

  renderList() {
    const listView = this.shadowRoot.getElementById('list-view');
    const msgList = this.shadowRoot.getElementById('msg-list');
    msgList.innerHTML = '';

    this.messages.forEach((msg, index) => {
      const li = document.createElement('li');
      li.className = 'msg-entry';
      li.dataset.index = index;

      const content = document.createElement('div');
      content.className = 'msg-entry-content';

      const typeEl = document.createElement('span');
      typeEl.className = 'msg-type';
      typeEl.textContent = msg.type;

      const previewEl = document.createElement('span');
      previewEl.className = 'msg-preview';
      previewEl.textContent = this.truncatePreview(msg.raw, 60);

      const timeEl = document.createElement('span');
      timeEl.className = 'msg-time';
      timeEl.textContent = this.formatTime(msg.timestamp);

      content.appendChild(typeEl);
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

  showDetail(index) {
    if (index < 0 || index >= this.messages.length) return;

    this.currentMessageIndex = index;
    const msg = this.messages[index];

    const listView = this.shadowRoot.getElementById('list-view');
    const detailView = this.shadowRoot.getElementById('detail-view');
    const treeContainer = this.shadowRoot.getElementById('json-tree-container');

    listView.style.display = 'none';
    detailView.classList.add('active');

    // Clear and render tree
    treeContainer.innerHTML = '';
    const tree = renderJsonTree(msg.obj);
    treeContainer.appendChild(tree);
  }

  showList() {
    const listView = this.shadowRoot.getElementById('list-view');
    const detailView = this.shadowRoot.getElementById('detail-view');

    detailView.classList.remove('active');
    listView.style.display = 'block';
    this.currentMessageIndex = -1;
  }

  copyCurrentMessage() {
    if (this.currentMessageIndex < 0 || this.currentMessageIndex >= this.messages.length) {
      return;
    }

    const msg = this.messages[this.currentMessageIndex];
    navigator.clipboard.writeText(msg.raw).then(() => {
      console.log('[WSPeek] Message copied to clipboard');
    }).catch((err) => {
      console.error('[WSPeek] Failed to copy:', err);
    });
  }

  truncatePreview(str, maxLen) {
    if (str.length > maxLen) {
      return str.substring(0, maxLen) + '…';
    }
    return str;
  }

  formatTime(date) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  deleteMessage(index) {
    if (index < 0 || index >= this.messages.length) return;
    this.messages.splice(index, 1);
    if (this.currentMessageIndex === index) {
      this.showList();
    }
    this.renderList();
  }
}

customElements.define('wspeek-incoming', WSPeekIncoming);
