const fs = require('fs');

let serverCode = fs.readFileSync('server.js', 'utf8');

const oldProxyBlock = serverCode.slice(
  serverCode.indexOf('  // Precision Proxy for Overpass'),
  serverCode.indexOf('  // Real Authentication API for URBNZD')
);

const newProxyBlock = `  // Precision Parallel Proxy for Overpass (CORS-free, Parallel Mirror Race in ~1.1s)
  if (req.url.startsWith('/api/overpass')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

    let body = '';
    for await (const chunk of req) body += chunk;
    let query = '';
    if (body.startsWith('data=')) {
      try {
        query = decodeURIComponent(body.slice(5).replace(/\\+/g, ' '));
      } catch (e) {
        query = body.slice(5);
      }
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

    const ctrls = mirrors.map(() => new AbortController());
    const attempt = async (url, idx) => {
      const ovRes = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Urbanized/2.0 (architecture-cgm@urbnzd.app)'
        },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.any([ctrls[idx].signal, AbortSignal.timeout(7000)])
      });
      if (!ovRes.ok) throw new Error(\`Overpass \${ovRes.status}\`);
      const txt = await ovRes.text();
      return txt;
    };

    try {
      const winnerData = await Promise.any(mirrors.map(attempt));
      ctrls.forEach(c => c.abort());
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(winnerData);
    } catch (e) {
      ctrls.forEach(c => c.abort());
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ elements: [] }));
    }
    return;
  }

`;

serverCode = serverCode.replace(oldProxyBlock, newProxyBlock);
fs.writeFileSync('server.js', serverCode, 'utf8');
console.log('server.js updated with parallel Promise.any Overpass proxy!');
