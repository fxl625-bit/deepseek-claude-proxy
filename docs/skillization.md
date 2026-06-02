# Skill 化发布说明

本文档用于把 `deepseek-claude-proxy` 作为项目绑定 skill 或工具型 skill 发布时参考。

## 公开默认原则

公开仓库不要硬编码个人旧 Claude API 中转站模型名。默认只使用 DeepSeek 模型名：

- `deepseek-v4-pro[1m]`
- `deepseek-v4-flash`

如果用户自己的历史配置里存在旧中转站别名，应由用户通过环境变量自行声明映射。

## 通用模型路由

代理当前模型路由规则：

- `deepseek-*`：直接透传。
- 包含 `sonnet`：转为 `DEEPSEEK_SONNET_MODEL`，默认 `deepseek-v4-pro[1m]`。
- 包含 `opus`：转为 `DEEPSEEK_OPUS_MODEL`，默认 `deepseek-v4-pro[1m]`。
- 包含 `haiku`：转为 `DEEPSEEK_HAIKU_MODEL`，默认 `deepseek-v4-flash`。
- 精确别名：通过 `DEEPSEEK_MODEL_ALIAS_MAP` 注入。

示例：

```powershell
$env:DEEPSEEK_MODEL_ALIAS_MAP = '{"my-sonnet-alias":"deepseek-v4-pro[1m]","my-haiku-alias":"deepseek-v4-flash"}'
```

## Skill 边界

如果做成 Codex / Claude / OpenClaw skill，建议定位为“项目绑定工具型 skill”：

- 源码真源：GitHub 仓库 `fxl625-bit/deepseek-claude-proxy`
- 功能：启动代理、检查 `/diag`、读取 `cache-usage.jsonl`、辅助判断缓存命中率
- 不应包含：API key、个人 VS Code settings、个人历史模型别名、真实 prompt、真实日志

## 发布前检查

```powershell
node --check deepseek-proxy.mjs
git status --short
git ls-files --others --exclude-standard
Select-String -Path .\* -Pattern 'sk-ant-|sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]+|C:\\Users\\|F:\\CODEX|\.workbuddy' -CaseSensitive:$false
```

## 缓存验证

```powershell
curl.exe --silent http://127.0.0.1:3456/diag
Get-Content .claude-cache-diagnostics\cache-usage.jsonl -Tail 20
```

判断标准：

- `model_forwarded` 稳定为目标 DeepSeek 模型。
- 第二轮开始出现 `cache_read_input_tokens > 0` 或 `prompt_cache_hit_tokens > 0`。
- `computed_cache_hit_rate` 不长期为 0。
- 如果 `system_prompt_hash`、`messages_prefix_hash`、`tools_hash` 交替变化，优先排查会话、工具和项目上下文是否在变。
