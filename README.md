# PagePatch - HTML File Editor

A Manifest V3 Chrome extension that lets you toggle "edit mode" on a local HTML file open in the browser, edit it inline with a rich floating toolbar, and save the result via the browser's Save As dialog. You can overwrite the original file or save a copy.

## Store Listing Copy

**Name**

`PagePatch - HTML File Editor`

**Short description**

Edit local HTML files directly in Chrome with rich formatting tools and save changes as the same file or a copy.

**Long description**

PagePatch lets you open a local HTML file in Chrome, switch into edit mode, and update the page directly in the browser without opening a separate HTML editor.

Use the floating toolbar to format text, apply headings, build lists, adjust alignment, change colors, insert links and images, add horizontal rules, and make quick text edits inline. PagePatch also includes undo/redo plus a built-in Find & Replace panel for editing longer pages faster.

When you're done, save the updated HTML through Chrome's Save As flow. You can overwrite the original file by choosing the same location and filename, or save a separate copy. PagePatch is built for editing `file://` HTML pages locally and keeping the workflow simple: open in Chrome, edit visually, save your changes.

## Features

### Inline formatting

- Bold, Italic, Underline, Strikethrough
- Inline `code`
- Font size dropdown
- Text color and highlight color (color pickers)
- Insert / edit / remove links

### Block formatting

- Headings (H1–H6), Paragraph, Blockquote, Code block (via the block-format dropdown)
- Bulleted and numbered lists, indent / outdent
- Alignment: left / center / right / justify
- Insert image (by URL)
- Insert horizontal rule

### Productivity

- Undo / Redo (toolbar buttons + `Ctrl/Cmd+Z` / `Ctrl/Cmd+Shift+Z`)
- Clear formatting (also unlinks)
- Remove selected text
- Find & Replace panel (`Ctrl/Cmd+F`):
  - Live highlighting of matches
  - Match count + current index
  - Prev / Next navigation
  - Replace current match / Replace all
  - Optional case sensitivity
  - `Esc` to close

### Save

- **Save** — opens Chrome's Save As dialog pre-filled with the original filename. Navigate to the original folder and confirm to overwrite.
- **Save As…** — same dialog; pick a different name or location to save a copy.
- Unsaved changes show an orange dot on the toolbar and a `beforeunload` prompt if you try to navigate away.

### Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd + B` | Bold |
| `Ctrl/Cmd + I` | Italic |
| `Ctrl/Cmd + U` | Underline |
| `Ctrl/Cmd + K` | Insert / edit / remove link |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl/Cmd + Shift + Z` / `Ctrl/Cmd + Y` | Redo |
| `Ctrl/Cmd + F` | Open / close Find & Replace |
| `Enter` (in Find input) | Next match |
| `Shift + Enter` (in Find input) | Previous match |
| `Enter` (in Replace input) | Replace current |
| `Cmd/Ctrl + Enter` (in Replace input) | Replace all |
| `Esc` (in Find panel) | Close Find |

## Install (load unpacked)

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this folder.
4. Find the extension card, click **Details**, and enable **Allow access to file URLs**. This is required so the extension can act on `file:///` pages.

## Usage

1. Open any local HTML file in Chrome (e.g. drag a `.html` file into the browser, or open `examples/sample.html` from this repo).
2. Click the extension icon in the toolbar.
3. Toggle **Edit mode** on. The page becomes editable and a two-row floating toolbar appears (drag it via the `⋮⋮` handle).
4. Select text and apply formatting; type to add text; select and press Delete or click the trash icon to remove text.
5. Click **Save** to open the Save As dialog with the original filename. Navigate to the original folder and confirm to overwrite.
6. Click **Save As…** to save a copy with a different name or location.
7. Toggle **Edit mode** off when done — the toolbar disappears and the page becomes read-only again.

## How saving works

Because Chrome extensions cannot silently overwrite arbitrary files on disk, this extension uses `chrome.downloads.download({ saveAs: true })` to surface Chrome's native Save As dialog. You confirm the destination in the OS dialog. To overwrite the original, navigate the dialog to the original folder and use the same filename — Chrome / the OS will prompt to confirm replacement.

If you need silent overwrite (no dialog), that requires Native Messaging with a small local helper and is not part of this version.

Before saving, the extension cleans up its own DOM artifacts (toolbar host, find/replace highlight spans, the `contenteditable` and `spellcheck` attributes it added) so the saved file contains only your edits.

## Project layout

```
.
├── manifest.json
├── src/
│   ├── background.js
│   ├── content/
│   │   ├── content.js          # toggle edit mode, action handlers, find/replace, DOM cleanup
│   │   └── toolbar.js          # floating toolbar UI (two rows + find panel) in Shadow DOM (CSS inlined)
│   └── popup/
│       ├── popup.html
│       ├── popup.js
│       └── popup.css
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── examples/
│   └── sample.html             # quick fixture for trying the extension
├── PRIVACY.md                  # privacy policy (required by Chrome Web Store)
├── PUBLISHING.md               # how to publish on the Chrome Web Store
├── LICENSE                     # MIT
└── README.md
```

## Permissions

PagePatch requests only the permissions it actually needs:

- `activeTab`, `scripting` — to inject the editor on the current tab when you click the toolbar icon (no persistent broad host access).
- `downloads` — to surface Chrome's Save As dialog when you save the edited HTML.
- `storage` — used only for `chrome.storage.session` (volatile, not synced) to remember per-tab edit state.
- `host_permissions: file:///*` — to enable editing of local HTML files, the extension's stated single purpose.

PagePatch makes no network requests, ships no remote code, and collects no telemetry. See [PRIVACY.md](PRIVACY.md) for full details.

## Security

- No third-party JavaScript dependencies — zero supply-chain surface.
- Toolbar UI mounts in a Shadow DOM, isolated from host-page CSS and JS.
- Link and image insertion validate the URL scheme before writing to the page, blocking `javascript:` and other dangerous URLs from being persisted into the saved HTML.
- The background message handler verifies the sender and rejects messages from outside the extension.
- Default Manifest V3 CSP applies (`script-src 'self'; object-src 'self'`).

To re-run the security scans before a release, see the "Re-run security checks" snippet in [PUBLISHING.md](PUBLISHING.md#8-post-publish).

## Publishing

To publish PagePatch on the Chrome Web Store, follow [PUBLISHING.md](PUBLISHING.md).

## License

[MIT](LICENSE).

## Roadmap

- Image insert via file picker (currently URL only)
- Table editing
- Auto-save / change tracking diff
- Multi-file / project view
- True silent overwrite via Native Messaging
- Migrate formatting commands off `document.execCommand` (deprecated; currently safe but worth replacing)
