const { registerUser, loginUser, manageWorkspace } = require('../lib/auth');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Parse body if needed
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      body = {};
    }
  } else if (!body && req.method === 'POST') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    try {
      body = JSON.parse(raw || '{}');
    } catch (e) {
      body = {};
    }
  }

  const action = req.query.action || (body && body.action) || (req.url.includes('/register') ? 'register' : req.url.includes('/login') ? 'login' : 'status');

  if (action === 'register') {
    const result = registerUser(body || {});
    res.status(result.status).json(result);
    return;
  }

  if (action === 'login') {
    const result = loginUser(body || {});
    res.status(result.status).json(result);
    return;
  }

  if (action === 'workspace') {
    const result = manageWorkspace(body || {});
    res.status(result.status).json(result);
    return;
  }

  res.status(200).json({ ok: true, message: 'URBNZD Auth Service Active' });
};
