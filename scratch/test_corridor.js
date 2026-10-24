async function testCorridorInterpolation() {
  // Henderson to Denver Airport line (from user screenshot: ~39.873, -104.85 to ~39.855, -104.68)
  const pA = [39.8730, -104.8500];
  const pB = [39.8550, -104.6800];

  // Interpolate along the segment every 75 meters
  // Total dist:
  const latDist = (pB[0] - pA[0]) * 111132;
  const lonDist = (pB[1] - pA[1]) * 111412 * Math.cos((pA[0] * Math.PI) / 180);
  const totalM = Math.hypot(latDist, lonDist);
  console.log('Total distance:', totalM, 'meters');

  const stepM = 80;
  const numSteps = Math.min(120, Math.max(2, Math.round(totalM / stepM)));
  const corridorPoints = [];
  for (let i = 0; i <= numSteps; i++) {
    const t = i / numSteps;
    const lat = pA[0] + t * (pB[0] - pA[0]);
    const lon = pA[1] + t * (pB[1] - pA[1]);
    corridorPoints.push(`${lat.toFixed(6)},${lon.toFixed(6)}`);
  }
  console.log('Interpolated corridor points count:', corridorPoints.length);

  const coords = corridorPoints.join(',');
  const query = `[out:json][timeout:15];(
    way["building"](around:60,${coords});
    relation["building"](around:60,${coords});
    way["aeroway"="terminal"](around:60,${coords});
    node["natural"="tree"](around:60,${coords});
    way["natural"="tree_row"](around:60,${coords});
    way["landuse"="forest"](around:60,${coords});
  );out geom;`;

  console.log('Querying /api/overpass with full interpolated corridor...');
  const t0 = Date.now();
  const res = await fetch('http://localhost:3000/api/overpass', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query)
  });
  console.log('Status:', res.status, 'in', Date.now() - t0, 'ms');
  const data = await res.json();
  console.log('Elements found along 7km corridor:', data.elements ? data.elements.length : 0);
  if (data.elements && data.elements.length > 0) {
    console.log('Sample elements:', data.elements.slice(0, 5).map(e => e.tags?.name || e.tags?.building || e.tags?.aeroway));
  }
}
testCorridorInterpolation().catch(console.error);
