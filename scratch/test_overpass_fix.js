const OVERPASS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

async function testOverpass() {
  const coords = '39.856100,-104.673700,39.861000,-104.670000';
  const radius = 50;
  const query = `[out:json][timeout:15];(
    way["building"](around:${radius},${coords});
    relation["building"](around:${radius},${coords});
    way["aeroway"="terminal"](around:${radius},${coords});
    node["natural"="tree"](around:${radius},${coords});
    way["landuse"="forest"](around:${radius},${coords});
    way["natural"="wood"](around:${radius},${coords});
  );out geom;`;

  for (const url of OVERPASS) {
    try {
      const t0 = Date.now();
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Urbanized/2.0 (architecture-cgm@urbnzd.app)'
        },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      console.log(url, 'SUCCESS in', Date.now() - t0, 'ms. Elements:', data.elements ? data.elements.length : 0);
      if (data.elements && data.elements.length > 0) {
        console.log('Sample types:', data.elements.slice(0, 5).map(e => ({ type: e.type, tags: e.tags })));
      }
      return;
    } catch (e) {
      console.log(url, 'FAILED:', e.message);
    }
  }
}
testOverpass();
