// URBNZD — High-Resolution Textured 3D Model Compiler (.GLB & .DAE Collada)
// Embeds 1:1 UV-mapped Satellite Orthophoto (or active analysis layer) onto the 3D Terrain Mesh
// and maps seamless procedural Architectural Facades (curtain wall, residential, masonry) & Roofs onto 3D Buildings.

function canvasToPngBytes(canvas) {
  return new Promise((resolve, reject) => {
    if (canvas.convertToBlob) {
      canvas.convertToBlob({ type: 'image/png' }).then(async (blob) => {
        resolve(new Uint8Array(await blob.arrayBuffer()));
      }).catch(reject);
      return;
    }
    const c = document.createElement('canvas');
    c.width = canvas.width;
    c.height = canvas.height;
    c.getContext('2d').drawImage(canvas, 0, 0);
    c.toBlob(async (blob) => {
      if (!blob) return reject(new Error('Failed to encode PNG'));
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, 'image/png');
  });
}

/**
 * Extracts or synthesizes the high-resolution terrain surface texture (up to 2048x2048)
 * combining the Satellite Orthophoto (or active analysis/cover layer) with subtle topographic hillshading.
 */
export async function buildTerrainTexturePNG(pack, U) {
  const W = 2048, H = 2048;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');

  // Base warm terrain tone in case no satellite imagery is present
  ctx.fillStyle = '#d9d4c7';
  ctx.fillRect(0, 0, W, H);

  const satRaster = (pack.rasters || []).find((r) => r.key === 'satellite');
  const epochCanvas = U.epochList && U.epochList[U.epochIdx] && U.epochList[U.epochIdx].canvas;
  const srcSat = (satRaster && satRaster.canvas) || U.hdExport || U.hd || epochCanvas;

  if (srcSat) {
    ctx.drawImage(srcSat, 0, 0, W, H);
  } else if (U.coverTex && U.coverTex.canvas) {
    ctx.drawImage(U.coverTex.canvas, 0, 0, W, H);
  }

  // Blend subtle hillshade so 3D terrain relief reads crisply in any renderer
  const hsRaster = (pack.rasters || []).find((r) => r.key === 'hillshade');
  if (hsRaster && hsRaster.canvas) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = srcSat ? 0.28 : 0.55;
    ctx.drawImage(hsRaster.canvas, 0, 0, W, H);
    ctx.restore();
  }

  return await canvasToPngBytes(cv);
}

/**
 * Generates a 512x512 seamless repeating architectural facade texture.
 * 1 tile = 4 window bays wide (14.0 m) x 4 floors tall (12.8 m -> 3.2 m per floor).
 */
