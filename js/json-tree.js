/**
 * renderJsonTree - Converts a JavaScript value into an interactive JSON tree DOM
 *
 * Returns a <ul> element with nested <li> items, syntax-highlighted and collapsible.
 * All nodes are expanded by default. Click chevron to toggle collapse/expand.
 */

export function renderJsonTree(val) {
  const root = document.createElement('ul');
  root.className = 'json-tree';

  const renderValue = (v, depth = 0) => {
    const li = document.createElement('li');
    const node = document.createElement('div');
    node.className = 'tree-node';

    // Determine if this value has children (objects/arrays)
    const hasChildren = (v !== null && typeof v === 'object');
    const isArray = Array.isArray(v);

    // Create chevron (expandable toggle)
    const chevron = document.createElement('span');
    chevron.className = hasChildren ? 'chevron' : 'chevron empty';

    if (hasChildren) {
      chevron.textContent = '▼';
      chevron.style.cursor = 'pointer';
    }

    // Create value display
    const valueSpan = document.createElement('span');

    if (v === null) {
      valueSpan.className = 'bool-null';
      valueSpan.textContent = 'null';
    } else if (typeof v === 'boolean') {
      valueSpan.className = 'bool-null';
      valueSpan.textContent = v ? 'true' : 'false';
    } else if (typeof v === 'number') {
      valueSpan.className = 'num';
      valueSpan.textContent = v.toString();
    } else if (typeof v === 'string') {
      valueSpan.className = 'str';
      valueSpan.textContent = `"${escapeString(v)}"`;
    } else if (isArray) {
      valueSpan.textContent = `[${v.length}]`;
      valueSpan.className = '';
    } else if (typeof v === 'object') {
      const keys = Object.keys(v);
      valueSpan.textContent = `{${keys.length}}`;
      valueSpan.className = '';
    }

    node.appendChild(chevron);
    node.appendChild(valueSpan);

    // Create children container (initially visible)
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'children visible';

    if (hasChildren) {
      if (isArray) {
        v.forEach((item, index) => {
          const child = renderArrayItem(item, index, depth + 1);
          childrenContainer.appendChild(child);
        });
      } else {
        Object.keys(v).forEach(key => {
          const child = renderObjectItem(key, v[key], depth + 1);
          childrenContainer.appendChild(child);
        });
      }

      // Toggle handler
      chevron.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = childrenContainer.classList.contains('visible');

        if (isVisible) {
          childrenContainer.classList.remove('visible');
          chevron.textContent = '▶';
          const placeholder = document.createElement('span');
          placeholder.className = 'placeholder';
          placeholder.textContent = isArray ? '[…]' : '{…}';

          // Replace valueSpan with placeholder
          const oldValue = node.querySelector('span:not(.chevron)');
          if (oldValue && oldValue !== placeholder) {
            node.replaceChild(placeholder, oldValue);
          }
        } else {
          childrenContainer.classList.add('visible');
          chevron.textContent = '▼';

          // Restore the original value display
          const placeholder = node.querySelector('.placeholder');
          if (placeholder) {
            node.replaceChild(valueSpan, placeholder);
          }
        }
      });
    }

    li.appendChild(node);
    li.appendChild(childrenContainer);

    return li;
  };

  const renderArrayItem = (item, index, depth) => {
    const li = document.createElement('li');
    const node = document.createElement('div');
    node.className = 'tree-node';

    const hasChildren = (item !== null && typeof item === 'object');
    const isArray = Array.isArray(item);

    // Chevron
    const chevron = document.createElement('span');
    chevron.className = hasChildren ? 'chevron' : 'chevron empty';

    if (hasChildren) {
      chevron.textContent = '▼';
      chevron.style.cursor = 'pointer';
    }

    // Index + value
    const indexSpan = document.createElement('span');
    indexSpan.className = 'key';
    indexSpan.textContent = `[${index}]: `;

    const valueSpan = document.createElement('span');

    if (item === null) {
      valueSpan.className = 'bool-null';
      valueSpan.textContent = 'null';
    } else if (typeof item === 'boolean') {
      valueSpan.className = 'bool-null';
      valueSpan.textContent = item ? 'true' : 'false';
    } else if (typeof item === 'number') {
      valueSpan.className = 'num';
      valueSpan.textContent = item.toString();
    } else if (typeof item === 'string') {
      valueSpan.className = 'str';
      valueSpan.textContent = `"${escapeString(item)}"`;
    } else if (isArray) {
      valueSpan.textContent = `[${item.length}]`;
    } else if (typeof item === 'object') {
      const keys = Object.keys(item);
      valueSpan.textContent = `{${keys.length}}`;
    }

    node.appendChild(chevron);
    node.appendChild(indexSpan);
    node.appendChild(valueSpan);

    // Children container
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'children visible';

    if (hasChildren) {
      if (isArray) {
        item.forEach((subitem, subindex) => {
          const child = renderArrayItem(subitem, subindex, depth + 1);
          childrenContainer.appendChild(child);
        });
      } else {
        Object.keys(item).forEach(key => {
          const child = renderObjectItem(key, item[key], depth + 1);
          childrenContainer.appendChild(child);
        });
      }

      chevron.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = childrenContainer.classList.contains('visible');

        if (isVisible) {
          childrenContainer.classList.remove('visible');
          chevron.textContent = '▶';
          const placeholder = document.createElement('span');
          placeholder.className = 'placeholder';
          placeholder.textContent = isArray ? '[…]' : '{…}';
          const oldValue = node.querySelector('span:last-child');
          node.replaceChild(placeholder, oldValue);
        } else {
          childrenContainer.classList.add('visible');
          chevron.textContent = '▼';
          const placeholder = node.querySelector('.placeholder');
          if (placeholder) {
            node.replaceChild(valueSpan, placeholder);
          }
        }
      });
    }

    li.appendChild(node);
    li.appendChild(childrenContainer);

    return li;
  };

  const renderObjectItem = (key, val, depth) => {
    const li = document.createElement('li');
    const node = document.createElement('div');
    node.className = 'tree-node';

    const hasChildren = (val !== null && typeof val === 'object');
    const isArray = Array.isArray(val);

    // Chevron
    const chevron = document.createElement('span');
    chevron.className = hasChildren ? 'chevron' : 'chevron empty';

    if (hasChildren) {
      chevron.textContent = '▼';
      chevron.style.cursor = 'pointer';
    }

    // Key
    const keySpan = document.createElement('span');
    keySpan.className = 'key';
    keySpan.textContent = `${key}: `;

    // Value
    const valueSpan = document.createElement('span');

    if (val === null) {
      valueSpan.className = 'bool-null';
      valueSpan.textContent = 'null';
    } else if (typeof val === 'boolean') {
      valueSpan.className = 'bool-null';
      valueSpan.textContent = val ? 'true' : 'false';
    } else if (typeof val === 'number') {
      valueSpan.className = 'num';
      valueSpan.textContent = val.toString();
    } else if (typeof val === 'string') {
      valueSpan.className = 'str';
      valueSpan.textContent = `"${escapeString(val)}"`;
    } else if (isArray) {
      valueSpan.textContent = `[${val.length}]`;
    } else if (typeof val === 'object') {
      const keys = Object.keys(val);
      valueSpan.textContent = `{${keys.length}}`;
    }

    node.appendChild(chevron);
    node.appendChild(keySpan);
    node.appendChild(valueSpan);

    // Children container
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'children visible';

    if (hasChildren) {
      if (isArray) {
        val.forEach((item, index) => {
          const child = renderArrayItem(item, index, depth + 1);
          childrenContainer.appendChild(child);
        });
      } else {
        Object.keys(val).forEach(subkey => {
          const child = renderObjectItem(subkey, val[subkey], depth + 1);
          childrenContainer.appendChild(child);
        });
      }

      chevron.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = childrenContainer.classList.contains('visible');

        if (isVisible) {
          childrenContainer.classList.remove('visible');
          chevron.textContent = '▶';
          const placeholder = document.createElement('span');
          placeholder.className = 'placeholder';
          placeholder.textContent = isArray ? '[…]' : '{…}';
          const oldValue = node.querySelector('span:last-child');
          node.replaceChild(placeholder, oldValue);
        } else {
          childrenContainer.classList.add('visible');
          chevron.textContent = '▼';
          const placeholder = node.querySelector('.placeholder');
          if (placeholder) {
            node.replaceChild(valueSpan, placeholder);
          }
        }
      });
    }

    li.appendChild(node);
    li.appendChild(childrenContainer);

    return li;
  };

  root.appendChild(renderValue(val));

  return root;
}

/**
 * Escape special characters in strings for safe display
 */
function escapeString(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
