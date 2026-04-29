"use strict";

const STATE_KEY = "tabState";

async function readAllState() {
  const stored = await chrome.storage.session.get(STATE_KEY);
  return stored[STATE_KEY] || {};
}

async function writeAllState(state) {
  await chrome.storage.session.set({ [STATE_KEY]: state });
}

async function getTabState(tabId) {
  const all = await readAllState();
  return all[tabId] || { editing: false, dirty: false };
}

async function setTabState(tabId, patch) {
  const all = await readAllState();
  const prev = all[tabId] || { editing: false, dirty: false };
  all[tabId] = { ...prev, ...patch };
  await writeAllState(all);
  return all[tabId];
}

async function clearTabState(tabId) {
  const all = await readAllState();
  if (all[tabId]) {
    delete all[tabId];
    await writeAllState(all);
  }
}

function basenameFromUrl(url, fallback = "edited.html") {
  try {
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname);
    const name = path.split("/").filter(Boolean).pop() || "";
    if (!name) return fallback;
    if (!/\.(html?|xhtml)$/i.test(name)) return `${name}.html`;
    return name;
  } catch {
    return fallback;
  }
}

async function sendToTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (err) {
    return { error: err?.message || String(err) };
  }
}

async function ensureContentScript(tabId) {
  try {
    const pong = await chrome.tabs.sendMessage(tabId, { type: "PING" });
    if (pong?.ok) return true;
  } catch {
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["src/content/toolbar.js", "src/content/content.js"],
    });
    return true;
  } catch (err) {
    console.warn("Failed to inject content script:", err);
    return false;
  }
}

function isTrustedSender(sender) {
  if (!sender) return false;
  if (sender.id !== chrome.runtime.id) return false;
  if (sender.url && !sender.url.startsWith(`chrome-extension://${chrome.runtime.id}/`)) {
    if (sender.tab?.id == null) return false;
  }
  return true;
}

function isValidTabId(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isTrustedSender(sender)) {
    sendResponse({ error: "Unauthorized sender." });
    return false;
  }

  (async () => {
    try {
      const senderTabId = sender?.tab?.id;

      if (message?.type === "GET_STATUS") {
        if (!isValidTabId(message.tabId)) {
          sendResponse({ error: "Invalid tabId." });
          return;
        }
        const tab = await chrome.tabs.get(message.tabId).catch(() => null);
        if (tab?.status === "loading") {
          const status = await setTabState(message.tabId, { editing: false, dirty: false });
          sendResponse(status);
          return;
        }
        const live = await sendToTab(message.tabId, { type: "PING" });
        if (live?.ok) {
          const status = await setTabState(message.tabId, {
            editing: !!live.editing,
            dirty: !!live.dirty,
          });
          sendResponse(status);
          return;
        }
        const status = await setTabState(message.tabId, { editing: false, dirty: false });
        sendResponse(status);
        return;
      }

      if (message?.type === "SET_EDIT_MODE") {
        const tabId = message.tabId;
        if (!isValidTabId(tabId)) {
          sendResponse({ error: "Invalid tabId." });
          return;
        }
        const enable = !!message.enable;
        const ok = await ensureContentScript(tabId);
        if (!ok) {
          sendResponse({ error: "Cannot inject editor on this page." });
          return;
        }
        const res = await sendToTab(tabId, { type: "SET_EDIT", enable });
        if (res?.error) {
          sendResponse({ error: res.error });
          return;
        }
        const status = await setTabState(tabId, {
          editing: !!res?.editing,
          dirty: !!res?.dirty,
        });
        sendResponse(status);
        return;
      }

      if (message?.type === "DIRTY_CHANGED") {
        if (isValidTabId(senderTabId)) {
          await setTabState(senderTabId, { dirty: !!message.dirty });
        }
        sendResponse({ ok: true });
        return;
      }

      if (message?.type === "EDIT_STATE_CHANGED") {
        if (isValidTabId(senderTabId)) {
          await setTabState(senderTabId, {
            editing: !!message.editing,
            dirty: !!message.dirty,
          });
        }
        sendResponse({ ok: true });
        return;
      }

      if (message?.type === "SAVE") {
        const tabId = message.tabId;
        if (!isValidTabId(tabId)) {
          sendResponse({ error: "Invalid tabId." });
          return;
        }
        const tab = await chrome.tabs.get(tabId);
        const res = await sendToTab(tabId, { type: "GET_HTML" });
        if (res?.error) {
          sendResponse({ error: res.error });
          return;
        }
        const html = res?.html;
        if (typeof html !== "string") {
          sendResponse({ error: "Could not read page HTML." });
          return;
        }
        const filename = basenameFromUrl(tab.url);
        const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
        try {
          const downloadId = await chrome.downloads.download({
            url: dataUrl,
            filename,
            saveAs: true,
            conflictAction: "uniquify",
          });
          if (downloadId == null) {
            sendResponse({ cancelled: true });
            return;
          }
          const result = await waitForDownload(downloadId);
          if (result.state === "complete") {
            await sendToTab(tabId, { type: "MARK_CLEAN" });
            await setTabState(tabId, { dirty: false });
            sendResponse({ ok: true, filename: result.filename });
          } else if (result.state === "interrupted") {
            if (result.error === "USER_CANCELED") {
              sendResponse({ cancelled: true });
            } else {
              sendResponse({ error: `Download failed: ${result.error || "unknown"}` });
            }
          } else {
            sendResponse({ ok: true });
          }
        } catch (err) {
          const msg = err?.message || String(err);
          if (/canceled|cancelled/i.test(msg)) {
            sendResponse({ cancelled: true });
          } else {
            sendResponse({ error: msg });
          }
        }
        return;
      }

      sendResponse({ error: `Unknown message type: ${message?.type}` });
    } catch (err) {
      sendResponse({ error: err?.message || String(err) });
    }
  })();
  return true;
});

function waitForDownload(downloadId) {
  return new Promise((resolve) => {
    const onChanged = (delta) => {
      if (delta.id !== downloadId) return;
      if (delta.state?.current === "complete" || delta.state?.current === "interrupted") {
        chrome.downloads.onChanged.removeListener(onChanged);
        chrome.downloads.search({ id: downloadId }, (items) => {
          const item = items?.[0];
          resolve({
            state: delta.state.current,
            filename: item?.filename,
            error: delta.error?.current || item?.error,
          });
        });
      }
    };
    chrome.downloads.onChanged.addListener(onChanged);
  });
}

chrome.tabs.onRemoved.addListener((tabId) => {
  clearTabState(tabId).catch(() => {});
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    clearTabState(tabId).catch(() => {});
  }
});
