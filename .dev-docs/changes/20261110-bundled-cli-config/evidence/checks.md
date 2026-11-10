# 集成验证

环境：Node.js 26 / pnpm 10.34.9；分支 bundled-lark-config，基于 dc463ad2dffebee6b7215d804ca4c1fd1765f523 的未提交改动。DSH 开发依赖固定 0.2.1-rc.5，官方 CLI 固定 1.0.98。依赖安装禁用生命周期脚本，未下载或执行真实 CLI 原生程序。

- `pnpm check` 成功：Host/client TypeScript 检查、Host/client 构建、41 个自动测试全部通过，无跳过。覆盖内置启动器/外部覆盖、私有具名初始化与 profile 路由、同一配置并发初始化、取消与热更新、密钥输出抑制、OAuth/工具边界、客户端模块与 slot 注册、凭证保留/移除操作。
- `git diff --check` 成功。
- 最终构建后 `npm pack --dry-run` 成功：17 文件，22.7 kB 压缩 / 66.1 kB 解包；包含 lib/client.js、Host JS/声明和 Skill，无源码、测试、预览或开发文档。
- 假 subprocess 测试不访问飞书、不写真实凭证；未安装到运行中的 profile，未提交/发布。

官方契约核对：v1.0.98 config init 非交互路径先保存后 probe，非零结果可能已保存配置；具名配置同 App ID 保留用户关联，不具名路径会替换用户列表。`--profile` 没有短别名，config init 的 pre-run 不要求该 profile 预先存在。

来源：
- https://github.com/larksuite/cli/blob/v1.0.98/cmd/config/init.go
- https://github.com/larksuite/cli/blob/v1.0.98/cmd/config/config.go
- https://github.com/larksuite/cli/blob/v1.0.98/cmd/global_flags.go
- https://github.com/larksuite/cli/blob/v1.0.98/cmd/bootstrap.go
- https://github.com/larksuite/cli/blob/v1.0.98/cmd/build.go

浏览器证据另见 ui-verification.md；隔离预览不等同于运行中插件的注册、持久化与真实凭证联调。
