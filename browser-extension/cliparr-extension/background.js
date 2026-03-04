const DEFAULT_STORES = [
  {
    id: "hannaford",
    name: "Hannaford",
    couponUrl: "https://hannaford.com/savings/coupons/browse",
    domain: "hannaford.com",
    automation: "content_script",
    enabled: true
  },
  {
    id: "homedepot",
    name: "Home Depot",
    couponUrl: "https://www.homedepot.com/",
    domain: "homedepot.com",
    automation: "open_only",
    enabled: false
  },
  {
    id: "lowes",
    name: "Lowe's",
    couponUrl: "https://www.lowes.com/",
    domain: "lowes.com",
    automation: "open_only",
    enabled: false
  },
  {
    id: "marketbasket",
    name: "Market Basket",
    couponUrl: "https://www.shopmarketbasket.com/",
    domain: "marketbasketfoods.com",
    automation: "open_only",
    enabled: false
  },
  {
    id: "shaws",
    name: "Shaw's",
    couponUrl: "https://www.shaws.com/foru/coupons-deals.html",
    domain: "shaws.com",
    automation: "content_script",
    enabled: false
  },
  {
    id: "amazon",
    name: "Amazon",
    couponUrl: "https://www.amazon.com/Coupons",
    domain: "amazon.com",
    automation: "open_only",
    enabled: false
  },
  {
    id: "walmart",
    name: "Walmart",
    couponUrl: "https://www.walmart.com/",
    domain: "walmart.com",
    automation: "open_only",
    enabled: false
  },
  {
    id: "target",
    name: "Target",
    couponUrl: "https://www.target.com/circle/offers",
    domain: "target.com",
    automation: "open_only",
    enabled: false
  },
  {
    id: "cvs",
    name: "CVS",
    couponUrl: "https://www.cvs.com/extracare/home",
    domain: "cvs.com",
    automation: "open_only",
    enabled: false
  },
  {
    id: "walgreens",
    name: "Walgreens",
    couponUrl: "https://www.walgreens.com/offers/offers.jsp",
    domain: "walgreens.com",
    automation: "open_only",
    enabled: false
  },
  {
    id: "oreilly",
    name: "O'Reilly Auto Parts",
    couponUrl: "https://www.oreillyauto.com/special-offers",
    domain: "oreillyauto.com",
    automation: "open_only",
    enabled: false
  },
  {
    id: "autozone",
    name: "AutoZone",
    couponUrl: "https://www.autozone.com/deals",
    domain: "autozone.com",
    automation: "open_only",
    enabled: false
  },
  {
    id: "starbucks",
    name: "Starbucks",
    couponUrl: "https://www.starbucks.com/rewards/",
    domain: "starbucks.com",
    automation: "open_only",
    enabled: false
  }
];

const DEFAULT_SETTINGS = {
  scheduleMode: "manual",
  scheduleHourLocal: 7,
  closeTabsAfterRun: true
};

