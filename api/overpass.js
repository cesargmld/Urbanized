export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let query = '';
  if (req.method === 'POST') {
    const body = req.body;
    if (typeof body === 'string') {
      if (body.startsWith('data=')) {
        try {
          query = decodeURIComponent(body.slice(5).replace(/\+/g, ' '));
        } catch (e) {
          query = body.slice(5);
        }
      } else {
        try {
          const parsed = JSON.parse(body);
          query = parsed.data || parsed.query || body;
        } catch (e) {
          query = body;
        }
      }
    } else if (body && typeof body === 'object') {
      query = body.data || body.query || '';
    }
  } else if (req.query && req.query.data) {
    query = req.query.data;
  }

  const mirrors = [
    'https://overpass.openstreetmap.fr/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ];

  const fetchMirror = async (url) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'Urbanized/2.0 (Architecture Studio)',
        },
        body: 'data=' + encodeURIComponent(query),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`Mirror ${url} responded with ${response.status}`);
      const text = await response.text();
      if (!text || text.includes('runtime error') || text.includes('quota exceeded')) {
        throw new Error(`Mirror ${url} returned error content`);
      }
      return text;
    } catch (e) {
      clearTimeout(timeout);
      throw e;
    }
  };

  try {
    const fastestResult = await Promise.any(mirrors.map(m => fetchMirror(m)));
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(fastestResult);
  } catch (err) {
    console.error('All Overpass mirrors failed in Vercel API:', err);
    return res.status(502).json({ error: 'Overpass mirrors unreachable', details: String(err) });
  }
}
