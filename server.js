const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.wasm': 'application/wasm',
  '.dxf': 'application/dxf',
  '.dae': 'model/vnd.collada+xml',
  '.stl': 'model/stl',
  '.ifc': 'application/x-step',
  '.fbx': 'application/octet-stream',
};

const server = http.createServer(async (req, res) => {
  // Proxy for Nominatim search with proper User-Agent
  if (req.url.startsWith('/api/search')) {
    const urlObj = new URL(req.url, 'http://localhost');
    const q = urlObj.searchParams.get('q') || '';
    const lang = urlObj.searchParams.get('lang') || 'es';
    const targetUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&accept-language=${encodeURIComponent(lang)}&q=${encodeURIComponent(q)}`;
    try {
      const resSearch = await fetch(targetUrl, {
        headers: { 'User-Agent': 'UrbanExportApp/1.0 (local dev; contact@local.dev)' }
      });
      const data = await resSearch.text();
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(data);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end('[]');
    }
    return;
  }

  // Mock API endpoints to avoid 404s
  if (req.url.startsWith('/api/status') || req.url.startsWith('/api/quota')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, billing: false, remaining: 999 }));
    return;
  }
  if (req.url.startsWith('/api/track') || req.url.startsWith('/api/charge')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, free: true, freeLeft: 999 }));
    return;
  }

  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';

  let filePath = path.join(ROOT, reqPath);

  // Security check
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
    });

    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Urban:EXPORT Clone iniciado con éxito!`);
  console.log(`📡 URL local: http://localhost:${PORT}`);
  console.log(`✨ Todas las funciones desbloqueadas (Sin límites ni pagos)`);
  console.log(`=======================================================`);
});
