"use strict";

(() => {
  if (window.__CEE_TOOLBAR__) return;

  // Toolbar CSS is inlined so styles always apply synchronously, regardless of
  // how the script is injected (declarative on file:// or programmatic via
  // chrome.scripting on http(s)). This also avoids needing the file in
  // web_accessible_resources, which would otherwise leak a fingerprinting probe
  // surface to every visited page.
  const TOOLBAR_CSS = `
:host {
  all: initial;
  display: block;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.shell {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 2147483647;
  display: flex;
  flex-direction: column;
  gap: 6px;
  pointer-events: auto;
}

.toolbar {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 8px;
  background: #ffffff;
  color: #111827;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  user-select: none;
  font-size: 13px;
  line-height: 1;
  max-width: min(900px, calc(100vw - 24px));
  cursor: grab;
}

.toolbar.dragging,
.toolbar.dragging * {
  cursor: grabbing !important;
}

.toolbar.dragging {
  opacity: 0.92;
}

.row {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  height: 28px;
  cursor: grab;
  color: #6b7280;
  user-select: none;
  letter-spacing: 1px;
  flex-shrink: 0;
}

.handle:active {
  cursor: grabbing;
}

.divider {
  width: 1px;
  height: 18px;
  background: #e5e7eb;
  margin: 0 2px;
  flex-shrink: 0;
}

.btn {
  appearance: none;
  border: 1px solid transparent;
  background: transparent;
  color: #111827;
  font: inherit;
  font-size: 13px;
  line-height: 1;
  height: 28px;
  min-width: 28px;
  padding: 0 8px;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: background 0.1s ease, border-color 0.1s ease;
  flex-shrink: 0;
}

.btn:hover {
  background: #f3f4f6;
}

.btn:active {
  background: #e5e7eb;
}

.btn.active {
  background: #dbeafe;
  border-color: #93c5fd;
  color: #1d4ed8;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: transparent;
  border-color: transparent;
  color: #111827;
}

.btn.danger:hover {
  background: #fee2e2;
  color: #b91c1c;
}

.btn.bold {
  font-weight: 700;
}

.btn.underline {
  text-decoration: underline;
}

.btn.italic {
  font-style: italic;
}

.btn.strike {
  text-decoration: line-through;
}

.btn.code-tag {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}

.select {
  appearance: none;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  color: #111827;
  font: inherit;
  font-size: 12px;
  height: 28px;
  padding: 0 22px 0 8px;
  border-radius: 6px;
  cursor: pointer;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%236b7280' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>");
  background-repeat: no-repeat;
  background-position: right 6px center;
  flex-shrink: 0;
}

.select:hover {
  background-color: #f9fafb;
}

.icon {
  width: 16px;
  height: 16px;
  display: inline-block;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.color-btn {
  position: relative;
  height: 28px;
  width: 32px;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
}

.color-btn:hover {
  background: #f3f4f6;
}

.color-btn .swatch {
  display: block;
  width: 18px;
  height: 4px;
  border-radius: 2px;
  background: currentColor;
  margin-top: 2px;
}

.color-btn .glyph {
  font-weight: 700;
  font-size: 13px;
  line-height: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.color-btn input[type="color"] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  border: none;
  padding: 0;
}

.dirty-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f59e0b;
  margin-left: 4px;
  display: none;
  flex-shrink: 0;
}

.dirty-dot.visible {
  display: inline-block;
}

.find-panel {
  display: none;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  padding: 8px;
  width: 360px;
  max-width: calc(100vw - 24px);
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: #111827;
}

.find-panel.open {
  display: flex;
}

.find-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.find-input {
  flex: 1;
  height: 26px;
  padding: 0 8px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font: inherit;
  font-size: 12px;
  color: #111827;
  background: #ffffff;
  outline: none;
}

.find-input:focus {
  border-color: #93c5fd;
  box-shadow: 0 0 0 2px rgba(147, 197, 253, 0.4);
}

.find-status {
  font-variant-numeric: tabular-nums;
  color: #6b7280;
  min-width: 48px;
  text-align: center;
}

.find-options {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #4b5563;
}

.find-options label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.find-options input[type="checkbox"] {
  margin: 0;
}

.find-btn {
  appearance: none;
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  color: #111827;
  height: 26px;
  padding: 0 8px;
  font: inherit;
  font-size: 12px;
  border-radius: 6px;
  cursor: pointer;
}

.find-btn:hover {
  background: #f3f4f6;
}

.find-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.find-btn.icon-only {
  width: 26px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.find-btn.close {
  margin-left: auto;
  border-color: transparent;
  background: transparent;
  color: #6b7280;
}

.find-btn.close:hover {
  background: #f3f4f6;
  color: #111827;
}

.cee-tooltip {
  position: fixed;
  z-index: 2147483647;
  background: #111827;
  color: #f9fafb;
  font: 500 11px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    sans-serif;
  padding: 5px 8px;
  border-radius: 5px;
  pointer-events: none;
  white-space: nowrap;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
  opacity: 0;
  transform: translateY(-3px);
  transition: opacity 0.12s ease, transform 0.12s ease;
  max-width: 260px;
}

.cee-tooltip.visible {
  opacity: 1;
  transform: translateY(0);
}

.cee-tooltip kbd {
  display: inline-block;
  margin-left: 2px;
  padding: 0 4px;
  border: 1px solid #374151;
  border-radius: 3px;
  background: #1f2937;
  font: 500 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: #e5e7eb;
}
`;

  const FONT_SIZES = ["10", "12", "14", "16", "18", "20", "24", "28", "32", "40", "48"];
  const HEADINGS = [
    { value: "p", label: "Paragraph" },
    { value: "h1", label: "Heading 1" },
    { value: "h2", label: "Heading 2" },
    { value: "h3", label: "Heading 3" },
    { value: "h4", label: "Heading 4" },
    { value: "h5", label: "Heading 5" },
    { value: "h6", label: "Heading 6" },
    { value: "blockquote", label: "Blockquote" },
    { value: "pre", label: "Code block" },
  ];

  const SVG_NS = "http://www.w3.org/2000/svg";

  const ICONS = {
    link: "M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 1 0-5.66-5.66l-1.5 1.5 M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 1 0 5.66 5.66l1.5-1.5",
    trash: "M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14 M10 11v6 M14 11v6",
    image: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z M3 17l5-5 4 4 3-3 6 6 M9 10a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z",
    hr: "M3 12h18",
    undo: "M9 14l-4-4 4-4 M5 10h9a5 5 0 0 1 0 10h-3",
    redo: "M15 14l4-4-4-4 M19 10h-9a5 5 0 0 0 0 10h3",
    bullets: "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
    numbered: "M10 6h11 M10 12h11 M10 18h11 M4 6h1v4 M4 10h2 M6 14H4l2 4H4",
    indent: "M3 6h18 M3 18h18 M3 12h11 M21 12l-4-3v6l4-3z",
    outdent: "M3 6h18 M3 18h18 M3 12h11 M3 12l4-3v6l-4-3z",
    alignLeft: "M3 6h18 M3 12h12 M3 18h18 M3 24h10",
    alignCenter: "M3 6h18 M6 12h12 M3 18h18",
    alignRight: "M3 6h18 M9 12h12 M3 18h18",
    alignJustify: "M3 6h18 M3 12h18 M3 18h18",
    quote: "M7 7h4v4H7zm0 4c0 3 2 5 4 5 M15 7h4v4h-4zm0 4c0 3 2 5 4 5",
    clear: "M7 7l10 10 M16 5h3v3 M14 8L7 15l-3 3 3-3 7-7zM5 18h6",
    search: "M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14z M21 21l-5.5-5.5",
  };

  function svgIcon(d) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "icon");
    svg.setAttribute("viewBox", "0 0 24 24");
    const paths = d.split(" M").map((p, i) => (i === 0 ? p : "M" + p));
    for (const pd of paths) {
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", pd);
      svg.appendChild(path);
    }
    return svg;
  }

  let host = null;
  let shadow = null;
  let toolbarEl = null;
  let findPanelEl = null;
  let findElems = {};
  let buttons = {};
  let dirtyDot = null;
  let savedRange = null;
  let pendingSelectionUpdate = null;

  let onActionCallback = null;

  let dragState = null;
  let findDebounce = null;
  let lastFindResult = { total: 0, current: 0 };

  let tooltipEl = null;
  let tooltipTarget = null;
  let tooltipShowTimer = null;
  const TOOLTIP_DELAY_MS = 350;

  function findTooltipTarget(node) {
    let n = node;
    while (n && n.nodeType === 1) {
      if (n.dataset && n.dataset.tooltip) return n;
      n = n.parentNode;
    }
    return null;
  }

  function positionTooltip(target) {
    if (!tooltipEl) return;
    const targetRect = target.getBoundingClientRect();
    const tipRect = tooltipEl.getBoundingClientRect();
    const margin = 6;
    const viewportPad = 4;
    let left = targetRect.left + targetRect.width / 2 - tipRect.width / 2;
    let top = targetRect.bottom + margin;
    if (left < viewportPad) left = viewportPad;
    if (left + tipRect.width > window.innerWidth - viewportPad) {
      left = window.innerWidth - tipRect.width - viewportPad;
    }
    if (top + tipRect.height > window.innerHeight - viewportPad) {
      top = targetRect.top - margin - tipRect.height;
    }
    if (top < viewportPad) top = viewportPad;
    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${top}px`;
  }

  function showTooltipFor(target) {
    if (!tooltipEl || !target?.dataset?.tooltip) return;
    tooltipEl.textContent = target.dataset.tooltip;
    tooltipEl.classList.add("visible");
    positionTooltip(target);
  }

  function hideTooltip() {
    if (tooltipShowTimer) {
      clearTimeout(tooltipShowTimer);
      tooltipShowTimer = null;
    }
    tooltipTarget = null;
    if (tooltipEl) tooltipEl.classList.remove("visible");
  }

  function onShellMouseOver(e) {
    if (dragState) return;
    const target = findTooltipTarget(e.target);
    if (!target || target === tooltipTarget) return;
    tooltipTarget = target;
    if (tooltipShowTimer) clearTimeout(tooltipShowTimer);
    tooltipShowTimer = setTimeout(() => {
      tooltipShowTimer = null;
      if (tooltipTarget === target) showTooltipFor(target);
    }, TOOLTIP_DELAY_MS);
  }

  function onShellMouseOut(e) {
    const target = findTooltipTarget(e.target);
    if (!target) return;
    const related = findTooltipTarget(e.relatedTarget);
    if (related === target) return;
    if (target === tooltipTarget) hideTooltip();
  }

  function rememberSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (isInsideEditable(range.commonAncestorContainer)) {
        savedRange = range.cloneRange();
      }
    }
  }

  function restoreSelection() {
    if (!savedRange) return false;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
    return true;
  }

  function isInsideEditable(node) {
    let n = node;
    while (n) {
      if (n.nodeType === 1) {
        const el = /** @type {HTMLElement} */ (n);
        if (el.isContentEditable) return true;
        if (host && host.contains(el)) return false;
      }
      n = n.parentNode;
    }
    return false;
  }

  function getActiveRange() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (isInsideEditable(range.commonAncestorContainer)) return range;
    }
    if (savedRange && document.contains(savedRange.startContainer)) {
      return savedRange;
    }
    return null;
  }

  function hasAncestor(range, tagNames) {
    if (!range) return false;
    let node = range.commonAncestorContainer;
    if (node.nodeType === 3) node = node.parentNode;
    while (node && node !== document.body) {
      if (node.nodeType === 1 && tagNames.includes(node.tagName)) return true;
      node = node.parentNode;
    }
    return false;
  }

  function blockAncestorTag(range) {
    if (!range) return "";
    let node = range.commonAncestorContainer;
    if (node.nodeType === 3) node = node.parentNode;
    const blocks = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "PRE", "DIV", "LI"]);
    while (node && node !== document.body) {
      if (node.nodeType === 1 && blocks.has(node.tagName)) {
        return node.tagName.toLowerCase();
      }
      node = node.parentNode;
    }
    return "";
  }

  function alignmentOf(range) {
    if (!range) return "";
    let node = range.commonAncestorContainer;
    if (node.nodeType === 3) node = node.parentNode;
    while (node && node !== document.body) {
      if (node.nodeType === 1) {
        const align =
          node.style?.textAlign ||
          (node.tagName === "CENTER" ? "center" : "");
        if (align) return align;
      }
      node = node.parentNode;
    }
    return "";
  }

  function closestAncestorWithFontSize(range) {
    let node = range.commonAncestorContainer;
    if (node.nodeType === 3) node = node.parentNode;
    while (node && node !== document.body) {
      if (node.nodeType === 1) {
        const inline = node.style && node.style.fontSize;
        if (inline) return node;
      }
      node = node.parentNode;
    }
    return null;
  }

  function isInlineCode(range) {
    let node = range.commonAncestorContainer;
    if (node.nodeType === 3) node = node.parentNode;
    while (node && node !== document.body) {
      if (node.nodeType === 1 && node.tagName === "CODE") {
        return node.parentNode?.tagName !== "PRE";
      }
      node = node.parentNode;
    }
    return false;
  }

  function updateActiveStates() {
    const range = getActiveRange();
    const isCollapsed = !range || range.collapsed;
    const inEditable = !!range;

    buttons.bold?.classList.toggle("active", inEditable && hasAncestor(range, ["B", "STRONG"]));
    buttons.italic?.classList.toggle("active", inEditable && hasAncestor(range, ["I", "EM"]));
    buttons.underline?.classList.toggle("active", inEditable && hasAncestor(range, ["U"]));
    buttons.strike?.classList.toggle("active", inEditable && hasAncestor(range, ["S", "STRIKE", "DEL"]));
    buttons.code?.classList.toggle("active", inEditable && isInlineCode(range));
    buttons.link?.classList.toggle("active", inEditable && hasAncestor(range, ["A"]));
    buttons.unorderedList?.classList.toggle("active", inEditable && hasAncestor(range, ["UL"]));
    buttons.orderedList?.classList.toggle("active", inEditable && hasAncestor(range, ["OL"]));
    buttons.blockquote?.classList.toggle("active", inEditable && hasAncestor(range, ["BLOCKQUOTE"]));

    const align = inEditable ? alignmentOf(range) : "";
    buttons.alignLeft?.classList.toggle("active", inEditable && (align === "left" || align === ""));
    buttons.alignCenter?.classList.toggle("active", inEditable && align === "center");
    buttons.alignRight?.classList.toggle("active", inEditable && align === "right");
    buttons.alignJustify?.classList.toggle("active", inEditable && align === "justify");

    if (buttons.heading) {
      const tag = inEditable ? blockAncestorTag(range) : "";
      const candidate = ["p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre"].includes(tag) ? tag : "";
      buttons.heading.value = candidate;
    }

    if (buttons.fontSize) {
      const ancestor = inEditable ? closestAncestorWithFontSize(range) : null;
      const value = ancestor ? Math.round(parseFloat(getComputedStyle(ancestor).fontSize)) : "";
      buttons.fontSize.value = String(value || "");
    }

    const allButtons = Object.values(buttons).filter((b) => b && typeof b.tagName === "string");
    for (const b of allButtons) {
      if (b.tagName === "BUTTON" || b.tagName === "SELECT") {
        b.disabled = !inEditable;
      }
    }
    if (buttons.remove) buttons.remove.disabled = !inEditable || isCollapsed;
    if (buttons.code) buttons.code.disabled = !inEditable || (isCollapsed && !isInlineCode(range));

    [buttons.undo, buttons.redo, buttons.find].forEach((b) => {
      if (b) b.disabled = false;
    });
  }

  function buildButton(opts) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `btn ${opts.cls || ""}`.trim();
    if (opts.title) {
      btn.setAttribute("aria-label", opts.title);
      btn.dataset.tooltip = opts.title;
    }
    if (opts.label) btn.textContent = opts.label;
    if (opts.icon) btn.appendChild(svgIcon(opts.icon));
    btn.addEventListener("mousedown", (e) => e.preventDefault());
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      restoreSelection();
      onActionCallback?.(opts.action);
    });
    return btn;
  }

  function buildSelect(opts) {
    const sel = document.createElement("select");
    sel.className = "select";
    if (opts.title) {
      sel.setAttribute("aria-label", opts.title);
      sel.dataset.tooltip = opts.title;
    }
    if (opts.placeholder !== undefined) {
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = opts.placeholder;
      sel.appendChild(placeholder);
    }
    for (const v of opts.options) {
      const o = document.createElement("option");
      if (typeof v === "string") {
        o.value = v;
        o.textContent = v;
      } else {
        o.value = v.value;
        o.textContent = v.label;
      }
      sel.appendChild(o);
    }
    sel.addEventListener("mousedown", () => {
      rememberSelection();
    });
    sel.addEventListener("change", (e) => {
      e.preventDefault();
      const v = sel.value;
      if (!v) return;
      restoreSelection();
      onActionCallback?.(opts.actionFn ? opts.actionFn(v) : { type: opts.actionType, value: v });
      sel.blur();
    });
    return sel;
  }

  function buildColorButton(opts) {
    const wrap = document.createElement("button");
    wrap.type = "button";
    wrap.className = "color-btn";
    if (opts.title) {
      wrap.setAttribute("aria-label", opts.title);
      wrap.dataset.tooltip = opts.title;
    }
    wrap.addEventListener("mousedown", (e) => {
      rememberSelection();
      e.preventDefault();
      input.click();
    });

    const glyph = document.createElement("span");
    glyph.className = "glyph";
    const letter = document.createElement("span");
    letter.textContent = opts.glyph || "A";
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.color = opts.defaultColor || "#000000";
    glyph.append(letter, swatch);

    const input = document.createElement("input");
    input.type = "color";
    input.value = opts.defaultColor || "#000000";
    input.addEventListener("mousedown", (e) => {
      rememberSelection();
      e.stopPropagation();
    });
    input.addEventListener("input", () => {
      swatch.style.color = input.value;
    });
    input.addEventListener("change", () => {
      swatch.style.color = input.value;
      restoreSelection();
      onActionCallback?.({ type: opts.actionType, value: input.value });
    });

    wrap.append(glyph, input);
    return wrap;
  }

  const INTERACTIVE_DRAG_SELECTOR =
    "button, select, input, textarea, label, a";

  function startDrag(e) {
    if (e.button !== 0) return;
    const t = e.target;
    if (t && t.nodeType === 1 && t.closest && t.closest(INTERACTIVE_DRAG_SELECTOR)) {
      return;
    }
    const rect = host.getBoundingClientRect();
    dragState = {
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
    };
    toolbarEl.classList.add("dragging");
    hideTooltip();
    document.addEventListener("mousemove", onDrag, true);
    document.addEventListener("mouseup", endDrag, true);
    e.preventDefault();
  }

  function onDrag(e) {
    if (!dragState) return;
    const shell = host.firstChild;
    const w = shell.offsetWidth || 200;
    const h = shell.offsetHeight || 60;
    const x = Math.max(4, Math.min(window.innerWidth - 50, e.clientX - dragState.offsetX));
    const y = Math.max(4, Math.min(window.innerHeight - 40, e.clientY - dragState.offsetY));
    const shellEl = shadow.querySelector(".shell");
    shellEl.style.left = x + "px";
    shellEl.style.top = y + "px";
    shellEl.style.right = "auto";
    e.preventDefault();
  }

  function endDrag() {
    dragState = null;
    toolbarEl?.classList.remove("dragging");
    document.removeEventListener("mousemove", onDrag, true);
    document.removeEventListener("mouseup", endDrag, true);
  }

  function makeDivider() {
    const d = document.createElement("span");
    d.className = "divider";
    return d;
  }

  function buildFindPanel() {
    const panel = document.createElement("div");
    panel.className = "find-panel";

    const findRow = document.createElement("div");
    findRow.className = "find-row";

    const findInput = document.createElement("input");
    findInput.type = "text";
    findInput.className = "find-input";
    findInput.placeholder = "Find";
    findInput.spellcheck = false;

    const status = document.createElement("span");
    status.className = "find-status";
    status.textContent = "0/0";

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "find-btn icon-only";
    prevBtn.setAttribute("aria-label", "Previous match (Shift+Enter)");
    prevBtn.dataset.tooltip = "Previous match (Shift+Enter)";
    prevBtn.textContent = "↑";

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "find-btn icon-only";
    nextBtn.setAttribute("aria-label", "Next match (Enter)");
    nextBtn.dataset.tooltip = "Next match (Enter)";
    nextBtn.textContent = "↓";

    findRow.append(findInput, status, prevBtn, nextBtn);

    const replaceRow = document.createElement("div");
    replaceRow.className = "find-row";
    const replaceInput = document.createElement("input");
    replaceInput.type = "text";
    replaceInput.className = "find-input";
    replaceInput.placeholder = "Replace";
    replaceInput.spellcheck = false;

    const replaceBtn = document.createElement("button");
    replaceBtn.type = "button";
    replaceBtn.className = "find-btn";
    replaceBtn.textContent = "Replace";
    replaceBtn.setAttribute("aria-label", "Replace current match (Enter)");
    replaceBtn.dataset.tooltip = "Replace current match (Enter)";

    const replaceAllBtn = document.createElement("button");
    replaceAllBtn.type = "button";
    replaceAllBtn.className = "find-btn";
    replaceAllBtn.textContent = "All";
    replaceAllBtn.setAttribute("aria-label", "Replace all (Cmd/Ctrl+Enter)");
    replaceAllBtn.dataset.tooltip = "Replace all (Cmd/Ctrl+Enter)";

    replaceRow.append(replaceInput, replaceBtn, replaceAllBtn);

    const optionsRow = document.createElement("div");
    optionsRow.className = "find-row find-options";
    const caseLabel = document.createElement("label");
    const caseToggle = document.createElement("input");
    caseToggle.type = "checkbox";
    const caseText = document.createElement("span");
    caseText.textContent = "Match case";
    caseLabel.append(caseToggle, caseText);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "find-btn close";
    closeBtn.setAttribute("aria-label", "Close (Esc)");
    closeBtn.dataset.tooltip = "Close (Esc)";
    closeBtn.textContent = "Close";

    optionsRow.append(caseLabel, closeBtn);

    panel.append(findRow, replaceRow, optionsRow);

    function emitFind() {
      onActionCallback?.({
        type: "find",
        query: findInput.value,
        ignoreCase: !caseToggle.checked,
      });
    }

    findInput.addEventListener("input", () => {
      clearTimeout(findDebounce);
      findDebounce = setTimeout(emitFind, 120);
    });
    caseToggle.addEventListener("change", emitFind);
    prevBtn.addEventListener("click", (e) => {
      e.preventDefault();
      onActionCallback?.({ type: "findNav", direction: "prev" });
      findInput.focus();
    });
    nextBtn.addEventListener("click", (e) => {
      e.preventDefault();
      onActionCallback?.({ type: "findNav", direction: "next" });
      findInput.focus();
    });
    replaceBtn.addEventListener("click", (e) => {
      e.preventDefault();
      onActionCallback?.({ type: "findReplace", replacement: replaceInput.value });
    });
    replaceAllBtn.addEventListener("click", (e) => {
      e.preventDefault();
      onActionCallback?.({ type: "findReplaceAll", replacement: replaceInput.value });
    });
    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      api.closeFind();
    });
    findInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          onActionCallback?.({ type: "findNav", direction: "prev" });
        } else {
          onActionCallback?.({ type: "findNav", direction: "next" });
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        api.closeFind();
      }
    });
    replaceInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.metaKey || e.ctrlKey) {
          onActionCallback?.({ type: "findReplaceAll", replacement: replaceInput.value });
        } else {
          onActionCallback?.({ type: "findReplace", replacement: replaceInput.value });
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        api.closeFind();
      }
    });

    findElems = { panel, findInput, replaceInput, status, caseToggle, prevBtn, nextBtn, replaceBtn, replaceAllBtn };
    return panel;
  }

  function build() {
    host = document.createElement("div");
    host.id = "__cee_toolbar_host__";
    host.setAttribute("data-cee-root", "true");
    host.style.all = "initial";
    host.style.position = "fixed";
    host.style.top = "0";
    host.style.left = "0";
    host.style.zIndex = "2147483647";
    host.style.pointerEvents = "none";

    shadow = host.attachShadow({ mode: "open" });

    const styleEl = document.createElement("style");
    styleEl.textContent = TOOLBAR_CSS;
    shadow.appendChild(styleEl);

    const shell = document.createElement("div");
    shell.className = "shell";

    toolbarEl = document.createElement("div");
    toolbarEl.className = "toolbar";

    const row1 = document.createElement("div");
    row1.className = "row";
    const row2 = document.createElement("div");
    row2.className = "row";

    const handle = document.createElement("div");
    handle.className = "handle";
    handle.setAttribute("aria-label", "Drag to move");
    handle.dataset.tooltip = "Drag to move (or grab any toolbar gap)";
    handle.textContent = "⋮⋮";
    row1.appendChild(handle);

    buttons.undo = buildButton({ icon: ICONS.undo, title: "Undo (Ctrl/Cmd+Z)", action: { type: "undo" } });
    buttons.redo = buildButton({ icon: ICONS.redo, title: "Redo (Ctrl/Cmd+Shift+Z)", action: { type: "redo" } });
    row1.append(buttons.undo, buttons.redo, makeDivider());

    buttons.heading = buildSelect({
      title: "Block format",
      options: HEADINGS,
      placeholder: "—",
      actionType: "formatBlock",
    });
    row1.append(buttons.heading, makeDivider());

    buttons.bold = buildButton({ label: "B", cls: "bold", title: "Bold (Ctrl/Cmd+B)", action: { type: "bold" } });
    buttons.italic = buildButton({ label: "I", cls: "italic", title: "Italic (Ctrl/Cmd+I)", action: { type: "italic" } });
    buttons.underline = buildButton({ label: "U", cls: "underline", title: "Underline (Ctrl/Cmd+U)", action: { type: "underline" } });
    buttons.strike = buildButton({ label: "S", cls: "strike", title: "Strikethrough", action: { type: "strikethrough" } });
    buttons.code = buildButton({ label: "</>", cls: "code-tag", title: "Inline code", action: { type: "code" } });
    row1.append(buttons.bold, buttons.italic, buttons.underline, buttons.strike, buttons.code, makeDivider());

    buttons.fontSize = buildSelect({
      placeholder: "Size",
      title: "Font size (px)",
      options: FONT_SIZES,
      actionType: "fontSize",
    });
    row1.append(buttons.fontSize);

    buttons.foreColor = buildColorButton({
      title: "Text color",
      glyph: "A",
      defaultColor: "#000000",
      actionType: "foreColor",
    });
    buttons.hiliteColor = buildColorButton({
      title: "Highlight color",
      glyph: "H",
      defaultColor: "#fef08a",
      actionType: "hiliteColor",
    });
    row1.append(buttons.foreColor, buttons.hiliteColor, makeDivider());

    dirtyDot = document.createElement("span");
    dirtyDot.className = "dirty-dot";
    dirtyDot.setAttribute("aria-label", "Unsaved changes");
    dirtyDot.dataset.tooltip = "Unsaved changes";
    row1.appendChild(dirtyDot);

    buttons.alignLeft = buildButton({ icon: ICONS.alignLeft, title: "Align left", action: { type: "align", value: "left" } });
    buttons.alignCenter = buildButton({ icon: ICONS.alignCenter, title: "Align center", action: { type: "align", value: "center" } });
    buttons.alignRight = buildButton({ icon: ICONS.alignRight, title: "Align right", action: { type: "align", value: "right" } });
    buttons.alignJustify = buildButton({ icon: ICONS.alignJustify, title: "Justify", action: { type: "align", value: "justify" } });
    row2.append(buttons.alignLeft, buttons.alignCenter, buttons.alignRight, buttons.alignJustify, makeDivider());

    buttons.unorderedList = buildButton({ icon: ICONS.bullets, title: "Bulleted list", action: { type: "unorderedList" } });
    buttons.orderedList = buildButton({ icon: ICONS.numbered, title: "Numbered list", action: { type: "orderedList" } });
    buttons.outdent = buildButton({ icon: ICONS.outdent, title: "Decrease indent", action: { type: "outdent" } });
    buttons.indent = buildButton({ icon: ICONS.indent, title: "Increase indent", action: { type: "indent" } });
    row2.append(buttons.unorderedList, buttons.orderedList, buttons.outdent, buttons.indent, makeDivider());

    buttons.blockquote = buildButton({ icon: ICONS.quote, title: "Blockquote", action: { type: "formatBlock", value: "blockquote" } });
    row2.append(buttons.blockquote, makeDivider());

    buttons.link = buildButton({ icon: ICONS.link, title: "Insert / edit link (Ctrl/Cmd+K)", action: { type: "link" } });
    buttons.image = buildButton({ icon: ICONS.image, title: "Insert image (URL)", action: { type: "image" } });
    buttons.hr = buildButton({ icon: ICONS.hr, title: "Insert horizontal rule", action: { type: "hr" } });
    row2.append(buttons.link, buttons.image, buttons.hr, makeDivider());

    buttons.clearFormat = buildButton({ icon: ICONS.clear, title: "Clear formatting", action: { type: "clearFormat" } });
    buttons.remove = buildButton({ icon: ICONS.trash, cls: "danger", title: "Remove selected text", action: { type: "removeText" } });
    row2.append(buttons.clearFormat, buttons.remove, makeDivider());

    buttons.find = buildButton({ icon: ICONS.search, title: "Find & Replace (Ctrl/Cmd+F)", action: { type: "__toggleFind" } });
    row2.append(buttons.find);

    toolbarEl.append(row1, row2);
    toolbarEl.addEventListener("mousedown", startDrag);

    const findPanel = buildFindPanel();
    findPanelEl = findPanel;

    shell.append(toolbarEl, findPanel);
    shadow.appendChild(shell);

    tooltipEl = document.createElement("div");
    tooltipEl.className = "cee-tooltip";
    tooltipEl.setAttribute("role", "tooltip");
    shadow.appendChild(tooltipEl);

    shell.addEventListener("mouseover", onShellMouseOver);
    shell.addEventListener("mouseout", onShellMouseOut);

    document.documentElement.appendChild(host);
  }

  function scheduleSelectionUpdate() {
    if (pendingSelectionUpdate) return;
    pendingSelectionUpdate = requestAnimationFrame(() => {
      pendingSelectionUpdate = null;
      updateActiveStates();
    });
  }

  function onSelectionChange() {
    rememberSelection();
    scheduleSelectionUpdate();
  }

  const api = {
    mount(onAction) {
      if (host) {
        host.style.display = "";
        return;
      }
      onActionCallback = (action) => {
        if (action?.type === "__toggleFind") {
          api.toggleFind();
          return;
        }
        onAction(action);
      };
      build();
      document.addEventListener("selectionchange", onSelectionChange, true);
      updateActiveStates();
    },
    unmount() {
      document.removeEventListener("selectionchange", onSelectionChange, true);
      hideTooltip();
      if (host && host.parentNode) host.parentNode.removeChild(host);
      host = null;
      shadow = null;
      toolbarEl = null;
      findPanelEl = null;
      findElems = {};
      buttons = {};
      dirtyDot = null;
      savedRange = null;
      onActionCallback = null;
      tooltipEl = null;
      tooltipTarget = null;
    },
    setDirty(dirty) {
      if (dirtyDot) dirtyDot.classList.toggle("visible", !!dirty);
    },
    refresh() {
      scheduleSelectionUpdate();
    },
    rememberSelection,
    restoreSelection,
    isMounted() {
      return !!host;
    },
    rootMatches(node) {
      return host && host.contains(node);
    },
    openFind() {
      if (!findPanelEl) return;
      findPanelEl.classList.add("open");
      setTimeout(() => findElems.findInput?.focus(), 0);
      if (findElems.findInput?.value) {
        onActionCallback?.({
          type: "find",
          query: findElems.findInput.value,
          ignoreCase: !findElems.caseToggle.checked,
        });
      }
    },
    closeFind() {
      if (!findPanelEl) return;
      findPanelEl.classList.remove("open");
      onActionCallback?.({ type: "findClose" });
    },
    toggleFind() {
      if (!findPanelEl) return;
      if (findPanelEl.classList.contains("open")) api.closeFind();
      else api.openFind();
    },
    isFindOpen() {
      return !!findPanelEl?.classList.contains("open");
    },
    setFindResult(result) {
      lastFindResult = result || { total: 0, current: 0 };
      if (findElems.status) {
        findElems.status.textContent = `${lastFindResult.current}/${lastFindResult.total}`;
      }
      const noResults = !lastFindResult.total;
      [findElems.prevBtn, findElems.nextBtn, findElems.replaceBtn, findElems.replaceAllBtn].forEach((b) => {
        if (b) b.disabled = noResults;
      });
    },
  };

  window.__CEE_TOOLBAR__ = api;
})();
