"use strict";

const $editToggle = document.getElementById("edit-toggle");
const $save = document.getElementById("save");
const $filename = document.getElementById("filename");
const $state = document.getElementById("state");
const $fileState = document.getElementById("file-state");
const $hint = document.getElementById("hint");

let currentTabId = null;
let currentUrl = null;

function setHint(message, kind = "") {
  $hint.textContent = message || "";
  $hint.classList.remove("error", "success");
  if (kind) $hint.classList.add(kind);
}

function basenameFromUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname);
    const name = path.split("/").filter(Boolean).pop() || "";
    return name;
  } catch {
    return "";
  }
}

function setEditModeHint(editing) {
  setHint(editing ? "Edit mode enabled." : "Edit mode disabled.");
}

function updateUiFromStatus(status) {
  const editing = !!status?.editing;
  const dirty = !!status?.dirty;

  $editToggle.checked = editing;
  $state.textContent = editing ? "EDITING" : "READ-ONLY";
  $fileState.classList.toggle("dirty", editing && dirty);
  $fileState.classList.toggle("saved", editing && !dirty);
  $fileState.querySelector("span:last-child").textContent = editing
    ? dirty
      ? "Unsaved"
      : "No changes"
    : "Read-only";
  $save.disabled = !editing || !dirty;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function fetchStatus() {
  if (currentTabId == null) return null;
  try {
    const res = await chrome.runtime.sendMessage({
      type: "GET_STATUS",
      tabId: currentTabId,
    });
    return res || { editing: false, dirty: false };
  } catch {
    return { editing: false, dirty: false };
  }
}

async function init() {
  const tab = await getActiveTab();
  if (!tab) {
    setHint("No active tab.", "error");
    return;
  }
  currentTabId = tab.id;
  currentUrl = tab.url || "";

  const name = basenameFromUrl(currentUrl) || "(untitled)";
  $filename.textContent = name;
  $filename.title = currentUrl;

  if (!/^file:|^https?:|^http:/.test(currentUrl)) {
    setHint("This page can't be edited (chrome:// or extension page).", "error");
    $editToggle.disabled = true;
    return;
  }

  if (!currentUrl.startsWith("file:")) {
    setHint("Tip: this extension is designed for local file:// HTML files.");
  }

  const status = await fetchStatus();
  updateUiFromStatus(status);
  setEditModeHint(!!status?.editing);
}

$editToggle.addEventListener("change", async () => {
  if (currentTabId == null) return;
  const enable = $editToggle.checked;
  try {
    const res = await chrome.runtime.sendMessage({
      type: "SET_EDIT_MODE",
      tabId: currentTabId,
      enable,
    });
    if (res?.error) {
      setHint(res.error, "error");
      $editToggle.checked = !enable;
      return;
    }
    updateUiFromStatus(res);
    setEditModeHint(enable);
  } catch (err) {
    setHint(`Failed: ${err?.message || err}`, "error");
    $editToggle.checked = !enable;
  }
});

async function triggerSave() {
  if (currentTabId == null) return;
  $save.disabled = true;
  setHint("Opening Save dialog…");
  try {
    const res = await chrome.runtime.sendMessage({
      type: "SAVE",
      tabId: currentTabId,
      saveAs: false,
    });
    if (res?.error) {
      setHint(res.error, "error");
    } else if (res?.cancelled) {
      setHint("Save cancelled.");
    } else {
      setHint("Saved.", "success");
    }
  } catch (err) {
    setHint(`Failed: ${err?.message || err}`, "error");
  } finally {
    const status = await fetchStatus();
    updateUiFromStatus(status);
  }
}

$save.addEventListener("click", triggerSave);

document.addEventListener("DOMContentLoaded", init);
