const messagesEl = document.getElementById('messages');
const formEl = document.getElementById('form');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');
const themeSelectEl = document.getElementById('theme-select');
const newChatBtn = document.getElementById('new-chat');
const chatListEl = document.getElementById('chat-list');
const scrollBtn = document.getElementById('scroll-bottom');

// Conversation state and history
let conversation = [
  { role: 'system', content: 'You are a helpful assistant. Always format responses in Markdown with clear headings, paragraphs, numbered/bulleted lists, and tables when appropriate. Do not include hidden reasoning. Do not use HTML tags; use pure Markdown only. When approaching token limits, conclude your response naturally with a summary or next steps rather than cutting off mid-sentence.' }
];
let currentChatId = localStorage.getItem('currentChatId') || null;
let chats = JSON.parse(localStorage.getItem('chats') || '{}');

function saveState() {
  localStorage.setItem('chats', JSON.stringify(chats));
  if (currentChatId) localStorage.setItem('currentChatId', currentChatId);
  else localStorage.removeItem('currentChatId');
}

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
  
  // Use marked.js if available, fallback to simple parser
  if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
    try {
      // Configure marked for better parsing
      marked.setOptions({
        breaks: true,
        gfm: true,
        tables: true,
        sanitize: false,
        smartLists: true,
        smartypants: false
      });
      
      const rawHtml = marked.parse(md);
      const sanitized = DOMPurify.sanitize(rawHtml, {
        ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a'],
        ALLOWED_ATTR: ['href', 'target', 'rel']
      });
      
      return sanitized;
    } catch (e) {
      console.warn('Marked.js failed, using fallback parser:', e);
    }
  }
  
  // Fallback parser (simplified version of the original)
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let html = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      html += `<h${level}>${inlineMd(headingMatch[2].trim())}</h${level}>`;
      continue;
    }
    
    // Lists
    if (/^\s*[-*+]\s+/.test(line)) {
      html += `<ul><li>${inlineMd(line.replace(/^\s*[-*+]\s+/, ''))}</li></ul>`;
      continue;
    }
    
    if (/^\s*\d+\.\s+/.test(line)) {
      html += `<ol><li>${inlineMd(line.replace(/^\s*\d+\.\s+/, ''))}</li></ol>`;
      continue;
    }
    
    // Code blocks
    if (line.startsWith('```')) {
      html += '<pre><code>';
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        html += escapeHtml(lines[i]) + '\n';
        i++;
      }
      html += '</code></pre>';
      continue;
    }
    
    // Paragraphs
    if (line.trim()) {
      html += `<p>${inlineMd(line)}</p>`;
    }
  }
  
  return html;
}

