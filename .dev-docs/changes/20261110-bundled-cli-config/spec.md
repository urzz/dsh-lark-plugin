# 方案（intent v1）

使用固定 @larksuite/cli 1.0.98 npm 依赖。默认从插件依赖启动，保留 executable 外部覆盖。官方包会下载平台二进制，非离线二进制分发。通过 DSH subprocess 调用，不经过 shell。

插件 Config 添加 appId、appSecret、brand；使用 DSH 原生 Schema 表单和密码字段，不新增独立视觉系统。既有 cwd/超时/输出上限保留。未提供应用配置时兼容既有 CLI 本地配置；提供时必须完整。自动初始化只由 Host 内部执行 config init --app-id ... --app-secret-stdin --brand ...；secret 只经 stdin，不返回原始初始化输出给模型。初始化与业务/授权使用相同 CLI 配置；避免并发重复初始化，避免未变化配置在每次调用重新初始化。OAuth 两步用户授权不变。

验收：
- A1 默认依赖启动且保留外部 CLI 覆盖。
- A2 原生配置字段覆盖 appId/secret/brand，secret 为密码输入，配置缺失有明确错误。
- A3 配置后自动初始化，secret 不在 argv 或模型输出，初始化失败阻止业务调用；并发和后续调用不会重复初始化。
- A4 原工具边界与 OAuth 回归通过；说明初始化、共享登录态和首次下载行为。

用户已审核前述方案并授权实施；原生 UI 一致性是后续明确约束。真实账号初始化与 OAuth 写入不在验收范围，使用假 subprocess 和 CLI 帮助验证契约。
