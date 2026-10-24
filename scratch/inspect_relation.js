const fetch = globalThis.fetch;
async function inspectRelation() {
  const coords = '39.856100,-104.673700,39.861000,-104.670000';
  const query = `[out:json][timeout:15];(
    way["building"](around:60,${coords});
    relation["building"](around:60,${coords});
    way["aeroway"="terminal"](around:60,${coords});
    relation["aeroway"="terminal"](around:60,${coords});
    node["natural"="tree"](around:60,${coords});
    way["landuse"="forest"](around:60,${coords});
    way["natural"="wood"](around:60,${coords});
  );out geom;`;

  const res = await fetch('https://overpass.openstreetmap.fr/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Urbanized/2.0 (architecture-cgm@urbnzd.app)'
    },
    body: 'data=' + encodeURIComponent(query)
  });
  const data = await res.json();
  console.log('Total elements:', data.elements.length);
  for (const el of data.elements) {
    console.log('el.type:', el.type, 'tags:', el.tags?.name || el.tags?.building || el.tags?.aeroway);
    if (el.type === 'relation') {
      console.log('relation members count:', el.members?.length);
      if (el.members?.[0]) {
        console.log('member[0] role:', el.members[0].role, 'type:', el.members[0].type, 'has geometry:', !!el.members[0].geometry, 'geom len:', el.members[0].geometry?.length);
      }
    }
  }
}
inspectRelation();
