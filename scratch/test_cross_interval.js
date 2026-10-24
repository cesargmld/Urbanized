const fs = require('fs');

async function testSectionProcessing() {
  const query = `[out:json][timeout:12];(
    relation["aeroway"="terminal"](around:50,39.856100,-104.673700,39.861000,-104.670000);
  );out geom;`;

  const res = await fetch('http://localhost:3000/api/overpass', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query)
  });
  const osm = await res.json();
  const el = osm.elements[0];
  console.log('Element tags:', el.tags);
  console.log('Members count:', el.members.length);
  for (const m of el.members) {
    console.log('Member type:', m.type, 'role:', m.role, 'geom length:', m.geometry ? m.geometry.length : 'none');
  }

  // Points along the cut line
  const points = [[39.8561, -104.6737], [39.8610, -104.6700]];
  const mid = points[0];
  const phi = (mid[0] * Math.PI) / 180;
  const m = {
    lat: 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi),
    lon: 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi),
  };
  const toLocal = ([lat, lon]) => [(lon - mid[1]) * m.lon, (lat - mid[0]) * m.lat];

  // Path
  let d = 0;
  const path = [];
  for (let i = 0; i < points.length; i++) {
    const [x, y] = toLocal(points[i]);
    if (i > 0) d += Math.hypot(x - path[i - 1].x, y - path[i - 1].y);
    path.push({ x, y, d, lat: points[i][0], lon: points[i][1] });
  }

  function crossIntervals(poly, path) {
    const hits = [];
    for (let s = 0; s < path.length - 1; s++) {
      const a = path[s], b = path[s + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length];
        const ex = q[0] - p[0], ey = q[1] - p[1];
        const den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-12) continue;
        const t = ((p[0] - a.x) * ey - (p[1] - a.y) * ex) / den;
        const u = ((p[0] - a.x) * dy - (p[1] - a.y) * dx) / den;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) hits.push(a.d + t * (b.d - a.d));
      }
    }
    hits.sort((a, b) => a - b);
    const inside = ([x, y]) => {
      let c = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    const at = (d) => {
      for (let s = 0; s < path.length - 1; s++) {
        const a = path[s], b = path[s + 1];
        if (d >= a.d && d <= b.d) {
          const t = (d - a.d) / (b.d - a.d || 1);
          return [a.x + t * (b.x - a.x), a.y + t * (b.y - a.y)];
        }
      }
      return [path.at(-1).x, path.at(-1).y];
    };
    const spans = [];
    const bounds = [0, ...hits, path.at(-1).d];
    for (let i = 0; i < bounds.length - 1; i++) {
      const d0 = bounds[i], d1 = bounds[i + 1];
      if (d1 - d0 < 0.3) continue;
      if (inside(at((d0 + d1) / 2))) spans.push([d0, d1]);
    }
    return spans;
  }

  for (const mem of el.members) {
    if (mem.geometry) {
      const poly = mem.geometry.map(g => toLocal([g.lat, g.lon]));
      const spans = crossIntervals(poly, path);
      console.log('Member role:', mem.role, 'points:', poly.length, 'spans:', spans);
    }
  }
}
testSectionProcessing().catch(console.error);
