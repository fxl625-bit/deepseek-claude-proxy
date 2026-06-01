# DeepSeek × Claude Code Proxy

本地 Node.js 代理，让 Claude Code（CLI / VSCode 插件 / 桌面版）通过 DeepSeek API 运行。

## 两大核心问题修复

| 问题 | 现象 | 修复 |
|------|------|------|
| System Role 格式不兼容 | `API Error 400: unknown variant system` | 自动将 messages 中的 system 提取到顶级参数 |
| 缓存率暴跌 | Cache hit rate 从 95%+ 跌至 0% | 剥离动态 billing header + `CLAUDE_CODE_ATTRIBUTION_HEADER=0` |

## 快速部署

```bash
# 1. 克隆仓库
git clone <this-repo>
cd deepseek-proxy

# 2. 修改 API Key
# 编辑 deepseek-proxy.mjs，将 DEEPSEEK_API_KEY 改为你的 DeepSeek API Key

# 3. 启动代理
node deepseek-proxy.mjs

# 4. 验证
curl http://127.0.0.1:3456/anthropic/v1/messages
```

## settings.json 配置

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

## 文件说明

| 文件 | 用途 |
|------|------|
| `deepseek-proxy.mjs` | 代理主程序 (v1.2.0) |
| `start-proxy.vbs` | Windows 静默启动 |
| `start-proxy.bat` | 手动启动（带控制台） |
| `start-proxy-silent.bat` | bat 方式静默启动 |
| `install-autostart.ps1` | 安装开机自启 |
| `uninstall-autostart.ps1` | 卸载开机自启 |

## ⚠️ 安全提示

- `deepseek-proxy.mjs` 中硬编码了 API Key，**提交到公开仓库前务必替换**
- 代理监听 `127.0.0.1:3456`，仅本机可访问，不暴露到外网

## 版本

v1.2.0 (2026-06-01) — 新增缓存率暴跌修复

## 许可

Private — 仅供个人使用。
