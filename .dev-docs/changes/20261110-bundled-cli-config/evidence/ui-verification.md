# A2 native configuration UI verification

Scope: delegated fresh verifier; no product source writes, plugin install, settings/credentials changes or real-account operations. Specification v1, acceptance A2. Worktree branch bundled-lark-config.

## Native reference inspected

- Live URL: https://dsh-dev1.urzz.me/ ; boot metadata reports DSH 0.2.2-rc.1.
- Owned BrowserSkill session ecwb: opened Plugins → native Terminal configuration. Observed the native detail header and single-column form, full-width inputs, separators, muted descriptions, and disabled Save in unchanged state. No inputs were changed and Save was not activated.
- Screenshot: [native-terminal-reference.png](native-terminal-reference.png), captured from the installed host; **not a screenshot of the newly implemented Lark UI**.
- Session ecwb stopped successfully after reference inspection.

## New component

Actual `client/LarkConfig.tsx` rendered through `client/preview.tsx`, bundled with React DOM in an isolated HTML harness. In-memory ConfigForm adapter only; this does not establish the installed plugin registration or real settings persistence path. Exact browser URL was `http://192.168.98.2:18765/preview.html`.

Desktop and narrow real browser screenshots:

- [lark-component-desktop.png](lark-component-desktop.png): configured-secret initial state, closed advanced disclosure, unchanged Save disabled.
- [lark-component-narrow.png](lark-component-narrow.png): blank credentials after removal, saved platform change, narrow form.
- [lark-component-narrow-actions.png](lark-component-narrow-actions.png): narrow lower form; actions wrap, descriptions remain readable, normal vertical scrolling.

The harness requested desktop emulation 1100×900 and narrow 390×900. Browser sync reported desktop layout 880×720; screenshot pixels were 1375×1125 and 488×1125 respectively. These are desktop+narrow checks, not a device coverage matrix.

### Observed interaction results

| Flow | Result |
| --- | --- |
| Initial | App ID populated with example value; secret replacement blank despite configured-secret status; Save and Discard disabled. Source confirms password input, `autoComplete=new-password`, and public-field-only hydration. |
| Save | Changed App ID to `cli_review_saved`; Save displayed `Saving…`, disabled fieldset and actions during pending; then `Changes saved.`, new App ID retained, Save disabled, secret still configured and blank. |
| Reset | Changed platform to Lark then Reset; platform returned to Feishu, edited accepted App ID retained, configured-secret hint retained; success explicitly says App ID and App Secret kept. |
| Remove / blank credentials | Remove cleared App ID, left secret replacement blank, hint switched to no configured secret, Remove disabled; status explicitly says existing CLI configuration will be used. |
| Revision conflict | Edited draft then simulated concurrent revision; conflict alert appeared, Save/Reset/Remove disabled. Discard cleared draft and restored accepted blank App ID. |
| Read-only | Toggle produced read-only status and disabled fieldset plus write actions. Restoring writable mode re-enabled editing. |
| Failure and recovery | With blank credentials changed platform to Lark, toggled mutation failure, saved: fixed error alert appeared, draft retained, Save/Discard enabled. Toggled failure off and saved same draft: `Changes saved.`, platform Lark retained, credentials still blank, Save disabled. |
| Layout | Native single-column spacing, token colors, separators and controls match captured host reference; narrow controls stay within available width and actions wrap. |

Observed host tokens used in preview: primary `#0f1115`, secondary `#61666b`, border L2 `#0000001a`, border L4 `#00000029`, layer3 `#fff`, medium radius `12px`, host system font stack. Review found `--dsw-focus-ring-color` undefined on live host; UI owner corrected production focus outline to the observed primary label token before preview rebuild. No remaining blocking component issue found in the bounded flows above.

### Reproduction and limits

Run from repository root: `node .dev-docs/changes/20261110-bundled-cli-config/evidence/build-preview.mjs`, then serve this evidence directory with a static server and open `preview.html`. Generated HTML is intentionally omitted from retained evidence; rebuild script and actual source harness are preserved. Harness controls are separate review UI, not product controls. The 600ms mutation delay and rejection are adapter simulations. The preview does not verify real secret storage, private CLI initialization, OAuth, host plugin installation/slot registration, or backend error handling. Those require separate code/automated evidence. No real credentials, profile configuration or account resources were written.

Owned browser session vimq stopped after capture; temporary static server job `bash-95f49b33a1ec40f1` cancelled after review. Reference session ecwb was also stopped.
