---
name: deepseek-claude-proxy
description: Use when Codex needs to operate, configure, verify, troubleshoot, or publish the DeepSeek Claude Code proxy project, especially tasks involving Claude Code + DeepSeek Anthropic API, local proxy port 3456, cache hit diagnostics, model routing, usage fields, VS Code Claude Code environment variables, or safe project-bound skill maintenance.
---

# DeepSeek Claude Proxy

Agent-facing workflow for operating and diagnosing the project-bound DeepSeek Claude Code proxy.

## Trigger Conditions

- Trigger on requests mentioning DeepSeek Claude proxy, Claude Code + DeepSeek, `deepseek-claude-proxy`, cache hit rate, `cache-usage.jsonl`, `/diag`, or local proxy port `3456`.
- Use when asked to start, stop, restart, verify, configure, or debug the proxy.
- Use when asked to inspect whether Claude Code requests are stable for DeepSeek prefix caching.
- Use when asked to prepare this repository for public release or skill-bound maintenance.

## Required Handling

1. Read `references/operations.md` before changing runtime behavior or giving commands.
2. Read `references/cache-diagnostics.md` before diagnosing cache hit rate, usage fields, or hash changes.
3. Inspect repository state with `git status --short` before editing or publishing.
4. Never print API keys, full prompts, full system prompts, full tool schemas, or raw message bodies; log and report hashes only.
5. Prefer the repository README and `deepseek-proxy.mjs` as the source of truth; treat Obsidian copies as archives, not source.
6. If publishing or archiving, run syntax and secret checks before commit or sync.
7. Return only outputs that satisfy the contract below.

## Output Contract

- State what was checked or changed, including relevant file paths and validation commands.
- Include proxy status using `/diag` when runtime verification is relevant.
- Include cache evidence from `cache-usage.jsonl` when cache behavior is discussed.
- Clearly distinguish confirmed evidence from likely causes.
- If a command cannot run, state the blocker and the next safest manual command.

## Do Not

- Do not reveal API keys, bearer tokens, `.env` values, full prompt text, or full request/response bodies.
- Do not hard-code personal paths, personal Node installations, or personal old relay model aliases into public defaults.
- Do not treat `OBSIDIAN_ROOT` as the source repository; source code authority is `CODEX_ROOT` / GitHub.
- Do not commit logs, `.env`, `.claude-cache-diagnostics/`, VS Code settings, Claude settings, or diagnosis JSONL files.
- Do not claim cache health from UI percentages alone; verify usage fields and hash stability.

## Load These Files

- `references/operations.md` for startup, configuration, publishing, and safety checks.
- `references/cache-diagnostics.md` for cache usage field mapping, hash interpretation, and root-cause ranking.
- `README.md` in the repository root for user-facing setup.
- `deepseek-proxy.mjs` in the repository root when implementation details or patching are required.
