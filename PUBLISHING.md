# Publishing PagePatch on the Chrome Web Store

A practical, step-by-step guide for taking PagePatch from this repository to a public listing on the Chrome Web Store (CWS).

> **Before you start:** make sure the security findings in the audit have been addressed (they are — see commit history). In particular, the manifest no longer requests `<all_urls>`, link/image insertion validates URL schemes, and the background message handler verifies the sender. These are prerequisites for a fast review.

---

## 1. Developer-account setup (one-time)

1. Sign in at <https://chrome.google.com/webstore/devconsole/> with the Google account you want associated with the listing.
2. Pay the one-time **US $5** registration fee.
3. Enable 2-Step Verification on the account (CWS will reject high-permission extensions without it).
4. Complete **identity verification** if prompted (photo-ID + address). Google enforces this for any extension that requests host permissions, which PagePatch does (`file:///*`).
5. Decide and declare your **trader status** (required since Feb 2024 for distribution in the EU). If you publish as an individual hobbyist, choose *Non-trader*.

## 2. Build a clean upload artefact

The store wants a flat `.zip` of the extension root — no `.git`, `node_modules`, hidden files, etc.

```bash
# Use the build script (recommended):
./build-zip.sh

# Or manually:
VERSION=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
zip -r "pagepatch-${VERSION}.zip" \
  manifest.json README.md PRIVACY.md LICENSE \
  src/ icons/ \
  -x "*.DS_Store" "*/.git/*" "*/node_modules/*"
```

Notes:

- `examples/`, `lib/`, and `PUBLISHING.md` are for local testing/development only — they are excluded from the upload to keep the package minimal.
- Bump `manifest.json`'s `"version"` (and optionally add `"version_name"`) before zipping each release. CWS rejects re-uploads of a package whose version isn't strictly higher than the currently published one.

Validate the package before uploading:

```bash
VERSION=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
python3 -c "import json; json.load(open('manifest.json'))"   # JSON sanity
unzip -l "pagepatch-${VERSION}.zip"                           # contents check
```

Smoke-test: load the *unpacked* zip contents in a fresh Chrome profile (`chrome://extensions` → "Load unpacked"), repeat the README usage flow, and watch DevTools Console for warnings.

## 3. Listing assets to prepare

| Asset | Size | Required? | Notes |
| --- | --- | --- | --- |
| Store icon | 128×128 PNG | Yes | Already present at `icons/icon128.png`. |
| Screenshots | 1280×800 or 640×400 PNG/JPEG | At least 1 (max 5) | Show the toolbar over `examples/sample.html`. |
| Small promo tile | 440×280 PNG/JPEG | Yes | Required for category placement. |
| Marquee | 1400×560 PNG/JPEG | Optional | Needed only if you apply for "Featured". |
| YouTube video | URL | Optional | Helps with discoverability. |

## 4. Listing copy

The README already contains polished copy you can paste into the dashboard:

- **Name** (≤45 chars): `PagePatch - HTML File Editor`
- **Short description** (≤132 chars): the line in the README under "Short description".
- **Detailed description** (≤16 000 chars): the README "Long description" + Features section.
- **Category**: *Productivity* (alt: *Developer Tools*).
- **Language**: English (add others later if you localise).

## 5. Permission justifications

CWS asks for a brief justification for each permission. Paste these verbatim:

| Permission | Justification |
| --- | --- |
| `activeTab` | Required so the user can click the extension icon to enable the editor on the current tab without granting persistent broad host permission. |
| `scripting` | Required to programmatically inject the editor UI (`src/content/*`) when the content scripts are not yet present on the active tab. |
| `downloads` | Required to surface Chrome's native Save As dialog so the user can write the edited HTML back to disk; we do not silently overwrite files. |
| `storage` | Used only for `chrome.storage.session` to remember per-tab edit/dirty state across popup opens. Data is volatile, never persisted to disk, never synced. |
| `host_permissions: file:///*` | Required to operate on local HTML files, which is the extension's stated single purpose. |
| Single-purpose statement | "Lets the user toggle a rich-text edit mode on a local HTML page open in Chrome and save the edits back to a file via Chrome's Save As dialog." |
| Remote code use | **No.** All code is bundled in the package. |
| Data collected | **None.** PagePatch does not collect, transmit, or sell user data. |

The manifest only requests `file:///*` as a host permission (no `<all_urls>`, no `http://*/*`, no `https://*/*`), so you will *not* be asked to fill in the "broad host permission" justification, and review will be markedly faster.

## 6. Privacy policy (required)

CWS requires a public privacy-policy URL whenever you request `storage`, `downloads`, or any host permission. The minimum-acceptable text is in `PRIVACY.md` at the repo root — host it as a public GitHub Pages page or a gist and paste the URL into the dashboard.

## 7. Submission flow

1. Open the **Chrome Web Store Developer Dashboard** → **Add new item**.
2. Upload `pagepatch-<version>.zip`.
3. Fill in:
   - **Store listing** — copy + assets.
   - **Privacy practices** — justifications + privacy URL + single-purpose statement.
   - **Distribution** — *Public*, *Unlisted*, or *Private*. *Unlisted* is a great way to do beta testing without store search exposure.
   - **Pricing & geography** — free, all regions or restricted.
   - **Trader status**.
4. Click **Submit for review**. Typical timelines:
   - Current PagePatch scope (`file:///*` only, no broad permissions): **a few hours to ~3 days**.
   - If you ever re-introduce `<all_urls>`: **1–4 weeks** with possibly multiple rounds with the review team.
5. Watch the developer-account inbox. CWS will email if a "compliance issue" is flagged; fix and resubmit.

## 8. Post-publish

- **Tag releases in Git**: `git tag v$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])") && git push --tags`. Keep `manifest.json` `version` and the tag in lock-step.
- **Update pipeline**: bump `version`, re-zip, upload as a new package; CWS auto-rolls out.
- **Monitor the dashboard**: install count, weekly user counts, ratings, crash reports.
- **Respond to reviews** within ~48 h while the listing is young — it strongly affects the algorithm.
- **Re-run security checks before every release**:

  ```bash
  npx -y retire -- --path .

  mkdir -p /tmp/cee-audit && cd /tmp/cee-audit
  npm init -y >/dev/null
  npm i --no-audit --no-fund eslint@9 eslint-plugin-security eslint-plugin-no-unsanitized >/dev/null
  cat > eslint.config.mjs <<'EOF'
  import security from "eslint-plugin-security";
  import noUnsanitized from "eslint-plugin-no-unsanitized";
  export default [{
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest", sourceType: "module",
      globals: { chrome: "readonly", window: "readonly", document: "readonly",
                 console: "readonly", setTimeout: "readonly", clearTimeout: "readonly",
                 requestAnimationFrame: "readonly", getComputedStyle: "readonly",
                 InputEvent: "readonly", NodeFilter: "readonly", ShadowRoot: "readonly",
                 URL: "readonly", RegExp: "readonly", fetch: "readonly" }
    },
    plugins: { security, "no-unsanitized": noUnsanitized },
    rules: { ...security.configs.recommended.rules, ...noUnsanitized.configs.recommended.rules },
  }];
  EOF
  ln -sfn "$REPO_ROOT/src" src
  ./node_modules/.bin/eslint src
  ```

- **Watch CWS policy updates**: subscribe to the [Chrome Developers blog](https://developer.chrome.com/blog) tag *Extensions*. CWS pushed manifest-version sunsets and remote-code rules in the last 18 months and continues to iterate.
