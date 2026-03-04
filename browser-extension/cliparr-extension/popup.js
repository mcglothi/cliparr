const totalRunsEl = document.getElementById("totalRuns");
const totalClippedEl = document.getElementById("totalClipped");
const enabledCountEl = document.getElementById("enabledCount");
const storeListEl = document.getElementById("storeList");
const statusLineEl = document.getElementById("statusLine");
const runNowBtn = document.getElementById("runNow");
const openOptionsBtn = document.getElementById("openOptions");
const checkpointPanelEl = document.getElementById("checkpointPanel");
const checkpointTextEl = document.getElementById("checkpointText");
const openCheckpointBtn = document.getElementById("openCheckpoint");
const resumeCheckpointBtn = document.getElementById("resumeCheckpoint");
const detailsTextEl = document.getElementById("detailsText");
const detailsAtEl = document.getElementById("detailsAt");

runNowBtn.addEventListener("click", async () => {
  runNowBtn.disabled = true;
  statusLineEl.textContent = "Running enabled stores...";
  const response = await chrome.runtime.sendMessage({ type: "cliparr.startRunNow" });

  if (!response?.ok) {
    statusLineEl.textContent = response?.error || "Run failed";
  } else {
    statusLineEl.textContent = "Run started in background...";
  }

  await renderState();
  runNowBtn.disabled = false;
});

openOptionsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

openCheckpointBtn.addEventListener("click", async () => {
  const response = await chrome.runtime.sendMessage({ type: "cliparr.openCheckpointTab" });
  statusLineEl.textContent = response?.result?.message || "Opened verification tab.";
});

resumeCheckpointBtn.addEventListener("click", async () => {
  resumeCheckpointBtn.disabled = true;
  statusLineEl.textContent = "Resuming after verification...";
  const response = await chrome.runtime.sendMessage({ type: "cliparr.resumeCheckpoint" });
  if (!response?.ok) {
    statusLineEl.textContent = response?.error || "Resume failed";
  } else {
    statusLineEl.textContent = `${response.result.storeName}: ${response.result.message}`;
  }
  await renderState();
  resumeCheckpointBtn.disabled = false;
});

async function runStore(storeId) {
  statusLineEl.textContent = "Running store...";
  const response = await chrome.runtime.sendMessage({ type: "cliparr.startRunStore", storeId });
  if (!response?.ok) {
    statusLineEl.textContent = response?.error || "Store run failed";
  } else {
    statusLineEl.textContent = "Store run started in background...";
  }
  await renderState();
}

function createStoreCard(store) {
  const card = document.createElement("article");
  card.className = "store-item";

  const top = document.createElement("div");
  top.className = "store-top";

  const title = document.createElement("strong");
  title.textContent = store.name;

  const badge = document.createElement("span");
  badge.className = `badge ${store.automation === "content_script" ? "automated" : "manual"}`;
  badge.textContent = store.automation === "content_script" ? "Automated" : "Manual";

  top.append(title, badge);

  const meta = document.createElement("div");
  meta.className = "store-meta";
  meta.innerHTML = `<span>${store.enabled ? "Enabled" : "Disabled"}</span><a href="${store.couponUrl}" target="_blank">Coupon page</a>`;

  const actions = document.createElement("div");
  actions.className = "store-actions";

  const runBtn = document.createElement("button");
  runBtn.className = "small";
  runBtn.textContent = "Run";
  runBtn.disabled = !store.enabled;
  runBtn.addEventListener("click", () => runStore(store.id));

  actions.append(runBtn);
  card.append(top, meta, actions);
  return card;
}

async function renderState() {
  const state = await chrome.runtime.sendMessage({ type: "cliparr.getState" });
  const stores = state.stores || [];
  const enabled = stores.filter((store) => store.enabled);

  totalRunsEl.textContent = String(state.metrics?.totalRuns || 0);
  totalClippedEl.textContent = String(state.metrics?.totalClipped || 0);
  enabledCountEl.textContent = `${enabled.length} enabled`;

  storeListEl.innerHTML = "";
  stores.forEach((store) => {
    storeListEl.append(createStoreCard(store));
  });

  const checkpoint = state.checkpoint || null;
  if (checkpoint) {
    checkpointPanelEl.classList.remove("hidden");
    checkpointTextEl.textContent = checkpoint.message || `${checkpoint.storeName} needs verification.`;
  } else {
    checkpointPanelEl.classList.add("hidden");
  }

  if (state.activeRun?.status === "running") {
    statusLineEl.textContent = state.activeRun.message || "Run in progress...";
  } else if (state.activeRun?.status === "error") {
    statusLineEl.textContent = state.activeRun.message || "Last run failed";
  } else if (state.activeRun?.status === "completed") {
    statusLineEl.textContent = state.activeRun.message || "Run completed";
  } else if (state.metrics?.lastRunSummary) {
    statusLineEl.textContent = state.metrics.lastRunSummary;
  }

  const lastRunDetails = state.lastRunDetails || { summary: "No run details yet.", results: [], at: null };
  const lines = [];
  lines.push(lastRunDetails.summary || "Run complete.");
  if (Array.isArray(lastRunDetails.results)) {
    for (const item of lastRunDetails.results) {
      lines.push(`${item.storeName}: ${item.message}`);
    }
  }
  detailsTextEl.textContent = lines.join("\n");
  const ts = state.activeRun?.status === "running" ? state.activeRun.startedAt : (lastRunDetails.at || state.activeRun?.completedAt);
  detailsAtEl.textContent = ts ? new Date(ts).toLocaleTimeString() : "-";
}

renderState().catch((error) => {
  statusLineEl.textContent = String(error);
});

setInterval(() => {
  renderState().catch(() => undefined);
}, 1500);
