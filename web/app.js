const messagesEl = document.getElementById('messages');
const formEl = document.getElementById('form');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');

const conversation = [
  { role: 'system', content: 'You are a helpful assistant. Provide direct, clear answers without showing your reasoning process.' }
];

function appendMessage(role, content) {
  const row = document.createElement('div');
  row.className = `msg ${role}`;

  const avatar = document.createElement('div');
  avatar.className = `role ${role}`;
  avatar.textContent = role === 'user' ? 'U' : 'A';

  const body = document.createElement('div');
  body.className = 'content';
  body.textContent = content;

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


