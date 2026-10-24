const mirrors = [
  'https://overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

async function parallelOverpass(query) {
  const ctrls = mirrors.map(() => new AbortController());
  const attempt = async (url, idx) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Urbanized/2.0 (architecture-cgm@urbnzd.app)'
      },
      body: 'data=' + encodeURIComponent(query),
      signal: AbortSignal.any([ctrls[idx].signal, AbortSignal.timeout(6000)])
    });
    if (!res.ok) throw new Error(`${url} status ${res.status}`);
    const json = await res.json();
    return { url, json };
  };

  try {
    const winner = await Promise.any(mirrors.map(attempt));
    ctrls.forEach(c => c.abort());
    return winner;
  } catch (e) {
    ctrls.forEach(c => c.abort());
    throw e;
  }
}

async function testParallel() {
  const query = `[out:json][timeout:8];(
    way["building"](around:60,39.8561,-104.6737);
    relation["building"](around:60,39.8561,-104.6737);
  );out geom;`;

  const t0 = Date.now();
  try {
    const win = await parallelOverpass(query);
    console.log('Fastest mirror won:', win.url, 'in', Date.now() - t0, 'ms. Elements:', win.json.elements?.length);
  } catch (err) {
    console.error('All mirrors failed in', Date.now() - t0, 'ms:', err.message);
  }
}
testParallel();