chrome.runtime.onInstalled.addListener(async () => {
  await ensureDefaults();
  await configureAlarm();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureDefaults();
  await configureAlarm();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "cliparr.daily") return;
  await runEnabledStores("scheduled");
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== "string") return;

  if (message.type === "cliparr.getState") {
    getState().then(sendResponse);
    return true;
  }

  if (message.type === "cliparr.startRunNow") {
    startRunNowJob("manual")
      .then(() => sendResponse({ ok: true, accepted: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message.type === "cliparr.startRunStore") {
    startRunStoreJob(message.storeId)
      .then(() => sendResponse({ ok: true, accepted: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message.type === "cliparr.runNow") {
    runEnabledStores("manual")
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message.type === "cliparr.runStore") {
    runStoreById(message.storeId)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message.type === "cliparr.saveOptions") {
    saveOptions(message.payload)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message.type === "cliparr.getCheckpoint") {
    getCheckpoint().then(sendResponse);
    return true;
  }

  if (message.type === "cliparr.resumeCheckpoint") {
    resumeCheckpoint()
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message.type === "cliparr.openCheckpointTab") {
    openCheckpointTab()
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }
});

async function ensureDefaults() {
  const stored = await chrome.storage.local.get(["stores", "settings", "metrics", "lastRunDetails", "activeRun"]);

  if (!Array.isArray(stored.stores) || stored.stores.length === 0) {
    await chrome.storage.local.set({ stores: DEFAULT_STORES });
  } else {
    const merged = mergeStores(stored.stores, DEFAULT_STORES);
    await chrome.storage.local.set({ stores: merged });
  }

  if (!stored.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }

  if (!stored.metrics) {
    await chrome.storage.local.set({
      metrics: {
        totalRuns: 0,
        totalClipped: 0,
        lastRunAt: null,
        lastRunSummary: "No runs yet"
      }
    });
  }

  if (!stored.lastRunDetails) {
    await chrome.storage.local.set({
      lastRunDetails: {
        at: null,
        summary: "No run details yet.",
        results: []
      }
    });
  }

  if (!stored.activeRun) {
    await chrome.storage.local.set({
      activeRun: {
        status: "idle",
        mode: null,
        storeId: null,
        storeName: null,
        startedAt: null,
        completedAt: null,
        message: "Idle"
      }
    });
  }
}

function mergeStores(existing, defaults) {
  const byId = new Map(existing.map((store) => [store.id, store]));
  return defaults.map((store) => {
    const prior = byId.get(store.id) || {};
    return {
      ...store,
      // Preserve user toggles while allowing store capability updates from new releases.
      enabled: typeof prior.enabled === "boolean" ? prior.enabled : store.enabled
    };
  });
}

async function configureAlarm() {
  const { settings } = await chrome.storage.local.get(["settings"]);
  await chrome.alarms.clear("cliparr.daily");
  if (!settings || settings.scheduleMode !== "daily") return;

  const now = new Date();
  const target = new Date(now);
  target.setHours(Number(settings.scheduleHourLocal) || 7, 0, 0, 0);
  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  chrome.alarms.create("cliparr.daily", {
    when: target.getTime(),
    periodInMinutes: 24 * 60
  });
}

async function getState() {
  const { stores, settings, metrics, checkpoint, lastRunDetails, activeRun } = await chrome.storage.local.get([
    "stores",
    "settings",
    "metrics",
    "checkpoint",
    "lastRunDetails",
    "activeRun"
  ]);
  return {
    stores: stores || DEFAULT_STORES,
    settings: settings || DEFAULT_SETTINGS,
    metrics: metrics || {
      totalRuns: 0,
      totalClipped: 0,
      lastRunAt: null,
      lastRunSummary: "No runs yet"
    },
    checkpoint: checkpoint || null,
    lastRunDetails: lastRunDetails || {
      at: null,
      summary: "No run details yet.",
      results: []
    },
    activeRun: activeRun || {
      status: "idle",
      mode: null,
      storeId: null,
      storeName: null,
      startedAt: null,
      completedAt: null,
      message: "Idle"
    }
  };
}

async function saveLastRunDetails(summary, results) {
  await chrome.storage.local.set({
    lastRunDetails: {
      at: new Date().toISOString(),
      summary: summary || "Run complete.",
      results: Array.isArray(results) ? results : []
    }
  });
}

async function setActiveRun(patch) {
  const { activeRun } = await chrome.storage.local.get(["activeRun"]);
  const base = activeRun || {
    status: "idle",
    mode: null,
    storeId: null,
    storeName: null,
    startedAt: null,
    completedAt: null,
    message: "Idle"
  };
  await chrome.storage.local.set({ activeRun: { ...base, ...patch } });
}

async function startRunNowJob(reason) {
  await setActiveRun({
    status: "running",
    mode: "all",
    storeId: null,
    storeName: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
    message: "Running enabled stores..."
  });
  try {
    const result = await runEnabledStores(reason || "manual");
    await setActiveRun({
      status: "completed",
      completedAt: new Date().toISOString(),
      message: result.summary
    });
  } catch (error) {
    await setActiveRun({
      status: "error",
      completedAt: new Date().toISOString(),
      message: String(error)
    });
  }
}

async function startRunStoreJob(storeId) {
  const { stores } = await chrome.storage.local.get(["stores"]);
  const store = (stores || []).find((item) => item.id === storeId);
  const storeName = store?.name || storeId;
  await setActiveRun({
    status: "running",
    mode: "store",
    storeId: storeId || null,
    storeName,
    startedAt: new Date().toISOString(),
    completedAt: null,
    message: `Running ${storeName}...`
  });
  try {
    const result = await runStoreById(storeId);
    await setActiveRun({
      status: "completed",
      completedAt: new Date().toISOString(),
      message: `${result.storeName}: ${result.message}`
    });
  } catch (error) {
    await setActiveRun({
      status: "error",
      completedAt: new Date().toISOString(),
      message: `${storeName}: ${String(error)}`
    });
  }
}

async function getCheckpoint() {
  const { checkpoint } = await chrome.storage.local.get(["checkpoint"]);
  return checkpoint || null;
}

async function setCheckpoint(checkpoint) {
  await chrome.storage.local.set({ checkpoint });
}

async function clearCheckpoint() {
  await chrome.storage.local.remove("checkpoint");
}

async function openCheckpointTab() {
  const checkpoint = await getCheckpoint();
  if (!checkpoint || !checkpoint.tabId) {
    return { opened: false, message: "No active checkpoint tab." };
  }
  await chrome.tabs.update(checkpoint.tabId, { active: true });
  return { opened: true, message: "Checkpoint tab focused." };
}

async function resumeCheckpoint() {
  const checkpoint = await getCheckpoint();
  if (!checkpoint) {
    throw new Error("No checkpoint to resume.");
  }

  const existingTab = await chrome.tabs.get(checkpoint.tabId).catch(() => null);
  if (!existingTab) {
    await clearCheckpoint();
    throw new Error("Checkpoint tab is gone. Run the store again.");
  }

  await chrome.tabs.update(checkpoint.tabId, { active: true });
  await sleep(1200);

  const clipper = getClipperForStore(checkpoint.storeId);
  if (!clipper) {
    throw new Error(`No clipper implemented for ${checkpoint.storeName}.`);
  }

  const [execution] = await chrome.scripting.executeScript({
    target: { tabId: checkpoint.tabId },
    world: "MAIN",
    func: clipper
  });

  const result = execution?.result || {};
  if (result.checkpointRequired) {
    await setCheckpoint({
      ...checkpoint,
      updatedAt: new Date().toISOString(),
      message: result.message || checkpoint.message
    });
  } else {
    await clearCheckpoint();
  }

  const normalized = {
    storeId: checkpoint.storeId,
    storeName: checkpoint.storeName,
    status: result.checkpointRequired ? "needs_human_verification" : "ok",
    clipped: Number(result.clipped) || 0,
    attempted: Number(result.attempted) || 0,
    message: result.message || "Completed"
  };

  await updateMetrics(`${normalized.storeName}: ${normalized.message}`, normalized.clipped);
  await saveLastRunDetails(`${normalized.storeName}: ${normalized.message}`, [normalized]);
  return normalized;
}

async function saveOptions(payload) {
  const safePayload = payload || {};
  if (safePayload.stores) {
    await chrome.storage.local.set({ stores: safePayload.stores });
  }
  if (safePayload.settings) {
    await chrome.storage.local.set({ settings: safePayload.settings });
  }
  await configureAlarm();
}

async function runStoreById(storeId) {
  const { stores } = await chrome.storage.local.get(["stores"]);
  const store = (stores || []).find((item) => item.id === storeId);
  if (!store) {
    throw new Error(`Unknown store '${storeId}'`);
  }
  const result = await runStore(store);
  const summary = `${result.storeName}: ${result.message}`;
  await updateMetrics(summary, result.clipped || 0);
  await saveLastRunDetails(summary, [result]);
  return result;
}

async function runEnabledStores(reason) {
  const state = await getState();
  const enabledStores = state.stores.filter((store) => store.enabled);
  const results = [];
  let clipped = 0;

  for (const store of enabledStores) {
    try {
      const result = await runStore(store);
      results.push(result);
      clipped += result.clipped || 0;
    } catch (error) {
      results.push({
        storeId: store.id,
        storeName: store.name,
        status: "error",
        clipped: 0,
        attempted: 0,
        message: String(error)
      });
    }
  }

  const summary = summarizeResults(enabledStores.length, results, clipped);
  await updateMetrics(summary, clipped);
  await saveLastRunDetails(summary, results);

  if (reason === "scheduled") {
    await chrome.notifications.create({
      type: "basic",
      iconUrl: "icon-128.png",
      title: "Cliparr scheduled run",
      message: summary
    }).catch(() => undefined);
  }

  return { summary, results, clipped };
}

function summarizeResults(enabledCount, results, clipped) {
  if (enabledCount === 0) {
    return "No stores enabled. Configure stores in Cliparr options.";
  }

  const automated = results.filter((result) => result.status === "ok").length;
  const manual = results.filter((result) => result.status === "manual_required").length;
  const checkpoints = results.filter((result) => result.status === "needs_human_verification").length;
  const errors = results.filter((result) => result.status === "error").length;

  const detail = results
    .map((result) => `${result.storeName}: ${result.message}`)
    .join(" || ");

  return `Clipped ${clipped} coupons across ${automated} automated stores. ${manual} manual stores. ${checkpoints} need verification. ${errors} errors. ${detail}`;
}

async function updateMetrics(summary, clipped) {
  const { metrics } = await chrome.storage.local.get(["metrics"]);
  const next = {
    totalRuns: (metrics?.totalRuns || 0) + 1,
    totalClipped: (metrics?.totalClipped || 0) + clipped,
    lastRunAt: new Date().toISOString(),
    lastRunSummary: summary
  };
  await chrome.storage.local.set({ metrics: next });
}

async function runStore(store) {
  if (store.automation !== "content_script") {
    await chrome.tabs.create({ url: store.couponUrl, active: false });
    return {
      storeId: store.id,
      storeName: store.name,
      status: "manual_required",
      clipped: 0,
      attempted: 0,
      message: "Opened coupon page. This store currently needs manual clipping."
    };
  }

  if (store.id === "hannaford") {
    return runHannaford(store);
  }

  if (store.id === "shaws") {
    return runShaws(store);
  }

  return {
    storeId: store.id,
    storeName: store.name,
    status: "manual_required",
    clipped: 0,
    attempted: 0,
    message: "Automation not implemented for this store yet."
  };
}

async function runHannaford(store) {
  return runContentScriptStore(store, clipHannafordInPage);
}

async function runShaws(store) {
  return runContentScriptStore(store, clipShawsInPage);
}

async function runContentScriptStore(store, clipper) {
  const { settings } = await chrome.storage.local.get(["settings"]);
  const tab = await chrome.tabs.create({ url: store.couponUrl, active: false });
  let keepTabOpen = false;

  try {
    await waitForTabComplete(tab.id);
    await sleep(1200);

    const [execution] = await executeClipperWithRetry(tab.id, clipper, 2);

    const result = execution?.result || {};
    if (result.checkpointRequired) {
      keepTabOpen = true;
      await setCheckpoint({
        storeId: store.id,
        storeName: store.name,
        tabId: tab.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        message: result.message || "Verification required."
      });
      await chrome.notifications
        .create({
          type: "basic",
          iconUrl: "icon-128.png",
          title: "Cliparr needs quick verification",
          message: `${store.name}: solve the challenge, then click Resume in Cliparr.`
        })
        .catch(() => undefined);
      return {
        storeId: store.id,
        storeName: store.name,
        status: "needs_human_verification",
        clipped: Number(result.clipped) || 0,
        attempted: Number(result.attempted) || 0,
        message: result.message || "Verification required."
      };
    }

    await clearCheckpoint();
    return {
      storeId: store.id,
      storeName: store.name,
      status: "ok",
      clipped: Number(result.clipped) || 0,
      attempted: Number(result.attempted) || 0,
      message: result.message || "Completed"
    };
  } finally {
    if (settings?.closeTabsAfterRun && !keepTabOpen) {
      await chrome.tabs.remove(tab.id).catch(() => undefined);
    }
  }
}

async function executeScriptWithTimeout(scriptArgs, timeoutMs) {
  return Promise.race([
    chrome.scripting.executeScript(scriptArgs),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Store run timed out after ${timeoutMs}ms`)), timeoutMs);
    })
  ]);
}

async function executeClipperWithRetry(tabId, clipper, maxAttempts = 2) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      if (attempt > 1) {
        await waitForTabComplete(tabId, 45000);
        await sleep(1200);
      }
      return await executeScriptWithTimeout(
        {
          target: { tabId },
          world: "MAIN",
          func: clipper
        },
        70000
      );
    } catch (error) {
      const message = String(error || "");
      lastError = error;
      const likelyFrameReset =
        message.includes("Frame with ID") ||
        message.includes("No frame with id") ||
        message.includes("Cannot access a chrome:// URL") ||
        message.includes("The tab was closed");
      if (!likelyFrameReset || attempt >= maxAttempts) {
        throw error;
      }
    }
  }
  throw lastError || new Error("Clipper execution failed");
}

function getClipperForStore(storeId) {
  if (storeId === "hannaford") return clipHannafordInPage;
  if (storeId === "shaws") return clipShawsInPage;
  return null;
}

function waitForTabComplete(tabId, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    let done = false;
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for tab load"));
    }, timeoutMs);

    function cleanup() {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    }

    function onUpdated(updatedTabId, info) {
      if (updatedTabId !== tabId) return;
      if (info.status === "complete") {
        cleanup();
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function clipHannafordInPage() {
  function normalizeButtonText(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function isRealClipButton(text) {
    const value = normalizeButtonText(text);
    if (!value) return false;
    if (value.includes("print")) return false;
    if (value.includes("clipped")) return false;
    return value.includes("clip coupon") || value === "clip";
  }

  const result = {
    clipped: 0,
    attempted: 0,
    message: "No coupon buttons detected",
    checkpointRequired: false
  };

  const cloudflareSignals = ["error code: 1020", "site temporarily down", "attention required"];
  const bodyText = document.body?.innerText?.toLowerCase?.() || "";
  if (cloudflareSignals.some((signal) => bodyText.includes(signal))) {
    result.message = "Blocked by site protection. Open store page manually and retry.";
    result.checkpointRequired = true;
    return result;
  }

  const isVerificationChallengePresent = () => {
    const text = (document.body?.innerText || "").toLowerCase();
    const strongPatterns = [
      /verify\s+(you(?:'| a)?re\s+)?human/,
      /are you human/,
      /security check/,
      /press and hold/,
      /slide to/,
      /please verify/,
      /complete the security check/,
      /captcha/
    ];
    if (strongPatterns.some((pattern) => pattern.test(text))) {
      return true;
    }

    const suspiciousIframes = Array.from(document.querySelectorAll("iframe")).some((frame) => {
      const title = (frame.getAttribute("title") || "").toLowerCase();
      const src = (frame.getAttribute("src") || "").toLowerCase();
      return (
        title.includes("captcha") ||
        title.includes("verify") ||
        title.includes("security") ||
        src.includes("captcha") ||
        src.includes("challenge-platform") ||
        src.includes("turnstile") ||
        src.includes("hcaptcha")
      );
    });
    return suspiciousIframes;
  };

  const clickIfNeeded = async () => {
    const buttons = Array.from(document.querySelectorAll("button"));
    let clickedThisPass = 0;

    for (const button of buttons) {
      const label = normalizeButtonText(button.innerText || button.textContent);
      if (!isRealClipButton(label)) continue;
      if (button.disabled || button.getAttribute("aria-disabled") === "true") continue;

      result.attempted += 1;
      button.scrollIntoView({ behavior: "instant", block: "center" });
      button.click();
      clickedThisPass += 1;
      result.clipped += 1;
      await new Promise((resolve) => setTimeout(resolve, 180));
    }

    return clickedThisPass;
  };

  const findLoadMoreButton = () => {
    const buttons = Array.from(document.querySelectorAll("button"));
    for (const button of buttons) {
      const label = normalizeButtonText(button.innerText || button.textContent);
      if (!label) continue;
      const isLoadMore =
        label.includes("load more") ||
        label.includes("show more") ||
        label.includes("more coupons") ||
        label.includes("view more");
      if (!isLoadMore) continue;
      if (button.disabled || button.getAttribute("aria-disabled") === "true") continue;
      return button;
    }
    return null;
  };

  const maxCycles = 40;
  let cycles = 0;
  let stagnantCycles = 0;
  let loadMoreClicks = 0;

  while (cycles < maxCycles && stagnantCycles < 4) {
    if (isVerificationChallengePresent()) {
      result.checkpointRequired = true;
      result.message = "Verification challenge detected. Solve it in this tab, then click Resume in Cliparr.";
      return result;
    }

    cycles += 1;
    const beforeHeight = Math.max(document.body?.scrollHeight || 0, document.documentElement?.scrollHeight || 0);
    const clickedThisPass = await clickIfNeeded();

    window.scrollBy(0, Math.round(window.innerHeight * 0.95));
    await new Promise((resolve) => setTimeout(resolve, 900));

    let advanced = clickedThisPass > 0;
    const loadMoreButton = findLoadMoreButton();
    if (loadMoreButton) {
      loadMoreButton.scrollIntoView({ behavior: "instant", block: "center" });
      loadMoreButton.click();
      loadMoreClicks += 1;
      advanced = true;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    const afterHeight = Math.max(document.body?.scrollHeight || 0, document.documentElement?.scrollHeight || 0);
    if (afterHeight > beforeHeight + 40) {
      advanced = true;
    }

    if (advanced) {
      stagnantCycles = 0;
    } else {
      stagnantCycles += 1;
    }
  }

  if (result.clipped > 0) {
    result.message = `Clipped ${result.clipped} coupon(s), load-more clicks: ${loadMoreClicks}`;
  } else {
    result.message = "No new coupons were clipped";
  }
  return result;
}

async function clipShawsInPage() {
  function normalizeButtonText(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function elementText(button) {
    return normalizeButtonText(
      button?.innerText ||
      button?.textContent ||
      button?.getAttribute?.("aria-label") ||
      button?.getAttribute?.("title")
    );
  }

  function collectButtonsDeep(rootNode) {
    const out = [];
    const visited = new Set();

    function walk(node) {
      if (!node || visited.has(node)) return;
      visited.add(node);

      if (node.querySelectorAll) {
        const candidates = node.querySelectorAll("button");
        for (const el of candidates) out.push(el);
      }

      if (!node.querySelectorAll) return;
      const all = node.querySelectorAll("*");
      for (const el of all) {
        if (el.shadowRoot) {
          walk(el.shadowRoot);
        }
      }
    }

    walk(rootNode);
    return Array.from(new Set(out));
  }

  function isVisible(el) {
    if (!el || typeof el.getBoundingClientRect !== "function") return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = window.getComputedStyle(el);
    return style.visibility !== "hidden" && style.display !== "none";
  }

  function humanClick(el) {
    const events = ["pointerdown", "mousedown", "mouseup", "click"];
    for (const type of events) {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    }
  }

  function isShawsClipButton(button) {
    const id = String(button?.id || "");
    const label = elementText(button);
    if (!label) return false;
    if (label.includes("clipped")) return false;
    if (label.includes("added")) return false;
    if (label.includes("remove")) return false;
    if (label.includes("print")) return false;

    if (id.startsWith("couponAddBtn")) {
      return label.includes("clip coupon") || label.includes("activate") || label === "clip";
    }

    return label.includes("clip coupon") || label.includes("activate") || label === "clip";
  }

  const result = {
    clipped: 0,
    attempted: 0,
    message: "No coupon buttons detected",
    checkpointRequired: false
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const isVerificationChallengePresent = () => {
    const text = (document.body?.innerText || "").toLowerCase();
    const strongPatterns = [
      /verify\s+(you(?:'| a)?re\s+)?human/,
      /are you human/,
      /security check/,
      /captcha/,
      /press and hold/,
      /slide to/,
      /please verify/,
      /complete the security check/
    ];
    if (strongPatterns.some((pattern) => pattern.test(text))) {
      return true;
    }

    const suspiciousIframes = Array.from(document.querySelectorAll("iframe")).some((frame) => {
      const title = (frame.getAttribute("title") || "").toLowerCase();
      const src = (frame.getAttribute("src") || "").toLowerCase();
      return (
        title.includes("captcha") ||
        title.includes("verify") ||
        title.includes("security") ||
        src.includes("captcha") ||
        src.includes("challenge-platform") ||
        src.includes("turnstile") ||
        src.includes("hcaptcha")
      );
    });
    return suspiciousIframes;
  };

  const clickFirstMatching = (elements) => {
    for (const el of elements) {
      if (!el || !isVisible(el)) continue;
      if (el.disabled || el.getAttribute("aria-disabled") === "true") continue;
      el.scrollIntoView({ behavior: "instant", block: "center" });
      try {
        el.click();
      } catch (_error) {
        humanClick(el);
      }
      return true;
    }
    return false;
  };

  const ensureCouponsView = async () => {
    const deep = collectButtonsDeep(document);
    const couponTabs = deep.filter((el) => {
      const text = elementText(el);
      return text === "coupons" || text.includes("coupons deals") || text.includes("digital coupons");
    });
    if (clickFirstMatching(couponTabs)) {
      await sleep(2200);
    }
  };

  const waitForCouponControls = async (timeoutMs = 15000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const deep = collectButtonsDeep(document);
      const hasClipLabels = deep.some((el) => {
        const text = elementText(el);
        return text.includes("clip coupon") || text.includes("activate") || text === "clip";
      });
      const couponButtonCount = document.querySelectorAll("button[id^='couponAddBtn']").length;
      if (hasClipLabels || couponButtonCount > 0) return true;
      await sleep(700);
    }
    return false;
  };

  const getClipCandidates = () => {
    const deep = collectButtonsDeep(document);
    const primary = deep.filter((el) => {
      if (String(el?.id || "").startsWith("couponAddBtn")) return true;
      const label = elementText(el);
      return label.includes("clip coupon") || label.includes("activate") || label === "clip";
    });
    return primary.length > 0 ? primary : deep;
  };

  const clickIfNeeded = async () => {
    const buttons = getClipCandidates();
    let clickedThisPass = 0;

    for (const button of buttons) {
      if (!isShawsClipButton(button)) continue;
      if (button.disabled || button.getAttribute("aria-disabled") === "true") continue;
      if (!isVisible(button)) continue;
      result.attempted += 1;
      button.scrollIntoView({ behavior: "instant", block: "center" });
      try {
        button.click();
      } catch (_error) {
        humanClick(button);
      }
      clickedThisPass += 1;
      result.clipped += 1;
      await new Promise((resolve) => setTimeout(resolve, 350));
    }

    return clickedThisPass;
  };

  const findLoadMoreButton = () => {
    const buttons = collectButtonsDeep(document);
    for (const button of buttons) {
      const label = elementText(button);
      if (!label) continue;
      const isLoadMore = label === "load more";
      if (!isLoadMore) continue;
      if (!isVisible(button)) continue;
      if (button.disabled || button.getAttribute("aria-disabled") === "true") continue;
      const rect = button.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.45) continue;
      return button;
    }
    return null;
  };

  const maxCycles = 80;
  const maxRuntimeMs = 180000;
  const startedAt = Date.now();
  let cycles = 0;
  let stagnantCycles = 0;
  let loadMoreClicks = 0;
  let noActionCycles = 0;

  await ensureCouponsView();
  await waitForCouponControls();

  while (cycles < maxCycles && stagnantCycles < 5) {
    if (Date.now() - startedAt > maxRuntimeMs) {
      break;
    }

    if (isVerificationChallengePresent()) {
      result.checkpointRequired = true;
      result.message = "Verification challenge detected. Solve it in this tab, then click Resume in Cliparr.";
      return result;
    }

    cycles += 1;
    const beforeHeight = Math.max(document.body?.scrollHeight || 0, document.documentElement?.scrollHeight || 0);
    const clickedThisPass = await clickIfNeeded();

    window.scrollTo({ top: document.body?.scrollHeight || 0, behavior: "instant" });
    await new Promise((resolve) => setTimeout(resolve, 1100));

    let advanced = clickedThisPass > 0;
    let didAction = clickedThisPass > 0;
    const loadMoreButton = findLoadMoreButton();
    if (loadMoreButton) {
      loadMoreButton.scrollIntoView({ behavior: "instant", block: "center" });
      try {
        loadMoreButton.click();
      } catch (_error) {
        humanClick(loadMoreButton);
      }
      loadMoreClicks += 1;
      advanced = true;
      didAction = true;
      await new Promise((resolve) => setTimeout(resolve, 1800));
    }

    const afterHeight = Math.max(document.body?.scrollHeight || 0, document.documentElement?.scrollHeight || 0);
    if (afterHeight > beforeHeight + 40) {
      advanced = true;
    }

    if (advanced) {
      stagnantCycles = 0;
    } else {
      stagnantCycles += 1;
    }

    if (didAction) {
      noActionCycles = 0;
    } else {
      noActionCycles += 1;
    }

    if (result.clipped === 0 && loadMoreClicks === 0 && noActionCycles >= 8) {
      break;
    }
  }

  if (result.clipped > 0) {
    result.message = `Clipped ${result.clipped} coupon(s), load-more clicks: ${loadMoreClicks}`;
  } else {
    const sampleButtons = collectButtonsDeep(document)
      .slice(0, 180)
      .map((button) => elementText(button))
      .filter(Boolean)
      .slice(0, 20);
    const couponButtonCount = document.querySelectorAll("button[id^='couponAddBtn']").length;
    const actionButtonCount = document.querySelectorAll("loyalty-card-action-buttons button").length;
    const deepButtonCount = collectButtonsDeep(document).length;
    const currentUrl = window.location.href;
    result.message =
      `No new coupons were clipped. couponAddBtn=${couponButtonCount}, ` +
      `actionButtons=${actionButtonCount}, deepButtons=${deepButtonCount}, url=${currentUrl}, ` +
      `sample=[${sampleButtons.join(" | ")}]`;
  }

  return result;
}
