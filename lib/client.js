window.__ModuleLoader__.load({id:"dsh-lark-plugin",factory(require){
const module={exports:{}};const exports=module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// client/LarkConfig.tsx
var import_react = require("react");

// client/model.ts
var fields = ["appId", "brand", "executable", "cwd", "timeoutMs", "maxOutputBytes"];
function valuesOf(value) {
  return Object.fromEntries(fields.map((field) => [field, String(value[field] ?? "")]));
}
function valid(values) {
  return ["feishu", "lark"].includes(values.brand) && Number.isSafeInteger(Number(values.timeoutMs)) && Number(values.timeoutMs) >= 1e3 && Number.isSafeInteger(Number(values.maxOutputBytes)) && Number(values.maxOutputBytes) >= 1024 && Number(values.maxOutputBytes) <= 2e7;
}
function removeCredentials() {
  return ["appId", "appSecret"].map((field) => ({ op: "set", path: [field], value: "" }));
}
function operations(values, accepted, replacement, reset = false) {
  if (reset) return fields.filter((field) => field !== "appId").map((field) => ({ op: "unset", path: [field] }));
  const ops = fields.filter((field) => values[field] !== accepted[field]).map((field) => ({
    op: "set",
    path: [field],
    value: field === "timeoutMs" || field === "maxOutputBytes" ? Number(values[field]) : values[field]
  }));
  if (replacement !== "") ops.push({ op: "set", path: ["appSecret"], value: replacement });
  return ops;
}

// client/LarkConfig.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function LarkConfig(props) {
  const { t } = props;
  const state = props.useConfig((snapshot) => snapshot);
  const settings = props.useSettings((snapshot) => snapshot);
  const id = (0, import_react.useId)();
  const [draft, setDraft] = (0, import_react.useState)(null);
  const [secret, setSecret] = (0, import_react.useState)("");
  const [pending, setPending] = (0, import_react.useState)(null);
  const [message, setMessage] = (0, import_react.useState)(null);
  const [testResult, setTestResult] = (0, import_react.useState)(null);
  if (props.view === "summary") return t("description");
  if (state.status !== "ready" || !state.value) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: "status", children: t(state.status === "loading" ? "loading" : "unavailable") });
  const accepted = valuesOf(state.value);
  const values = draft?.values ?? accepted;
  const conflict = draft !== null && draft.revision !== state.revision;
  const disabled = !state.writable || pending !== null;
  const secretSet = settings.view?.namespaces.find((section) => section.ns === "lark-plugin")?.secrets.find((slot) => slot.path.length === 1 && slot.path[0] === "appSecret")?.set;
  const edit = (field, value) => {
    setDraft({ values: { ...values, [field]: value }, revision: draft ? draft.revision : state.revision });
    setMessage(null);
  };
  const discard = () => {
    setDraft(null);
    setSecret("");
    setMessage(null);
  };
  const save = async (reset, clear = false) => {
    if (disabled) return;
    if (conflict) {
      setMessage("conflict");
      return;
    }
    if (!reset && !clear && !valid(values)) {
      setMessage("invalid");
      return;
    }
    const ops = clear ? removeCredentials() : operations(values, accepted, secret, reset);
    setPending(clear ? "clear" : reset ? "reset" : "save");
    setMessage(null);
    try {
      if (await props.mutateConfig(ops, draft ? draft.revision : state.revision)) {
        setDraft(null);
        setSecret("");
        setMessage(clear ? "removed" : reset ? "resetDone" : "saved");
      } else setMessage("failed");
    } catch {
      setMessage("failed");
    } finally {
      setPending(null);
    }
  };
  const testConnection = async () => {
    setPending("test");
    setTestResult(null);
    setMessage(null);
    try {
      const result = await props.testConnection();
      setTestResult({ status: result.status, revision: state.revision });
    } catch {
      setTestResult({ status: "check_failed", revision: state.revision });
    } finally {
      setPending(null);
    }
  };
  const input = (field, hint) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t(field) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "input",
      {
        name: field,
        type: field === "timeoutMs" || field === "maxOutputBytes" ? "number" : "text",
        min: field === "timeoutMs" ? 1e3 : field === "maxOutputBytes" ? 1024 : void 0,
        max: field === "maxOutputBytes" ? 2e7 : void 0,
        step: field === "timeoutMs" || field === "maxOutputBytes" ? 1 : void 0,
        value: values[field],
        onChange: (event) => edit(field, event.target.value),
        "aria-describedby": hint ? `${id}-${hint}` : void 0,
        autoComplete: "off",
        spellCheck: false
      }
    ),
    hint && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { id: `${id}-${hint}`, children: t(hint) })
  ] }, field);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", { className: "dsh-lark-config", "aria-label": t("title"), "aria-busy": pending !== null, onSubmit: (event) => {
    event.preventDefault();
    void save(false);
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "dsh-lark-hint", children: t("shared") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { className: "dsh-lark-hint", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", { href: values.brand === "lark" ? "https://open.larksuite.com/app" : "https://open.feishu.cn/app", target: "_blank", rel: "noopener noreferrer", children: t("manageApps") }),
      " ",
      t("credentialsHint")
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", { disabled, children: [
      input("appId"),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("appSecret") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            name: "appSecret",
            type: "password",
            value: secret,
            autoComplete: "new-password",
            spellCheck: false,
            "aria-describedby": `${id}-secret`,
            onChange: (event) => {
              setSecret(event.target.value);
              setDraft((current) => current ?? { values, revision: state.revision });
              setMessage(null);
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("small", { id: `${id}-secret`, children: t(secretSet === true ? "secretSet" : secretSet === false ? "secretUnset" : "secretUnknown") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("brand") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", { name: "brand", value: values.brand, onChange: (event) => edit("brand", event.target.value), children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "feishu", children: t("feishu") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: "lark", children: t("lark") })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("summary", { children: t("advanced") }),
        input("executable", "executableHint"),
        input("cwd", "cwdHint"),
        input("timeoutMs"),
        input("maxOutputBytes")
      ] })
    ] }),
    !state.writable && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: "status", children: t("readOnly") }),
    conflict && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: "alert", children: t("conflict") }),
    message && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: message === "failed" || message === "invalid" ? "alert" : "status", children: t(message) }),
    !draft && testResult && testResult.revision === state.revision && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: testResult.status === "connected" ? "status" : "alert", children: t(testResult.status) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "dsh-lark-actions", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { className: "dsh-lark-primary", type: "submit", disabled: disabled || conflict || !draft, children: t(pending === "save" ? "saving" : "save") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", disabled: pending !== null || draft !== null, "aria-describedby": `${id}-test`, onClick: () => {
        void testConnection();
      }, children: t(pending === "test" ? "testing" : "testConnection") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", disabled: pending !== null || !draft, onClick: discard, children: t("discard") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", disabled: disabled || conflict, "aria-describedby": `${id}-reset`, onClick: () => {
        void save(true);
      }, children: t(pending === "reset" ? "resetting" : "reset") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", disabled: disabled || conflict || !accepted.appId && secretSet !== true, onClick: () => {
        void save(false, true);
      }, children: t(pending === "clear" ? "removing" : "remove") })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { id: `${id}-test`, className: "dsh-lark-hint", children: t(draft ? "testSaveFirst" : "testHint") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { id: `${id}-reset`, className: "dsh-lark-hint", children: t("resetHint") })
  ] });
}

