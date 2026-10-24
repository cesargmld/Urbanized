async function testSamplePoints() {
  const pA = [39.8730, -104.8500];
  const pB = [39.8550, -104.6800];

  // 15 sampled points along the line
  const steps = 15;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lat = pA[0] + t * (pB[0] - pA[0]);
    const lon = pA[1] + t * (pB[1] - pA[1]);
    pts.push(`${lat.toFixed(6)},${lon.toFixed(6)}`);
  }
  const coords = pts.join(',');
  const query = `[out:json][timeout:8];(
    way["building"](around:120,${coords});
    relation["building"](around:120,${coords});
    way["aeroway"="terminal"](around:120,${coords});
    node["natural"="tree"](around:120,${coords});
    way["landuse"="forest"](around:120,${coords});
  );out geom;`;

  const t0 = Date.now();
  const res = await fetch('http://localhost:3000/api/overpass', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query)
  });
  console.log('Sampled 16 points status:', res.status, 'in', Date.now() - t0, 'ms');
  const data = await res.json();
  console.log('Elements found:', data.elements ? data.elements.length : 0);
  if (data.elements && data.elements.length > 0) {
    console.log('Sample tags:', data.elements.slice(0, 5).map(e => ({ name: e.tags?.name, type: e.type, bldg: e.tags?.building, aero: e.tags?.aeroway, nat: e.tags?.natural })));
  }
}
testSamplePoints().catch(console.error);
