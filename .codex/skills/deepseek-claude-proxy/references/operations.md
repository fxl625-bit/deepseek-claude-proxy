# Operations Reference

Use this reference when operating or publishing the DeepSeek Claude Proxy.

## Source Boundaries

- Treat the matching repository under `CODEX_ROOT` as the source authority; on this workstation that project repository is `F:\CODEX\deepseek-proxy`.
- Treat Obsidian mirrors as archives and indices, not as the commit source.
- Do not write durable rules that only work on one machine-specific path.
- Keep public defaults portable and free of personal model aliases.

## Safe Runtime Commands

Check syntax:

```powershell
node --check deepseek-proxy.mjs
```

Start in foreground:

```powershell
node deepseek-proxy.mjs
```

Check status:

```powershell
curl.exe --silent http://127.0.0.1:3456/diag
```

Inspect listening port:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3456
```

Inspect recent usage:

```powershell
Get-Content .claude-cache-diagnostics\cache-usage.jsonl -Tail 20
```

## Recommended Claude Code Environment

Use DeepSeek model names as public defaults:

```text
ANTHROPIC_BASE_URL=http://127.0.0.1:3456/anthropic
ANTHROPIC_MODEL=deepseek-v4-pro[1m]
ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek-v4-pro[1m]
ANTHROPIC_DEFAULT_OPUS_MODEL=deepseek-v4-pro[1m]
ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash
CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-flash
CLAUDE_CODE_EFFORT_LEVEL=max
CLAUDE_CODE_ATTRIBUTION_HEADER=0
```

If a user has private historical relay aliases, require explicit opt-in:

```powershell
$env:DEEPSEEK_MODEL_ALIAS_MAP = '{"my-sonnet-alias":"deepseek-v4-pro[1m]"}'
```

## Publishing Checklist

Run before commit or push:

```powershell
node --check deepseek-proxy.mjs
git status --short
git ls-files --others --exclude-standard
Select-String -Path (git ls-files | ForEach-Object { Join-Path (Get-Location) $_ }) -Pattern 'sk-ant-|sk-[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]+|C:\\Users\\|\.workbuddy' -CaseSensitive:$false
```

Expected:

- Logs and `.claude-cache-diagnostics/` are ignored.
- No real secrets appear in tracked files.
- No personal absolute paths appear in public scripts or docs.
- Old personal relay aliases are not public defaults.

## GitHub Connectivity

If direct GitHub access fails but a local proxy is available, use per-command proxy settings instead of changing durable repository config:

```powershell
git -c http.proxy=http://127.0.0.1:7890 -c https.proxy=http://127.0.0.1:7890 ls-remote origin HEAD
git -c http.proxy=http://127.0.0.1:7890 -c https.proxy=http://127.0.0.1:7890 push origin master
```
