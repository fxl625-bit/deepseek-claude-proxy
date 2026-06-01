/**
 * Claude Code -> DeepSeek Anthropic API 格式转换代理
 *
 * @version 1.3.0
 * @date    2026-06-01
 *
 * 功能：
 *   1. 将 Claude Code 发送的 messages 数组中的 system role 提取到顶级 system 参数
 *   2. 剥离 Claude Code 注入的动态 billing header，防止缓存率暴跌
 *   3. 稳定 JSON 序列化（sorted keys），消除 key 顺序漂移导致的缓存失效
 * 原因：
 *   - DeepSeek Anthropic 兼容端点不接受 messages 里的 system role
 *   - Claude Code v2.1.37+ 在 system prompt 前注入动态 hash 导致前缀缓存全部失效
 *   - JSON.stringify 不保证 key 顺序，任何漂移都会破坏前缀逐字节匹配
 *
 * 启动：node deepseek-proxy.mjs
 * 端口：3456
 */

import http from 'http';
import https from 'https';
import fs from 'fs';

const PORT = 3456;
const DEEPSEEK_BASE = 'https://api.deepseek.com';
const DEEPSEEK_API_KEY = '<your-deepseek-api-key>';  // 替换为你的 API Key，或通过 x-api-key 请求头传入（代理自动转发）

/**
 * 稳定 JSON 序列化：递归排序对象 key，确保跨请求字节一致
 *
 * JSON.stringify 不保证 key 顺序（虽然 V8 通常按插入顺序），
 * 但任何 key 顺序漂移都会导致前缀逐字节匹配失败，缓存全部作废。
 * 此函数强制按字母序排列所有 key，消除最后的不确定因素。
 *
 * @param {*} obj - 待序列化的值
 * @returns {string} 稳定排序后的 JSON 字符串
 */
