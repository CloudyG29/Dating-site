// ─── CONFIG (swap these out) ──────────────────────────────
const CURRENT_USER_ID = 1; // logged-in user's ID from your session/auth
const MATCH_ID = 5; // ID of the accepted request (from requests table)
// ──────────────────────────────────────────────────────────

const messagesEl = document.getElementById("messages");
const input = document.getElementById("msg-input");
const pollStatus = document.getElementById("poll-status");

const messageIds = new Set(); // prevents duplicate renders on every poll

function formatTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Builds and appends a message bubble to the chat window
function renderMessage(msg) {
  if (messageIds.has(msg.id)) return; // already rendered, skip
  messageIds.add(msg.id);

  const isMine = msg.senderId === CURRENT_USER_ID;
  const div = document.createElement("div");
  div.className = `msg ${isMine ? "mine" : "theirs"}`;
  div.innerHTML = `
    <div class="bubble">${msg.content}</div>
    <div class="msg-time">${msg.sentAt}</div>
  `;
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight; // auto-scroll to bottom
}

// Sends a new message to the backend
async function sendMessage() {
  const content = input.value.trim();
  if (!content) return;
  input.value = "";

  // Show message instantly without waiting for server (optimistic UI)
  renderMessage({
    id: `local-${Date.now()}`,
    senderId: CURRENT_USER_ID,
    content,
    sentAt: formatTime(),
  });

  await fetch("/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      matchId: MATCH_ID,
      senderId: CURRENT_USER_ID,
      content,
    }),
  });
}

// Asks the backend for new messages every 3 seconds
async function poll() {
  const res = await fetch(`/messages/${MATCH_ID}`);
  const messages = await res.json();
  messages.forEach(renderMessage); // renderMessage skips any already shown
  pollStatus.textContent = `Last synced at ${formatTime()}`;
}

// Wire up send button and Enter key
document.getElementById("send-btn").addEventListener("click", sendMessage);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

// Load existing messages immediately when chat opens
poll();

// Then keep polling every 3 seconds
setInterval(poll, 3000);
