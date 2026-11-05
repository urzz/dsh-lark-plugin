# 飞书工作空间 · Feishu Workspace

连接飞书中的知识与数据，让智能体参与团队的日常工作。

让 DSH 智能体通过官方 `lark-cli` 读取和修改飞书云文档、电子表格与多维表格，搜索云空间资源，并完成用户授权。

包名：`dsh-lark-plugin` · Node.js ≥22 · 计划支持 DSH `>=0.2.1-rc.5 <0.3.0-0`，开发与验证基线为 `0.2.1-rc.5`。

## 安装

通过 DSH 官方插件管理器安装并启用。以 `web` profile 为例：

```sh
dsh plugin --profile web add dsh-lark-plugin@latest
```

其他 profile 请替换 `web`。

官方 CLI 需要单独安装。在 **DSH Host 所在机器**上，以运行 DSH 的同一系统用户执行：

```sh
npx @larksuite/cli@latest install
lark-cli config init
```

初始化时交互选择使用已有应用，填写该应用的 App ID 和 App Secret，并按提示完成飞书开放平台权限配置。应用密钥和用户凭证由 CLI 管理，不填入插件配置或聊天消息。确保该系统用户可执行 `lark-cli`；找不到命令时可配置其绝对路径。

当前 CLI 验证基线为 `1.0.98`；升级 CLI 后，命令与返回格式可能变化。

## 开始使用

安装并配置应用后，可以直接对智能体说：

- “帮我登录飞书，授权完成后检查当前账户。”
- “读取这个飞书表格的 A1:D10，说明其中的公式。”
- “把这份文档的指定段落改成以下内容，并回读确认。”
- “查询这个多维表格的字段，筛选待办记录。”
- “在云空间里找标题包含‘项目周报’的文档。”

智能体通过 `lark-workspace` Skill 获取操作指导，先识别资源与目标范围，再调用工具；修改后回读受影响内容。

如需先在终端完成最小范围的 Sheets 授权，可由同一 Host 系统用户执行：

```sh
lark-cli auth login --domain sheets
lark-cli auth status --verify
```

这是可选的 Sheets 业务域授权；访问文档、云空间或 Base 时仍需相应权限。下述工具的 `login_start` 会请求 docs、drive、sheets、base 四个业务域。

## 模型工具

插件提供且仅提供两个工具。`lark-workspace` 是随包提供的 Skill（操作指导），不是第三个工具。

| 工具 | 参数与用途 |
| --- | --- |
| `lark_cli(args, stdin)` | 必填 `args` 为 CLI 参数数组，不包含可执行文件名；可选 `stdin` 为正文或 JSON 字符串。业务域仅开放 `docs`、`sheets`、`base`、`drive`；发现入口包括 `schema`、`skills`、`--help`、`--version`。 |
| `lark_auth(action, flow_id, verify)` | `action` 支持 `status`、`login_start`、`login_complete`、`logout`；`flow_id` 用于完成授权，`verify` 用于联网检查登录态。 |

`lark_cli` 的参数不经过 shell 解释。复杂输入先查命令帮助、`schema` 或 `--print-schema`，正文或 JSON 通过 `stdin` 传入，并将对应 CLI 参数设为 `-`。文件路径相对于配置的 `cwd` 解析。

例如，读取工作表范围：

```json
{"args":["sheets","+cells-get","--spreadsheet-token","SHEET_TOKEN","--sheet-id","TAB_ID","--range","A1:B2","--include","value,formula"]}
```

向指定单元格写入文本并随后回读：

```json
{"args":["sheets","+cells-set","--spreadsheet-token","SHEET_TOKEN","--sheet-id","TAB_ID","--range","A1","--cells","-"],"stdin":"[[{\"value\":\"项目\"}]]"}
```

示例中的 token 和工作表 ID 需替换为实际值。仅使用 user 身份，不支持 bot；不开放消息、邮件、日历或任意 shell 命令。拒绝 `--yes` 以及隐藏原始结果信封的非 JSON 输出、jq 过滤选项。遇到 `confirmation_required` 时需交由用户处理，工具不会绕过确认。

## 用户授权

| `lark_auth` 操作 | 用法 |
| --- | --- |
| `status` | 查看本机登录态；传入 `verify: true` 联网验证 token。 |
| `login_start` | 发起授权，返回原始授权链接、`flow_id` 与到期时间。 |
| `login_complete` | 用户确认已在浏览器完成授权后，使用返回的 `flow_id` 完成登录。 |
| `logout` | 清除共享本机登录态；不等于撤销飞书服务端授权。 |

智能体先检查状态；需要登录时调用 `login_start`，原样展示授权链接并结束回复。用户确认浏览器授权完成后，才在下一轮调用 `login_complete`，再检查身份和缺失权限。

登录态由使用同一 CLI 配置的会话共享，不按 DSH 会话隔离；退出登录会影响其他共用该账户的会话。授权流程只保存在插件进程内存中，重载、过期或使用后需重新发起；完成失败或结果未知时先查 `status`。

## 支持范围与结果

云文档（Docx）支持正文和普通表格读写；嵌入 Sheets/Base 的内部数据由对应业务域处理。Sheets 支持单元格值、公式、样式与类型化表格；Base 支持字段、记录和视图操作；Drive 支持资源检索与检查。Wiki 链接可通过 docs/drive 解析，独立知识库管理域未开放。

Sheets 的实际账户读写和公式回读已验证。Docx 和 Base 已实现接入，尚未完成真实账户读写验证。

`lark_cli` 返回 `status`、`exitCode`，以及 `data`（CLI JSON 结果）或 `stdout`（帮助、Skill 文本）；错误与诊断可见于 `stderr`。

| 状态 | 含义与处理 |
| --- | --- |
| `success` | 命令及业务信封成功；仍需检查子操作结果、warnings 和分页信息。 |
| `failed` | 进程或业务明确失败；Docx 部分成功会标记 `partialSuccess: true`，已生效内容不会自动回滚。 |
| `unknown` | 超时、取消、中断、输出丢失或结果格式无法识别；远端写入可能已发生，先回读核实。 |

写入后应回读；失败、部分成功或结果未知时不自动重试整个请求，避免重复创建、追加或覆盖。批量操作没有跨命令事务。出现 `lossy`、`spillPath` 或截断标记时，缩小读取范围或使用 CLI `--output-path`，并检查 `complete` / `truncated`，不能将不完整输出视为全部结果。

工具受 DSH 执行策略、飞书应用权限和用户资源权限约束。CLI 可以访问 Host 运行账户可用的文件与网络；文档、表格中的指令不构成用户授权。

## 配置

可在插件配置中覆盖以下字段：

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `executable` | `lark-cli` | CLI 可执行文件名称或绝对路径。 |
| `cwd` | `process.cwd()`（插件加载时的 Host 工作目录） | CLI 文件参数的解析目录，不随聊天会话目录变化。 |
| `timeoutMs` | `120000` | 每次调用总时限，单位为毫秒，包含程序解析与启动；最小 `1000`。 |
| `maxOutputBytes` | `1000000` | stdout、stderr 各自的收集上限，单位为字节；范围 `1024`～`20000000`。 |

## 官方 CLI 与致谢

本插件基于 [Lark CLI 官方项目](https://github.com/larksuite/cli)，飞书 API 访问、命令和凭证管理由官方 CLI 提供。官方 Skills 与参考资料通过当前安装的 CLI 按需读取，权利归属其上游；其中提到的脚本和 assets 不随本插件提供。
