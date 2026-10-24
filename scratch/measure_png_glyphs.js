const fs = require('fs');

// Read the PNG and check non-transparent bounding box
// We can use a simple node script to scan the PNG buffer using zlib to decompress IDAT!
const zlib = require('zlib');

const buf = fs.readFileSync('public/assets/urbnzd-logo.png');
let pos = 8;
let width = 0, height = 0;
const idatChunks = [];

while (pos < buf.length) {
  const len = buf.readUInt32BE(pos);
  const type = buf.toString('ascii', pos + 4, pos + 8);
  if (type === 'IHDR') {
    width = buf.readUInt32BE(pos + 8);
    height = buf.readUInt32BE(pos + 12);
  } else if (type === 'IDAT') {
    idatChunks.push(buf.slice(pos + 8, pos + 8 + len));
  }
  pos += 12 + len;
}

const compressed = Buffer.concat(idatChunks);
zlib.inflate(compressed, (err, raw) => {
  if (err) {
    console.error(err);
    return;
  }
  // raw has filter byte + RGBA for each line
  const bpp = 4;
  const stride = 1 + width * bpp;
  console.log('Decompressed raw data size:', raw.length, 'expected:', height * stride);

  // Let's reconstruct lines (handling filter 0 or sub/up/etc)
  // Let's just find columns where alpha > 20
  const colAlpha = new Array(width).fill(0);
  for (let y = 0; y < height; y++) {
    const lineStart = y * stride + 1;
    for (let x = 0; x < width; x++) {
      const a = raw[lineStart + x * 4 + 3]; // approx if not heavily filtered
      if (a > 30) colAlpha[x]++;
    }
  }

  // Find column ranges with alpha
  let inGlyph = false;
  let startX = 0;
  const ranges = [];
  for (let x = 0; x < width; x++) {
    if (colAlpha[x] > 0 && !inGlyph) {
      inGlyph = true;
      startX = x;
    } else if (colAlpha[x] === 0 && inGlyph) {
      inGlyph = false;
      ranges.push([startX, x - 1]);
    }
  }
  if (inGlyph) ranges.push([startX, width - 1]);
  console.log('Column ranges with content (Globe and letters):', ranges);
});
