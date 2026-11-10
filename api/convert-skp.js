module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    const skp = require('openskp');
    let glbBytes;
    try {
      const instanced = skp.buildInstancedScene(buffer, { respectEdgeVisibility: true });
      glbBytes = skp.toInstancedGLB(instanced, { textures: true });
    } catch {
      const skpFile = skp.openExisting ? skp.openExisting(buffer) : buffer;
      const scene = skp.buildScene(skpFile, { respectEdgeVisibility: true });
      glbBytes = skp.toGLB(scene, { textures: false });
    }

    res.setHeader('Content-Type', 'model/gltf-binary');
    res.setHeader('Content-Disposition', 'attachment; filename="converted.glb"');
    res.status(200).send(Buffer.from(glbBytes));
  } catch (err) {
    console.error('Error converting SKP:', err);
    res.status(400).json({
      error: 'Error al procesar archivo .skp: ' + (err.message || String(err)),
    });
  }
};
