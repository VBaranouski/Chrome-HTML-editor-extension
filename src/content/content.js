"use strict";

(() => {
  if (window.__CEE_CONTENT__) return;

  const TOOLBAR = () => window.__CEE_TOOLBAR__;
  const HOST_ID = "__cee_toolbar_host__";
  const FIND_MATCH_CLASS = "__cee_find_match__";
  const FIND_CURRENT_CLASS = "__cee_find_current__";

  let fileHandle = null;

  const state = {
    editing: false,
    dirty: false,
    prevContentEditable: null,
    prevSpellcheck: null,
  };

  const find = {
    query: "",
    ignoreCase: true,
    matches: [],
    currentIndex: -1,
  };

  const ALLOWED_LINK_SCHEMES = new Set([
    "http:",
    "https:",
    "mailto:",
    "tel:",
    "ftp:",
    "ftps:",
    "file:",
  ]);
  const ALLOWED_IMAGE_SCHEMES = new Set(["http:", "https:", "data:", "file:"]);
  const ALLOWED_DATA_IMAGE_RE = /^data:image\/(png|jpe?g|gif|webp|svg\+xml);/i;

  function safeUrl(input, allowed, opts = {}) {
    if (typeof input !== "string") return null;
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (opts.allowFragment && trimmed.startsWith("#")) return trimmed;
    let parsed;
    try {
      parsed = new URL(trimmed, document.baseURI || location.href);
    } catch {
      return null;
    }
    if (!allowed.has(parsed.protocol)) return null;
    if (parsed.protocol === "data:") {
      if (!opts.allowDataImage) return null;
      if (!ALLOWED_DATA_IMAGE_RE.test(parsed.href)) return null;
    }
    return parsed.href;
  }

  function notifyState() {
    chrome.runtime
      .sendMessage({ type: "EDIT_STATE_CHANGED", editing: state.editing, dirty: state.dirty })
      .catch(() => {});
  }

  function setDirty(value) {
    const next = !!value;
    if (state.dirty === next) return;
    state.dirty = next;
    TOOLBAR()?.setDirty?.(next);
    chrome.runtime.sendMessage({ type: "DIRTY_CHANGED", dirty: next }).catch(() => {});
  }

  function onInput(e) {
    if (!state.editing) return;
    if (e?.target && isInsideToolbar(e.target)) return;
    setDirty(true);
  }

  function onPaste(e) {
    if (!state.editing) return;
    if (isInsideToolbar(e.target)) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) return;
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result;
          if (typeof dataUrl === "string" && dataUrl.startsWith("data:image/")) {
            insertImage(dataUrl, "");
          }
        };
        reader.readAsDataURL(blob);
        return;
      }
    }
  }

  function onKeyDown(e) {
    if (!state.editing) return;
    if (isInsideToolbar(e.target)) return;

    if (resizeTarget && (e.key === "Escape")) {
      e.preventDefault();
      removeResizeOverlay();
      return;
    }
    if (resizeTarget && (e.key === "Delete" || e.key === "Backspace")) {
      e.preventDefault();
      const img = resizeTarget;
      removeResizeOverlay();
      img.remove();
      fireInput(document.body);
      return;
    }

    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === "b") {
      e.preventDefault();
      handleAction({ type: "bold" });
    } else if (k === "i") {
      e.preventDefault();
      handleAction({ type: "italic" });
    } else if (k === "u") {
      e.preventDefault();
      handleAction({ type: "underline" });
    } else if (k === "k") {
      e.preventDefault();
      handleAction({ type: "link" });
    } else if (k === "f") {
      e.preventDefault();
      TOOLBAR()?.toggleFind?.();
    } else if (k === "z" && !e.shiftKey) {
      e.preventDefault();
      handleAction({ type: "undo" });
    } else if ((k === "z" && e.shiftKey) || k === "y") {
      e.preventDefault();
      handleAction({ type: "redo" });
    }
  }

  function isInsideToolbar(node) {
    if (!node) return false;
    let n = node;
    while (n) {
      if (n.nodeType === 1 && /** @type {HTMLElement} */ (n).id === HOST_ID) return true;
      n = n.parentNode || (n instanceof ShadowRoot ? n.host : null);
    }
    return false;
  }

  function ensureRangeInEditable() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    let node = range.commonAncestorContainer;
    while (node && node !== document.body) {
      if (node.nodeType === 1 && /** @type {HTMLElement} */ (node).id === HOST_ID) return null;
      node = node.parentNode;
    }
    if (!document.body.contains(range.commonAncestorContainer)) return null;
    return range;
  }

  function fireInput(target) {
    const evt = new InputEvent("input", { bubbles: true, cancelable: false });
    (target || document.body).dispatchEvent(evt);
    setDirty(true);
  }

  function findAncestor(node, predicate) {
    let n = node;
    if (n && n.nodeType === 3) n = n.parentNode;
    while (n && n !== document.body) {
      if (n.nodeType === 1 && predicate(n)) return n;
      n = n.parentNode;
    }
    return null;
  }

  function withStyleCSS(fn) {
    let prev = false;
    try {
      document.execCommand("styleWithCSS", false, true);
      fn();
    } finally {
      document.execCommand("styleWithCSS", false, prev);
    }
  }

  function applyFontSize(px) {
    const range = ensureRangeInEditable();
    if (!range || range.collapsed) return;
    const span = document.createElement("span");
    span.style.fontSize = `${px}px`;
    try {
      range.surroundContents(span);
    } catch {
      const contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);
    }
    const sel = window.getSelection();
    sel.removeAllRanges();
    const r = document.createRange();
    r.selectNodeContents(span);
    sel.addRange(r);
  }

  function applyLink() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = ensureRangeInEditable();
    if (!range) return;

    const existingAnchor = findAncestor(range.commonAncestorContainer, (n) => n.tagName === "A");
    const currentHref = existingAnchor?.getAttribute("href") || "";
    const promptMessage = existingAnchor
      ? "Edit link URL (leave empty to remove the link):"
      : "Enter link URL:";
    const input = window.prompt(promptMessage, currentHref || "https://");
    if (input === null) return;
    const href = input.trim();

    if (existingAnchor) {
      if (href === "") {
        const parent = existingAnchor.parentNode;
        while (existingAnchor.firstChild) parent.insertBefore(existingAnchor.firstChild, existingAnchor);
        parent.removeChild(existingAnchor);
        return;
      }
      const safeHref = safeUrl(href, ALLOWED_LINK_SCHEMES, { allowFragment: true });
      if (!safeHref) {
        window.alert("Unsupported link URL. Use http(s), mailto:, tel:, ftp(s):, file:, or a #fragment.");
        return;
      }
      existingAnchor.setAttribute("href", safeHref);
      return;
    }

    if (href === "" || range.collapsed) return;

    const safeHref = safeUrl(href, ALLOWED_LINK_SCHEMES, { allowFragment: true });
    if (!safeHref) {
      window.alert("Unsupported link URL. Use http(s), mailto:, tel:, ftp(s):, file:, or a #fragment.");
      return;
    }

    const a = document.createElement("a");
    a.setAttribute("href", safeHref);
    try {
      range.surroundContents(a);
    } catch {
      const contents = range.extractContents();
      a.appendChild(contents);
      range.insertNode(a);
    }
    const newRange = document.createRange();
    newRange.selectNodeContents(a);
    sel.removeAllRanges();
    sel.addRange(newRange);
  }

  // ─── Image resize handles ───

  const RESIZE_OVERLAY_ID = "__cee_img_resize__";
  let resizeTarget = null;
  let resizeOverlay = null;
  let resizeDrag = null;

  function removeResizeOverlay() {
    resizeOverlay?.remove();
    resizeOverlay = null;
    resizeTarget = null;
  }

  function positionOverlay() {
    if (!resizeOverlay || !resizeTarget) return;
    const rect = resizeTarget.getBoundingClientRect();
    const o = resizeOverlay;
    o.style.left = `${rect.left + window.scrollX}px`;
    o.style.top = `${rect.top + window.scrollY}px`;
    o.style.width = `${rect.width}px`;
    o.style.height = `${rect.height}px`;
  }

  function showResizeOverlay(img) {
    if (resizeTarget === img && resizeOverlay) {
      positionOverlay();
      return;
    }
    removeResizeOverlay();
    resizeTarget = img;

    const overlay = document.createElement("div");
    overlay.id = RESIZE_OVERLAY_ID;
    overlay.setAttribute("data-cee-root", "true");
    overlay.contentEditable = "false";
    const s = overlay.style;
    s.position = "absolute";
    s.border = "2px solid #3b82f6";
    s.boxSizing = "border-box";
    s.pointerEvents = "none";
    s.zIndex = "2147483646";

    const handles = ["nw", "ne", "sw", "se"];
    const cursors = { nw: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", se: "nwse-resize" };
    const positions = {
      nw: { top: "-4px", left: "-4px" },
      ne: { top: "-4px", right: "-4px" },
      sw: { bottom: "-4px", left: "-4px" },
      se: { bottom: "-4px", right: "-4px" },
    };

    for (const dir of handles) {
      const h = document.createElement("div");
      h.dataset.handle = dir;
      const hs = h.style;
      hs.position = "absolute";
      hs.width = "8px";
      hs.height = "8px";
      hs.background = "#3b82f6";
      hs.border = "1px solid #ffffff";
      hs.borderRadius = "2px";
      hs.pointerEvents = "auto";
      hs.cursor = cursors[dir];
      hs.boxSizing = "border-box";
      Object.assign(hs, positions[dir]);
      h.addEventListener("mousedown", onHandleMouseDown);
      overlay.appendChild(h);
    }

    resizeOverlay = overlay;
    document.body.appendChild(overlay);
    positionOverlay();
  }

  function onHandleMouseDown(e) {
    if (e.button !== 0 || !resizeTarget) return;
    e.preventDefault();
    e.stopPropagation();
    const dir = e.target.dataset.handle;
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = resizeTarget.getBoundingClientRect().width;
    const startH = resizeTarget.getBoundingClientRect().height;
    const aspect = startW / (startH || 1);

    resizeDrag = { dir, startX, startY, startW, startH, aspect };
    document.addEventListener("mousemove", onResizeMove, true);
    document.addEventListener("mouseup", onResizeUp, true);
  }

  function onResizeMove(e) {
    if (!resizeDrag || !resizeTarget) return;
    e.preventDefault();
    const { dir, startX, startY, startW, startH, aspect } = resizeDrag;
    let dx = e.clientX - startX;
    let dy = e.clientY - startY;

    if (dir === "nw") { dx = -dx; dy = -dy; }
    else if (dir === "ne") { dy = -dy; }
    else if (dir === "sw") { dx = -dx; }

    let newW = Math.max(20, startW + dx);
    let newH = newW / aspect;

    resizeTarget.style.width = `${Math.round(newW)}px`;
    resizeTarget.style.height = `${Math.round(newH)}px`;
    resizeTarget.removeAttribute("width");
    resizeTarget.removeAttribute("height");
    positionOverlay();
  }

  function onResizeUp(e) {
    document.removeEventListener("mousemove", onResizeMove, true);
    document.removeEventListener("mouseup", onResizeUp, true);
    if (resizeDrag && resizeTarget) {
      fireInput(document.body);
    }
    resizeDrag = null;
  }

  function onBodyMouseDown(e) {
    if (!state.editing) return;
    if (isInsideToolbar(e.target)) return;

    if (e.target?.tagName === "IMG" && document.body.contains(e.target)) {
      e.preventDefault();
      showResizeOverlay(e.target);
      return;
    }

    if (resizeOverlay && !resizeOverlay.contains(e.target)) {
      removeResizeOverlay();
    }
  }

  function onWindowScroll() {
    if (resizeOverlay) positionOverlay();
  }

  function insertImage(src, alt) {
    const allowed = new Set([...ALLOWED_IMAGE_SCHEMES]);
    const safeSrc = safeUrl(src, allowed, { allowDataImage: true });
    if (!safeSrc) {
      window.alert("Unsupported image URL. Use http(s), data:image/*, or file:// URLs.");
      return;
    }
    const range = ensureRangeInEditable();
    if (!range) return;
    const img = document.createElement("img");
    img.src = safeSrc;
    if (alt) img.alt = alt;
    img.style.maxWidth = "100%";
    if (!range.collapsed) range.deleteContents();
    range.insertNode(img);
    const sel = window.getSelection();
    sel.removeAllRanges();
    const after = document.createRange();
    after.setStartAfter(img);
    after.collapse(true);
    sel.addRange(after);
    fireInput(document.body);
  }

  function applyHorizontalRule() {
    const range = ensureRangeInEditable();
    if (!range) return;
    document.execCommand("insertHorizontalRule");
  }

  function removeSelectedText() {
    const range = ensureRangeInEditable();
    if (!range || range.collapsed) return;
    range.deleteContents();
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function applyFormatBlock(value) {
    if (!value) return;
    const tag = value.toLowerCase();
    document.execCommand("formatBlock", false, `<${tag}>`);
  }

  function applyAlign(value) {
    const map = {
      left: "justifyLeft",
      center: "justifyCenter",
      right: "justifyRight",
      justify: "justifyFull",
    };
    const cmd = map[value];
    if (!cmd) return;
    document.execCommand(cmd);
  }

  function toggleInlineCode() {
    const range = ensureRangeInEditable();
    if (!range) return;
    const codeAncestor = findAncestor(
      range.commonAncestorContainer,
      (n) => n.tagName === "CODE" && n.parentNode?.tagName !== "PRE"
    );
    if (codeAncestor) {
      const parent = codeAncestor.parentNode;
      while (codeAncestor.firstChild) parent.insertBefore(codeAncestor.firstChild, codeAncestor);
      parent.removeChild(codeAncestor);
      parent.normalize();
      return;
    }
    if (range.collapsed) return;
    const code = document.createElement("code");
    try {
      range.surroundContents(code);
    } catch {
      const c = range.extractContents();
      code.appendChild(c);
      range.insertNode(code);
    }
    const sel = window.getSelection();
    sel.removeAllRanges();
    const r = document.createRange();
    r.selectNodeContents(code);
    sel.addRange(r);
  }

  function applyForeColor(color) {
    const range = ensureRangeInEditable();
    if (!range || range.collapsed) return;
    withStyleCSS(() => {
      document.execCommand("foreColor", false, color);
    });
  }

  function applyHiliteColor(color) {
    const range = ensureRangeInEditable();
    if (!range || range.collapsed) return;
    withStyleCSS(() => {
      const ok = document.execCommand("hiliteColor", false, color);
      if (!ok) document.execCommand("backColor", false, color);
    });
  }

  function applyClearFormat() {
    const range = ensureRangeInEditable();
    if (!range) return;
    document.execCommand("removeFormat");
    document.execCommand("unlink");
  }

  function clearFindHighlights() {
    if (!find.matches.length) return;
    const matches = Array.from(document.querySelectorAll(`.${FIND_MATCH_CLASS}, .${FIND_CURRENT_CLASS}`));
    for (const span of matches) {
      const parent = span.parentNode;
      if (!parent) continue;
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
      parent.normalize();
    }
    find.matches = [];
    find.currentIndex = -1;
  }

  function buildHighlights(query, ignoreCase) {
    if (!query) return [];
    const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(escape(query), ignoreCase ? "gi" : "g");
    const root = document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue) return NodeFilter.FILTER_REJECT;
        let p = n.parentNode;
        while (p) {
          if (p.nodeType === 1) {
            const el = /** @type {Element} */ (p);
            if (el.id === HOST_ID) return NodeFilter.FILTER_REJECT;
            if (el.classList.contains(FIND_MATCH_CLASS)) return NodeFilter.FILTER_REJECT;
            if (el.classList.contains(FIND_CURRENT_CLASS)) return NodeFilter.FILTER_REJECT;
            const tag = el.tagName;
            if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return NodeFilter.FILTER_REJECT;
          }
          p = p.parentNode;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const textNodes = [];
    let n;
    while ((n = walker.nextNode())) textNodes.push(n);

    const matches = [];
    for (const node of textNodes) {
      const text = node.nodeValue;
      let lastIndex = 0;
      let m;
      re.lastIndex = 0;
      const fragments = [];
      let hadMatch = false;
      while ((m = re.exec(text)) !== null) {
        hadMatch = true;
        if (m.index > lastIndex) fragments.push(document.createTextNode(text.slice(lastIndex, m.index)));
        const span = document.createElement("span");
        span.className = FIND_MATCH_CLASS;
        span.style.backgroundColor = "#fde68a";
        span.style.color = "inherit";
        span.style.borderRadius = "2px";
        span.textContent = m[0];
        fragments.push(span);
        matches.push(span);
        lastIndex = m.index + m[0].length;
        if (m[0].length === 0) re.lastIndex++;
      }
      if (hadMatch) {
        if (lastIndex < text.length) fragments.push(document.createTextNode(text.slice(lastIndex)));
        const parent = node.parentNode;
        for (const f of fragments) parent.insertBefore(f, node);
        parent.removeChild(node);
      }
    }
    return matches;
  }

  function setCurrentMatch(index) {
    if (!find.matches.length) {
      find.currentIndex = -1;
      return;
    }
    if (find.currentIndex >= 0 && find.matches[find.currentIndex]) {
      const prev = find.matches[find.currentIndex];
      prev.classList.remove(FIND_CURRENT_CLASS);
      prev.classList.add(FIND_MATCH_CLASS);
      prev.style.backgroundColor = "#fde68a";
      prev.style.outline = "";
    }
    const wrapped = ((index % find.matches.length) + find.matches.length) % find.matches.length;
    find.currentIndex = wrapped;
    const cur = find.matches[wrapped];
    if (cur) {
      cur.classList.remove(FIND_MATCH_CLASS);
      cur.classList.add(FIND_CURRENT_CLASS);
      cur.style.backgroundColor = "#f59e0b";
      cur.style.outline = "1px solid #b45309";
      cur.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }

  function reportFindResult() {
    TOOLBAR()?.setFindResult?.({
      total: find.matches.length,
      current: find.matches.length ? find.currentIndex + 1 : 0,
    });
  }

  function findRun(query, ignoreCase) {
    clearFindHighlights();
    find.query = query || "";
    find.ignoreCase = !!ignoreCase;
    if (!find.query) {
      reportFindResult();
      return;
    }
    find.matches = buildHighlights(find.query, find.ignoreCase);
    if (find.matches.length) setCurrentMatch(0);
    reportFindResult();
  }

  function findNav(direction) {
    if (!find.matches.length) return;
    const next = find.currentIndex + (direction === "prev" ? -1 : 1);
    setCurrentMatch(next);
    reportFindResult();
  }

  function findReplace(replacement) {
    if (!find.matches.length || find.currentIndex < 0) return;
    const span = find.matches[find.currentIndex];
    if (!span) return;
    const parent = span.parentNode;
    const before = document.createTextNode(replacement || "");
    parent.insertBefore(before, span);
    parent.removeChild(span);
    parent.normalize();
    find.matches.splice(find.currentIndex, 1);
    if (!find.matches.length) {
      find.currentIndex = -1;
    } else {
      const idx = Math.min(find.currentIndex, find.matches.length - 1);
      find.currentIndex = -1;
      setCurrentMatch(idx);
    }
    fireInput(document.body);
    reportFindResult();
  }

  function findReplaceAll(replacement) {
    if (!find.matches.length) return;
    for (const span of find.matches) {
      const parent = span.parentNode;
      if (!parent) continue;
      const tn = document.createTextNode(replacement || "");
      parent.insertBefore(tn, span);
      parent.removeChild(span);
      parent.normalize();
    }
    find.matches = [];
    find.currentIndex = -1;
    fireInput(document.body);
    reportFindResult();
  }

  function findClose() {
    clearFindHighlights();
    find.query = "";
    reportFindResult();
  }

  function handleAction(action) {
    if (!state.editing) return;
    if (!action || !action.type) return;

    switch (action.type) {
      case "bold":
        document.execCommand("bold");
        break;
      case "italic":
        document.execCommand("italic");
        break;
      case "underline":
        document.execCommand("underline");
        break;
      case "strikethrough":
        document.execCommand("strikeThrough");
        break;
      case "code":
        toggleInlineCode();
        break;
      case "fontSize":
        applyFontSize(action.value);
        break;
      case "foreColor":
        applyForeColor(action.value);
        break;
      case "hiliteColor":
        applyHiliteColor(action.value);
        break;
      case "formatBlock":
        applyFormatBlock(action.value);
        break;
      case "align":
        applyAlign(action.value);
        break;
      case "unorderedList":
        document.execCommand("insertUnorderedList");
        break;
      case "orderedList":
        document.execCommand("insertOrderedList");
        break;
      case "indent":
        document.execCommand("indent");
        break;
      case "outdent":
        document.execCommand("outdent");
        break;
      case "link":
        applyLink();
        break;
      case "insertImage":
        insertImage(action.src, action.alt);
        return;
      case "hr":
        applyHorizontalRule();
        break;
      case "clearFormat":
        applyClearFormat();
        break;
      case "removeText":
        removeSelectedText();
        break;
      case "undo":
        document.execCommand("undo");
        break;
      case "redo":
        document.execCommand("redo");
        break;
      case "find":
        findRun(action.query, action.ignoreCase);
        return;
      case "findNav":
        findNav(action.direction);
        return;
      case "findReplace":
        findReplace(action.replacement);
        return;
      case "findReplaceAll":
        findReplaceAll(action.replacement);
        return;
      case "findClose":
        findClose();
        return;
      case "save":
        saveInPlace();
        return;
      default:
        return;
    }
    fireInput(document.body);
    TOOLBAR()?.refresh?.();
  }

  function enableEditing() {
    if (state.editing) return;
    state.prevContentEditable = document.body.getAttribute("contenteditable");
    state.prevSpellcheck = document.body.getAttribute("spellcheck");
    document.body.setAttribute("contenteditable", "true");
    document.body.setAttribute("spellcheck", "false");
    document.body.addEventListener("input", onInput, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("paste", onPaste, true);
    document.addEventListener("mousedown", onBodyMouseDown, true);
    window.addEventListener("scroll", onWindowScroll, true);
    window.addEventListener("resize", onWindowScroll);
    TOOLBAR()?.mount(handleAction);
    TOOLBAR()?.setDirty?.(state.dirty);
    state.editing = true;
    notifyState();
  }

  function disableEditing() {
    if (!state.editing) return;
    findClose();
    removeResizeOverlay();
    document.body.removeEventListener("input", onInput, true);
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("paste", onPaste, true);
    document.removeEventListener("mousedown", onBodyMouseDown, true);
    window.removeEventListener("scroll", onWindowScroll, true);
    window.removeEventListener("resize", onWindowScroll);
    if (state.prevContentEditable === null) {
      document.body.removeAttribute("contenteditable");
    } else {
      document.body.setAttribute("contenteditable", state.prevContentEditable);
    }
    if (state.prevSpellcheck === null) {
      document.body.removeAttribute("spellcheck");
    } else {
      document.body.setAttribute("spellcheck", state.prevSpellcheck);
    }
    TOOLBAR()?.unmount();
    state.editing = false;
    notifyState();
  }

  function captureCleanHtml() {
    clearFindHighlights();
    removeResizeOverlay();

    const cloned = document.documentElement.cloneNode(true);
    cloned.querySelectorAll(`#${HOST_ID}, [data-cee-root]`).forEach((n) => n.remove());

    cloned.querySelectorAll(`.${FIND_MATCH_CLASS}, .${FIND_CURRENT_CLASS}`).forEach((span) => {
      const parent = span.parentNode;
      if (!parent) return;
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
    });
    cloned.querySelectorAll("body, body *").forEach((el) => {
      if (el.nodeType !== 1) return;
      el.normalize?.();
    });

    const body = cloned.querySelector("body");
    if (body) {
      if (state.prevContentEditable === null) body.removeAttribute("contenteditable");
      else body.setAttribute("contenteditable", state.prevContentEditable);
      if (state.prevSpellcheck === null) body.removeAttribute("spellcheck");
      else body.setAttribute("spellcheck", state.prevSpellcheck);
    }

    let doctype = "<!DOCTYPE html>";
    const dt = document.doctype;
    if (dt) {
      const pub = dt.publicId ? ` PUBLIC "${dt.publicId}"` : "";
      const sys = dt.systemId ? ` "${dt.systemId}"` : "";
      doctype = `<!DOCTYPE ${dt.name}${pub}${sys}>`;
    }
    return `${doctype}\n${cloned.outerHTML}`;
  }

  function fileNameFromUrl() {
    try {
      const path = decodeURIComponent(new URL(location.href).pathname);
      return path.split("/").filter(Boolean).pop() || "edited.html";
    } catch {
      return "edited.html";
    }
  }

  async function saveInPlace() {
    if (!window.showSaveFilePicker) {
      chrome.runtime.sendMessage({ type: "SAVE", tabId: null, saveAs: false });
      return;
    }

    const html = captureCleanHtml();

    try {
      if (!fileHandle) {
        fileHandle = await window.showSaveFilePicker({
          suggestedName: fileNameFromUrl(),
          types: [{
            description: "HTML Files",
            accept: { "text/html": [".html", ".htm", ".xhtml"] },
          }],
        });
      }

      const writable = await fileHandle.createWritable();
      await writable.write(html);
      await writable.close();

      setDirty(false);
    } catch (err) {
      if (err.name === "AbortError") return;
      fileHandle = null;
      chrome.runtime.sendMessage({ type: "SAVE", tabId: null, saveAs: false });
    }
  }

  const CONTENT_MESSAGE_TYPES = new Set([
    "PING", "SET_EDIT", "GET_HTML", "MARK_CLEAN", "SAVE_IN_PLACE",
    "PRINT", "GENERATE_PDF", "GENERATE_DOCX",
  ]);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!CONTENT_MESSAGE_TYPES.has(message?.type)) return false;

    try {
      if (message.type === "PING") {
        sendResponse({ ok: true, editing: state.editing, dirty: state.dirty });
        return false;
      }
      if (message.type === "SET_EDIT") {
        if (message.enable) enableEditing();
        else disableEditing();
        sendResponse({ editing: state.editing, dirty: state.dirty });
        return false;
      }
      if (message.type === "GET_HTML") {
        const html = captureCleanHtml();
        sendResponse({ html });
        return false;
      }
      if (message.type === "MARK_CLEAN") {
        setDirty(false);
        sendResponse({ ok: true });
        return false;
      }
      if (message.type === "SAVE_IN_PLACE") {
        saveInPlace().then(() => sendResponse({ ok: true }))
          .catch((err) => sendResponse({ error: err?.message || String(err) }));
        return true;
      }
      if (message.type === "PRINT") {
        const savedMargin = document.body.style.margin;
        const savedPadding = document.body.style.padding;

        const printStyle = document.createElement("style");
        printStyle.id = "__cee_print_style__";
        printStyle.textContent = `
          @page { margin: 0; }
          @media print {
            html, body { margin: 0 !important; padding: 4mm 0 !important; }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              color-adjust: exact !important;
            }
          }
        `;
        document.head.appendChild(printStyle);
        window.print();

        const cleanup = () => {
          printStyle.remove();
          document.body.style.margin = savedMargin;
          document.body.style.padding = savedPadding;
        };
        if (window.matchMedia) {
          const mql = window.matchMedia("print");
          const handler = (e) => {
            if (!e.matches) { cleanup(); mql.removeEventListener("change", handler); }
          };
          mql.addEventListener("change", handler);
          setTimeout(cleanup, 5000);
        } else {
          setTimeout(cleanup, 500);
        }

        sendResponse({ ok: true });
        return false;
      }
      if (message.type === "GENERATE_PDF") {
        generatePdf()
          .then((dataUrl) => sendResponse({ dataUrl }))
          .catch((err) => sendResponse({ error: err?.message || String(err) }));
        return true;
      }
      if (message.type === "GENERATE_DOCX") {
        generateDocx()
          .then((dataUrl) => sendResponse({ dataUrl }))
          .catch((err) => sendResponse({ error: err?.message || String(err) }));
        return true;
      }
    } catch (err) {
      sendResponse({ error: err?.message || String(err) });
      return false;
    }
  });

  async function generatePdf() {
    if (typeof html2pdf === "undefined") {
      throw new Error("html2pdf library not loaded.");
    }
    const toolbarHost = document.getElementById(HOST_ID);
    if (toolbarHost) toolbarHost.style.display = "none";

    const saved = {
      bodyMargin: document.body.style.margin,
      bodyPadding: document.body.style.padding,
      htmlMargin: document.documentElement.style.margin,
      htmlPadding: document.documentElement.style.padding,
    };
    document.body.style.margin = "0";
    document.body.style.padding = "0";
    document.documentElement.style.margin = "0";
    document.documentElement.style.padding = "0";

    try {
      const opt = {
        margin: [0, 0, 0, 0],
        filename: "export.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, scrollY: 0 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: "css" },
      };
      const blob = await html2pdf().set(opt).from(document.body).outputPdf("blob");
      return await blobToDataUrl(blob);
    } finally {
      document.body.style.margin = saved.bodyMargin;
      document.body.style.padding = saved.bodyPadding;
      document.documentElement.style.margin = saved.htmlMargin;
      document.documentElement.style.padding = saved.htmlPadding;
      if (toolbarHost) toolbarHost.style.display = "";
    }
  }

  async function generateDocx() {
    if (typeof htmlDocx === "undefined") {
      throw new Error("html-docx library not loaded.");
    }
    const html = captureCleanHtml();
    const blob = htmlDocx.asBlob(html);
    return await blobToDataUrl(blob);
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Failed to read blob."));
      reader.readAsDataURL(blob);
    });
  }

  window.addEventListener("beforeunload", (e) => {
    if (state.editing && state.dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  window.__CEE_CONTENT__ = { state, find };
})();
