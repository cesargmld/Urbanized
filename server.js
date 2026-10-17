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
  '.skp': 'application/octet-stream',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.obj': 'text/plain',
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

  // Parser de Normativa Urbana con Gemini Flash-Lite (@google/genai)
  if (req.url.startsWith('/api/parse-normativa') && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const { text = '' } = JSON.parse(body || '{}');
      const ZONING_SCHEMA = {
        type: 'object',
        properties: {
          cos: { type: 'number', description: 'Porcentaje de ocupación del suelo (0 a 100)' },
          cus: { type: 'number', description: 'Coeficiente de utilización del suelo (ej. 2.4)' },
          max_levels: { type: 'number', description: 'Número máximo de niveles permitidos' },
          front_setback_m: { type: 'number', description: 'Remetimiento frontal en metros' },
          side_setback_m: { type: 'number', description: 'Remetimiento lateral o perimetral en metros' },
        },
        required: ['cos', 'cus', 'max_levels', 'front_setback_m', 'side_setback_m'],
      };

      let result = null;
      if (process.env.GEMINI_API_KEY) {
        const { GoogleGenAI } = await import('@google/genai');
        const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const interaction = await client.interactions.create({
          model: 'gemini-3.5-flash-lite',
          system_instruction:
            'Eres un parser experto en normativa urbana y zonificación. Extrae COS (en porcentaje 0-100, si viene como 0.7 conviértelo a 70), CUS, niveles máximos (max_levels), remetimiento frontal en metros (front_setback_m) y remetimiento lateral/perimetral en metros (side_setback_m).',
          input: text,
          response_format: [
            {
              type: 'text',
              mime_type: 'application/json',
              schema: ZONING_SCHEMA,
            },
          ],
        });
        result = JSON.parse(interaction.output_text);
      } else {
        // Fallback heurístico determinista si no se definió GEMINI_API_KEY en entorno local
        const cosMatch = text.match(/COS\s*[:=]?\s*(\d+(?:\.\d+)?)\s*(%)?/i);
        const areaLibreMatch = text.match(/[áa]rea\s+libre\s*[:=]?\s*(\d+(?:\.\d+)?)\s*%/i);
        let cos = 70;
        if (cosMatch) {
          const val = parseFloat(cosMatch[1]);
          cos = val <= 1 && !cosMatch[2] ? Math.round(val * 100) : Math.round(val);
        } else if (areaLibreMatch) {
          cos = Math.max(10, 100 - Math.round(parseFloat(areaLibreMatch[1])));
        }
        const cusMatch = text.match(/CUS\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
        const lvlMatch = text.match(/(\d+)\s*(?:niveles|pisos|plantas)|(?:niveles|altura\s+m[áa]xima)\s*[:=]?\s*(\d+)/i);
        const frontMatch = text.match(/(?:frontal|frente)\s*(?:de\s*)?[:=]?\s*(\d+(?:\.\d+)?)\s*m/i);
        const sideMatch = text.match(/(?:lateral|perimetral|colindancia|posterior)\s*(?:de\s*)?[:=]?\s*(\d+(?:\.\d+)?)\s*m/i);
        result = {
          cos,
          cus: cusMatch ? parseFloat(cusMatch[1]) : 2.4,
          max_levels: lvlMatch ? parseInt(lvlMatch[1] || lvlMatch[2], 10) : 4,
          front_setback_m: frontMatch ? parseFloat(frontMatch[1]) : 3.0,
          side_setback_m: sideMatch ? parseFloat(sideMatch[1]) : 1.5,
        };
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Error parsing zoning text' }));
    }
    return;
  }

  // Conversor nativo de SketchUp (.skp) a GLB mediante openskp
  if (req.url.startsWith('/api/convert-skp') && req.method === 'POST') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    try {
      const skp = require('openskp');
      const skpFile = skp.openExisting(buffer);
      const scene = skp.buildScene(skpFile);
      const glb = skp.toGLB(scene);
      res.writeHead(200, {
        'Content-Type': 'model/gltf-binary',
        'Content-Disposition': 'attachment; filename="project.glb"',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(Buffer.from(glb));
    } catch (err) {
      console.error('Error al convertir SKP:', err);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No se pudo procesar el archivo .skp: ' + (err.message || 'formato o versión no soportada') }));
    }
    return;
  }

  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';

  let filePath = path.join(ROOT, 'public', reqPath);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    filePath = path.join(ROOT, reqPath);
  }

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
