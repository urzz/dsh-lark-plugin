# Native Lark configuration

The surface belongs inside DSH’s plugin row settings, keyed by `dsh-lark-plugin#lark-plugin`. DSH supplies its title, navigation and description. The form starts with App ID, App Secret and platform, followed by a closed Advanced disclosure and actions. All labels, hints and actions are left aligned. Controls fill the available width so narrow plugin panes remain usable.

```text
App ID
[input                                 ]
App Secret
[password replacement                  ]
Keep existing secret when empty
Platform
[Feishu / Lark                         ]
▸ Advanced
[Save changes] [Discard] [Reset settings]
status
```

Use the host font (`font: inherit`), 13px body/labels, 14px section titles, 6px label/control gaps and 12px field spacing. Inherit primary and secondary text from `--dsw-alias-label-primary` / `--dsw-alias-label-secondary`, input backgrounds from `--dsw-alias-bg-layer-3`, separators from `--dsw-alias-border-l2`, control borders from `--dsw-alias-border-l4`, radius from `--dsw-radius-md`, and visible focus outlines from `--dsw-alias-label-primary`. The fresh reviewer found no defined `--dsw-focus-ring-color` in the actual host, so the outline uses an observed semantic token. No invented palette, display font, hero, cards, shadows or motion. These references follow the installed DSH settings styling and the working dsh-search-plugin client. ConfigField/SettingsForm are not exported by the installed ui-settings `/client` entry; cross-plugin runtime component imports would also bypass DSH’s service boundary.

Review before implementation: a separate branded panel would compete with the host’s navigation and make credential setup look like a new product. Removed that treatment; native form rhythm and disclosure hierarchy provide the visual identity required by this brief. The primary action is the only strong visual emphasis.

Security and interaction: password input never receives accepted values. A configured/unconfigured hint comes only from `SettingsNamespaceView.secrets`; empty replacement omits the secret operation. Reset clears platform and execution overrides and preserves both App ID and App Secret. A separate Remove application credentials action explicitly writes both credential fields to empty strings, so inherited base credentials cannot reappear. Drafts retain the revision of their first edit; concurrent updates require discard before writing. Pending actions disable editing. Errors use localized fixed text, never raw server exceptions. Summary renders plain localized text.

Implementation critique: the native single-column layout and inherited semantic colors fit both themes without a separate theme switch. The reset action spells out secret preservation; replacement is deliberately separate from accepted secret status. Baseline 0.2.1-rc.5 TypeScript compilation, production client bundle and five focused behavior/protocol tests pass. Initial API inspection used installed 0.2.2-rc.1 and was followed by compilation against the actual baseline dependencies. A fresh reviewer owns browser review through the detached actual-component preview; no installed plugin/profile changes are needed. The preview is a separate entry, excluded from the production bundle.
