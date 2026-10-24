const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const htmlPath = path.join(repoDir, 'public', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// Replace verbose headers
html = html.replace('Pila de Capas & Opacidad Independiente', 'Capas del Plano');
html = html.replace('Pila de Capas Axonométricas', 'Capas Axonométricas');
html = html.replace('PILA DE CAPAS & OPACIDAD INDEPENDIENTE', 'CAPAS DEL PLANO');

fs.writeFileSync(htmlPath, html, 'utf8');
console.log('✓ Cleaned up drawer headers');
