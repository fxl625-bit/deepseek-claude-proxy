# DeepSeek Claude Code Proxy

一个本地 Node.js 代理，用于让 Claude Code（CLI / VS Code 插件）稳定接入 DeepSeek Anthropic API，并记录可脱敏验证的缓存命中率。

## 这个代理解决什么问题

Claude Code 的请求形态和 DeepSeek Anthropic 兼容端点之间可能存在几类兼容问题：

- `system` 可能出现在 `messages` 数组里，而 DeepSeek Anthropic 端点更稳定地接受顶层 `system`。
- Claude Code 可能注入动态 attribution / billing header，导致前缀缓存命中率下降。
- 中间层或旧配置可能使用非 DeepSeek 模型别名，导致模型缓存分区不稳定。
- 缓存 usage 字段可能是 Anthropic 风格的 `cache_read_input_tokens` / `cache_creation_input_tokens`，也可能是 DeepSeek OpenAI 风格的 `prompt_cache_hit_tokens` / `prompt_cache_miss_tokens`。

代理会在本地完成格式稳定化、模型路由和 usage 诊断日志记录。

## 功能

- 提取 `messages[].role=system` 到顶层 `system`。
- 剥离 `x-anthropic-billing-header`，减少动态前缀。
- 使用稳定 JSON 序列化，减少 key 顺序漂移。
- DeepSeek 模型名直通，`sonnet` / `opus` / `haiku` 模式通用映射。
- 支持 `DEEPSEEK_MODEL_ALIAS_MAP` 精确配置个人旧模型别名。
- 非流式和 SSE 流式响应都记录 usage。
- 日志只记录 hash、模型名、usage 和 latency，不记录完整 prompt，不记录 API key。

## 快速启动

```bash
git clone https://github.com/fxl625-bit/deepseek-claude-proxy.git
cd deepseek-claude-proxy
node deepseek-proxy.mjs
```

代理默认监听：

```text
http://127.0.0.1:3456/anthropic
```

## Claude Code 配置

### VS Code Claude Code 插件

在 `%APPDATA%/Code/User/settings.json` 中配置：

```json
{
  "claudeCode.environmentVariables": [
    { "name": "ANTHROPIC_BASE_URL", "value": "http://127.0.0.1:3456/anthropic" },
    { "name": "ANTHROPIC_API_KEY", "value": "<your-deepseek-api-key>" },
    { "name": "ANTHROPIC_AUTH_TOKEN", "value": "<your-deepseek-api-key>" },
    { "name": "ANTHROPIC_MODEL", "value": "deepseek-v4-pro[1m]" },
    { "name": "ANTHROPIC_DEFAULT_SONNET_MODEL", "value": "deepseek-v4-pro[1m]" },
    { "name": "ANTHROPIC_DEFAULT_OPUS_MODEL", "value": "deepseek-v4-pro[1m]" },
    { "name": "ANTHROPIC_DEFAULT_HAIKU_MODEL", "value": "deepseek-v4-flash" },
    { "name": "CLAUDE_CODE_SUBAGENT_MODEL", "value": "deepseek-v4-flash" },
    { "name": "CLAUDE_CODE_EFFORT_LEVEL", "value": "max" },
    { "name": "CLAUDE_CODE_ATTRIBUTION_HEADER", "value": "0" },
    { "name": "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "value": "1" }
  ]
}
```

### Claude Code CLI

在 `~/.claude/settings.json` 中配置：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:3456/anthropic",
    "ANTHROPIC_API_KEY": "<your-deepseek-api-key>",
    "ANTHROPIC_AUTH_TOKEN": "<your-deepseek-api-key>",
    "ANTHROPIC_MODEL": "deepseek-v4-pro[1m]",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "deepseek-v4-pro[1m]",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "deepseek-v4-pro[1m]",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "deepseek-v4-flash",
    "CLAUDE_CODE_SUBAGENT_MODEL": "deepseek-v4-flash",
    "CLAUDE_CODE_EFFORT_LEVEL": "max",
    "CLAUDE_CODE_ATTRIBUTION_HEADER": "0",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  }
}
```

## 模型路由

公开版默认不硬编码任何个人中转站模型别名。

路由规则：

- `deepseek-*`：直接透传。
- 包含 `sonnet`：转为 `DEEPSEEK_SONNET_MODEL`，默认 `deepseek-v4-pro[1m]`。
- 包含 `opus`：转为 `DEEPSEEK_OPUS_MODEL`，默认 `deepseek-v4-pro[1m]`。
- 包含 `haiku`：转为 `DEEPSEEK_HAIKU_MODEL`，默认 `deepseek-v4-flash`。
- 其他未知模型：默认透传，可用 `DEEPSEEK_UNKNOWN_MODEL_FALLBACK` 兜底。

如果你有自己的旧中转站模型别名，可以通过环境变量精确映射：

```powershell
$env:DEEPSEEK_MODEL_ALIAS_MAP = '{"my-sonnet-alias":"deepseek-v4-pro[1m]","my-haiku-alias":"deepseek-v4-flash"}'
```

## 缓存诊断日志

默认写入：

```text
.claude-cache-diagnostics/cache-usage.jsonl
```

可通过环境变量修改：

```powershell
$env:CLAUDE_CACHE_DIAG_DIR = "D:\path\to\diagnostics"
```

日志字段包括：

- `model_requested`
- `model_forwarded`
- `model_returned`
- `model_was_mapped`
- `system_prompt_hash`
- `messages_prefix_hash`
- `request_body_hash`
- `tools_hash`
- `cache_read_input_tokens`
- `cache_creation_input_tokens`
- `prompt_cache_hit_tokens`
- `prompt_cache_miss_tokens`
- `computed_cache_hit_rate`
- `latency_ms`

日志不包含完整 prompt，不包含 API key。

## 验证

查看代理状态：

```bash
curl http://127.0.0.1:3456/diag
```

查看最近缓存 usage：

```powershell
Get-Content .claude-cache-diagnostics\cache-usage.jsonl -Tail 20
```

判断标准：

- `model_forwarded` 应稳定为目标 DeepSeek 模型。
- 第二轮开始应出现 `cache_read_input_tokens > 0` 或 `prompt_cache_hit_tokens > 0`。
- `computed_cache_hit_rate` 不应长期为 0。
- 若 hash 在多组值之间交替，说明会话前缀或工具上下文仍在变化。

## Windows 启动脚本

| 文件 | 用途 |
| --- | --- |
| `deepseek-proxy.mjs` | 代理主程序 |
| `start-proxy.bat` | 前台启动，适合调试 |
| `start-proxy-silent.bat` | 后台启动 |
| `start-proxy.vbs` | Windows 隐藏窗口启动 |
| `install-autostart.ps1` | 安装开机自启快捷方式 |
| `uninstall-autostart.ps1` | 卸载开机自启快捷方式 |

这些脚本使用脚本所在目录和 PATH 中的 `node`，不依赖固定本机路径。

## 安全边界

- 不要把真实 API key 写进仓库。
- 不要提交 `.env`、`*.log` 或 `.claude-cache-diagnostics/`。
- 不要提交个人 `settings.json`。
- 不要把个人旧中转站模型别名作为公共默认值。

## License

MIT
