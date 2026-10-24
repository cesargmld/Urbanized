const fs = require('fs');
let code = fs.readFileSync('public/js/exporters.js', 'utf8');

const addition = `/* ---------------- SketchUp Nativo (.skp) con Tags CGM Atelier & Materiales D5 Render ---------------- */
export async function toSKP(model) {
  const payload = {
    terrain: model.terrain ? { verts: model.terrain.verts, faces: model.terrain.faces } : null,
    roadMeshes: (model.roadMeshes || []).map((rm) => ({ layer: rm.layer, verts: rm.verts, faces: rm.faces })),
    water: (model.water || []).map((w) => ({ verts: w.verts, faces: w.faces })),
    bridges: (model.bridges || []).map((br) => ({ verts: br.verts, faces: br.faces })),
    buildings: (model.buildings || []).map((b) => ({ name: b.name, cls: b.cls, verts: b.verts, faces: b.faces })),
    trees: (model.trees || []).map((t) => ({ x: t.x, y: t.y, z: t.z, r: t.r, h: t.h })),
  };
  const res = await fetch('/api/export-skp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Error compilando archivo nativo .skp');
  return await res.blob();
}

/* ---------------- Wavefront OBJ ---------------- */
export function toOBJ(model) {
  const lines = ['# Urbanized 3D Export (.obj) - Units: Meters'];
  let vOffset = 1;
  const writeMesh = (name, mesh) => {
    if (!mesh || !mesh.verts?.length || !mesh.faces?.length) return;
    lines.push('o ' + name);
    for (const [x, y, z] of mesh.verts) {
      lines.push('v ' + f(x) + ' ' + f(z || 0) + ' ' + f(-y));
    }
    for (const fc of mesh.faces) {
      const idx = Array.isArray(fc) ? fc : fc.v;
      if (idx && idx.length >= 3) {
        lines.push('f ' + idx.map((i) => i + vOffset).join(' '));
      }
    }
    vOffset += mesh.verts.length;
  };
  if (model.terrain) writeMesh('01_Losa_y_Pisos_Terreno', model.terrain);
  for (let i = 0; i < (model.buildings || []).length; i++) {
    writeMesh('02_Estructura_Edificio_' + (i + 1), model.buildings[i]);
  }
  return new Blob([lines.join('\\n')], { type: 'text/plain' });
}

/* ---------------- Proyecto Nativo .urbnz ---------------- */
export function toURBNZ(model) {
  const data = {
    version: '6.0',
    app: 'URBNZD Studio',
    createdAt: new Date().toISOString(),
    center: model.center,
    size: model.size,
    shape: model.shape,
    stats: {
      buildings: (model.buildings || []).length,
      trees: (model.trees || []).length,
    },
    model,
  };
  return new Blob([JSON.stringify(data)], { type: 'application/json' });
}

export const FORMATS = {
  skp: { label: 'SketchUp Nativo', ext: 'skp', make: toSKP },
  dxf: { label: 'AutoCAD', ext: 'dxf', make: toDXF },
  obj: { label: 'Wavefront OBJ', ext: 'obj', make: toOBJ },
  urbnz: { label: 'URBNZD Project', ext: 'urbnz', make: toURBNZ },`;

code = code.replace(/export const FORMATS = \{\r?\n\s*dxf: \{ label: 'AutoCAD', ext: 'dxf', make: toDXF \},/, addition);
fs.writeFileSync('public/js/exporters.js', code, 'utf8');
console.log('Successfully updated exporters.js');
