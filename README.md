# Urban Export (Versión Desbloqueada y Libre)

Réplica 100% funcional, autónoma y sin límites de [urban-export.ildar.space](https://urban-export.ildar.space/). Genera modelos 3D de ciudades, mapas vectoriales, cortes de terreno y exportaciones CAD/BIM de cualquier lugar del mundo.

---

## 🚀 Características Desbloqueadas

- **Sin pagos ni límites diarios**: Cuotas eliminadas. Descargas ilimitadas para siempre.
- **Sin cuentas ni registro**: Todo el procesamiento se realiza en el navegador (Client-Side).
- **Áreas ampliadas**: Tamaño de cuadrícula expandido (hasta más de 3.5 km).
- **Multi-idioma**: Soporte completo en Español, Inglés y otros 6 idiomas.

---

## 🛠️ Formatos de Exportación Incluidos

1. **AutoCAD (.dxf)**: Geometría 3D con mallas 3DFACE y polilíneas en capas estructuradas (`BUILDINGS_RESIDENTIAL`, `ROADS`, `TERRAIN_3DFACE`, `CONTOURS`).
2. **SketchUp (.dae)**: Formato Collada con materiales, escenas y entidades listas para editar.
3. **Rhino 5+ (.3dm)**: Generación directa con WebAssembly (`rhino3dm`). Los edificios rectangulares se exportan como **sólidos NURBS de extrusión reales** y los árboles como definiciones de bloques (`InstanceDefinition`).
4. **Illustrator (.svg)**: Vectorial limpio con capas agrupadas.
5. **ArchiCAD / Revit (.ifc)**: Archivo estándar IFC 2x3 con georreferenciación y entidades `IfcSite`, `IfcBuilding`, `IfcBuildingElementProxy`.
6. **Autodesk FBX (.fbx)**: Compatible con Blender, Unreal Engine, Unity y 3ds Max.
7. **Impresión 3D (.stl)**: Malla estanca (watertight) con faldón y base sólida cerrada a escala (1:500, 1:1000, 1:2000).
8. **Satélite (.jpg)**: Mosaico satelital de alta resolución alineado con la cuadrícula.

---

## 🎨 Editores Integrados

- **Ilustración Vectorial (Axonometría / Perspectiva)**: Vistas Isométricas (SO, SE, NE, NO), Cenital y Ojo de Peatón; estilos Flat, Línea y Monocromo; paletas de color editables y etiquetas de texto.
- **Mapa Vectorial 2D**: Presets Clásico, Figura-Fondo, Relieve, Nocturno y Blueprint; cálculo dinámico de sombras solares según acimut y altitud; sombreado de relieve (hillshade), mapa de profundidad hipsométrica, escala gráfica y rosa de los vientos.
- **Sección Arquitectónica**: Dibuja una línea de corte en el mapa (hasta 20 km); muestreo de perfil altimétrico con suavizado gaussiano; corte de edificios y masas de agua; exageración vertical ($\times 1, \times 2, \times 5$).

---

## 🌐 Fuentes de Datos (100% Públicas y Gratuitas)

- **Vectorial Urbano**: OpenStreetMap mediante múltiples servidores Overpass API (con selección automática por latencia).
- **Respaldo y Relleno de Huellas**: Overture Maps Foundation mediante lectura directa de archivos PMTiles en AWS S3 vía HTTP Range Requests.
- **Relieve y DEM**: Mapterhorn (mosaicos WebP Terrarium con resolución GLO-30 y LiDAR nacional de alta resolución).
- **Imágenes Satelitales**: Esri World Imagery.
- **Geocodificación**: Nominatim OSM.
- **Detección de Árboles**: Algoritmo de visión por computador en Canvas 2D utilizando el índice ExG (Excess Green), filtrado por desviación estándar de textura con imágenes integrales y transformada de distancia de Chamfer.

---

## 💻 Cómo Ejecutar en Local

1. Asegúrate de tener [Node.js](https://nodejs.org/) instalado.
2. Abre una terminal en esta carpeta y ejecuta:
   ```bash
   node server.js
   ```
3. Abre tu navegador en [http://localhost:3000](http://localhost:3000).

---

## ☁️ Cómo Desplegar Gratis en la Nube

Como la aplicación funciona al 100% en el cliente, puedes subirla a cualquier plataforma de hosting estático:
- **Cloudflare Pages**: Conectar repositorio o arrastrar la carpeta.
- **Vercel**: `vercel deploy` o importar desde GitHub.
- **Netlify**: Arrastrar la carpeta al dashboard de Netlify Drop.
- **GitHub Pages**: Habilitar en la pestaña *Settings > Pages* de tu repositorio.
