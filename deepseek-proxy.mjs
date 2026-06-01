/**
 * Claude Code -> DeepSeek Anthropic API 格式转换代理
 *
 * @version 1.2.0
 * @date    2026-06-01
 *
 * 功能：
 *   1. 将 Claude Code 发送的 messages 数组中的 system role 提取到顶级 system 参数
 *   2. 剥离 Claude Code 注入的动态 billing header，防止缓存率暴跌
 * 原因：
 *   - DeepSeek Anthropic 兼容端点不接受 messages 里的 system role
 *   - Claude Code v2.1.37+ 在 system prompt 前注入动态 hash 导致前缀缓存全部失效
 *
 * 启动：node deepseek-proxy.mjs
 * 端口：3456
 */

import http from 'http';
import https from 'https';

const PORT = 3456;
const DEEPSEEK_BASE = 'https://api.deepseek.com';
const DEEPSEEK_API_KEY = '<your-deepseek-api-key>';

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
      const transformedStr = JSON.stringify(transformed);

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
