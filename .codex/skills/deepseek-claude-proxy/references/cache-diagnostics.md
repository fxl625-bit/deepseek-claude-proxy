# Cache Diagnostics Reference

Use this reference when diagnosing DeepSeek cache hit rates through the proxy.

## Usage Fields

DeepSeek Anthropic responses may expose Anthropic-style cache fields:

- `cache_read_input_tokens`
- `cache_creation_input_tokens`

DeepSeek OpenAI-compatible responses may expose:

- `prompt_cache_hit_tokens`
- `prompt_cache_miss_tokens`

Compute hit rate with whichever pair is present:

```text
hit_rate = hit_tokens / (hit_tokens + miss_or_creation_tokens)
```

If neither denominator is positive, report `null` instead of `0`; the request may be too small or may not have created a visible cache segment.

## Required Evidence

Use `.claude-cache-diagnostics/cache-usage.jsonl` for actual proxy evidence. Important fields:

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

Use `/diag` for current runtime state:

```powershell
curl.exe --silent http://127.0.0.1:3456/diag
```

## Root Cause Ranking

When cache rate is unexpectedly low, rank causes by evidence:

1. Wrong usage-field parser: UI reads only `prompt_cache_*` while Anthropic endpoint returns `cache_read_input_tokens`.
2. Model instability: `model_forwarded` or `model_returned` changes across requests.
3. Prefix instability: `system_prompt_hash`, `messages_prefix_hash`, or `tools_hash` alternates between multiple values.
4. Multiple sessions or compaction: body size and message counts jump between distinct groups.
5. Dynamic tools or MCP schemas: `tools_hash` changes across turns.
6. Environment split: VS Code Claude Code environment differs from terminal environment.
7. Proxy disabled or wrong base URL: requests bypass `http://127.0.0.1:3456/anthropic`.

## Reporting Rules

- Report hashes and token counts, not raw prompt contents.
- Mention exact fields used to compute cache hit rate.
- Do not infer a cache miss from one first request; first stable request often creates the cache.
- Prefer a three-request stable-prefix experiment for validation.
