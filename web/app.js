const messagesEl = document.getElementById('messages');
const formEl = document.getElementById('form');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');

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

  row.appendChild(avatar);
  row.appendChild(body);
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
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: conversation, max_tokens: 300 })
    });

    const data = await res.json();

    if (!res.ok) {
      appendMessage('assistant', data.error || 'Request failed');
      return;
    }

    const assistantText = data.text || '';
    appendMessage('assistant', assistantText);
    conversation.push({ role: 'assistant', content: assistantText });
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