// Convert any inline HTML the model might return into Markdown-ish before parsing
function sanitizeModelTextToMarkdown(text) {
  if (!text) return '';
  let t = String(text);
  
  // Decode HTML entities first
  try {
    const ta = document.createElement('textarea');
    ta.innerHTML = t;
    t = ta.value;
  } catch {}
  
  // Remove accidental surrounding triple quotes
  t = t.replace(/^\s*"""\s*/, '').replace(/\s*"""\s*$/, '');
  
  // Convert HTML to Markdown
  t = t.replace(/<a\s+[^>]*?href=\"([^\"]+)\"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  t = t.replace(/<br\s*\/?>/gi, '\n');
  t = t.replace(/<\/(p|div)>/gi, '\n\n');
  t = t.replace(/<(p|div)[^>]*>/gi, '');
  t = t.replace(/<strong[^>]*>/gi, '**').replace(/<\/strong>/gi, '**');
  t = t.replace(/<b[^>]*>/gi, '**').replace(/<\/b>/gi, '**');
  t = t.replace(/<em[^>]*>/gi, '*').replace(/<\/em>/gi, '*');
  t = t.replace(/<i[^>]*>/gi, '*').replace(/<\/i>/gi, '*');
  t = t.replace(/<code[^>]*>/gi, '`').replace(/<\/code>/gi, '`');
  t = t.replace(/<pre[^>]*>/gi, '```\n').replace(/<\/pre>/gi, '\n```');
  t = t.replace(/<h1[^>]*>/gi, '# ').replace(/<\/h1>/gi, '\n\n');
  t = t.replace(/<h2[^>]*>/gi, '## ').replace(/<\/h2>/gi, '\n\n');
  t = t.replace(/<h3[^>]*>/gi, '### ').replace(/<\/h3>/gi, '\n\n');
  t = t.replace(/<h4[^>]*>/gi, '#### ').replace(/<\/h4>/gi, '\n\n');
  t = t.replace(/<li[^>]*>/gi, '- ').replace(/<\/li>/gi, '\n');
  t = t.replace(/<\/(ul|ol)>/gi, '').replace(/<(ul|ol)[^>]*>/gi, '');
  
  // Remove any remaining HTML tags
  t = t.replace(/<[^>]+>/g, '');
  
  // Clean up whitespace and ensure proper line breaks
  t = t.replace(/\n{3,}/g, '\n\n').trim();
  
  return t;
}

function scrollToBottom() {
  if (!messagesEl) return;
  // Force immediate scroll to bottom
  messagesEl.scrollTop = messagesEl.scrollHeight;
  // Also ensure it happens after any pending layout updates
  requestAnimationFrame(() => {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
  // Double-check after a short delay for any async rendering
  setTimeout(() => {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }, 10);
}

function appendMessage(role, content) {
  const row = document.createElement('div');
  row.className = 'msg';
  const bubble = document.createElement('div');
  bubble.className = `bubble ${role}`;

  const avatar = document.createElement('div');
  avatar.className = `role ${role}`;
  avatar.textContent = role === 'user' ? 'U' : 'A';

  const body = document.createElement('div');
  body.className = 'content';
  if (role === 'assistant') {
    body.innerHTML = markdownToHtml(sanitizeModelTextToMarkdown(content));
  } else {
    body.textContent = content;
  }

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

  bubble.appendChild(avatar);
  bubble.appendChild(body);
  bubble.appendChild(actions);
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  scrollToBottom();
}

function showTyping() {
  const wrap = document.createElement('div');
  wrap.className = 'typing';
  wrap.id = 'typing';
  wrap.innerHTML = '<div class="dots"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>';
  messagesEl.appendChild(wrap);
  scrollToBottom();
}

function hideTyping() {
  const t = document.getElementById('typing');
  if (t) t.remove();
}

function saveChatsToLocal() {
  if (currentChatId && chats[currentChatId]) {
    chats[currentChatId].messages = [...conversation];
    saveState();
  }
}

async function createChat(title) {
  const ts = Date.now();
  try {
    const res = await fetch('/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: (title || 'New chat').slice(0, 200) }),
    });
    if (res.ok) {
      const data = await res.json();
      const id = String(data.id);
      chats[id] = { id, title: data.title, messages: [...conversation], createdAt: ts };
      currentChatId = id;
      saveState();
      renderChatList();
      return id;
    }
  } catch (e) {
    // fall through to local-only
  }
  const id = 'c_' + ts;
  chats[id] = { id, title: title || 'New chat', messages: [...conversation], createdAt: ts };
  currentChatId = id;
  saveState();
  renderChatList();
  return id;
}

function updateCurrentChatTitleFrom(text) {
  const title = text.trim().slice(0, 40) || 'New chat';
  if (currentChatId && chats[currentChatId]) {
    chats[currentChatId].title = title;
    saveState();
    renderChatList();
  }
}

function renderChatList() {
  if (!chatListEl) return;
  chatListEl.innerHTML = '';
  const ids = Object.keys(chats).sort((a,b) => ((chats[b].createdAt||0) - (chats[a].createdAt||0)));
  for (const id of ids) {
    const chat = chats[id];
    const btn = document.createElement('button');
    btn.className = 'item' + (id === currentChatId ? ' active' : '');
    btn.innerHTML = `<span class="title">${escapeHtml(chat.title)}</span>`;
    btn.addEventListener('click', () => {
      loadChat(id);
    });
    chatListEl.appendChild(btn);
  }
}

function loadChat(id) {
  const chat = chats[id];
  if (!chat) return;
  currentChatId = id;
  messagesEl.innerHTML = '';
  conversation = chat.messages.map(m => ({...m}));
  for (const m of conversation) {
    if (m.role === 'system') continue;
    appendMessage(m.role, m.content);
  }
  renderChatList();
}

formEl.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = inputEl.value.trim();
  if (!text) return;

  // Optimistic render
  appendMessage('user', text);
  conversation.push({ role: 'user', content: text });
  if (!currentChatId) {
    currentChatId = await createChat(text);
  } else {
    updateCurrentChatTitleFrom(text);
  }

  inputEl.value = '';
  inputEl.disabled = true;
  sendBtn.disabled = true;
  showTyping();

  try {
    // Debug: log the conversation being sent (only once)
    console.log('Sending conversation to server:', conversation);
    
    // Placeholder assistant message container
    const row = document.createElement('div');
    row.className = 'msg';
    const bubble = document.createElement('div');
    bubble.className = 'bubble assistant';
    const avatar = document.createElement('div');
    avatar.className = 'role assistant';
    avatar.textContent = 'A';
    const body = document.createElement('div');
    body.className = 'content';
    bubble.appendChild(avatar);
    bubble.appendChild(body);
    row.appendChild(bubble);
    messagesEl.appendChild(row);
    scrollToBottom();

    // Use simple non-streaming API
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: conversation, max_tokens: 4000 })
    });

    if (!res.ok) {
      hideTyping();
      const data = await res.json().catch(() => ({ error: 'Request failed' }));
      body.textContent = data.error || 'Request failed';
      conversation.push({ role: 'assistant', content: body.textContent });
      saveChatsToLocal();
      return;
    }

    const data = await res.json();
    const responseText = data.text || 'No response received';
    
    hideTyping();
    const sanitized = sanitizeModelTextToMarkdown(responseText);
    body.innerHTML = markdownToHtml(sanitized);
    conversation.push({ role: 'assistant', content: responseText });
    saveChatsToLocal();
    scrollToBottom();
  } catch (err) {
    hideTyping();
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

// New chat resets conversation and UI
newChatBtn?.addEventListener('click', () => {
  conversation = [
    { role: 'system', content: 'You are a helpful assistant. Always format responses in Markdown with clear headings, paragraphs, numbered/bulleted lists, and tables when appropriate. Do not include hidden reasoning. Do not use HTML tags; use pure Markdown only. When approaching token limits, conclude your response naturally with a summary or next steps rather than cutting off mid-sentence.' }
  ];
  messagesEl.innerHTML = '';
  inputEl.value = '';
  autoResize();
  inputEl.focus();
  currentChatId = null;
  renderChatList();
  console.log('New chat started, conversation reset');
});

// Initial render of chat list
renderChatList();
if (currentChatId && chats[currentChatId]) {
  loadChat(currentChatId);
}

// Scroll to bottom controller
const atBottom = () => Math.abs(messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight) < 2;
messagesEl.addEventListener('scroll', () => {
  if (atBottom()) scrollBtn.style.display = 'none';
  else scrollBtn.style.display = 'grid';
});
scrollBtn?.addEventListener('click', () => {
  messagesEl.scrollTop = messagesEl.scrollHeight;
  scrollBtn.style.display = 'none';
});


