async function testApiOverpass() {
  const query = `[out:json][timeout:12];(
    way["building"](around:50,39.856100,-104.673700,39.861000,-104.670000);
    relation["building"](around:50,39.856100,-104.673700,39.861000,-104.670000);
    way["aeroway"="terminal"](around:50,39.856100,-104.673700,39.861000,-104.670000);
    relation["aeroway"="terminal"](around:50,39.856100,-104.673700,39.861000,-104.670000);
    node["natural"="tree"](around:50,39.856100,-104.673700,39.861000,-104.670000);
  );out geom;`;

  const res = await fetch('http://localhost:3000/api/overpass', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query)
  });
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Elements count:', data.elements ? data.elements.length : 0);
  if (data.elements && data.elements.length > 0) {
    console.log('First element:', data.elements[0].tags);
  }
}
testApiOverpass().catch(console.error);
