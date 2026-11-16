const skp = require('openskp');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
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
          if (v && Number.isFinite(v[0]) && Number.isFinite(v[1])) {
            pts.push(toIn(v));
          }
        }
        if (pts.length >= 3) {
          try {
            grp.addFace(pts, { material: matHandle, backMaterial: matHandle });
          } catch (e) {}
        }
      }
    };

    // 3. Terreno Topográfico DEM
    if (payload.terrain && payload.terrain.verts?.length) {
      builder.addGroup((g) => {
        addMeshFaces(g, payload.terrain, matPisoPorcelanato);
      }, { name: 'Terreno_Topografico_DEM', layer: tagLosa, material: matPisoPorcelanato });
    }

    // 4. Vialidades y Banquetas
    if (Array.isArray(payload.roadMeshes) && payload.roadMeshes.length) {
      builder.addGroup((g) => {
        for (const rm of payload.roadMeshes) addMeshFaces(g, rm, matAluminioNegro);
      }, { name: 'Vialidades_y_Banquetas', layer: tagLosa, material: matAluminioNegro });
    }

    // 5. Cuerpos de Agua
    if (Array.isArray(payload.water) && payload.water.length) {
      builder.addGroup((g) => {
        for (const w of payload.water) addMeshFaces(g, w, matCristalClaro);
      }, { name: 'Cuerpos_de_Agua', layer: tagCanceleria, material: matCristalClaro });
    }

    // 6. Puentes e Infraestructura
    if (Array.isArray(payload.bridges) && payload.bridges.length) {
      builder.addGroup((g) => {
        for (const br of payload.bridges) addMeshFaces(g, br, matMuroBlanco);
      }, { name: 'Puentes_e_Infraestructura', layer: tagEstructura, material: matMuroBlanco });
    }

    // 7. Volúmenes Edificados (Agrupación individual con Tags)
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

    // 8. Vegetación y Arbolado (Mobiliario)
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
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="Proyecto_URBNZD_CGM.skp"');
    return res.status(200).send(Buffer.from(skpBytes));
  } catch (err) {
    console.error('Error compilando SKP en Vercel:', err);
    return res.status(500).json({ error: 'Fallo al compilar archivo .skp', details: String(err) });
  }
}
