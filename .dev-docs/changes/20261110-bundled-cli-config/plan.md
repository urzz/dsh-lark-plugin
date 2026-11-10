# 实施计划

worktree/projectRoot: /home/fooksky/projects/fooksky/dsh-plugins/dsh-lark-plugin/.agents/worktrees/bundled-lark-config
branch: bundled-lark-config
changeId: 20261110-bundled-cli-config
basedOn: intent v1 / spec v1
交付边界：当前 worktree 可审阅实现，不提交、不发布或安装用户 profile。

P1（direct，A1–A3）：src 内实现依赖启动、原生配置 Schema、私有自动初始化；package 和 lock 固定依赖。使用 fake subprocess 验证初始化并发、失败、secret 和 CLI 覆盖。
P2（direct，A2、A4）：核对宿主后发现 Schema 不自动提供插件管理器表单，添加可选 client 配置入口，复用 configForms/slot 原生协议和主题；Host 使用 volatile 配置处理保存变更。初始化使用具名 CLI 配置，避免 unnamed init 清空用户列表。更新 README、维护约定、Skill 和知识入口；运行 pnpm check、npm pack --dry-run。真实浏览器交 fresh reviewer，未安装用户 profile 时明确证据限制；不得声称已验收运行中的新表单。
