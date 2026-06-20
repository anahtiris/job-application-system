const API = "http://localhost:8000";

const PROMPT_PROCESS = "Process my captured jobs";
const PROMPT_BATCH   = "Process my captured jobs in batches of 4 — stop after each batch so I can /clear before the next";

async function checkBackend() {
  const dot = document.getElementById("statusDot");
  try {
    const r = await fetch(`${API}/api/health`, { signal: AbortSignal.timeout(2000) });
    dot.className = r.ok ? "status-dot online" : "status-dot offline";
  } catch {
    dot.className = "status-dot offline";
  }
}

function showMessage(text, type) {
  const el = document.getElementById("message");
  el.textContent = text;
  el.className = `message ${type}`;
}

async function refreshQueue() {
  try {
    const r = await fetch(`${API}/api/leads/pending-count`, { signal: AbortSignal.timeout(2000) });
    if (!r.ok) return;
    const { count } = await r.json();

    const queue       = document.getElementById("queue");
    const badge       = document.getElementById("queueBadge");
    const processBtn  = document.getElementById("copyProcessBtn");
    const batchBtn    = document.getElementById("copyBatchBtn");

    if (count === 0) {
      queue.classList.remove("visible");
      return;
    }

    badge.textContent = count;
    badge.className   = `queue-badge${count > 4 ? " hot" : ""}`;
    queue.classList.add("visible");

    processBtn.style.display = count > 1 ? "block" : "none";
    batchBtn.style.display   = count > 4 ? "block" : "none";
  } catch {
    // backend unreachable — queue section stays hidden
  }
}

function notifyCapture(label) {
  if (!chrome.notifications) return;
  chrome.notifications.create({
    type:    "basic",
    iconUrl: "icon-48.png",
    title:   "Job Capture",
    message: label,
  });
}

function copyPrompt(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.textContent;
    btn.textContent = "Copied!";
    btn.classList.add("copied");
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove("copied");
      btn.disabled = false;
    }, 1500);
  });
}

document.getElementById("copyProcessBtn").addEventListener("click", function () {
  copyPrompt(this, PROMPT_PROCESS);
});

document.getElementById("copyBatchBtn").addEventListener("click", function () {
  copyPrompt(this, PROMPT_BATCH);
});

document.getElementById("captureBtn").addEventListener("click", async () => {
  const btn = document.getElementById("captureBtn");
  btn.disabled = true;

  let elapsed = 0;
  let timer = null;

  function startTimer() {
    elapsed = 0;
    timer = setInterval(() => {
      elapsed++;
      showMessage(`Saving… ${elapsed}s`, "info");
    }, 1000);
  }

  function stopTimer() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  try {
    btn.textContent = "Reading page…";
    showMessage("Reading page content…", "info");

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({ text: document.body.innerText, url: location.href }),
    });

    const { text, url } = results[0].result;

    btn.textContent = "Saving…";
    startTimer();

    const r = await fetch(`${API}/api/leads/from-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, source_url: url }),
    });

    stopTimer();

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.detail || `HTTP ${r.status}`);
    }

    const data = await r.json();
    const label = data.duplicate ? "Already captured" : "Job captured!";

    showMessage(label, "success");
    notifyCapture(label);
    btn.textContent = "Capture Job";
    btn.disabled = false;

    await refreshQueue();

  } catch (err) {
    stopTimer();
    showMessage(
      (err.message.includes("fetch") || err.message.includes("Failed"))
        ? "Cannot reach backend — is it running on port 8000?"
        : err.message,
      "error"
    );
    btn.disabled = false;
    btn.textContent = "Capture Job";
  }
});

checkBackend();
refreshQueue();
