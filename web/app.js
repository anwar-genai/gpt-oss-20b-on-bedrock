const messagesEl = document.getElementById('messages');
const formEl = document.getElementById('form');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');
const themeSelectEl = document.getElementById('theme-select');
const newChatBtn = document.getElementById('new-chat');
const chatListEl = document.getElementById('chat-list');
const scrollBtn = document.getElementById('scroll-bottom');
const layoutEl = document.querySelector('.layout');

// Conversation state and history
let conversation = [
  { role: 'system', content: 'You are a helpful assistant. Always format responses in Markdown with clear headings, paragraphs, numbered/bulleted lists, and tables when appropriate. Do not include hidden reasoning. Do not use HTML tags; use pure Markdown only. When approaching token limits, conclude your response naturally with a summary or next steps rather than cutting off mid-sentence.' }
];
let currentChatId = localStorage.getItem('currentChatId') || null;
let chats = JSON.parse(localStorage.getItem('chats') || '{}');
let favorites = JSON.parse(localStorage.getItem('favorites') || '[]');

function saveState() {
  localStorage.setItem('chats', JSON.stringify(chats));
  if (currentChatId) localStorage.setItem('currentChatId', currentChatId);
  else localStorage.removeItem('currentChatId');
  localStorage.setItem('favorites', JSON.stringify(favorites));
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

function enhanceCodeBlocks(container) {
  if (!container) return;
  
  // Find all code blocks
  const codeBlocks = container.querySelectorAll('pre code');
  codeBlocks.forEach((codeBlock) => {
    const pre = codeBlock.parentElement;
    
    // Skip if already enhanced with header
    if (pre.querySelector('.code-block-header')) return;
    
    // Detect language from class name
    const className = codeBlock.className;
    const language = className.match(/language-(\w+)/) ? className.match(/language-(\w+)/)[1] : 'code';
    
    // Wrap code in scroll container
    if (!codeBlock.parentElement.classList.contains('code-scroll')) {
      const scrollWrap = document.createElement('div');
      scrollWrap.className = 'code-scroll';
      codeBlock.parentNode.replaceChild(scrollWrap, codeBlock);
      scrollWrap.appendChild(codeBlock);
    }
    
    // Header with language and copy button
    const header = document.createElement('div');
    header.className = 'code-block-header';
    header.innerHTML = `
      <span class="code-language">${language}</span>
      <button class="copy-code-btn" onclick="copyCodeBlock(this)">Copy</button>
    `;
    pre.insertBefore(header, pre.firstChild);
    
    // Apply syntax highlighting
    if (typeof Prism !== 'undefined') {
      Prism.highlightElement(codeBlock);
    }
  });
}

function enhanceTables(container) {
  if (!container) return;
  const tables = container.querySelectorAll(':scope > table, table');
  tables.forEach((tbl) => {
    if (tbl.parentElement && tbl.parentElement.classList.contains('table-scroll')) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'table-scroll';
    tbl.parentNode.replaceChild(wrapper, tbl);
    wrapper.appendChild(tbl);
  });
}

function copyCodeBlock(button) {
  const codeBlock = button.parentElement.nextElementSibling;
  const text = codeBlock.textContent;
  
  navigator.clipboard.writeText(text).then(() => {
    button.textContent = 'Copied!';
    button.classList.add('copied');
    setTimeout(() => {
      button.textContent = 'Copy';
      button.classList.remove('copied');
    }, 2000);
  }).catch(() => {
    button.textContent = 'Failed';
    setTimeout(() => {
      button.textContent = 'Copy';
    }, 2000);
  });
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

function updateMessagesLayout() {
  if (!messagesEl) return;
  const hasMessages = messagesEl.children.length > 0;
  if (hasMessages) {
    messagesEl.classList.remove('empty');
    messagesEl.closest('.chat')?.classList.remove('empty-chat');
    // Remove welcome message if it exists
    const welcomeMsg = messagesEl.querySelector('.welcome-message');
    if (welcomeMsg) {
      welcomeMsg.remove();
    }
  } else {
    messagesEl.classList.add('empty');
    messagesEl.closest('.chat')?.classList.add('empty-chat');
    // Add welcome message if it doesn't exist
    if (!messagesEl.querySelector('.welcome-message')) {
      const welcomeDiv = document.createElement('div');
      welcomeDiv.className = 'welcome-message';
      welcomeDiv.innerHTML = `
        <div class="welcome-hero">
          <h2>Welcome to ChatAnwar</h2>
          <div class="sub">Ask anything. Try one of these to get started:</div>
        </div>
        <div class="suggestions">
          <button class="suggestion" data-prompt="Give me a 7-day meal plan with shopping list.">Healthy 7‑day meal plan + shopping list</button>
          <button class="suggestion" data-prompt="Draft a polite email requesting a project deadline extension.">Draft a polite extension email</button>
          <button class="suggestion" data-prompt="Explain Kubernetes like I'm new to DevOps.">Explain Kubernetes for beginners</button>
          <button class="suggestion" data-prompt="Write a Python script that renames files by date.">Python script: rename files by date</button>
          <button class="suggestion" data-prompt="Create a study plan to learn SQL in 2 weeks.">2‑week SQL study plan</button>
          <button class="suggestion" data-prompt="Summarize the key points of Clean Code.">Summarize Clean Code</button>
        </div>
        <div class="welcome-bottom"><h3>Start a new chat below</h3></div>
        <div class="hint-row">Press <strong>Enter</strong> to send • <strong>Shift+Enter</strong> for newline</div>
      `;
      messagesEl.appendChild(welcomeDiv);
      // Wire suggestions
      welcomeDiv.querySelectorAll('.suggestion').forEach(btn => {
        btn.addEventListener('click', () => {
          const prompt = btn.getAttribute('data-prompt') || btn.textContent;
          inputEl.value = prompt;
          inputEl.focus();
        });
      });
    }
  }
  // Force a reflow to ensure the layout updates
  messagesEl.offsetHeight;
}

function scrollToBottom() {
  // With page-level scrolling, just scroll the window to the bottom
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
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
    // Prevent UI from expanding horizontally for long user lines
    body.textContent = content;
  }

  bubble.appendChild(avatar);
  bubble.appendChild(body);
  
  // Only add copy button for assistant messages
  if (role === 'assistant') {
    const actions = document.createElement('div');
    actions.className = 'actions';
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'action-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', async () => {
      const text = body.innerText;
      try { await navigator.clipboard.writeText(text); copyBtn.textContent = 'Copied'; setTimeout(()=>copyBtn.textContent='Copy', 1200); } catch {}
    });
    actions.appendChild(copyBtn);
    bubble.appendChild(actions);
  }
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  
  // Enhance code blocks with syntax highlighting and copy buttons
  if (role === 'assistant') {
    enhanceCodeBlocks(body);
    enhanceTables(body);
  }
  
  updateMessagesLayout();
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
      chats[id] = { id, title: data.title, messages: [...conversation], createdAt: ts, isFavorite: false };
      currentChatId = id;
      saveState();
      renderChatList();
      return id;
    }
  } catch (e) {
    // fall through to local-only
  }
  const id = 'c_' + ts;
  chats[id] = { id, title: title || 'New chat', messages: [...conversation], createdAt: ts, isFavorite: false };
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
    const isFav = !!chat.isFavorite || favorites.includes(id);
    btn.innerHTML = `<span class="title">${escapeHtml(chat.title)}</span><button class="star${isFav ? ' active' : ''}" title="Toggle favorite">${isFav ? '★' : '☆'}</button>`;
    btn.addEventListener('click', () => {
      loadChat(id);
      // reflect selection in URL and storage
      try { history.replaceState(null, '', `#chat=${encodeURIComponent(id)}`); } catch {}
      saveState();
    });
    // Star toggle
    btn.querySelector('.star')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      // Call backend if server id; fallback to local
      if (!String(id).startsWith('c_')) {
        try {
          const desired = !isFav;
          const res = await fetch(`/api/chats/${encodeURIComponent(id)}/favorite`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ favorite: desired })
          });
          if (res.ok) {
            chats[id].isFavorite = desired;
          }
        } catch {}
      } else {
        const idx = favorites.indexOf(id);
        if (idx >= 0) favorites.splice(idx, 1); else favorites.push(id);
      }
      saveState(); renderChatList();
    });
    chatListEl.appendChild(btn);
  }
}

