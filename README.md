# DeepSeek × Claude Code Proxy

本地 Node.js 代理，让 Claude Code（CLI / VSCode 插件 / 桌面版）通过 DeepSeek API 运行。

## 两大核心问题修复

| 问题 | 现象 | 修复 |
|------|------|------|
| System Role 格式不兼容 | `API Error 400: unknown variant system` | 自动将 messages 中的 system 提取到顶级参数 |
| 缓存率暴跌 | Cache hit rate 从 95%+ 跌至 0% | 剥离动态 billing header + `CLAUDE_CODE_ATTRIBUTION_HEADER=0` |

## 快速部署

```bash
git clone https://github.com/fxl625-bit/deepseek-claude-proxy.git
cd deepseek-claude-proxy
node deepseek-proxy.mjs
```

## 配置 Claude Code

编辑 `~/.claude/settings.json`：

```json
{
  "env": {
    "ANTHROPIC_API_KEY": "<your-deepseek-api-key>",
    "ANTHROPIC_AUTH_TOKEN": "<your-deepseek-api-key>",
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:3456/anthropic",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "claude-haiku-4-20250514",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "claude-opus-4-20250514",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "claude-sonnet-4-20250514",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
    "DISABLE_NONESSENTIAL_TRAFFIC": "1",
    "CLAUDE_CODE_ATTRIBUTION_HEADER": "0"
  }
}
```

> API Key 只需配在 `settings.json` 中，代理会自动转发请求头中的认证信息到 DeepSeek。

## 验证

```bash
curl http://127.0.0.1:3456/anthropic/v1/messages
```

## 启动方式

| 文件 | 用途 |
|------|------|
| `deepseek-proxy.mjs` | 代理主程序 (v1.2.0) |
| `start-proxy.vbs` | Windows 静默启动（后台常驻） |
| `start-proxy.bat` | 手动启动（带控制台，调试用） |
| `start-proxy-silent.bat` | bat 方式静默启动 |
| `install-autostart.ps1` | 安装开机自启 |
| `uninstall-autostart.ps1` | 卸载开机自启 |

## 版本

v1.3.0 (2026-06-01) — 新增稳定 JSON 序列化（sorted keys），消除 key 顺序漂移导致的缓存失效

## 许可

MIT
