const scheduleModeEl = document.getElementById("scheduleMode");
const scheduleHourEl = document.getElementById("scheduleHour");
const closeTabsAfterRunEl = document.getElementById("closeTabsAfterRun");
const storesContainerEl = document.getElementById("storesContainer");
const saveBtn = document.getElementById("saveBtn");
const saveStatusEl = document.getElementById("saveStatus");

let currentStores = [];

function storeRow(store) {
  const row = document.createElement("div");
  row.className = "store-toggle";

  const left = document.createElement("div");
  left.innerHTML = `<strong>${store.name}</strong><p>${store.automation === "content_script" ? "Automated clip supported" : "Manual open-only for now"}</p>`;

  const right = document.createElement("div");
  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.checked = !!store.enabled;
  toggle.addEventListener("change", () => {
    store.enabled = toggle.checked;
  });

  right.append(toggle);
  row.append(left, right);
  return row;
}

async function loadState() {
  const state = await chrome.runtime.sendMessage({ type: "cliparr.getState" });
  currentStores = structuredClone(state.stores || []);

  scheduleModeEl.value = state.settings?.scheduleMode || "manual";
  scheduleHourEl.value = String(state.settings?.scheduleHourLocal ?? 7);
  closeTabsAfterRunEl.checked = !!state.settings?.closeTabsAfterRun;

  storesContainerEl.innerHTML = "";
  currentStores.forEach((store) => storesContainerEl.append(storeRow(store)));
}

saveBtn.addEventListener("click", async () => {
  saveBtn.disabled = true;
  saveStatusEl.textContent = "Saving...";

  const payload = {
    settings: {
      scheduleMode: scheduleModeEl.value,
      scheduleHourLocal: Math.max(0, Math.min(23, Number(scheduleHourEl.value) || 7)),
      closeTabsAfterRun: closeTabsAfterRunEl.checked
    },
    stores: currentStores
  };

  const response = await chrome.runtime.sendMessage({ type: "cliparr.saveOptions", payload });

  if (response?.ok) {
    saveStatusEl.textContent = "Saved. Schedule updated.";
  } else {
    saveStatusEl.textContent = response?.error || "Failed to save settings.";
  }

  saveBtn.disabled = false;
});

loadState().catch((error) => {
  saveStatusEl.textContent = String(error);
});