function loadChat(id) {
  const chat = chats[id];
  if (!chat) return;
  currentChatId = id;
  try { history.replaceState(null, '', `#chat=${encodeURIComponent(id)}`); } catch {}
  saveState();
  messagesEl.innerHTML = '';
  conversation = chat.messages.map(m => ({...m}));
  for (const m of conversation) {
    if (m.role === 'system') continue;
    appendMessage(m.role, m.content);
  }
  updateMessagesLayout();
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
    try { history.replaceState(null, '', `#chat=${encodeURIComponent(currentChatId)}`); } catch {}
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
    
    // Enhance code blocks with syntax highlighting and copy buttons
    enhanceCodeBlocks(body);
    
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

// Fixed height textarea - no auto-resize needed

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
  inputEl.focus();
  currentChatId = null;
  try { history.replaceState(null, '', window.location.pathname); } catch {}
  updateMessagesLayout();
  renderChatList();
  console.log('New chat started, conversation reset');
});

// Initial load: restore last chat if available; otherwise start fresh
function bootstrapChats() {
  try {
    const storedChats = JSON.parse(localStorage.getItem('chats') || '{}');
    chats = storedChats;
    // Prefer URL hash chat id if present, else stored currentChatId
    let urlChatId = null;
    try {
      const hash = window.location.hash || '';
      const match = hash.match(/[#&]?chat=([^&]+)/);
      if (match) urlChatId = decodeURIComponent(match[1]);
    } catch {}
    const storedId = localStorage.getItem('currentChatId');
    currentChatId = (urlChatId && chats[urlChatId]) ? urlChatId : (storedId && chats[storedId] ? storedId : null);
  } catch {
    chats = {};
    currentChatId = null;
  }

  renderChatList();

  if (currentChatId && chats[currentChatId]) {
    loadChat(currentChatId);
  } else {
    // Fresh empty state
    conversation = [
      { role: 'system', content: 'You are a helpful assistant. Always format responses in Markdown with clear headings, paragraphs, numbered/bulleted lists, and tables when appropriate. Do not include hidden reasoning. Do not use HTML tags; use pure Markdown only. When approaching token limits, conclude your response naturally with a summary or next steps rather than cutting off mid-sentence.' }
    ];
    messagesEl.innerHTML = '';
    updateMessagesLayout();
  }
  inputEl.focus();
}

// Scroll to bottom controller
const atBottom = () => (window.innerHeight + window.scrollY) >= (document.body.scrollHeight - 2);
window.addEventListener('scroll', () => {
  if (atBottom()) scrollBtn.style.display = 'none';
  else scrollBtn.style.display = 'grid';
});
scrollBtn?.addEventListener('click', () => {
  messagesEl.scrollTop = messagesEl.scrollHeight;
  scrollBtn.style.display = 'none';
});

// Copy entire chat functionality
function copyEntireChat() {
  const copyBtn = document.getElementById('copyChatBtn');
  if (!copyBtn) return;
  
  let chatText = '';
  const messages = messagesEl.querySelectorAll('.msg');
  
  messages.forEach(msg => {
    const role = msg.querySelector('.role');
    const content = msg.querySelector('.content');
    
    if (role && content) {
      const roleText = role.textContent === 'U' ? 'User' : 'Assistant';
      const contentText = content.innerText || content.textContent;
      chatText += `${roleText}: ${contentText}\n\n`;
    }
  });
  
  if (chatText.trim()) {
    navigator.clipboard.writeText(chatText.trim()).then(() => {
      copyBtn.classList.add('copied');
      copyBtn.textContent = '✓';
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyBtn.textContent = '📋';
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy chat:', err);
    });
  }
}

// Chat history search functionality
let chatSearchResults = [];
let allChats = [];

function searchChatHistory(query) {
  if (!query.trim()) {
    // Show all chats if search is empty
    restoreAllChats();
    return;
  }
  
  const chatItems = document.querySelectorAll('.sidebar .item');
  chatSearchResults = [];
  
  chatItems.forEach((item, index) => {
    const title = item.querySelector('.title');
    const text = title ? title.textContent.toLowerCase() : '';
    const isMatch = text.includes(query.toLowerCase());
    
    if (isMatch) {
      chatSearchResults.push(item);
      item.style.display = 'flex';
      // Highlight search terms
      highlightSearchTerms(title, query);
    } else {
      item.style.display = 'none';
    }
  });
}

function highlightSearchTerms(element, query) {
  const text = element.innerHTML;
  const regex = new RegExp(`(${query})`, 'gi');
  element.innerHTML = text.replace(regex, '<mark style="background: color-mix(in oklab, var(--accent) 30%, transparent); padding: 2px 4px; border-radius: 4px;">$1</mark>');
}

function restoreAllChats() {
  const chatItems = document.querySelectorAll('.sidebar .item');
  chatItems.forEach(item => {
    item.style.display = 'flex';
    const title = item.querySelector('.title');
    if (title) {
      // Remove highlighting
      title.innerHTML = title.textContent;
    }
  });
  chatSearchResults = [];
}

// Add search functionality
document.addEventListener('DOMContentLoaded', () => {
  const copyChatBtn = document.getElementById('copyChatBtn');
  if (copyChatBtn) {
    copyChatBtn.addEventListener('click', copyEntireChat);
  }
  // Share and copy link
  const shareBtn = document.getElementById('share-chat');
  const copyLinkBtn = document.getElementById('copy-link');
  const openFavBtn = document.getElementById('open-favorites');
  const closeFavBtn = document.getElementById('close-favorites');
  const favoritesPage = document.getElementById('favorites-page');
  const favoritesList = document.getElementById('favorites-list');
  const getChatUrl = () => {
    const id = currentChatId || localStorage.getItem('currentChatId');
    const base = window.location.origin + window.location.pathname;
    return id ? `${base}#chat=${encodeURIComponent(id)}` : base;
  };
  shareBtn?.addEventListener('click', async () => {
    const url = getChatUrl();
    try {
      if (navigator.share) {
        await navigator.share({ title: 'ChatAnwar Chat', url });
      } else {
        await navigator.clipboard.writeText(url);
        shareBtn.textContent = 'Copied!';
        setTimeout(() => shareBtn.textContent = 'Share', 1200);
      }
    } catch {}
  });
  copyLinkBtn?.addEventListener('click', async () => {
    const url = getChatUrl();
    try {
      await navigator.clipboard.writeText(url);
      copyLinkBtn.textContent = 'Copied!';
      setTimeout(() => copyLinkBtn.textContent = 'Copy link', 1200);
    } catch {}
  });

  const renderFavoritesPage = () => {
    if (!favoritesList) return;
    favoritesList.innerHTML = '';
    const favIds = Object.keys(chats).filter(id => chats[id].isFavorite || favorites.includes(id));
    if (favIds.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = 'No favorites yet. Click ★ next to a chat to favorite it.';
      favoritesList.appendChild(empty);
      return;
    }
    favIds.forEach(id => {
      const chat = chats[id];
      const row = document.createElement('button');
      row.className = 'item';
      row.innerHTML = `<span class="title">${escapeHtml(chat.title)}</span><span class="star active">★</span>`;
      row.addEventListener('click', () => {
        favoritesPage.style.display = 'none';
        document.querySelector('.messages').style.display = '';
        loadChat(id);
      });
      favoritesList.appendChild(row);
    });
  };

  openFavBtn?.addEventListener('click', () => {
    if (!favoritesPage) return;
    renderFavoritesPage();
    favoritesPage.style.display = '';
    document.querySelector('.messages').style.display = 'none';
  });
  closeFavBtn?.addEventListener('click', () => {
    if (!favoritesPage) return;
    favoritesPage.style.display = 'none';
    document.querySelector('.messages').style.display = '';
  });
  // Sidebar toggle persistence
  try {
    const collapsed = localStorage.getItem('sidebarCollapsed') === '1';
    if (collapsed) layoutEl.classList.add('collapsed');
  } catch {}
  const toggleBtn = document.getElementById('toggle-sidebar');
  const revealBtn = document.getElementById('reveal-sidebar');
  const setCollapsed = (isCollapsed) => {
    if (isCollapsed) layoutEl.classList.add('collapsed');
    else layoutEl.classList.remove('collapsed');
    try { localStorage.setItem('sidebarCollapsed', isCollapsed ? '1' : '0'); } catch {}
    // Update labels
    if (toggleBtn) toggleBtn.textContent = isCollapsed ? 'Show ⟩' : '⟨ Hide';
  };
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => setCollapsed(!layoutEl.classList.contains('collapsed')));
  }
  if (revealBtn) {
    revealBtn.addEventListener('click', () => setCollapsed(false));
  }
  
  const chatSearchInput = document.getElementById('chatSearchInput');
  
  if (chatSearchInput) {
    chatSearchInput.addEventListener('input', (e) => {
      searchChatHistory(e.target.value);
    });
    
    chatSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        chatSearchInput.value = '';
        restoreAllChats();
        chatSearchInput.blur();
      }
    });
  }
  // Bootstrap chats and UI state
  bootstrapChats();

  // Initial fetch of server chats to hydrate titles and favorites
  (async () => {
    try {
      const res = await fetch('/api/chats');
      if (res.ok) {
        const list = await res.json();
        list.forEach(c => {
          const id = String(c.id);
          if (!chats[id]) chats[id] = { id, title: c.title, messages: [], createdAt: Date.parse(c.createdAt) || Date.now(), isFavorite: !!c.isFavorite };
          else chats[id].isFavorite = !!c.isFavorite;
        });
        saveState();
        renderChatList();
      }
    } catch {}
  })();
});