// client/locales.ts
var en = {
  description: "Application credentials and shared CLI settings.",
  title: "Lark settings",
  appId: "App ID",
  appSecret: "App Secret",
  brand: "Platform",
  feishu: "Feishu (China)",
  lark: "Lark (international)",
  secretSet: "An App Secret is configured. Leave blank to keep it; enter a new secret to replace it.",
  secretUnset: "No App Secret is configured. Enter one to initialize the shared CLI with this App ID.",
  secretUnknown: "Leave blank to keep the existing App Secret. Stored secrets are never shown.",
  shared: "These settings apply to the shared CLI account. Leave application credentials unset to use existing CLI configuration.",
  manageApps: "Open app management \u2197",
  credentialsHint: "Select or create an app, then find its App ID and App Secret under Credentials & Basic Info.",
  advanced: "Advanced execution settings",
  executable: "CLI executable",
  executableHint: "Leave blank to use the bundled official CLI.",
  cwd: "Working directory",
  cwdHint: "Base directory for CLI file input and output.",
  timeoutMs: "Process timeout (ms)",
  maxOutputBytes: "Maximum output per stream (bytes)",
  testConnection: "Test connection",
  testing: "Testing\u2026",
  testSaveFirst: "Save or discard your edits before testing the connection.",
  testHint: "Tests the saved configuration and verifies user authorization online. Does not check access to individual documents.",
  connected: "Connection successful. CLI user authorization has been verified online.",
  not_configured: "The CLI application is not configured. Save App ID and App Secret, or configure the external CLI on the host.",
  not_authorized: "User authorization is missing. Ask the assistant to sign in to Lark / Feishu.",
  verification_failed: "User authorization could not be verified. Check connectivity; you may need to sign in again.",
  setup_failed: "Application initialization failed. Check App ID, App Secret, platform, and host connectivity. Save corrected settings or reload the plugin before retrying.",
  check_failed: "Connection test failed. Check CLI availability, application configuration, authorization, and host connectivity.",
  save: "Save changes",
  saving: "Saving\u2026",
  resetting: "Resetting\u2026",
  discard: "Discard edits",
  reset: "Reset settings",
  resetHint: "Reset restores platform and execution settings, keeping App ID and App Secret. Remove application credentials to use existing CLI configuration.",
  saved: "Changes saved.",
  resetDone: "Settings reset. App ID and App Secret were kept.",
  remove: "Remove application credentials",
  removing: "Removing\u2026",
  removed: "Application credentials removed. Existing CLI configuration will be used.",
  loading: "Loading configuration\u2026",
  unavailable: "Configuration is unavailable.",
  readOnly: "Configuration is read-only.",
  conflict: "Configuration changed elsewhere. Discard edits to load the latest values before saving.",
  failed: "Could not save changes. Check the configuration and try again.",
  invalid: "Timeout must be an integer of at least 1,000 ms. Output must be an integer from 1,024 to 20,000,000 bytes."
};
var zh = {
  testConnection: "\u6D4B\u8BD5\u8FDE\u63A5",
  testing: "\u6B63\u5728\u6D4B\u8BD5\u2026",
  testSaveFirst: "\u8BF7\u5148\u4FDD\u5B58\u66F4\u6539\u6216\u653E\u5F03\u7F16\u8F91\uFF0C\u518D\u6D4B\u8BD5\u8FDE\u63A5\u3002",
  testHint: "\u4F7F\u7528\u5DF2\u4FDD\u5B58\u914D\u7F6E\u8054\u7F51\u9A8C\u8BC1\u7528\u6237\u6388\u6743\uFF0C\u4E0D\u68C0\u67E5\u5177\u4F53\u6587\u6863\u7684\u8BBF\u95EE\u6743\u9650\u3002",
  connected: "\u8FDE\u63A5\u6B63\u5E38\uFF0CCLI \u7528\u6237\u6388\u6743\u5DF2\u901A\u8FC7\u8054\u7F51\u9A8C\u8BC1\u3002",
  not_configured: "CLI \u5E94\u7528\u5C1A\u672A\u914D\u7F6E\u3002\u8BF7\u4FDD\u5B58 App ID \u548C App Secret\uFF0C\u6216\u5728\u5BBF\u4E3B\u673A\u914D\u7F6E\u5916\u90E8 CLI\u3002",
  not_authorized: "\u5C1A\u672A\u5B8C\u6210\u7528\u6237\u6388\u6743\uFF0C\u8BF7\u8BA9\u52A9\u624B\u767B\u5F55\u98DE\u4E66 / Lark\u3002",
  verification_failed: "\u7528\u6237\u6388\u6743\u672A\u901A\u8FC7\u8054\u7F51\u9A8C\u8BC1\u3002\u8BF7\u68C0\u67E5\u7F51\u7EDC\uFF0C\u5FC5\u8981\u65F6\u91CD\u65B0\u767B\u5F55\u6388\u6743\u3002",
  setup_failed: "\u5E94\u7528\u521D\u59CB\u5316\u5931\u8D25\u3002\u8BF7\u68C0\u67E5 App ID\u3001App Secret\u3001\u5E73\u53F0\u548C\u5BBF\u4E3B\u673A\u7F51\u7EDC\uFF0C\u4FDD\u5B58\u4FEE\u6B63\u540E\u7684\u914D\u7F6E\u6216\u91CD\u8F7D\u63D2\u4EF6\u540E\u91CD\u8BD5\u3002",
  check_failed: "\u8FDE\u63A5\u6D4B\u8BD5\u5931\u8D25\u3002\u8BF7\u68C0\u67E5 CLI \u662F\u5426\u53EF\u7528\u3001\u5E94\u7528\u914D\u7F6E\u3001\u7528\u6237\u6388\u6743\u53CA\u5BBF\u4E3B\u673A\u7F51\u7EDC\u3002",
  description: "\u5E94\u7528\u51ED\u8BC1\u4E0E\u5171\u4EAB CLI \u8BBE\u7F6E\u3002",
  title: "\u98DE\u4E66 / Lark \u8BBE\u7F6E",
  appId: "App ID",
  appSecret: "App Secret",
  brand: "\u5E73\u53F0",
  feishu: "\u98DE\u4E66\uFF08\u4E2D\u56FD\uFF09",
  lark: "Lark\uFF08\u56FD\u9645\uFF09",
  secretSet: "\u5DF2\u914D\u7F6E App Secret\u3002\u7559\u7A7A\u4FDD\u7559\u73B0\u6709\u5BC6\u94A5\uFF1B\u8F93\u5165\u65B0\u5BC6\u94A5\u53EF\u66FF\u6362\u3002",
  secretUnset: "\u5C1A\u672A\u914D\u7F6E App Secret\u3002\u586B\u5199\u540E\u5C06\u4F7F\u7528\u6B64 App ID \u521D\u59CB\u5316\u5171\u4EAB CLI\u3002",
  secretUnknown: "\u7559\u7A7A\u4FDD\u7559\u73B0\u6709 App Secret\u3002\u5DF2\u5B58\u5BC6\u94A5\u4E0D\u4F1A\u56DE\u663E\u3002",
  shared: "\u8FD9\u4E9B\u8BBE\u7F6E\u7528\u4E8E\u5171\u4EAB CLI \u8D26\u6237\u3002\u4E0D\u8BBE\u7F6E\u5E94\u7528\u51ED\u8BC1\u65F6\u4F7F\u7528\u73B0\u6709 CLI \u914D\u7F6E\u3002",
  manageApps: "\u6253\u5F00\u5E94\u7528\u7BA1\u7406 \u2197",
  credentialsHint: "\u9009\u62E9\u6216\u521B\u5EFA\u5E94\u7528\u540E\uFF0C\u5728\u300C\u51ED\u8BC1\u4E0E\u57FA\u7840\u4FE1\u606F\u300D\u4E2D\u83B7\u53D6 App ID \u548C App Secret\u3002",
  advanced: "\u9AD8\u7EA7\u6267\u884C\u8BBE\u7F6E",
  executable: "CLI \u53EF\u6267\u884C\u6587\u4EF6",
  executableHint: "\u7559\u7A7A\u4F7F\u7528\u968F\u63D2\u4EF6\u63D0\u4F9B\u7684\u5B98\u65B9 CLI\u3002",
  cwd: "\u5DE5\u4F5C\u76EE\u5F55",
  cwdHint: "CLI \u6587\u4EF6\u8F93\u5165\u548C\u8F93\u51FA\u7684\u57FA\u7840\u76EE\u5F55\u3002",
  timeoutMs: "\u8FDB\u7A0B\u8D85\u65F6\uFF08\u6BEB\u79D2\uFF09",
  maxOutputBytes: "\u6BCF\u4E2A\u8F93\u51FA\u6D41\u7684\u6700\u5927\u5B57\u8282\u6570",
  save: "\u4FDD\u5B58\u66F4\u6539",
  saving: "\u6B63\u5728\u4FDD\u5B58\u2026",
  resetting: "\u6B63\u5728\u91CD\u7F6E\u2026",
  discard: "\u653E\u5F03\u7F16\u8F91",
  reset: "\u91CD\u7F6E\u8BBE\u7F6E",
  resetHint: "\u91CD\u7F6E\u5C06\u6062\u590D\u5E73\u53F0\u4E0E\u6267\u884C\u8BBE\u7F6E\uFF0C\u5E76\u4FDD\u7559 App ID \u548C App Secret\u3002\u79FB\u9664\u5E94\u7528\u51ED\u8BC1\u540E\u4F7F\u7528\u73B0\u6709 CLI \u914D\u7F6E\u3002",
  saved: "\u66F4\u6539\u5DF2\u4FDD\u5B58\u3002",
  resetDone: "\u8BBE\u7F6E\u5DF2\u91CD\u7F6E\uFF0CApp ID \u548C App Secret \u5DF2\u4FDD\u7559\u3002",
  remove: "\u79FB\u9664\u5E94\u7528\u51ED\u8BC1",
  removing: "\u6B63\u5728\u79FB\u9664\u2026",
  removed: "\u5E94\u7528\u51ED\u8BC1\u5DF2\u79FB\u9664\uFF0C\u5C06\u4F7F\u7528\u73B0\u6709 CLI \u914D\u7F6E\u3002",
  loading: "\u6B63\u5728\u52A0\u8F7D\u914D\u7F6E\u2026",
  unavailable: "\u5F53\u524D\u65E0\u6CD5\u914D\u7F6E\u6B64\u63D2\u4EF6\u3002",
  readOnly: "\u914D\u7F6E\u4E3A\u53EA\u8BFB\u3002",
  conflict: "\u914D\u7F6E\u5DF2\u5728\u5176\u4ED6\u4F4D\u7F6E\u66F4\u6539\u3002\u8BF7\u653E\u5F03\u7F16\u8F91\u4EE5\u52A0\u8F7D\u6700\u65B0\u503C\uFF0C\u7136\u540E\u91CD\u65B0\u4FDD\u5B58\u3002",
  failed: "\u65E0\u6CD5\u4FDD\u5B58\u66F4\u6539\u3002\u8BF7\u68C0\u67E5\u914D\u7F6E\u540E\u91CD\u8BD5\u3002",
  invalid: "\u8D85\u65F6\u987B\u4E3A\u81F3\u5C11 1,000 \u6BEB\u79D2\u7684\u6574\u6570\uFF1B\u8F93\u51FA\u4E0A\u9650\u987B\u4E3A 1,024 \u81F3 20,000,000 \u5B57\u8282\u7684\u6574\u6570\u3002"
};

