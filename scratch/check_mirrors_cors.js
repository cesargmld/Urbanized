const mirrors = [
  'https://overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter'
];

async function checkMirrors() {
  const query = '[out:json][timeout:10];(way["building"](around:50,39.8561,-104.6737););out geom;';
  for (const url of mirrors) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Origin': 'http://localhost:3000' },
        body: 'data=' + encodeURIComponent(query)
      });
      console.log(url, 'Status:', res.status, 'CORS:', res.headers.get('access-control-allow-origin'));
    } catch (e) {
      console.log(url, 'ERR:', e.message);
    }
  }
}
checkMirrors();
