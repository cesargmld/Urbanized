const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

const target = '  // Real Authentication API for URBNZD';
const injection = `  // Precision Proxy for Overpass with proper User-Agent & failover mirrors (Zero CORS issues)
  if (req.url.startsWith('/api/overpass')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    let body = '';
    for await (const chunk of req) body += chunk;
    let query = '';
    if (body.startsWith('data=')) {
      query = decodeURIComponent(body.slice(5));
    } else {
      try {
        const parsed = JSON.parse(body);
        query = parsed.data || parsed.query || '';
      } catch (e) {
        query = body;
      }
    }

    const mirrors = [
      'https://overpass.openstreetmap.fr/api/interpreter',
      'https://z.overpass-api.de/api/interpreter',
      'https://lz4.overpass-api.de/api/interpreter',
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter'
    ];

    let result = null;
    for (const mirror of mirrors) {
      try {
        const ovRes = await fetch(mirror, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Urbanized/2.0 (architecture-cgm@urbnzd.app)'
          },
          body: 'data=' + encodeURIComponent(query),
          signal: AbortSignal.timeout(10000)
        });
        if (ovRes.ok) {
          result = await ovRes.text();
          break;
        }
      } catch (e) {
        // try next mirror
      }
    }

    if (result) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(result);
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ elements: [] }));
    }
    return;
  }

  // Real Authentication API for URBNZD`;

code = code.replace(target, injection);
fs.writeFileSync('server.js', code, 'utf8');
console.log('server.js updated with /api/overpass endpoint!');