// client/style.css
var style_default = "/* Mirror DSH ConfigField/SettingsForm, with the host's theme and font. */\n.dsh-lark-config { min-width: 0; color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px; line-height: 1.5; text-align: start; }\n.dsh-lark-config fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }\n.dsh-lark-config label { display: flex; flex-direction: column; gap: 6px; min-width: 0; padding: 12px 0; font-weight: 500; }\n.dsh-lark-config label + label { border-top: .5px solid var(--dsw-alias-border-l2); }\n.dsh-lark-config input, .dsh-lark-config select { box-sizing: border-box; width: 100%; min-width: 0; min-height: 34px; padding: 6px 12px; border: .5px solid var(--dsw-alias-border-l4); border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-primary); font: inherit; font-weight: 400; }\n.dsh-lark-config small, .dsh-lark-config .dsh-lark-hint { color: var(--dsw-alias-label-secondary); font-size: 12px; font-weight: 400; }\n.dsh-lark-config p { margin: 8px 0; overflow-wrap: anywhere; }\n.dsh-lark-config a { color: var(--dsw-alias-label-primary); text-decoration: underline; text-underline-offset: 2px; }\n.dsh-lark-config details { margin-top: 12px; border-top: .5px solid var(--dsw-alias-border-l2); }\n.dsh-lark-config summary { padding: 12px 0; cursor: pointer; font-size: 14px; font-weight: 600; }\n.dsh-lark-config .dsh-lark-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 24px; }\n.dsh-lark-config button { appearance: none; min-height: 32px; padding: 5px 14px; border: 1px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-md); background: transparent; color: var(--dsw-alias-label-primary); cursor: pointer; font: inherit; line-height: 1.5; }\n.dsh-lark-config .dsh-lark-primary { border-color: transparent; background: var(--dsw-alias-label-primary); color: var(--dsw-alias-bg-layer-3); }\n.dsh-lark-config :disabled { opacity: .4; cursor: default; }\n.dsh-lark-config fieldset:disabled { opacity: 1; }\n.dsh-lark-config :focus-visible { outline: 2px solid var(--dsw-alias-label-primary); outline-offset: 2px; }\n";

