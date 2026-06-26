const http = require('http');
const https = require('https');
const { URL } = require('url');

const PORT = Number(process.env.PROXY_PORT || 5001);
const TARGET = process.env.PROXY_TARGET || 'http://localhost:3000';

function writeCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

const server = http.createServer((req, res) => {
  writeCors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (!req.url || !req.url.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: 'Route not found' }));
    return;
  }

  const targetUrl = new URL(req.url, TARGET);
  const client = targetUrl.protocol === 'https:' ? https : http;

  const proxyReq = client.request(
    {
      protocol: targetUrl.protocol,
      hostname: targetUrl.hostname,
      port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: {
        ...req.headers,
        host: targetUrl.host,
        origin: TARGET,
      },
    },
    (proxyRes) => {
      const headers = { ...proxyRes.headers };
      delete headers['access-control-allow-origin'];
      delete headers['access-control-allow-methods'];
      delete headers['access-control-allow-headers'];
      delete headers['access-control-allow-credentials'];

      writeCors(res);
      res.writeHead(proxyRes.statusCode || 500, headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', (err) => {
    writeCors(res);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, message: `Proxy error: ${err.message}` }));
  });

  req.pipe(proxyReq);
});

server.listen(PORT, () => {
  console.log(`CORS proxy running on http://localhost:${PORT}`);
  console.log(`Forwarding /api/* to ${TARGET}`);
});


