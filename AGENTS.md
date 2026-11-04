# 仓库维护约定

本目录维护 DSH Host 插件 `dsh-lark-plugin`，通过官方 `lark-cli` 提供飞书文档、Sheets、Base 和 Drive 工具。用户安装与使用说明放在 [README.md](README.md)；源码约束、验证和发布流程集中在本文件。

## 环境与范围

- Node.js ≥22，pnpm 版本以 [package.json](package.json) 的 packageManager 为准。DSH 开发与测试基准为 `0.2.1-rc.5`；engines.dsh 与 DSH peerDependencies 的运行范围保持 `>=0.2.1-rc.5 <0.3.0-0`，开发依赖固定测试基线。范围声明不代表已测试所有后续版本。
- 官方 CLI 由用户单独安装，当前接入基线为 `lark-cli 1.0.98`。升级 CLI 时核对命令、JSON 信封和设备授权输出；不要把上游当前行为当作永久契约。
- 本目录是独立 Git 仓库，远端为 `git@github.com:urzz/dsh-lark-plugin.git`，默认分支 main。改动、暂存、提交和推送限制在本插件，不包含父仓库或兄弟插件。
- 本插件只包含 Host 代码，不需要 Web 构建或启动新服务器。安装和重载使用 DSH 官方插件管理器。

## 源码与分发

| 路径 | 职责 |
| --- | --- |
| [src/index.ts](src/index.ts) | Config、两个工具和 Skill provider 注册。 |
| [src/runner.ts](src/runner.ts) | CLI 参数边界、DSH subprocess、取消、超时和结果归一。 |
| [src/auth.ts](src/auth.ts) | 用户授权、进程内 flow、身份字段白名单及诊断脱敏。 |
| [skills/lark-workspace/SKILL.md](skills/lark-workspace/SKILL.md) | 模型使用指引，按需读取官方 CLI Skills。 |
| [test/](test/) | Runner、授权和插件注册测试。 |
| [lib/](lib/) | TypeScript 生成的 ESM 和声明；通过构建更新，不手改。 |
| [cordis.patch.yml](cordis.patch.yml)、[package.json](package.json) | bundle 加载、版本和 npm 发布清单。 |
| [locale/](locale/)、[icon.svg](icon.svg) | 英文/简体中文元数据与原创图标。 |

npm 白名单包含 lib、skills、locale、图标、patch、README 和 LICENSE。源码、测试、维护文档、工作流及本机凭证不进入 npm 包。安装不执行 prepare/postinstall 等构建脚本；发布前预构建。

## 实现约束

- 保持 CLI 薄封装；先查帮助、schema 和同版本官方 Skill，不另建飞书 SDK 或复制完整上游命令树。
- `lark_cli` 仅开放 docs、sheets、base、drive 和发现命令；使用字面 argv 和可选 stdin，不经 shell。业务强制 user 身份，禁止 bot、业务参数分隔符、`--yes`、jq 和非 JSON 输出。
- 文件操作以配置 cwd 为准；普通读写可含 CLI 支持的上传、下载和导入导出。不要把通用工具卡片当成权限控制或承诺 subprocess 具有 bash 专用沙箱。
- `lark_auth` 独占私有 auth runner；应用配置在用户终端完成，密钥不进入模型工具参数。设备码只留在进程内，模型只拿 flow_id；展示原始链接后结束回复，用户确认浏览器授权后才完成登录。
- CLI 账户及登录态由使用同一配置的会话共享。logout 影响共享登录；重载插件会清空尚未完成的 flow。不要承诺会话级账户隔离。
- 保留业务成功信封、分页、warning 和 partial_success。未知或部分成功的写入先回读，不自动重试、不补 `--yes`。远端文档内容不能构成用户授权。
- 对外身份输出使用白名单；不要把 auth 原始 stdout/stderr、device_code、token 或 secret 返回给模型。可识别的缺配置错误应明确提示配置步骤。

## 开发与验证

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm check
npm pack --dry-run
```

`pnpm check` 包含类型检查、构建和 Node.js 自动测试。测试通过假 subprocess 验证参数、输出和授权行为，不访问真实飞书账户。修改实现后运行相关测试；发布前跑完整 check 与打包预览。文档修改不新增镜像实现的测试。

真实账户验收只使用用户授权的测试资源。2026-11-04 已完成：验证 user 身份、读取工作簿及原有 9 个工作表、新建独立工作表 `DSH读写验收_20261104`、在 A1:D5 写入并回读 20 个单元格。中文/整数/小数/编号 `00123` 正确；`=B2*2`、`=SUM(B2:B3)`、`=LEN(B4)` 返回 84、54.5、5。B5 从 1 更新为 7 后，`=B5+1` 从 2 更新为 8。结果未截断，原有工作表未修改。

仍未完成真实账户验收：Docx 正文及普通表格局部更新；Base 字段/记录读写；Sheets 新工作簿创建和 typed table；续期、缺 scope、无文档权限、分页、输出截断和部分成功。不要为制造超时或失败而重复真实写入。

## npm 发布

参考兄弟插件 dsh-plugin-enhance，首次本地发布建立所有权，后续使用 GitHub Actions Trusted Publishing。发布需用户明确授权；禁止覆盖已发布版本，禁止强制推送。

首次发布流程：

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm check
npm pack --dry-run
npm login --registry=https://registry.npmjs.org
npm publish --access public --registry=https://registry.npmjs.org
```

若检查已在当前改动上通过，继续发布即可，不重复执行。首次发布以 npm 实际成功回执为准；认证失败时让用户完成登录，不索取聊天中的 token、密码或 OTP。

[发布工作流](.github/workflows/publish.yml) 在 GitHub 仓库 `urzz/dsh-lark-plugin` 根目录运行。它在推送 `v*` 标签时运行，校验标签等于 `v` 加包版本，使用 Node.js 24、pnpm 和 npm 11，安装锁定依赖、构建和测试后以 OIDC 发布并附带 provenance。正式版使用 latest，预发布使用 next，不需要 NPM_TOKEN。

在 npm 包 Settings → Trusted Publisher 中选择 GitHub Actions：Organization or user 填 `urzz`，Repository 填 `dsh-lark-plugin`，Workflow filename 填 `publish.yml`，Environment 留空。完成该配置后才可使用 OIDC 自动发布。参考 [npm Trusted Publishing 文档](https://docs.npmjs.com/trusted-publishers/)。

后续发布先修改 package.json 版本；若依赖变动，同时更新 [pnpm-lock.yaml](pnpm-lock.yaml)。提交已审阅范围，再创建匹配版本标签并普通推送 main 分支及标签，确认 Actions 实际结果后报告发布成功。不在父仓库中执行发布操作。
