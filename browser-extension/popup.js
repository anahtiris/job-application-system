const API = "http://localhost:8000";
const APP = "http://localhost:3000";

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

document.getElementById("captureBtn").addEventListener("click", async () => {
  const btn = document.getElementById("captureBtn");
  btn.disabled = true;

  let elapsed = 0;
  let timer = null;

  function startTimer() {
    elapsed = 0;
    timer = setInterval(() => {
      elapsed++;
      showMessage(`AI extracting job details… ${elapsed}s`, "info");
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

    btn.textContent = "Extracting…";
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
    const label = data.duplicate ? "Already captured — opening…" : "Done! Opening app…";
    showMessage(label, "success");
    chrome.tabs.create({ url: `${APP}/leads/${data.id}` });
    setTimeout(() => window.close(), 600);

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
