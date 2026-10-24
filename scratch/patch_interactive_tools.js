const fs = require('fs');
const path = require('path');

const repoDir = 'C:\\Users\\Cesar Gonzalez\\.gemini\\antigravity\\scratch\\urbanized_repo';
const htmlPath = path.join(repoDir, 'public', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// Target snippet to replace
const targetStart = `    // URBNZD 3D Dock Tools Handlers
    document.getElementById('dock-tool-section-3d')?.addEventListener('click', () => {`;

const targetEnd = `    // Rayon Segmented Controls`;

const startIdx = html.indexOf(targetStart);
const endIdx = html.indexOf(targetEnd);

if (startIdx === -1 || endIdx === -1) {
  console.error('Target range not found in index.html!');
  process.exit(1);
}

const replacement = `    // =====================================================
    // URBNZD 3D DOCK TOOLS & INTERACTIVE CONTROLS
    // =====================================================

    // 1. Interactive 3D Section Plane & Floating Bar
    const secBar = document.getElementById('studio-section-bar');
    const secSlider = document.getElementById('studio-sec-slider');
    const secVal = document.getElementById('studio-sec-val');

    document.getElementById('dock-tool-section-3d')?.addEventListener('click', () => {
      const isVisible = secBar && secBar.style.display !== 'none';
      if (isVisible) {
        if (secBar) secBar.style.display = 'none';
        if (window.toggleSectionCut3D) window.toggleSectionCut3D(false);
        document.getElementById('dock-tool-section-3d')?.classList.remove('active');
        showCadToast('Plano de sección 3D desactivado');
      } else {
        if (secBar) secBar.style.display = 'flex';
        if (window.toggleSectionCut3D) window.toggleSectionCut3D(true);
        document.getElementById('dock-tool-section-3d')?.classList.add('active');
        showCadToast('Plano de sección 3D interactivo activado');
      }
    });

    document.querySelectorAll('#studio-sec-axis-seg .rayon-seg-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#studio-sec-axis-seg .rayon-seg-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const axis = btn.getAttribute('data-axis') || 'z';
        if (window.setSectionCutAxis) window.setSectionCutAxis(axis);
        showCadToast('Plano de corte orientado en eje ' + axis.toUpperCase());
      });
    });

    secSlider?.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      if (secVal) secVal.textContent = v + 'm';
      if (window.setSectionCutPosition) window.setSectionCutPosition(v);
    });

    document.getElementById('studio-sec-invert')?.addEventListener('click', () => {
      if (window.invertSectionCut) window.invertSectionCut();
      showCadToast('Dirección de corte invertida');
    });

    document.getElementById('studio-sec-close')?.addEventListener('click', () => {
      if (secBar) secBar.style.display = 'none';
      if (window.toggleSectionCut3D) window.toggleSectionCut3D(false);
      document.getElementById('dock-tool-section-3d')?.classList.remove('active');
      showCadToast('Plano de sección 3D cerrado');
    });

    // 2. CAD 3D Measurement Ruler Tool
    let isMeasuringActive = false;
    document.getElementById('dock-tool-dim-3d')?.addEventListener('click', () => {
      isMeasuringActive = !isMeasuringActive;
      const btn = document.getElementById('dock-tool-dim-3d');
      btn?.classList.toggle('active', isMeasuringActive);
      if (window.setMeasuring3DMode) {
        window.setMeasuring3DMode(isMeasuringActive);
      }
      if (isMeasuringActive) {
        showCadToast('📐 Regla CAD 3D activa: Haz clic en dos vértices del modelo para medir distancia');
      } else {
        if (window.clearMeasure3D) window.clearMeasure3D();
        showCadToast('Regla CAD desactivada');
      }
    });

    document.getElementById('dock-tool-select-3d')?.addEventListener('click', () => {
      isMeasuringActive = false;
      document.getElementById('dock-tool-dim-3d')?.classList.remove('active');
      if (window.setMeasuring3DMode) window.setMeasuring3DMode(false);
      if (window.clearMeasure3D) window.clearMeasure3D();
      document.querySelectorAll('#preview .rayon-tool-btn').forEach(b => b.classList.remove('active'));
      document.getElementById('dock-tool-select-3d')?.classList.add('active');
      showCadToast('Modo Órbita y Selección 3D activo');
    });

    document.getElementById('dock-tool-level-3d')?.addEventListener('click', () => {
      const notice = document.getElementById('axiom-notice-msg');
      if (notice) {
        notice.textContent = 'Cota de Nivel Z activa. Haz clic sobre cualquier punto del relieve o cubierta para leer su elevación.';
        const box = document.getElementById('axiom-map-notice');
        if (box) { box.hidden = false; setTimeout(() => { box.hidden = true; }, 3500); }
      }
      showCadToast('Cota de Nivel Z activa: haz clic en cualquier cubierta o punto del relieve');
    });

    // 3. Real-Time Sun Azimuth & Elevation with Dynamic Shadows
    const sunAzSlider = document.getElementById('slider-studio-sun-azimuth');
    const sunElSlider = document.getElementById('slider-studio-sun-elevation');
    const sunAzVal = document.getElementById('val-studio-sun-azimuth');
    const sunElVal = document.getElementById('val-studio-sun-elevation');

    function sync3DSunPosition() {
      if (!sunAzSlider || !sunElSlider) return;
      const az = parseFloat(sunAzSlider.value);
      const el = parseFloat(sunElSlider.value);
      if (sunAzVal) sunAzVal.textContent = az + '°';
      if (sunElVal) sunElVal.textContent = el + '°';
      if (window.set3DSun) {
        window.set3DSun(az, el);
      }
    }
    sunAzSlider?.addEventListener('input', sync3DSunPosition);
    sunElSlider?.addEventListener('input', sync3DSunPosition);

    // Initial sun position sync
    setTimeout(sync3DSunPosition, 200);

    // 4. Dependent Controls Dimming
    function updateDependentDimming() {
      const satToggle = document.getElementById('sat-active-toggle');
      const satGroup = satToggle?.closest('.axiom-editor-group');
      if (satGroup) {
        const rows = satGroup.querySelectorAll('.axiom-control-row');
        rows.forEach(r => r.classList.toggle('axiom-dimmed-controls', !satToggle.checked));
      }

      const contourToggle = document.getElementById('sat-contour-visible');
      const contourGroup = contourToggle?.closest('.axiom-editor-group');
      if (contourGroup) {
        const rows = contourGroup.querySelectorAll('.axiom-control-row');
        rows.forEach(r => r.classList.toggle('axiom-dimmed-controls', !contourToggle.checked));
      }

      const tbToggle = document.getElementById('comp-titleblock-toggle');
      const tbGroup = document.getElementById('comp-group-project-data');
      if (tbGroup && tbToggle) {
        tbGroup.classList.toggle('axiom-dimmed-controls', !tbToggle.checked);
      }
    }
    document.getElementById('sat-active-toggle')?.addEventListener('change', updateDependentDimming);
    document.getElementById('sat-contour-visible')?.addEventListener('change', updateDependentDimming);
    document.getElementById('comp-titleblock-toggle')?.addEventListener('change', updateDependentDimming);
    setTimeout(updateDependentDimming, 250);

    // 5. Dynamic Technical Notes CRUD
    let studioNotes = [
      {
        id: 'n-1',
        author: 'CGM Atelier',
        tag: 'observacion',
        text: 'Ajustar alineamiento de losa y paramento norte según cota topográfica +12.50m.',
        time: 'Hoy, 10:45'
      }
    ];

    function renderStudioNotes() {
      const list = document.getElementById('studio-comments-list');
      if (!list) return;
      if (!studioNotes.length) {
        list.innerHTML = '<span style="font-size:11px; color:#71717a; padding:8px;">No hay notas registradas. Agrega una nota técnica abajo.</span>';
        return;
      }
      list.innerHTML = studioNotes.map(n => '<div class="studio-note-card" data-note-id="' + n.id + '" style="background:#18181b; padding:9px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.08); display:flex; flex-direction:column; gap:4px;">' +
        '<div style="display:flex; justify-content:space-between; align-items:center;">' +
          '<div style="display:flex; align-items:center; gap:6px;">' +
            '<strong style="font-size:11px; color:#ffffff;">' + n.author + '</strong>' +
            '<span style="font-size:8.5px; background:rgba(56,189,248,0.12); color:#38bdf8; padding:1px 5px; border-radius:3px; text-transform:uppercase;">' + n.tag + '</span>' +
          '</div>' +
          '<div style="display:flex; align-items:center; gap:4px;">' +
            '<span style="font-size:9.5px; color:#71717a;">' + n.time + '</span>' +
            '<button type="button" class="btn-note-edit" data-id="' + n.id + '" title="Editar nota" style="background:none; border:none; color:#a1a1aa; cursor:pointer; font-size:11px; padding:2px 4px;">✎</button>' +
            '<button type="button" class="btn-note-del" data-id="' + n.id + '" title="Eliminar nota" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:12px; padding:2px 4px;">✕</button>' +
          '</div>' +
        '</div>' +
        '<p class="note-text" style="margin:0; font-size:11px; color:#d4d4d8; line-height:1.4;">' + n.text + '</p>' +
      '</div>').join('');

      list.querySelectorAll('.btn-note-del').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          studioNotes = studioNotes.filter(item => item.id !== id);
          renderStudioNotes();
          showCadToast('Nota técnica eliminada');
        });
      });

      list.querySelectorAll('.btn-note-edit').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-id');
          const note = studioNotes.find(item => item.id === id);
          if (!note) return;
          const card = btn.closest('.studio-note-card');
          const p = card.querySelector('.note-text');
          const curText = note.text;
          p.innerHTML = '<div style="display:flex; flex-direction:column; gap:4px; margin-top:4px;">' +
            '<textarea class="note-edit-input" style="width:100%; background:#09090b; color:#fff; border:1px solid #38bdf8; border-radius:4px; padding:4px 6px; font-size:11px; font-family:inherit; resize:vertical; box-sizing:border-box;">' + curText + '</textarea>' +
            '<div style="display:flex; gap:6px; justify-content:flex-end;">' +
              '<button type="button" class="btn-note-cancel" style="background:transparent; border:1px solid rgba(255,255,255,0.15); color:#a1a1aa; border-radius:3px; padding:2px 8px; font-size:10px; cursor:pointer;">Cancelar</button>' +
              '<button type="button" class="btn-note-save" style="background:#38bdf8; border:none; color:#000; font-weight:600; border-radius:3px; padding:2px 8px; font-size:10px; cursor:pointer;">Guardar</button>' +
            '</div>' +
          '</div>';

          card.querySelector('.btn-note-cancel').addEventListener('click', () => renderStudioNotes());
          card.querySelector('.btn-note-save').addEventListener('click', () => {
            const val = card.querySelector('.note-edit-input').value.trim();
            if (val) note.text = val;
            renderStudioNotes();
            showCadToast('✓ Nota técnica actualizada');
          });
        });
      });
    }

    document.getElementById('btn-studio-post-comment')?.addEventListener('click', () => {
      const txt = document.getElementById('studio-comment-text')?.value;
      const author = document.getElementById('studio-comment-author')?.value || 'Arquitectura';
      const tag = document.getElementById('studio-comment-tag')?.value || 'observacion';
      if (!txt || !txt.trim()) return;

      studioNotes.unshift({
        id: 'n-' + Date.now(),
        author: author,
        tag: tag,
        text: txt.trim(),
        time: 'Ahora'
      });

      renderStudioNotes();
      document.getElementById('studio-comment-text').value = '';
      showCadToast('✓ Nota técnica publicada');
    });

    renderStudioNotes();

`;

html = html.substring(0, startIdx) + replacement + '\n    ' + html.substring(endIdx);
fs.writeFileSync(htmlPath, html, 'utf8');
console.log('✓ Successfully patched 3D tools, sun, floating section bar, measurement, notes CRUD, and dimming');
