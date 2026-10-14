export default async function handler(req, res) {
  const { q, lang = 'es' } = req.query;
  if (!q) return res.status(200).json([]);
  
  const targetUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&accept-language=${encodeURIComponent(lang)}&q=${encodeURIComponent(q)}`;
  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'ModelExportApp/1.0 (Vercel deployment; contact@modelexport.app)'
      }
    });
    const data = await response.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json([]);
  }
}
