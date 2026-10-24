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

  // Precision Proxy for Overpass with proper User-Agent & failover mirrors (Zero CORS issues)
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

  // Real Authentication API for URBNZD
  if (req.url.startsWith('/api/auth')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    let body = '';
    for await (const chunk of req) body += chunk;
    let parsedBody = {};
    try {
      if (body) parsedBody = JSON.parse(body);
    } catch (e) {
      parsedBody = {};
    }

    const { registerUser, loginUser, manageWorkspace } = require('./lib/auth');

    if (req.url.startsWith('/api/auth/register') && req.method === 'POST') {
      const result = registerUser(parsedBody);
      res.writeHead(result.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (req.url.startsWith('/api/auth/login') && req.method === 'POST') {
      const result = loginUser(parsedBody);
      res.writeHead(result.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (req.url.startsWith('/api/auth/workspace') && req.method === 'POST') {
      const result = manageWorkspace(parsedBody);
      res.writeHead(result.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'URBNZD Auth Engine' }));
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

  // Compilador nativo de Modelo Urbano a archivo SketchUp (.skp) con Tags CGM Atelier y Materiales D5 Render
  if (req.url.startsWith('/api/export-skp') && req.method === 'POST') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    try {
      const payload = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}');
      const skp = require('openskp');
      const M2I = skp.METRES_TO_INCHES || 39.37007874015748;
      const toIn = (pt) => [pt[0] * M2I, pt[1] * M2I, (pt[2] || 0) * M2I];

      const builder = skp.create();

      // 1. Materiales Diferenciados Estándar CGM Atelier (Listos para D5 Render)
      const matMuroBlanco = builder.addMaterial('Mat_Muro_Blanco', [242, 242, 240, 255], 1.0);
      const matPisoPorcelanato = builder.addMaterial('Mat_Piso_Porcelanato', [230, 226, 218, 255], 1.0);
      const matAluminioNegro = builder.addMaterial('Mat_Aluminio_Negro', [25, 25, 28, 255], 1.0);
      const matCristalClaro = builder.addMaterial('Mat_Cristal_Claro', [140, 200, 230, 90], 0.35);
      const matMadera = builder.addMaterial('Mat_Madera', [155, 105, 65, 255], 1.0);

      // 2. Tags Estándar Obligatorios CGM Atelier
      const tagLosa = builder.addLayer('01_Losa_y_Pisos', { color: [230, 226, 218, 255] });
      const tagEstructura = builder.addLayer('02_Estructura_y_Nucleos', { color: [200, 200, 205, 255] });
      const tagMuros = builder.addLayer('03_Muros_Tablaroca_Interiores', { color: [242, 242, 240, 255] });
      const tagCanceleria = builder.addLayer('04_Canceleria_y_Mamparas_Cristal', { color: [140, 200, 230, 255] });
      const tagPlafones = builder.addLayer('05_Plafones_e_Iluminacion', { color: [220, 220, 220, 255] });
      const tagMobiliario = builder.addLayer('06_Mobiliario_y_Equipos', { color: [155, 105, 65, 255] });

      const addMeshFaces = (grp, mesh, matHandle) => {
        if (!mesh || !Array.isArray(mesh.verts) || !Array.isArray(mesh.faces)) return;
        const verts = mesh.verts;
        for (const f of mesh.faces) {
          const idx = Array.isArray(f) ? f : f.v;
          if (!idx || idx.length < 3) continue;
          const pts = [];
          for (let i = 0; i < idx.length; i++) {
            const v = verts[idx[i]];
            if (v) pts.push(toIn(v));
          }
          if (pts.length >= 3) {
            try { grp.addFace(pts, { material: matHandle, backMaterial: matHandle }); } catch (e) {}
          }
        }
      };

      // 3. Construcción en Grupos Aislados (Cero geometría suelta)
      if (payload.terrain && payload.terrain.verts?.length) {
        builder.addGroup((g) => {
          addMeshFaces(g, payload.terrain, matPisoPorcelanato);
        }, { name: 'Terreno_Topografico_DEM', layer: tagLosa, material: matPisoPorcelanato });
      }

      if (Array.isArray(payload.roadMeshes) && payload.roadMeshes.length) {
        builder.addGroup((g) => {
          for (const rm of payload.roadMeshes) addMeshFaces(g, rm, matAluminioNegro);
        }, { name: 'Vialidades_y_Banquetas', layer: tagLosa, material: matAluminioNegro });
      }

      if (Array.isArray(payload.water) && payload.water.length) {
        builder.addGroup((g) => {
          for (const w of payload.water) addMeshFaces(g, w, matCristalClaro);
        }, { name: 'Cuerpos_de_Agua', layer: tagCanceleria, material: matCristalClaro });
      }

      if (Array.isArray(payload.bridges) && payload.bridges.length) {
        builder.addGroup((g) => {
          for (const br of payload.bridges) addMeshFaces(g, br, matMuroBlanco);
        }, { name: 'Puentes_e_Infraestructura', layer: tagEstructura, material: matMuroBlanco });
      }

      if (Array.isArray(payload.buildings) && payload.buildings.length) {
        const bldgs = payload.buildings.slice(0, 1200);
        for (let i = 0; i < bldgs.length; i++) {
          const b = bldgs[i];
          const isGlass = b.cls === 'commercial' || b.cls === 'public';
          const mat = isGlass ? matCristalClaro : matMuroBlanco;
          const tag = isGlass ? tagCanceleria : tagEstructura;
          builder.addGroup((g) => {
            addMeshFaces(g, b, mat);
          }, { name: b.name || `Volumen_Edificio_${i + 1}`, layer: tag, material: mat });
        }
      }

      if (Array.isArray(payload.trees) && payload.trees.length) {
        const trees = payload.trees.slice(0, 400);
        builder.addGroup((g) => {
          for (const t of trees) {
            const x = t.x || 0, y = t.y || 0, z = t.z || 0;
            const r = Math.max(1.2, (t.r || 2.5) * 0.7);
            const h = Math.max(3.0, t.h || 6.0);
            const zTop = z + h;
            const zBase = z + h * 0.25;
            const p1 = toIn([x - r, y - r, zBase]);
            const p2 = toIn([x + r, y - r, zBase]);
            const p3 = toIn([x + r, y + r, zBase]);
            const p4 = toIn([x - r, y + r, zBase]);
            const top = toIn([x, y, zTop]);
            try {
              g.addFace([p1, p2, top], { material: matMadera });
              g.addFace([p2, p3, top], { material: matMadera });
              g.addFace([p3, p4, top], { material: matMadera });
              g.addFace([p4, p1, top], { material: matMadera });
            } catch (e) {}
          }
        }, { name: 'Vegetacion_y_Arbolado', layer: tagMobiliario, material: matMadera });
      }

      const skpBytes = builder.toBytes();
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="Proyecto_URBNZD_CGM.skp"',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(Buffer.from(skpBytes));
    } catch (err) {
      console.error('Error compilando SKP nativo:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Error al compilar .skp: ' + (err.message || String(err)) }));
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
