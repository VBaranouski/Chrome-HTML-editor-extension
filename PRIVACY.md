# PagePatch Privacy Policy

_Last updated: 2026-04-29_

PagePatch ("the extension") does **not** collect, transmit, sell, or share any personal information.

## What the extension runs

- All code runs locally inside Chrome on your device.
- The extension contains no analytics, no telemetry, and no remotely hosted code.
- The extension does not make any network requests of its own — it has no `fetch`, no XMLHttpRequest, no WebSocket, no `sendBeacon`.

## What the extension stores

- A small per-tab object kept in `chrome.storage.session` to remember whether edit mode is on for that tab and whether there are unsaved changes. This storage is volatile: it is cleared whenever Chrome closes and is never synced to your Google account.
- No data is written to `chrome.storage.local`, `chrome.storage.sync`, IndexedDB, or LocalStorage.

## What the extension reads

- The HTML of the page you choose to edit, only while edit mode is active on that tab, and only so it can save your edits back to disk through Chrome's Save As dialog.
- The URL of the active tab, only so the popup can show the filename of the page you are editing.

## What the extension writes

- The HTML you save is written to the location you select in Chrome's Save As dialog, using the standard `chrome.downloads` API. PagePatch never writes files silently and cannot overwrite files without your explicit confirmation in the OS Save dialog.

## Permissions used and why

| Permission | Why it is requested |
| --- | --- |
| `activeTab` | So you can click the toolbar icon to enable the editor on the current tab without granting the extension persistent access to all websites. |
| `scripting` | To programmatically inject the editor UI on the current tab when you toggle edit mode. |
| `downloads` | To open Chrome's Save As dialog so you can save the edited HTML back to disk. |
| `storage` | To remember per-tab edit state in `chrome.storage.session`. |
| `host_permissions: file:///*` | To enable editing of local HTML files, the extension's stated single purpose. |

## Children

PagePatch is not directed at children and does not knowingly collect data from anyone, regardless of age.

## Changes to this policy

If this policy ever changes, we will update the "Last updated" date above and post the new policy in the same location. Material changes will be noted in the extension's Chrome Web Store listing.

## Contact

Questions about this policy can be sent to the maintainer via the Chrome Web Store support link on the PagePatch listing.
