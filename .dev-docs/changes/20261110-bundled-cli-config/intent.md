# 需求

添加固定版本官方 CLI npm 依赖，用户无需手动安装 CLI 或运行 config init。在插件配置填写 appId、appSecret、brand，由 Host 私有流程初始化，保留用户 OAuth 两步授权。配置 UI 与 DSH 原生设计及交互一致。

用户在已展示 npm 依赖、stdin 传密钥和首次使用/变更时初始化方案后回复「好，确认需要做这个优化」，随后要求配置页面 UI 和交互对齐 DSH。

范围不包含发布、安装到用户 profile、真实账号变更或提交推送。