export async function buildFacadeTexturePNG(style) {
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext('2d');

  const bays = 4;
  const floors = 4;
  const bayW = S / bays;
  const floorH = S / floors;

  if (style === 'glass') {
    // Modern Curtain Wall (Commercial / Office / High-rise)
    ctx.fillStyle = '#1e2936';
    ctx.fillRect(0, 0, S, S);

    for (let f = 0; f < floors; f++) {
      const y0 = f * floorH;
      // Spandrel slab band
      ctx.fillStyle = '#141a22';
      ctx.fillRect(0, y0, S, 18);
      ctx.fillStyle = '#2c3947';
      ctx.fillRect(0, y0 + 16, S, 3);

      for (let b = 0; b < bays; b++) {
        const x0 = b * bayW;
        // Glazing panel with subtle sky/interior luminance gradient
        const grad = ctx.createLinearGradient(x0 + 6, y0 + 20, x0 + bayW - 6, y0 + floorH - 4);
        const lit = ((f * 3 + b * 5) % 7 === 0);
        if (lit) {
          grad.addColorStop(0, '#5a788f');
          grad.addColorStop(0.5, '#7c98ad');
          grad.addColorStop(1, '#435d73');
        } else {
          grad.addColorStop(0, '#2b4257');
          grad.addColorStop(0.5, '#3d5a73');
          grad.addColorStop(1, '#1f3142');
        }
        ctx.fillStyle = grad;
        ctx.fillRect(x0 + 5, y0 + 20, bayW - 10, floorH - 24);

        // Vertical aluminum mullion
        ctx.fillStyle = '#0f141a';
        ctx.fillRect(x0, y0, 5, floorH);
        ctx.fillRect(x0 + bayW - 5, y0, 5, floorH);
        // Sub-mullion
        ctx.fillStyle = 'rgba(15,20,26,0.65)';
        ctx.fillRect(x0 + bayW / 2 - 1, y0 + 18, 2, floorH - 18);
      }
    }
  } else if (style === 'masonry') {
    // Warm Architectural Brick / Terracotta / Historic Urban Facade
    ctx.fillStyle = '#b87d60';
    ctx.fillRect(0, 0, S, S);

    // Subtle horizontal brick coursing lines
    ctx.fillStyle = 'rgba(70,40,28,0.16)';
    for (let y = 0; y < S; y += 6) {
      ctx.fillRect(0, y, S, 1);
    }

    for (let f = 0; f < floors; f++) {
      const y0 = f * floorH;
      // Stone stringcourse band
      ctx.fillStyle = '#d8cec2';
      ctx.fillRect(0, y0, S, 8);
      ctx.fillStyle = '#8f624b';
      ctx.fillRect(0, y0 + 8, S, 3);

      for (let b = 0; b < bays; b++) {
        const x0 = b * bayW;
        const wx = x0 + 26;
        const wy = y0 + 24;
        const ww = bayW - 52;
        const wh = floorH - 42;

        // Stone lintel & sill
        ctx.fillStyle = '#dfd6ca';
        ctx.fillRect(wx - 4, wy - 7, ww + 8, 7);
        ctx.fillRect(wx - 5, wy + wh, ww + 10, 6);

        // Deep window recess
        ctx.fillStyle = '#1c242b';
        ctx.fillRect(wx, wy, ww, wh);

        // Window glass panes
        const warm = ((f + b) % 3 === 0);
        ctx.fillStyle = warm ? '#495866' : '#293542';
        ctx.fillRect(wx + 4, wy + 4, ww - 8, wh - 8);

        // White/cream wood sash frame & crossbars
        ctx.fillStyle = '#e8e2d8';
        ctx.fillRect(wx + 2, wy + 2, ww - 4, 3);
        ctx.fillRect(wx + 2, wy + wh - 5, ww - 4, 3);
        ctx.fillRect(wx + ww / 2 - 1.5, wy + 2, 3, wh - 4);
        ctx.fillRect(wx + 2, wy + wh * 0.42, ww - 4, 2.5);
      }
    }
  } else {
    // Contemporary Residential / Limestone Stucco & Apartments
    ctx.fillStyle = '#e3ded5';
    ctx.fillRect(0, 0, S, S);

    // Subtle architectural panel joints
    ctx.fillStyle = 'rgba(120,114,105,0.22)';
    for (let b = 0; b < bays; b++) {
      ctx.fillRect(b * bayW, 0, 2, S);
    }

    for (let f = 0; f < floors; f++) {
      const y0 = f * floorH;
      // Concrete floor slab edge
      ctx.fillStyle = '#c9c2b6';
      ctx.fillRect(0, y0, S, 10);
      ctx.fillStyle = '#a8a093';
      ctx.fillRect(0, y0 + 10, S, 2);

      for (let b = 0; b < bays; b++) {
        const x0 = b * bayW;
        const wx = x0 + 18;
        const wy = y0 + 20;
        const ww = bayW - 36;
        const wh = floorH - 30;

        // Dark charcoal aluminum frame
        ctx.fillStyle = '#25282c';
        ctx.fillRect(wx, wy, ww, wh);

        // Glass with blinds / reflection
        const shadeH = ((f * 2 + b) % 3 === 0) ? Math.round(wh * 0.35) : 0;
        ctx.fillStyle = '#384b5c';
        ctx.fillRect(wx + 4, wy + 4, ww - 8, wh - 8);
        if (shadeH > 0) {
          ctx.fillStyle = '#cfc8bc';
          ctx.fillRect(wx + 4, wy + 4, ww - 8, shadeH);
        }

        // Mullion division
        ctx.fillStyle = '#1e2024';
        ctx.fillRect(wx + ww * 0.62, wy, 4, wh);

        // Glass balustrade at bottom of window
        ctx.fillStyle = 'rgba(180,205,220,0.45)';
        ctx.fillRect(wx + 2, wy + wh - 22, ww - 4, 20);
        ctx.fillStyle = '#1e2024';
        ctx.fillRect(wx, wy + wh - 23, ww, 2.5);
      }
    }
  }

  return await canvasToPngBytes(cv);
}

