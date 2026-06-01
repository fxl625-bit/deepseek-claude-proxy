# DeepSeek × Claude Code Proxy

让 Claude Code（CLI / VSCode 插件 / 桌面版）通过 DeepSeek API 运行。

## 两种部署方式

| 方式 | 配置 | 说明 |
|------|------|------|
| **直连**（推荐） | `ANTHROPIC_BASE_URL` → `https://api.deepseek.com/anthropic` | 无需本地代理，即配即用 |
| **代理**（可选） | `ANTHROPIC_BASE_URL` → `http://127.0.0.1:3456/anthropic` | 额外提供 billing header 剥离 + sorted keys 缓存优化 |

## 直连模式配置

VSCode Claude Code 插件（`%APPDATA%/Code/User/settings.json`）：

```json
{
  "claudeCode.environmentVariables": [
    { "name": "ANTHROPIC_BASE_URL",      "value": "https://api.deepseek.com/anthropic" },
    { "name": "ANTHROPIC_API_KEY",       "value": "<your-deepseek-api-key>" },
    { "name": "ANTHROPIC_AUTH_TOKEN",    "value": "<your-deepseek-api-key>" },
    { "name": "ANTHROPIC_MODEL",         "value": "deepseek-v4-pro" },
    { "name": "ANTHROPIC_DEFAULT_OPUS_MODEL",   "value": "deepseek-v4-pro" },
    { "name": "ANTHROPIC_DEFAULT_SONNET_MODEL", "value": "deepseek-v4-pro" },
    { "name": "ANTHROPIC_DEFAULT_HAIKU_MODEL",  "value": "deepseek-v4-flash" },
    { "name": "CLAUDE_CODE_SUBAGENT_MODEL",     "value": "deepseek-v4-flash" },
    { "name": "CLAUDE_CODE_EFFORT_LEVEL",       "value": "max" },
    { "name": "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "value": "1" }
  ]
}
```

## 代理模式（可选缓存优化）

```bash
git clone https://github.com/fxl625-bit/deepseek-claude-proxy.git
cd deepseek-claude-proxy
node deepseek-proxy.mjs
```

然后将 `ANTHROPIC_BASE_URL` 改为 `http://127.0.0.1:3456/anthropic`，并添加：
- `CLAUDE_CODE_ATTRIBUTION_HEADER`: `"0"`

## 代理功能（v1.3.0）

| 功能 | 说明 |
|------|------|
| System role 提取 | 兼容 DeepSeek Anthropic 端点的 system 参数格式 |
| Billing header 剥离 | 去除动态归属头，防止前缀缓存失效 |
| Stable JSON serialization | sorted keys 确保跨请求字节一致 |
| SSE 透传 | 流式响应低延迟转发 |
| 异常保护 | 全局 uncaughtException / unhandledRejection 捕获 |

## 验证

```bash
curl http://127.0.0.1:3456/anthropic/v1/messages
```

## 启动方式

| 文件 | 用途 |
|------|------|
| `deepseek-proxy.mjs` | 代理主程序 (v1.3.0) |
| `start-proxy.vbs` | Windows 静默启动（后台常驻） |
| `start-proxy.bat` | 手动启动（带控制台，调试用） |
| `install-autostart.ps1` | 安装开机自启 |
| `uninstall-autostart.ps1` | 卸载开机自启 |

## 许可

MIT
