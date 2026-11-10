export const en = {
  description: 'Application credentials and shared CLI settings.', title: 'Lark settings',
  appId: 'App ID', appSecret: 'App Secret', brand: 'Platform', feishu: 'Feishu (China)', lark: 'Lark (international)',
  secretSet: 'An App Secret is configured. Leave blank to keep it; enter a new secret to replace it.',
  secretUnset: 'No App Secret is configured. Enter one to initialize the shared CLI with this App ID.',
  secretUnknown: 'Leave blank to keep the existing App Secret. Stored secrets are never shown.',
  shared: 'These settings apply to the shared CLI account. Leave application credentials unset to use existing CLI configuration.',
  advanced: 'Advanced execution settings', executable: 'CLI executable', executableHint: 'Leave blank to use the bundled official CLI.',
  cwd: 'Working directory', cwdHint: 'Base directory for CLI file input and output.', timeoutMs: 'Process timeout (ms)', maxOutputBytes: 'Maximum output per stream (bytes)',
  save: 'Save changes', saving: 'Saving…', resetting: 'Resetting…', discard: 'Discard edits', reset: 'Reset settings',
  resetHint: 'Reset restores platform and execution settings, keeping App ID and App Secret. Remove application credentials to use existing CLI configuration.', saved: 'Changes saved.', resetDone: 'Settings reset. App ID and App Secret were kept.', remove: 'Remove application credentials', removing: 'Removing…', removed: 'Application credentials removed. Existing CLI configuration will be used.',
  loading: 'Loading configuration…', unavailable: 'Configuration is unavailable.', readOnly: 'Configuration is read-only.',
  conflict: 'Configuration changed elsewhere. Discard edits to load the latest values before saving.',
  failed: 'Could not save changes. Check the configuration and try again.',
  invalid: 'Timeout must be an integer of at least 1,000 ms. Output must be an integer from 1,024 to 20,000,000 bytes.',
};
export const zh: Record<keyof typeof en, string> = {
  description: '应用凭证与共享 CLI 设置。', title: '飞书 / Lark 设置', appId: 'App ID', appSecret: 'App Secret', brand: '平台', feishu: '飞书（中国）', lark: 'Lark（国际）',
  secretSet: '已配置 App Secret。留空保留现有密钥；输入新密钥可替换。', secretUnset: '尚未配置 App Secret。填写后将使用此 App ID 初始化共享 CLI。',
  secretUnknown: '留空保留现有 App Secret。已存密钥不会回显。', shared: '这些设置用于共享 CLI 账户。不设置应用凭证时使用现有 CLI 配置。',
  advanced: '高级执行设置', executable: 'CLI 可执行文件', executableHint: '留空使用随插件提供的官方 CLI。', cwd: '工作目录', cwdHint: 'CLI 文件输入和输出的基础目录。',
  timeoutMs: '进程超时（毫秒）', maxOutputBytes: '每个输出流的最大字节数', save: '保存更改', saving: '正在保存…', resetting: '正在重置…', discard: '放弃编辑', reset: '重置设置',
  resetHint: '重置将恢复平台与执行设置，并保留 App ID 和 App Secret。移除应用凭证后使用现有 CLI 配置。', saved: '更改已保存。', resetDone: '设置已重置，App ID 和 App Secret 已保留。', remove: '移除应用凭证', removing: '正在移除…', removed: '应用凭证已移除，将使用现有 CLI 配置。',
  loading: '正在加载配置…', unavailable: '当前无法配置此插件。', readOnly: '配置为只读。', conflict: '配置已在其他位置更改。请放弃编辑以加载最新值，然后重新保存。',
  failed: '无法保存更改。请检查配置后重试。', invalid: '超时须为至少 1,000 毫秒的整数；输出上限须为 1,024 至 20,000,000 字节的整数。',
};
export type Message = keyof typeof en;
