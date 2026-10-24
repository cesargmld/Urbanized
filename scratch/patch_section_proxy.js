const fs = require('fs');
let code = fs.readFileSync('public/js/section.js', 'utf8');

// Update OVERPASS list to use /api/overpass first (local Node proxy with full User-Agent & failover)
const oldOverpassHead = code.slice(code.indexOf('const OVERPASS ='), code.indexOf('const metersPerDeg ='));
const newOverpassHead = `const OVERPASS = [
  '/api/overpass',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

`;

code = code.replace(oldOverpassHead, newOverpassHead);

// Also in fetchAlong:
// Use standard POST without unsafe browser headers (the proxy adds User-Agent automatically)
const oldAttemptStart = code.indexOf('  const attempt = async (url) => {');
const oldAttemptEnd = code.indexOf('  try {\n    return await Promise.any(OVERPASS.map(attempt));');
const oldAttempt = code.slice(oldAttemptStart, oldAttemptEnd);

const newAttempt = `  const attempt = async (url) => {
    const isProxy = url.startsWith('/');
    const res = await fetch(url, {
      method: 'POST',
      headers: isProxy ? { 'Content-Type': 'application/x-www-form-urlencoded' } : undefined,
      body: 'data=' + encodeURIComponent(query),
      signal: AbortSignal.any([AbortSignal.timeout(8000), ...(signal ? [signal] : [])]),
    });
    if (!res.ok) throw new Error(\`Overpass \${res.status}\`);
    return res.json();
  };
`;

code = code.replace(oldAttempt, newAttempt);

fs.writeFileSync('public/js/section.js', code, 'utf8');
console.log('public/js/section.js successfully updated with /api/overpass proxy priority!');
