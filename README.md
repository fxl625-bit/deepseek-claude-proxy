# DeepSeek × Claude Code Proxy

本地 Node.js 代理，让 Claude Code（CLI / VSCode 插件 / 桌面版）通过 DeepSeek API 运行。

## 为什么需要代理

Claude Code 的 SDK 将 system prompt 放在 `messages` 数组里，但 DeepSeek Anthropic 端点要求 system 作为顶级参数。直连必然报错：

```
API Error 400: unknown variant system, expected user or assistant
```

代理在中间完成格式转换，这是**必需**的，不是可选的。

## 快速部署

```bash
git clone https://github.com/fxl625-bit/deepseek-claude-proxy.git
cd deepseek-claude-proxy
node deepseek-proxy.mjs
```

## 配置

### VSCode Claude Code 插件

`%APPDATA%/Code/User/settings.json`：

```json
{
  "claudeCode.environmentVariables": [
    { "name": "ANTHROPIC_BASE_URL",              "value": "http://127.0.0.1:3456/anthropic" },
    { "name": "ANTHROPIC_API_KEY",               "value": "<your-deepseek-api-key>" },
    { "name": "ANTHROPIC_AUTH_TOKEN",            "value": "<your-deepseek-api-key>" },
    { "name": "ANTHROPIC_DEFAULT_OPUS_MODEL",    "value": "claude-opus-4-20250514" },
    { "name": "ANTHROPIC_DEFAULT_SONNET_MODEL",  "value": "claude-sonnet-4-20250514" },
    { "name": "ANTHROPIC_DEFAULT_HAIKU_MODEL",   "value": "claude-haiku-4-20250514" },
    { "name": "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "value": "1" },
    { "name": "CLAUDE_CODE_ATTRIBUTION_HEADER",  "value": "0" }
  ]
}
```

### Claude Code CLI

`~/.claude/settings.json`：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:3456/anthropic",
    "ANTHROPIC_API_KEY": "<your-deepseek-api-key>",
    "ANTHROPIC_AUTH_TOKEN": "<your-deepseek-api-key>",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-20250514",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-20250514",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-haiku-4-20250514",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
    "CLAUDE_CODE_ATTRIBUTION_HEADER": "0"
  }
}
```

> 模型名写 Claude 名，DeepSeek 端自动映射。不要写 `deepseek-v4-pro` 等原生名。

## 代理功能 (v1.5.0)

| 功能 | 说明 |
|------|------|
| System role 提取 | 修复 400 报错的根本原因 |
| Billing header 剥离 | 去除动态 hash，保护前缀缓存 |
| Stable JSON serialization | sorted keys 消除 key 顺序漂移 |
| SSE 透传 | 流式响应低延迟转发 |
| 异常保护 | uncaughtException / unhandledRejection 捕获 |

## 验证

```bash
curl http://127.0.0.1:3456/anthropic/v1/messages
```

## 启动方式

| 文件 | 用途 |
|------|------|
| `deepseek-proxy.mjs` | 代理主程序 (v1.5.0) |
| `start-proxy.vbs` | Windows 静默启动（后台常驻） |
| `start-proxy.bat` | 手动启动（带控制台，调试用） |
| `install-autostart.ps1` | 安装开机自启 |
| `uninstall-autostart.ps1` | 卸载开机自启 |

## 许可

MIT