function stableStringify(obj) {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(stableStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  const pairs = keys.map(k => JSON.stringify(k) + ':' + stableStringify(obj[k]));
  return '{' + pairs.join(',') + '}';
}

/**
 * 剥离 Claude Code 注入的动态归属头 (billing header)
 *
 * Claude Code v2.1.37+ 在系统提示词前面注入：
 *   x-anthropic-billing-header: cc_version=X.X.X.X; cc_entrypoint=...; cch=XXXX;
 *
 * 其中 cch 是动态哈希，导致每次请求的 system prompt 前缀不同，
 * API 缓存（依赖前缀逐字节匹配）完全失效，缓存率暴跌至接近 0%。
 *
 * 设置 CLAUDE_CODE_ATTRIBUTION_HEADER=0 可以从源头禁用，此函数作为防御层
 * 在代理层二次剥离，确保即使 env var 未生效也不会影响缓存。
 */
function stripBillingHeader(text) {
  if (typeof text !== 'string') return text;
  // 匹配 billing header 行（可能带有多行变体）
  const stripped = text.replace(/^x-anthropic-billing-header:\s*.+$/gim, '').trimStart();
  if (stripped !== text) {
    console.log('[CACHE] Stripped billing header from system prompt');
  }
  return stripped;
}

function transformRequest(body) {
  // Extract system messages from the messages array
  const systemMessages = [];
  const cleanMessages = [];

  for (const msg of (body.messages || [])) {
    if (msg.role === 'system') {
      // Merge system message content
      const raw = typeof msg.content === 'string'
        ? msg.content
        : JSON.stringify(msg.content);
      systemMessages.push(stripBillingHeader(raw));
    } else {
      cleanMessages.push(msg);
    }
  }

  const transformed = { ...body, messages: cleanMessages };

  // Set system as top-level parameter if we found system messages
  if (systemMessages.length > 0) {
    // If body already has a system field, merge them
    if (body.system) {
      const existing = typeof body.system === 'string' ? body.system : JSON.stringify(body.system);
      transformed.system = stripBillingHeader(existing) + '\n\n' + systemMessages.join('\n\n');
    } else {
      transformed.system = systemMessages.join('\n\n');
    }
  } else if (body.system) {
    // No system messages in array, but top-level system exists — strip it too
    transformed.system = typeof body.system === 'string'
      ? stripBillingHeader(body.system)
      : body.system;
  }

  return transformed;
}

// 简易哈希（用于诊断日志，不用于安全）
function djb2(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// 诊断日志：分析请求哪些部分可能破坏缓存
let lastSystemHash = null;
let lastToolsHash = null;
let requestSeq = 0;
const diagHistory = [];

function diagLog(body) {
  try {
  requestSeq++;
  const sysStr = body.system ? (typeof body.system === 'string' ? body.system : stableStringify(body.system)) : '';
  const sysPrefix = sysStr.substring(0, 2000);
  const sysHash = djb2(sysPrefix);
  const sysChanged = lastSystemHash && sysHash !== lastSystemHash ? ' ⚡PREFIX_CHANGED' : '';
  lastSystemHash = sysHash;

  const tools = body.tools ? stableStringify(body.tools) : '';
  const toolsHash = tools ? djb2(tools) : 'none';
  const toolsChanged = lastToolsHash && toolsHash !== lastToolsHash ? ' ⚡TOOLS_CHANGED' : '';
  lastToolsHash = toolsHash;

  const msgCount = body.messages ? body.messages.length : 0;
  const toolCount = body.tools ? body.tools.length : 0;
  const hasCacheControl = (sysStr.includes('cache_control') || tools.includes('cache_control')) ? '✓' : '✗';
  const sysLen = sysStr.length;
  const totalBodySize = stableStringify(body).length;
  // 分离追踪：开头固定窗口 vs 尾部新消息
  const msgsArr = body.messages || [];
  const headMsgs = msgsArr.slice(0, 50);   // 前50条，应永远不变
  const tailMsgs = msgsArr.slice(-4);       // 最后4条，每轮变化
  const headHash = headMsgs.length > 0 ? djb2(stableStringify(headMsgs)) : 'none';
  const tailHash = tailMsgs.length > 0 ? djb2(stableStringify(tailMsgs)) : 'none';

  const line = `[DIAG #${requestSeq}] sys=${sysLen}B(h=${sysHash}${sysChanged}) | tools=${toolCount}(h=${toolsHash}${toolsChanged}) | msgs=${msgCount} head50=${headHash} tail4=${tailHash} | body=${Math.round(totalBodySize/1024)}KB`;
  console.log(line);
  diagHistory.push({ time: new Date().toISOString(), seq: requestSeq, sysLen, sysHash, sysChanged: !!sysChanged, toolsHash, toolsChanged: !!toolsChanged, toolCount, msgCount, headHash, tailHash, bodyKB: Math.round(totalBodySize/1024) });
  const diagPath = 'F:/CODEX/deepseek-proxy/diag.log';
  fs.appendFileSync(diagPath, new Date().toISOString() + ' ' + line + '\n');
  } catch (e) {
    // 兜底：诊断崩了也不能影响代理
    console.error('[DIAG_ERR]', e.message);
  }
}

function proxyRequest(clientReq, clientRes) {
  let bodyChunks = [];

    clientReq.on('error', (err) => {
      console.error('[ERROR] Client request error:', err.message);
      if (!clientRes.headersSent) {
        clientRes.writeHead(400, { 'Content-Type': 'application/json' });
      }
      clientRes.end(JSON.stringify({ error: 'Client error: ' + err.message }));
    });

    clientReq.on('data', chunk => bodyChunks.push(chunk));

    clientReq.on('end', () => {
      const bodyStr = Buffer.concat(bodyChunks).toString('utf8');

      // Parse and transform
      let body;
      try {
        body = JSON.parse(bodyStr);
      } catch (e) {
        clientRes.writeHead(400, { 'Content-Type': 'application/json' });
        clientRes.end(JSON.stringify({ error: 'Invalid JSON body' }));
        return;
      }

      const transformed = transformRequest(body);
      diagLog(transformed);  // 诊断缓存前缀
      const transformedStr = stableStringify(transformed);  // 稳定排序，确保缓存命中

      // Forward to DeepSeek
      const targetPath = clientReq.url;
      let targetUrl;
      try {
        targetUrl = new URL(targetPath, DEEPSEEK_BASE);
      } catch (e) {
        clientRes.writeHead(400, { 'Content-Type': 'application/json' });
        clientRes.end(JSON.stringify({ error: 'Invalid URL: ' + targetPath }));
        return;
      }

      const headers = { ...clientReq.headers };
      headers['host'] = targetUrl.host;
      headers['content-length'] = Buffer.byteLength(transformedStr);

      const reqOptions = {
        hostname: targetUrl.hostname,
        port: 443,
        path: targetUrl.pathname + targetUrl.search,
        method: clientReq.method,
        headers: headers,
        timeout: 120000, // 120s timeout for long responses
      };

      const proxyReq = https.request(reqOptions, (proxyRes) => {
        // Handle streaming responses (SSE)
        if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
          clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
          proxyRes.pipe(clientRes);
          proxyRes.on('error', (err) => {
            console.error('[ERROR] Stream pipe error:', err.message);
            clientRes.end();
          });
        } else {
          let responseBody = [];
          proxyRes.on('data', chunk => responseBody.push(chunk));
          proxyRes.on('end', () => {
            try {
              const responseStr = Buffer.concat(responseBody).toString('utf8');
              clientRes.writeHead(proxyRes.statusCode, {
                'Content-Type': proxyRes.headers['content-type'] || 'application/json',
                'Access-Control-Allow-Origin': '*',
              });
              clientRes.end(responseStr);
            } catch (e) {
              console.error('[ERROR] Response send error:', e.message);
              if (!clientRes.headersSent) {
                clientRes.writeHead(500, { 'Content-Type': 'application/json' });
              }
              clientRes.end(JSON.stringify({ error: 'Response error' }));
            }
          });
        }
      });

      proxyReq.on('error', (err) => {
        console.error('[ERROR] Proxy request failed:', err.message);
        if (!clientRes.headersSent) {
          clientRes.writeHead(502, { 'Content-Type': 'application/json' });
        }
        clientRes.end(JSON.stringify({ error: 'Proxy error: ' + err.message }));
      });

      proxyReq.on('timeout', () => {
        console.error('[ERROR] Proxy request timeout');
        proxyReq.destroy();
        if (!clientRes.headersSent) {
          clientRes.writeHead(504, { 'Content-Type': 'application/json' });
        }
        clientRes.end(JSON.stringify({ error: 'Upstream timeout' }));
      });

      proxyReq.write(transformedStr);
      proxyReq.end();
    });
}

const server = http.createServer((req, res) => {
  // 诊断端点：返回当前缓存状态，不经过文件系统
  if (req.method === 'GET' && req.url === '/diag') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      requestSeq,
      lastSystemHash,
      lastToolsHash,
      diagHistory: diagHistory.slice(-20),  // 最近20条
    }));
    return;
  }

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    });
    res.end();
    return;
  }

  // Keep-alive
  req.socket.setKeepAlive(true);
  res.socket.setKeepAlive(true);

  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  // Wrap entire request handling in try-catch to prevent crash
  try {
    proxyRequest(req, res);
  } catch (e) {
    console.error('[FATAL] Unhandled error:', e.message, e.stack);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
    }
    res.end(JSON.stringify({ error: 'Internal proxy error' }));
  }
});

// Prevent unhandled rejections from crashing the process
process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err.message);
  // Don't exit — keep serving
});

// Graceful shutdown on SIGINT/SIGTERM
function shutdown(signal) {
  console.log(`\n[${signal}] Shutting down gracefully...`);
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
  // Force exit after 5s if graceful shutdown hangs
  setTimeout(() => process.exit(1), 5000);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n========================================`);
  console.log(`  DeepSeek Proxy running on http://127.0.0.1:${PORT}`);
  console.log(`  Target: ${DEEPSEEK_BASE}`);
  console.log(`  Claude Code settings.json BASE_URL:`);
  console.log(`  http://127.0.0.1:${PORT}/anthropic`);
  console.log(`========================================\n`);
});