/**
 * Generates a 512x512 seamless architectural roof texture (1 tile = 16m x 16m).
 */
export async function buildRoofTexturePNG() {
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext('2d');

  // Architectural warm grey membrane / concrete roof deck
  ctx.fillStyle = '#9e9a93';
  ctx.fillRect(0, 0, S, S);

  // Subtle gravel/paver grid
  ctx.strokeStyle = 'rgba(60,58,54,0.22)';
  ctx.lineWidth = 2;
  const step = 64;
  for (let i = 0; i <= S; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, S);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(S, i);
    ctx.stroke();
  }

  // Subtle tonal variation per slab panel
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const v = ((r * 7 + c * 13) % 5) - 2;
      ctx.fillStyle = v >= 0 ? `rgba(255,255,255,${v * 0.025})` : `rgba(0,0,0,${-v * 0.025})`;
      ctx.fillRect(c * step + 2, r * step + 2, step - 4, step - 4);
    }
  }

  return await canvasToPngBytes(cv);
}

/**
 * Collects all textured mesh buckets (positions, normals, uvs) in Y-up glTF coordinates (meters).
 */
function buildTexturedMeshBuckets(pack, U) {
  const stats = pack.grid ? pack.grid.stats() : { min: 0 };
  const zMin = Number(stats.min || 0);
  const w = U.area.w;
  const h = U.area.h;
  const elevAt = pack.elev || (() => zMin);

  const makeBucket = (name, texIndex, baseColorFactor = [1, 1, 1, 1], roughness = 0.75, metallic = 0.05) => ({
    name,
    texIndex,
    baseColorFactor,
    roughness,
    metallic,
    pos: [],
    norm: [],
    uv: [],
  });

  // Bucket 0: Terrain with Satellite HD Texture (texIndex = 0)
  const bTerrain = makeBucket('Terrain_Satellite_HD', 0, [1, 1, 1, 1], 0.88, 0.0);
  // Bucket 1: Commercial / Curtain Wall Facades (texIndex = 1)
  const bFacadeGlass = makeBucket('Buildings_CurtainWall_Facades', 1, [1, 1, 1, 1], 0.35, 0.35);
  // Bucket 2: Residential / Apartment Facades (texIndex = 2)
  const bFacadeRes = makeBucket('Buildings_Residential_Facades', 2, [1, 1, 1, 1], 0.65, 0.08);
  // Bucket 3: Masonry / Brick Urban Facades (texIndex = 3)
  const bFacadeMasonry = makeBucket('Buildings_Masonry_Facades', 3, [1, 1, 1, 1], 0.78, 0.05);
  // Bucket 4: Building Roofs (texIndex = 4)
  const bRoofs = makeBucket('Buildings_Roofs', 4, [1, 1, 1, 1], 0.8, 0.05);
  // Bucket 5: Roads & Plazas (untextured PBR asphalt)
  const bRoads = makeBucket('Roads_and_Paths', null, [0.22, 0.23, 0.25, 1], 0.85, 0.05);
  // Bucket 6: Water bodies (translucent water)
  const bWater = makeBucket('Water_Bodies', null, [0.25, 0.52, 0.72, 0.78], 0.15, 0.1);
  // Bucket 7: 3D Trees & Canopy (foliage green)
  const bTrees = makeBucket('Trees_3D', null, [0.36, 0.52, 0.31, 1], 0.85, 0.0);

  const pushTri = (bucket, p0, p1, p2, uv0, uv1, uv2) => {
    const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
    const vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    bucket.pos.push(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
    bucket.norm.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    bucket.uv.push(uv0[0], uv0[1], uv1[0], uv1[1], uv2[0], uv2[1]);
  };

  // 1. Terrain Mesh with 1:1 Satellite Orthophoto UVs
  const tm = pack.meshes && pack.meshes.terrain;
  if (tm && tm.P && tm.quads) {
    const P = tm.P;
    const Q = tm.quads;
    const vPos = (idx) => [P[3 * idx], P[3 * idx + 2] - zMin, P[3 * idx + 1]];
    const vUV = (idx) => [
      Math.max(0, Math.min(1, (P[3 * idx] + w / 2) / w)),
      Math.max(0, Math.min(1, (P[3 * idx + 1] + h / 2) / h)),
    ];
    for (let i = 0; i < Q.length; i += 4) {
      const i0 = Q[i], i1 = Q[i + 1], i2 = Q[i + 2], i3 = Q[i + 3];
      pushTri(bTerrain, vPos(i0), vPos(i3), vPos(i2), vUV(i0), vUV(i3), vUV(i2));
      pushTri(bTerrain, vPos(i0), vPos(i2), vPos(i1), vUV(i0), vUV(i2), vUV(i1));
    }
  }

  // 2. Buildings with Metric Architectural Facade UVs & Roof UVs
  const bm = pack.meshes && pack.meshes.buildings;
  if (Array.isArray(bm)) {
    const tileW = 14.0; // 4 bays * 3.5m
    const tileH = 12.8; // 4 floors * 3.2m
    for (let bIdx = 0; bIdx < bm.length; bIdx++) {
      const b = bm[bIdx];
      const Q = b.tris;
      if (!Q || Q.length < 9) continue;

      // Determine building style from height & attributes
      const hMeters = Number((b.attrs && b.attrs.height_m) || 8);
      const osmId = Number((b.attrs && b.attrs.osm_id) || bIdx);
      let wallBucket = bFacadeRes;
      if (hMeters >= 18 || (osmId % 5 === 0 && hMeters >= 10)) {
        wallBucket = bFacadeGlass;
      } else if (osmId % 3 === 0) {
        wallBucket = bFacadeMasonry;
      }

      // Find minimum Y (base elevation) of this building
      let bMinY = Infinity;
      for (let i = 1; i < Q.length; i += 3) {
        if (Q[i] < bMinY) bMinY = Q[i];
      }
      bMinY -= zMin;

      for (let i = 0; i < Q.length; i += 9) {
        // In Q: (x, elev, z_south) -> Y-up glTF is [x, elev - zMin, z_south]
        const p0 = [Q[i],     Q[i + 1] - zMin, Q[i + 2]];
        const p1 = [Q[i + 3], Q[i + 4] - zMin, Q[i + 5]];
        const p2 = [Q[i + 6], Q[i + 7] - zMin, Q[i + 8]];

        const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
        const vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
        const nx = uy * vz - uz * vy;
        const ny = uz * vx - ux * vz;
        const nz = ux * vy - uy * vx;
        const nLen = Math.hypot(nx, ny, nz) || 1;
        const absNy = Math.abs(ny / nLen);

        if (absNy < 0.45) {
          // Vertical Wall Facade: tangent along wall in XZ plane
          const tLen = Math.hypot(nx, nz) || 1;
          const tx = -nz / tLen;
          const tz = nx / tLen;
          const wallUV = (p) => [
            (p[0] * tx + p[2] * tz) / tileW,
            1.0 - (p[1] - bMinY) / tileH,
          ];
          pushTri(wallBucket, p0, p1, p2, wallUV(p0), wallUV(p1), wallUV(p2));
        } else {
          // Roof surface: planar UV in 16m tiles
          const roofUV = (p) => [p[0] / 16.0, p[2] / 16.0];
          pushTri(bRoofs, p0, p1, p2, roofUV(p0), roofUV(p1), roofUV(p2));
        }
      }
    }
  }

  // 3. Roads 3D Mesh
  const rm = pack.meshes && pack.meshes.roads;
  if (Array.isArray(rm)) {
    for (const item of rm) {
      const Q = item.tris;
      if (!Q) continue;
      for (let i = 0; i < Q.length; i += 9) {
        const p0 = [Q[i],     Q[i + 1] - zMin + 0.04, Q[i + 2]];
        const p1 = [Q[i + 3], Q[i + 4] - zMin + 0.04, Q[i + 5]];
        const p2 = [Q[i + 6], Q[i + 7] - zMin + 0.04, Q[i + 8]];
        pushTri(bRoads, p0, p1, p2, [0, 0], [1, 0], [0, 1]);
      }
    }
  }

  // 4. 3D Trees (Octahedral/Pyramidal crowns + trunks)
  const treeLayer = (pack.vectors || []).find((v) => v.key === 'trees');
  if (treeLayer && Array.isArray(treeLayer.items)) {
    for (const t of treeLayer.items.slice(0, 1200)) {
      const tx = t.x || 0;
      const tz = t.z || 0;
      const ty = elevAt(tx, tz) - zMin;
      const r = Math.max(1.2, (t.r || 2.5) * 0.8);
      const th = Math.max(3.0, t.h || 6.5);
      const yBase = ty + th * 0.25;
      const yMid = ty + th * 0.62;
      const yTop = ty + th;
      const top = [tx, yTop, tz];
      const bot = [tx, yBase, tz];
      const ring = [
        [tx + r, yMid, tz],
        [tx, yMid, tz - r],
        [tx - r, yMid, tz],
        [tx, yMid, tz + r],
      ];
      for (let k = 0; k < 4; k++) {
        const a = ring[k];
        const b = ring[(k + 1) % 4];
        pushTri(bTrees, a, b, top, [0, 0], [1, 0], [0.5, 1]);
        pushTri(bTrees, b, a, bot, [0, 0], [1, 0], [0.5, 0]);
      }
    }
  }

  return [bTerrain, bFacadeGlass, bFacadeRes, bFacadeMasonry, bRoofs, bRoads, bWater, bTrees].filter(
    (b) => b.pos.length > 0,
  );
}

/**
 * Compiles a self-contained binary glTF 2.0 (.glb) file with embedded PNG textures:
 * - Satellite HD texture mapped 1:1 on the 3D terrain
 * - 3 seamless architectural facade textures + roof texture mapped metrically on the 3D buildings
 */
export async function compileTexturedGLB(pack, U) {
  const [texTerrain, texGlass, texRes, texMasonry, texRoof] = await Promise.all([
    buildTerrainTexturePNG(pack, U),
    buildFacadeTexturePNG('glass'),
    buildFacadeTexturePNG('residential'),
    buildFacadeTexturePNG('masonry'),
    buildRoofTexturePNG(),
  ]);
  const texBytesList = [texTerrain, texGlass, texRes, texMasonry, texRoof];
  const buckets = buildTexturedMeshBuckets(pack, U);

  const bufferViews = [];
  const accessors = [];
  const images = [];
  const textures = [];
  const materials = [];
  const meshes = [];
  const nodes = [];
  const binChunks = [];
  let byteOffset = 0;

  const appendBin = (uint8) => {
    const pad = (4 - (uint8.byteLength % 4)) % 4;
    const viewIdx = bufferViews.length;
    bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: uint8.byteLength,
    });
    binChunks.push(uint8);
    if (pad > 0) binChunks.push(new Uint8Array(pad));
    byteOffset += uint8.byteLength + pad;
    return viewIdx;
  };

  // Sampler 0: CLAMP_TO_EDGE (for Terrain Satellite orthophoto)
  // Sampler 1: REPEAT (for seamless Building Facades & Roofs)
  const samplers = [
    { magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 },
    { magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 },
  ];

  for (let i = 0; i < texBytesList.length; i++) {
    const bv = appendBin(texBytesList[i]);
    images.push({ bufferView: bv, mimeType: 'image/png' });
    textures.push({ sampler: i === 0 ? 0 : 1, source: i });
  }

  for (const b of buckets) {
    const posArr = new Float32Array(b.pos);
    const normArr = new Float32Array(b.norm);
    const uvArr = new Float32Array(b.uv);
    const vCount = posArr.length / 3;

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let i = 0; i < posArr.length; i += 3) {
      const x = posArr[i], y = posArr[i + 1], z = posArr[i + 2];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }

    const posBV = appendBin(new Uint8Array(posArr.buffer));
    const normBV = appendBin(new Uint8Array(normArr.buffer));
    const uvBV = appendBin(new Uint8Array(uvArr.buffer));

    const posAcc = accessors.length;
    accessors.push({
      bufferView: posBV,
      componentType: 5126,
      count: vCount,
      type: 'VEC3',
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
    });

    const normAcc = accessors.length;
    accessors.push({
      bufferView: normBV,
      componentType: 5126,
      count: vCount,
      type: 'VEC3',
    });

    const uvAcc = accessors.length;
    accessors.push({
      bufferView: uvBV,
      componentType: 5126,
      count: vCount,
      type: 'VEC2',
    });

    const matIdx = materials.length;
    const pbr = {
      baseColorFactor: b.baseColorFactor,
      roughnessFactor: b.roughness,
      metallicFactor: b.metallic,
    };
    if (b.texIndex != null) {
      pbr.baseColorTexture = { index: b.texIndex };
    }
    materials.push({
      name: `Mat_${b.name}`,
      pbrMetallicRoughness: pbr,
      doubleSided: true,
    });

    const meshIdx = meshes.length;
    meshes.push({
      name: b.name,
      primitives: [
        {
          attributes: { POSITION: posAcc, NORMAL: normAcc, TEXCOORD_0: uvAcc },
          material: matIdx,
          mode: 4,
        },
      ],
    });

    nodes.push({ name: b.name, mesh: meshIdx });
  }

  const gltfJson = {
    asset: { version: '2.0', generator: 'URBNZD 3D Studio' },
    scene: 0,
    scenes: [{ name: 'URBNZD_Site_Model', nodes: nodes.map((_, i) => i) }],
    nodes,
    meshes,
    materials,
    textures,
    images,
    samplers,
    accessors,
    bufferViews,
    buffers: [{ byteLength: byteOffset }],
  };

  const jsonBytes = new TextEncoder().encode(JSON.stringify(gltfJson));
  const jsonPad = (4 - (jsonBytes.byteLength % 4)) % 4;
  const jsonChunkLen = jsonBytes.byteLength + jsonPad;
  const totalLen = 12 + 8 + jsonChunkLen + 8 + byteOffset;

  const out = new Uint8Array(totalLen);
  const dv = new DataView(out.buffer);
  // Header: magic "glTF", version 2, totalLength
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, totalLen, true);
  // Chunk 0: JSON
  dv.setUint32(12, jsonChunkLen, true);
  dv.setUint32(16, 0x4e4f534a, true);
  out.set(jsonBytes, 20);
  for (let i = 0; i < jsonPad; i++) out[20 + jsonBytes.byteLength + i] = 0x20;
  // Chunk 1: BIN
  const binStart = 20 + jsonChunkLen;
  dv.setUint32(binStart, byteOffset, true);
  dv.setUint32(binStart + 4, 0x004e4942, true);
  let cursor = binStart + 8;
  for (const chunk of binChunks) {
    out.set(chunk, cursor);
    cursor += chunk.byteLength;
  }

  return new Blob([out], { type: 'model/gltf-binary' });
}
