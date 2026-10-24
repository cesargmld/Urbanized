const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const htmlPath = path.join(repoDir, 'public', 'index.html');
const previewPath = path.join(repoDir, 'public', 'js', 'preview.js');

let html = fs.readFileSync(htmlPath, 'utf8');
let preview = fs.readFileSync(previewPath, 'utf8');

// 1. Fix preview.js setBuildingFinish: normalize white/mono and stipple/hatch, and attach to window
const targetFinish = `export function setBuildingFinish(finish) {
  if (finish) studioState.buildings.finish = finish;
  if (!ctx || !ctx.lastModel) return;
  showModel(null, ctx.lastModel, { keepCamera: true, chunkMode: chunkModeActive });
}`;

const replaceFinish = `export function setBuildingFinish(finish) {
  if (finish === 'stipple' || finish === 'hatch') finish = 'hatch';
  else if (finish === 'white' || finish === 'mono') finish = 'mono';
  else if (finish === 'blueprint') finish = 'blueprint';
  else if (finish === 'gis') finish = 'gis';
  if (finish) studioState.buildings.finish = finish;
  if (!ctx || !ctx.lastModel) return;
  showModel(null, ctx.lastModel, { keepCamera: true, chunkMode: chunkModeActive });
}
window.setBuildingFinish = setBuildingFinish;`;

if (preview.includes(targetFinish)) {
  preview = preview.replace(targetFinish, replaceFinish);
  console.log('✓ Normalized setBuildingFinish and exposed to window in preview.js');
} else {
  console.log('Target setBuildingFinish not found directly, checking variations...');
  if (!preview.includes('window.setBuildingFinish = setBuildingFinish')) {
    preview = preview.replace(/export function setBuildingFinish\(finish\) \{[\s\S]*?showModel\(null, ctx\.lastModel, \{ keepCamera: true, chunkMode: chunkModeActive \}\);\s*\}/, replaceFinish);
    console.log('✓ Regex replaced setBuildingFinish in preview.js');
  }
}
fs.writeFileSync(previewPath, preview, 'utf8');

// 2. Now let's check what needs to be inserted/updated in public/index.html
// We will replace the composition update logic and add the new comprehensive handlers.

const startUpdateMarker = 'function updateCompositorSheetView() {';
const endUpdateMarker = 'function exportCompositeSheet4K() {';

const startIdx = html.indexOf(startUpdateMarker);
const endIdx = html.indexOf(endUpdateMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('Markers for updateCompositorSheetView not found!');
  process.exit(1);
}

