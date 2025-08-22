const messagesEl = document.getElementById('messages');
const formEl = document.getElementById('form');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');
const themeSelectEl = document.getElementById('theme-select');

const conversation = [
  { role: 'system', content: 'You are a helpful assistant. Provide direct, clear answers without showing your reasoning process.' }
];

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inlineMd(text) {
  let t = escapeHtml(text);
  // Inline code
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold and italics
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Links
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return t;
}

function markdownToHtml(md) {
  if (!md) return '';
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  let html = '';

  function parseTable(startIndex) {
    const header = lines[startIndex].trim();
    const sep = lines[startIndex + 1] || '';
    if (!/\|/.test(header) || !/^\s*\|?\s*:?[-\s|:]+:?\s*\|?\s*$/.test(sep)) return null;

    function splitRow(row) {
      return row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => inlineMd(c.trim()));
    }

    const headers = splitRow(header);
    let j = startIndex + 2;
    const rows = [];
    while (j < lines.length && /\|/.test(lines[j])) {
      rows.push(splitRow(lines[j]));
      j++;
    }
    let table = '<table><thead><tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead>'; 
    if (rows.length) {
      table += '<tbody>' + rows.map(r => '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>').join('') + '</tbody>';
    }
    table += '</table>';
    return { html: table, next: j };
  }

  while (i < lines.length) {
    const line = lines[i];

    // Code fence
    if (/^```/.test(line)) {
      const fence = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { fence.push(lines[i]); i++; }
      i++; // skip closing fence
      html += `<pre><code>${escapeHtml(fence.join('\n'))}</code></pre>`;
      continue;
    }

    // Table
    const table = parseTable(i);
    if (table) {
      html += table.html;
      i = table.next;
      continue;
    }

    // Headings
    const m = line.match(/^(#{1,6})\s+(.*)$/);
    if (m) {
      const level = m[1].length;
      html += `<h${level}>${inlineMd(m[2].trim())}</h${level}>`;
      i++;
      continue;
    }

    // Lists
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const tag = ordered ? 'ol' : 'ul';
      html += `<${tag}>`;
      while (i < lines.length && (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]))) {
        const item = lines[i].replace(/^\s*([-*]|\d+\.)\s+/, '');
        html += `<li>${inlineMd(item)}</li>`;
        i++;
      }
      html += `</${tag}>`;
      continue;
    }

    // Blank line
    if (!line.trim()) { i++; continue; }

    // Paragraph (collect consecutive non-empty, non-structured lines)
    const para = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#{1,6})\s+/.test(lines[i]) && !/^```/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    html += `<p>${inlineMd(para.join(' '))}</p>`;
  }

  return html;
}

function appendMessage(role, content) {
  const row = document.createElement('div');
  row.className = `msg ${role}`;

  const avatar = document.createElement('div');
  avatar.className = `role ${role}`;
  avatar.textContent = role === 'user' ? 'U' : 'A';

  const body = document.createElement('div');
  body.className = 'content';
  if (role === 'assistant') {
    body.innerHTML = markdownToHtml(content);
  } else {
    body.textContent = content;
  }

  // Actions (copy)
  const actions = document.createElement('div');
  actions.className = 'actions';
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'action-btn';
  copyBtn.textContent = 'Copy';
  copyBtn.addEventListener('click', async () => {
    const text = role === 'assistant' ? body.innerText : body.textContent;
    try { await navigator.clipboard.writeText(text); copyBtn.textContent = 'Copied'; setTimeout(()=>copyBtn.textContent='Copy', 1200); } catch {}
  });
  actions.appendChild(copyBtn);

  row.appendChild(avatar);
  row.appendChild(body);
  row.appendChild(actions);
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

formEl.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = inputEl.value.trim();
  if (!text) return;

  // Optimistic render
  appendMessage('user', text);
  conversation.push({ role: 'user', content: text });

  inputEl.value = '';
  inputEl.disabled = true;
  sendBtn.disabled = true;

  try {
    // Create placeholder assistant message to stream into
    const row = document.createElement('div');
    row.className = 'msg assistant';
    const avatar = document.createElement('div');
    avatar.className = 'role assistant';
    avatar.textContent = 'A';
    const body = document.createElement('div');
    body.className = 'content';
    row.appendChild(avatar);
    row.appendChild(body);
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    const res = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: conversation, max_tokens: 300 })
    });

    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({ error: 'Request failed' }));
      body.textContent = data.error || 'Request failed';
      conversation.push({ role: 'assistant', content: body.textContent });
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Parse SSE lines
      const parts = buffer.split('\n\n');
      buffer = parts.pop();
      for (const part of parts) {
        const line = part.trim();
        if (!line) continue;
        if (line.startsWith('event:')) continue; // we only need data lines here
        const dataLine = line.replace(/^data:\s?/, '');
        if (dataLine === 'end') {
          // finalize markdown rendering
          body.innerHTML = markdownToHtml(fullText);
          conversation.push({ role: 'assistant', content: fullText });
          continue;
        }
        fullText += dataLine;
        // Optimistic inline render to keep it fast without re-parsing full markdown every token
        body.textContent = fullText;
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    }

    // Safety: finalize once more
    body.innerHTML = markdownToHtml(fullText);
    conversation.push({ role: 'assistant', content: fullText });
  } catch (err) {
    appendMessage('assistant', String(err));
  } finally {
    inputEl.disabled = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }
});

// Submit on Enter (Shift+Enter for newline)
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    formEl.requestSubmit();
  }
});

// Auto-resize textarea
const autoResize = () => {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(400, inputEl.scrollHeight) + 'px';
};
inputEl.addEventListener('input', autoResize);
setTimeout(autoResize, 0);

// Theme handling with persistence
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  themeSelectEl.value = theme;
}
const savedTheme = localStorage.getItem('theme') || 'dark';
applyTheme(savedTheme);
themeSelectEl.addEventListener('change', (e) => {
  const t = e.target.value;
  applyTheme(t);
  localStorage.setItem('theme', t);
});


