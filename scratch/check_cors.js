async function checkCors() {
  const res = await fetch('https://overpass.openstreetmap.fr/api/interpreter', {
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://localhost:3000',
      'Access-Control-Request-Method': 'POST'
    }
  });
  console.log('OPTIONS status:', res.status);
  console.log('OPTIONS cors headers:', {
    'access-control-allow-origin': res.headers.get('access-control-allow-origin'),
    'access-control-allow-methods': res.headers.get('access-control-allow-methods')
  });

  const resPost = await fetch('https://overpass.openstreetmap.fr/api/interpreter', {
    method: 'POST',
    headers: {
      'Origin': 'http://localhost:3000',
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'data=[out:json];node(1);out;'
  });
  console.log('POST status:', resPost.status);
  console.log('POST cors headers:', {
    'access-control-allow-origin': resPost.headers.get('access-control-allow-origin')
  });
}
checkCors();
