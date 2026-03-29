const tokenInput = document.querySelector("#admin-token");
const uploadForm = document.querySelector("#upload-form");
const issueForm = document.querySelector("#issue-form");
const verifyForm = document.querySelector("#verify-form");
const tokenForm = document.querySelector("#token-form");

const output = {
  config: document.querySelector("#config-output"),
  upload: document.querySelector("#upload-output"),
  issue: document.querySelector("#issue-output"),
  verify: document.querySelector("#verify-output"),
};

const statusGrid = document.querySelector("#status-grid");
const activityFeed = document.querySelector("#activity-feed");

const state = {
  adminToken: sessionStorage.getItem("chainlocker.adminToken") || "",
  lastUpload: null,
};

tokenInput.value = state.adminToken;

tokenForm.addEventListener("submit", (event) => {
  event.preventDefault();
  state.adminToken = tokenInput.value.trim();
  sessionStorage.setItem("chainlocker.adminToken", state.adminToken);
});

document.querySelector("#refresh-status").addEventListener("click", refreshStatus);
document.querySelector("#refresh-activity").addEventListener("click", loadActivity);

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(uploadForm);
  const response = await api("/api/v1/documents/upload", {
    method: "POST",
    body: formData,
  }, true);

  renderJson(output.upload, response);
  state.lastUpload = response;
  document.querySelector("#issue-hash").value = response.sha256Hex;
  document.querySelector("#issue-cid").value = response.ipfsCid;
  document.querySelector("#issue-time").value = Math.floor(Date.now() / 1000);
  loadActivity();
});

issueForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = {
    sha256Hex: document.querySelector("#issue-hash").value.trim(),
    ipfsCid: document.querySelector("#issue-cid").value.trim(),
    issuedAtUnix: parseOptionalNumber(document.querySelector("#issue-time").value),
    note: document.querySelector("#issue-note").value.trim() || null,
    dryRun: document.querySelector("#issue-dry-run").checked,
  };

  const response = await api("/api/v1/credentials/issue", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }, true);

  renderJson(output.issue, response);
  loadActivity();
});

verifyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = document.querySelector("#verify-file").files[0];
  if (!file) {
    renderJson(output.verify, { error: "Select a file to verify." });
    return;
  }

  const sha256Hex = await digestFile(file);
  const response = await api("/api/v1/credentials/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sha256Hex }),
  });

  renderJson(output.verify, { ...response, browserComputedSha256: sha256Hex });
  loadActivity();
});

async function refreshStatus() {
  const healthPromise = api("/api/v1/health");
  const configPromise = api("/api/v1/system/config", {}, true).catch((error) => ({
    error: error.message,
  }));
  const [health, config] = await Promise.all([healthPromise, configPromise]);

  renderStatus(health);
  renderJson(output.config, config);
}

async function loadActivity() {
  try {
    const events = await api("/api/v1/system/activity?limit=12", {}, true);
    renderActivity(events);
  } catch (error) {
    renderActivity([]);
    activityFeed.innerHTML = `<div class="activity-item">Activity feed unavailable: ${error.message}</div>`;
  }
}

function renderStatus(health) {
  const cards = [
    ["Service", health.status],
    ["IPFS", health.ipfs?.reachable ? "online" : "degraded"],
    ["Solana", health.solana?.reachable ? "online" : "degraded"],
  ];

  statusGrid.innerHTML = cards
    .map(([label, value]) => {
      const className = value === "online" || value === "ok" ? "status-ok" : "status-warn";
      return `<div class="status-pill"><span>${label}</span><strong class="${className}">${value}</strong></div>`;
    })
    .join("");
}

function renderActivity(events) {
  if (!events.length) {
    activityFeed.innerHTML = `<div class="activity-item">No recent activity yet.</div>`;
    return;
  }

  activityFeed.innerHTML = events
    .slice()
    .reverse()
    .map((event) => {
      return `
        <article class="activity-item">
          <time>${new Date(event.at).toLocaleString()}</time>
          <strong>${event.action}</strong>
          <div>${event.detail}</div>
          <div class="muted">${event.status}${event.sha256Hex ? ` • ${event.sha256Hex}` : ""}</div>
        </article>
      `;
    })
    .join("");
}

function renderJson(node, payload) {
  node.textContent = JSON.stringify(payload, null, 2);
}

async function api(path, options = {}, auth = false) {
  const headers = new Headers(options.headers || {});
  if (auth && state.adminToken) {
    headers.set("x-chainlocker-admin-token", state.adminToken);
  }

  const response = await fetch(path, { ...options, headers });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error?.message || `Request failed with ${response.status}`);
  }
  return response.json();
}

async function digestFile(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function parseOptionalNumber(value) {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

refreshStatus();
loadActivity();