const newCompositionLogic = `
    let activeCompPickerVpIdx = 0;

    // Open scene picker modal for a specific viewport block
    function openCompPickerForViewport(vpIdx) {
      activeCompPickerVpIdx = vpIdx;
      const modal = document.getElementById('modal-comp-pick-scene');
      if (!modal) return;

      const scenesList = document.getElementById('comp-picker-scenes-list');
      if (scenesList) {
        const views = viewsManager.getViews();
        if (!views.length) {
          scenesList.innerHTML = '<span style="color:#71717a; font-size:11px; padding:8px;">No hay escenas guardadas aún. Usa los botones rápidos de arriba para capturar en vivo o guarda una escena desde el modelo.</span>';
        } else {
          scenesList.innerHTML = views.map(v => {
            const thumbHtml = v.thumbnail 
              ? '<img src="' + v.thumbnail + '" style="width:52px; height:36px; object-fit:cover; border-radius:3px; border:1px solid rgba(255,255,255,0.12);" alt="">'
              : '<div style="width:52px; height:36px; background:#27272a; border-radius:3px; display:flex; align-items:center; justify-content:center; color:#71717a; font-size:10px;">' + (v.mode === 'result' ? '3D' : v.mode === 'mapper' ? '2D' : 'AXO') + '</div>';
            return '<div style="display:flex; align-items:center; justify-content:space-between; padding:8px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:4px; gap:10px;">' +
              '<div style="display:flex; align-items:center; gap:8px; overflow:hidden;">' +
                thumbHtml +
                '<div style="overflow:hidden;">' +
                  '<div style="font-size:11.5px; font-weight:600; color:#f4f4f6; white-space:nowrap; text-overflow:ellipsis; overflow:hidden;">' + v.name + '</div>' +
                  '<div style="font-size:9.5px; color:#71717a;">' + (v.mode === 'result' ? 'Modelo 3D' : v.mode === 'mapper' ? 'Cartografía 2D' : 'Axonometría') + ' · ' + new Date(v.createdAt).toLocaleDateString() + '</div>' +
                '</div>' +
              '</div>' +
              '<button type="button" class="axiom-subtle-btn btn-assign-saved-scene" data-scene-id="' + v.id + '" style="font-size:10px; padding:4px 10px; flex:none; background:#38bdf8; color:#000; font-weight:700;">Asignar</button>' +
            '</div>';
          }).join('');

          scenesList.querySelectorAll('.btn-assign-saved-scene').forEach(btn => {
            btn.addEventListener('click', () => {
              const sId = btn.getAttribute('data-scene-id');
              const v = views.find(item => item.id === sId);
              if (v) {
                const page = sheetPages[activeSheetPageIndex];
                if (page.viewports[activeCompPickerVpIdx]) {
                  page.viewports[activeCompPickerVpIdx].sceneId = v.id;
                  page.viewports[activeCompPickerVpIdx].thumbnail = v.thumbnail;
                  page.viewports[activeCompPickerVpIdx].label = v.name;
                  modal.style.display = 'none';
                  updateCompositorSheetView();
                  showCadToast('✓ Escena "' + v.name + '" asignada al bloque');
                }
              }
            });
          });
        }
      }

      modal.style.display = 'flex';
    }
    window.openCompPickerForViewport = openCompPickerForViewport;

    // Helper to capture live canvas and assign to viewport
    function captureLiveCanvasToViewport(canvasSelector, label) {
      const canvas = document.querySelector(canvasSelector);
      if (!canvas) {
        showCadToast('No se encontró el lienzo correspondiente');
        return;
      }
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        const page = sheetPages[activeSheetPageIndex];
        if (page.viewports[activeCompPickerVpIdx]) {
          page.viewports[activeCompPickerVpIdx].thumbnail = dataUrl;
          page.viewports[activeCompPickerVpIdx].sceneId = null;
          page.viewports[activeCompPickerVpIdx].label = label;
          document.getElementById('modal-comp-pick-scene').style.display = 'none';
          updateCompositorSheetView();
          showCadToast('✓ ' + label + ' capturada y vinculada al bloque');
        }
      } catch (err) {
        console.error('Error capturing canvas:', err);
        showCadToast('Error al capturar imagen del lienzo');
      }
    }

    // Modal Live Capture Handlers
    document.getElementById('btn-pick-live-3d')?.addEventListener('click', () => {
      captureLiveCanvasToViewport('#viewer canvas', '01 VISTA 3D MODELO');
    });
    document.getElementById('btn-pick-live-2d')?.addEventListener('click', () => {
      captureLiveCanvasToViewport('#map-canvas, #viewer canvas', '02 PLANO CARTOGRAFÍA 2D');
    });
    document.getElementById('btn-pick-live-axo')?.addEventListener('click', () => {
      captureLiveCanvasToViewport('#illu-canvas, #viewer canvas', '03 AXONOMETRÍA ISOMÉTRICA');
    });
    document.getElementById('btn-close-comp-picker')?.addEventListener('click', () => {
      document.getElementById('modal-comp-pick-scene').style.display = 'none';
    });

    // Add Viewport Block button
    document.getElementById('comp-btn-add-viewport')?.addEventListener('click', () => {
      const page = sheetPages[activeSheetPageIndex];
      const nextNum = page.viewports.length + 1;
      page.viewports.push({
        label: 'VISTA 0' + nextNum,
        sceneId: null,
        thumbnail: null
      });
      updateCompositorSheetView();
      showCadToast('✓ Bloque añadido al pliego. Clic en [+ Asignar Vista] para vincularlo.');
    });

    // Layout templates switching
    function setCompositorLayout(layoutId) {
      const page = sheetPages[activeSheetPageIndex];
      page.layout = layoutId;

      // Adjust default slots based on layout
      if (layoutId === 'hero' || layoutId === '1' || layoutId === '3') {
        while (page.viewports.length < 3) {
          page.viewports.push({ label: 'DETALLE 0' + page.viewports.length, sceneId: null, thumbnail: null });
        }
      } else if (layoutId === 'grid4' || layoutId === '2' || layoutId === '4') {
        while (page.viewports.length < 4) {
          page.viewports.push({ label: 'CUADRANTE 0' + (page.viewports.length + 1), sceneId: null, thumbnail: null });
        }
      } else if (layoutId === 'panoramic') {
        while (page.viewports.length < 4) {
          page.viewports.push({ label: 'TIRA BASE 0' + page.viewports.length, sceneId: null, thumbnail: null });
        }
      }

      document.querySelectorAll('#comp-btn-layout-1, #comp-btn-layout-2, #comp-btn-layout-3, [data-comp-layout]').forEach(b => {
        const l = b.getAttribute('data-comp-layout');
        b.classList.toggle('active', l === layoutId);
      });

      updateCompositorSheetView();
      showCadToast('✓ Diagramación de pliego actualizada');
    }
    window.setCompositorLayout = setCompositorLayout;

    document.getElementById('comp-btn-layout-1')?.addEventListener('click', () => setCompositorLayout('hero'));
    document.getElementById('comp-btn-layout-2')?.addEventListener('click', () => setCompositorLayout('grid4'));
    document.getElementById('comp-btn-layout-3')?.addEventListener('click', () => setCompositorLayout('panoramic'));

    // Frame style, Border width & Border color listeners
    document.getElementById('comp-frame-style-select')?.addEventListener('change', (e) => {
      sheetPages[activeSheetPageIndex].frameStyle = e.target.value;
      updateCompositorSheetView();
    });
    document.getElementById('comp-border-width-select')?.addEventListener('change', (e) => {
      sheetPages[activeSheetPageIndex].borderWidth = e.target.value;
      updateCompositorSheetView();
    });
    document.getElementById('comp-border-color-select')?.addEventListener('change', (e) => {
      sheetPages[activeSheetPageIndex].borderColor = e.target.value;
      updateCompositorSheetView();
    });

    // Logo Switcher & Custom Logo Handlers (Title Block Right Section: ONLY THE LOGO)
    let customLogoDataUrl = null;
    let activeLogoPreset = 'cgm'; // 'cgm' | 'urbnzd' | 'custom'

    function updateTitleBlockLogo() {
      const imgEl = document.getElementById('compositor-tb-logo-img');
      const textEl = document.getElementById('compositor-tb-logo-text');
      if (!imgEl || !textEl) return;

      if (activeLogoPreset === 'custom' && customLogoDataUrl) {
        imgEl.src = customLogoDataUrl;
        imgEl.style.display = 'block';
        textEl.style.display = 'none';
      } else if (activeLogoPreset === 'urbnzd') {
        imgEl.style.display = 'none';
        textEl.style.display = 'block';
        textEl.textContent = 'URBNZD';
      } else {
        // default: CGM Atelier
        imgEl.style.display = 'none';
        textEl.style.display = 'block';
        textEl.textContent = 'CGM ATELIER';
      }
    }

    document.querySelectorAll('#comp-logo-seg .rayon-seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#comp-logo-seg .rayon-seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeLogoPreset = btn.getAttribute('data-logo-preset') || 'cgm';
        updateTitleBlockLogo();
        showCadToast('✓ Logotipo actualizado en pie de plano');
      });
    });

    document.getElementById('comp-input-custom-logo')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        customLogoDataUrl = evt.target.result;
        activeLogoPreset = 'custom';
        document.querySelectorAll('#comp-logo-seg .rayon-seg-btn').forEach(b => b.classList.remove('active'));
        updateTitleBlockLogo();
        showCadToast('✓ Logotipo personalizado cargado con éxito');
      };
      reader.readAsDataURL(file);
    });

    // MAIN COMPOSITOR UPDATE VIEW FUNCTION
    function updateCompositorSheetView() {
      const page = sheetPages[activeSheetPageIndex];
      const grid = document.getElementById('compositor-viewports-grid');
      const sheetEl = document.getElementById('compositor-paper-sheet');
      const innerBorder = document.getElementById('comp-frame-inner-border');
      const titleEl = document.getElementById('compositor-sheet-title');
      const tbProj = document.getElementById('compositor-tb-project');
      const tbLoc = document.getElementById('compositor-tb-loc');
      const tbScale = document.getElementById('compositor-tb-scale');
      const tbNum = document.getElementById('compositor-tb-sheetnum');

      // Top Island & Status
      const islandName = document.getElementById('comp-island-sheet-name');
      if (islandName) islandName.textContent = (page.name || ('PLIEGO 0' + (activeSheetPageIndex + 1))).toUpperCase();
      const islandFmt = document.getElementById('comp-island-format');
      if (islandFmt) islandFmt.textContent = page.format.toUpperCase() + ' · ' + (page.orient === 'landscape' ? 'Horizontal' : 'Vertical');
      const compMeasure = document.getElementById('comp-measure-text');
      if (compMeasure) compMeasure.textContent = page.name + ' · ' + page.format.toUpperCase() + ' · Escala 1:' + page.scale;

      if (titleEl) titleEl.textContent = 'PLIEGO 0' + (activeSheetPageIndex + 1) + ' · ' + page.format.toUpperCase() + ' ' + (page.orient === 'landscape' ? 'HORIZONTAL' : 'VERTICAL');
      document.querySelectorAll('#compositor-scale-badge').forEach(badge => badge.textContent = 'Escala: 1:' + page.scale);
      if (tbProj) tbProj.textContent = (page.titleProject || 'PLAN MAESTRO URBANO').toUpperCase();
      if (tbLoc) tbLoc.textContent = (page.titleLoc || 'MONTERREY, N.L.').toUpperCase();
      if (tbScale) tbScale.textContent = '1:' + page.scale;
      if (tbNum) tbNum.textContent = page.sheetNum || ('PL-0' + (activeSheetPageIndex + 1));

      // Title Block Logo
      updateTitleBlockLogo();

      // Adjust paper proportions
      if (sheetEl) {
        const formatAspects = {
          '90x60': 90 / 60,
          'A1': 841 / 594,
          'A2': 594 / 420,
          'tabloid': 17 / 11,
          'letter': 11 / 8.5
        };
        const aspect = formatAspects[page.format] || 1.5;
        if (page.orient === 'portrait') {
          const h = 880;
          const w = Math.round(h / aspect);
          sheetEl.style.width = w + 'px';
          sheetEl.style.height = h + 'px';
        } else {
          const w = 920;
          const h = Math.round(w / aspect);
          sheetEl.style.width = w + 'px';
          sheetEl.style.height = h + 'px';
        }
      }

      // Frame & Border styling
      const frameStyle = page.frameStyle || 'cad';
      const bWidth = parseInt(page.borderWidth ?? 1, 10);
      const bColor = page.borderColor || '#18181b';

      const cropTL = document.getElementById('comp-crop-tl');
      const cropTR = document.getElementById('comp-crop-tr');
      const cropBL = document.getElementById('comp-crop-bl');
      const cropBR = document.getElementById('comp-crop-br');

      if (innerBorder) {
        if (frameStyle === 'none' || bWidth === 0) {
          innerBorder.style.border = 'none';
          innerBorder.style.outline = 'none';
        } else if (frameStyle === 'double') {
          innerBorder.style.border = bWidth + 'px solid ' + bColor;
          innerBorder.style.outline = (bWidth + 1) + 'px solid ' + bColor;
          innerBorder.style.outlineOffset = '4px';
        } else {
          innerBorder.style.border = bWidth + 'px solid ' + bColor;
          innerBorder.style.outline = 'none';
        }
      }

      const showCrops = (frameStyle === 'cad');
      [cropTL, cropTR, cropBL, cropBR].forEach(c => {
        if (c) c.style.display = showCrops ? 'block' : 'none';
      });

      if (!grid) return;

      // CSS Grid Template Layouts
      const layout = page.layout || 'hero';
      grid.style.display = 'grid';
      grid.style.gap = '10px';
      grid.style.width = '100%';
      grid.style.flex = '1';

      if (layout === 'hero' || layout === '1' || layout === '3') {
        // Hero 65% + 2 Detalles apilados
        grid.style.gridTemplateColumns = '1.75fr 1fr';
        grid.style.gridTemplateRows = '1fr 1fr';
      } else if (layout === 'grid4' || layout === '2' || layout === '4') {
        // Cuadrícula Técnica 2x2
        grid.style.gridTemplateColumns = '1fr 1fr';
        grid.style.gridTemplateRows = '1fr 1fr';
      } else if (layout === 'panoramic') {
        // Panorámica superior + 3 tiras base
        grid.style.gridTemplateColumns = '1fr 1fr 1fr';
        grid.style.gridTemplateRows = '1.6fr 1fr';
      } else {
        grid.style.gridTemplateColumns = '1fr 1fr';
        grid.style.gridTemplateRows = '1fr';
      }

      const views = viewsManager.getViews();

      grid.innerHTML = page.viewports.map((vp, idx) => {
        let imgSrc = vp.thumbnail || null;
        if (!imgSrc && vp.sceneId) {
          const v = views.find(item => item.id === vp.sceneId);
          if (v && v.thumbnail) imgSrc = v.thumbnail;
        }

        // Determine grid position styling based on layout
        let gridAreaStyle = '';
        if (layout === 'hero' || layout === '1' || layout === '3') {
          if (idx === 0) gridAreaStyle = 'grid-column: 1; grid-row: 1 / span 2;';
          else if (idx === 1) gridAreaStyle = 'grid-column: 2; grid-row: 1;';
          else if (idx === 2) gridAreaStyle = 'grid-column: 2; grid-row: 2;';
        } else if (layout === 'panoramic') {
          if (idx === 0) gridAreaStyle = 'grid-column: 1 / span 3; grid-row: 1;';
          else if (idx === 1) gridAreaStyle = 'grid-column: 1; grid-row: 2;';
          else if (idx === 2) gridAreaStyle = 'grid-column: 2; grid-row: 2;';
          else if (idx === 3) gridAreaStyle = 'grid-column: 3; grid-row: 2;';
        }

        if (imgSrc) {
          // Assigned Viewport Block
          return '<div class="comp-vp-block" style="' + gridAreaStyle + ' position:relative; background:#ffffff; border:1px solid ' + bColor + '; border-radius:2px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 3px 10px rgba(0,0,0,0.06);">' +
            '<div style="background:#18181b; color:#ffffff; padding:4px 8px; display:flex; justify-content:space-between; align-items:center; z-index:2;">' +
              '<input type="text" class="comp-vp-caption-input" data-vp-idx="' + idx + '" value="' + (vp.label || 'VISTA 0' + (idx + 1)) + '" style="background:transparent; border:none; color:#ffffff; font-family:\x27JetBrains Mono\x27, monospace; font-size:9px; font-weight:700; width:65%; outline:none;" title="Clic para editar título del bloque">' +
              '<div style="display:flex; align-items:center; gap:5px;">' +
                '<span style="font-size:7.5px; color:#38bdf8; font-weight:600; font-family:\x27JetBrains Mono\x27, monospace;">ESC 1:' + page.scale + '</span>' +
                '<button type="button" class="btn-comp-change-vp" data-vp-idx="' + idx + '" title="Cambiar escena" style="background:rgba(255,255,255,0.15); border:none; color:#ffffff; border-radius:2px; font-size:8px; padding:2px 5px; cursor:pointer;">⟳ Cambiar</button>' +
                '<button type="button" class="btn-comp-del-vp" data-vp-idx="' + idx + '" title="Eliminar vista" style="background:rgba(239,68,68,0.25); border:none; color:#fca5a5; border-radius:2px; font-size:8px; padding:2px 5px; cursor:pointer;">✕</button>' +
              '</div>' +
            '</div>' +
            '<div style="flex:1; position:relative; overflow:hidden; background:#09090b; display:flex; align-items:center; justify-content:center;">' +
              '<img src="' + imgSrc + '" style="width:100%; height:100%; object-fit:cover; display:block;" alt="' + (vp.label || 'Vista') + '">' +
            '</div>' +
          '</div>';
        } else {
          // Empty Viewport Block with Centered + Asignar Vista button
          return '<div class="comp-vp-block comp-vp-empty" style="' + gridAreaStyle + ' position:relative; background:#fbfbfb; border:1px dashed #a1a1aa; border-radius:2px; overflow:hidden; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:16px; box-shadow:inset 0 0 12px rgba(0,0,0,0.02);">' +
            '<div style="width:100%; display:flex; justify-content:space-between; align-items:center; position:absolute; top:6px; left:8px; right:8px; padding-right:16px;">' +
              '<span style="font-size:8px; font-weight:700; color:#71717a; font-family:\x27JetBrains Mono\x27, monospace; text-transform:uppercase;">' + (vp.label || 'BLOQUE ' + (idx + 1)) + '</span>' +
              (page.viewports.length > 1 ? '<button type="button" class="btn-comp-del-vp" data-vp-idx="' + idx + '" title="Eliminar bloque" style="background:none; border:none; color:#ef4444; font-size:10px; cursor:pointer;">✕</button>' : '') +
            '</div>' +
            '<button type="button" class="comp-vp-add-btn" data-vp-idx="' + idx + '" style="background:#18181b; color:#ffffff; border:1px dashed #38bdf8; border-radius:4px; padding:8px 16px; font-size:11px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:6px; box-shadow:0 2px 8px rgba(0,0,0,0.08);">' +
              '<span style="font-size:15px; font-weight:700; color:#38bdf8;">+</span> Asignar Vista' +
            '</button>' +
            '<span style="font-size:8px; color:#71717a; margin-top:6px; font-family:\x27JetBrains Mono\x27, monospace;">Vincular captura 3D, 2D o Axonométrica</span>' +
          '</div>';
        }
      }).join('');

      // Wire interactive events on rendered viewport blocks
      grid.querySelectorAll('.comp-vp-add-btn, .btn-comp-change-vp').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-vp-idx'), 10);
          openCompPickerForViewport(idx);
        });
      });

      grid.querySelectorAll('.btn-comp-del-vp').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.getAttribute('data-vp-idx'), 10);
          if (page.viewports[idx]) {
            if (page.viewports[idx].thumbnail || page.viewports[idx].sceneId) {
              page.viewports[idx].thumbnail = null;
              page.viewports[idx].sceneId = null;
            } else if (page.viewports.length > 1) {
              page.viewports.splice(idx, 1);
            }
            updateCompositorSheetView();
            showCadToast('Bloque actualizado');
          }
        });
      });

      grid.querySelectorAll('.comp-vp-caption-input').forEach(input => {
        input.addEventListener('change', (e) => {
          const idx = parseInt(input.getAttribute('data-vp-idx'), 10);
          if (page.viewports[idx]) {
            page.viewports[idx].label = e.target.value;
          }
        });
      });
    }
`;

// Replace from startIdx to endIdx
html = html.substring(0, startIdx) + newCompositionLogic.trim() + '\n\n    ' + html.substring(endIdx);
console.log('✓ Injected new comprehensive updateCompositorSheetView and viewport modal handlers');

fs.writeFileSync(htmlPath, html, 'utf8');