// client/remote.ts
var connectionRemote = {
  package: "dsh-lark-plugin",
  descriptors: [{
    id: "larkConnection/test",
    service: "larkConnection",
    namespace: "larkConnection",
    method: "test",
    invocation: { kind: "direct" },
    parameters: [],
    result: { mode: "src-json" }
  }]
};

// client/index.ts
var inject = ["slots", "locale", "configForms", "remote"];
async function apply(ctx) {
  await ctx.remote.$mount(connectionRemote);
  ctx.effect(() => ctx.locale.register("larkPlugin", { en, zh }));
  ctx.effect(() => {
    const style = document.createElement("style");
    style.dataset.plugin = "dsh-lark-plugin";
    style.textContent = style_default;
    document.head.append(style);
    return () => style.remove();
  });
  const form = ctx.configForms.get("lark-plugin");
  const settings = ctx.configForms.describe();
  const face = {
    hooks: {
      config: { getSnapshot: () => form.getSnapshot(), subscribe: (listener) => form.subscribe(listener) },
      settings: { getSnapshot: () => settings.getSnapshot(), subscribe: (listener) => settings.subscribe(listener) }
    },
    mutateConfig: (ops, revision) => form.mutate(ops, revision),
    testConnection: async () => {
      const result = await ctx.remote.larkConnection.test();
      return result.ok ? result.value : { status: "check_failed" };
    }
  };
  ctx.effect(() => ctx.slots.inject("plugins.row.config", () => ctx.slots.register({
    name: "plugins.row.config",
    key: "dsh-lark-plugin#lark-plugin",
    locale: "larkPlugin",
    inject: () => face
  }, LarkConfig)));
}
return module.exports;
}});
