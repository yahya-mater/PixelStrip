// =============================================
// ui.js — UI helpers: toast, zoom, info panel
// =============================================

import { state, pushUndo } from './state.js';
import { applyZoom, getCanvas } from './canvas.js';
import { refreshCursor } from './cursor.js';

// ── Toast notifications ──────────────────────

let toastTimer = null;
const toastEl = document.getElementById('toast');

export function showToast(msg, type = '') {
  toastEl.textContent = msg;
  toastEl.className = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.className = 'toast';
  }, 2800);
}

// ── Canvas info panel ────────────────────────

export function updateInfo() {
  const canvas = getCanvas();
  if (!canvas) return;

  const sizeEl = document.getElementById('info-size');
  const zoomEl = document.getElementById('info-zoom');
  const toolEl = document.getElementById('info-tool');

  if (sizeEl) sizeEl.textContent = `${canvas.width} × ${canvas.height}`;
  if (zoomEl) zoomEl.textContent = Math.round(state.zoom * 100) + '%';
  if (toolEl) toolEl.textContent = state.tool;
}

// ── Zoom controls ────────────────────────────

export function zoomIn(anchorX, anchorY) {
  zoomAround(state.zoom * 1.25, anchorX, anchorY);
}

export function zoomOut(anchorX, anchorY) {
  zoomAround(state.zoom * 0.8, anchorX, anchorY);
}

export function zoomFit() {
  const wrapper = document.getElementById('canvas-wrapper');
  const area    = document.getElementById('canvas-area');
  const canvas  = getCanvas();
  if (!canvas) return;
  const maxW = area.clientWidth  - 80;
  const maxH = area.clientHeight - 80;
  const zoom = Math.min(1, Math.min(maxW / canvas.width, maxH / canvas.height));
  applyZoom(zoom, wrapper);

  // Center by scrolling — canvas display size after zoom:
  const dispW = canvas.width  * zoom;
  const dispH = canvas.height * zoom;
  area.scrollLeft = Math.max(0, (dispW - area.clientWidth)  / 2);
  area.scrollTop  = Math.max(0, (dispH - area.clientHeight) / 2);

  updateInfo();
}

// Core zoom function — zooms around a specific point in screen coordinates.
// If no anchor given, zooms around the center of the canvas-area.
export function zoomAround(newZoom, anchorScreenX, anchorScreenY) {
  const wrapper = document.getElementById('canvas-wrapper');
  const area    = document.getElementById('canvas-area');
  const canvas  = getCanvas();
  if (!canvas) return;

  const oldZoom = state.zoom;
  newZoom = Math.min(Math.max(newZoom, 0.05), 8);
  if (newZoom === oldZoom) return;

  const areaRect = area.getBoundingClientRect();

  // Default anchor = center of visible area
  const ax = anchorScreenX ?? (areaRect.left + areaRect.width  / 2);
  const ay = anchorScreenY ?? (areaRect.top  + areaRect.height / 2);

  // Convert anchor to canvas pixel coordinates.
  // area.scrollLeft/scrollTop = how far we've scrolled inside the area.
  // ax - areaRect.left = where the anchor is inside the visible area viewport.
  // Together they give us the position inside the full scrollable content.
  // Divide by current zoom to get the canvas pixel under the cursor.
  const canvasPixelX = (area.scrollLeft + (ax - areaRect.left)) / oldZoom;
  const canvasPixelY = (area.scrollTop  + (ay - areaRect.top))  / oldZoom;

  // Apply zoom — updates CSS size of wrapper
  applyZoom(newZoom, wrapper);

  // New canvas display size in screen pixels
  const newW = canvas.width  * newZoom;
  const newH = canvas.height * newZoom;

  // Full scrollable content size = canvas display size
  // (no extra centering margin — we remove centering below)
  // Position of anchor inside new content:
  const newAnchorInContentX = canvasPixelX * newZoom;
  const newAnchorInContentY = canvasPixelY * newZoom;

  // Scroll so anchor stays under cursor
  area.scrollLeft = newAnchorInContentX - (ax - areaRect.left);
  area.scrollTop  = newAnchorInContentY - (ay - areaRect.top);

  updateInfo();
}
// ── Resize panel logic ───────────────────────

export function initResizePanel() {
  const wInput   = document.getElementById('resize-w');
  const hInput   = document.getElementById('resize-h');
  const lockBtn  = document.getElementById('lock-aspect');

  lockBtn.classList.toggle('locked', state.aspectLocked);

  lockBtn.addEventListener('click', () => {
    state.aspectLocked = !state.aspectLocked;
    lockBtn.classList.toggle('locked', state.aspectLocked);
    const canvas = getCanvas();
    if (canvas) {
      state.aspectRatio = canvas.width / canvas.height;
    }
  });

  wInput.addEventListener('input', () => {
    if (!state.aspectLocked) return;
    const canvas = getCanvas();
    if (!canvas) return;
    const ratio = canvas.height / canvas.width;
    const newW  = parseInt(wInput.value) || 0;
    hInput.value = Math.round(newW * ratio) || '';
  });

  hInput.addEventListener('input', () => {
    if (!state.aspectLocked) return;
    const canvas = getCanvas();
    if (!canvas) return;
    const ratio = canvas.width / canvas.height;
    const newH  = parseInt(hInput.value) || 0;
    wInput.value = Math.round(newH * ratio) || '';
  });
}

// ── Populate resize inputs with current size ─

export function syncResizeInputs() {
  const canvas = getCanvas();
  if (!canvas) return;
  document.getElementById('resize-w').value = canvas.width;
  document.getElementById('resize-h').value = canvas.height;
  state.aspectRatio = canvas.width / canvas.height;
}

// ── Active tool button highlight ─────────────

export function setActiveTool(toolName) {
  state.tool = toolName;
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tool === toolName);
  });
  const wrapper = document.getElementById('canvas-wrapper');
  if (wrapper) wrapper.setAttribute('data-tool', toolName);
  updateInfo();
  refreshCursor();
  
  // Clear magnifier overlay when leaving zoom tool
  if (toolName !== 'zoom') {
    import('./canvas.js').then(m => m.clearMagnifier());
  }

  // Show crop bar when crop tool active
  const cropOpts = document.getElementById('crop-opts');
  if (cropOpts) {
    cropOpts.style.display = toolName === 'crop' ? 'flex' : 'none';
  }

  // Init crop box when switching to crop tool
  if (toolName === 'crop' && state.imageLoaded) {
    import('./cropTool.js').then(m => m.initCrop());
  }

  // Cancel crop when switching away
  if (toolName !== 'crop') {
    import('./cropTool.js').then(m => m.cancelCrop());
  }

  // Show/hide text size selector
  const textOpts = document.getElementById('text-opts');
  if (textOpts) textOpts.style.display = toolName === 'text' ? 'flex' : 'none';
}




// ── Mobile bottom sheet ──────────────────────

const SHEET_SECTIONS = {
  background: () => document.querySelector('.ops-section:nth-child(1)')?.innerHTML ?? '',
  resize:     () => document.querySelector('.ops-section:nth-child(2)')?.innerHTML ?? '',
  export:     () => document.querySelector('.ops-section:nth-child(3)')?.innerHTML ?? '',
  info:       () => document.querySelector('.ops-section:nth-child(4)')?.innerHTML ?? '',
};

export function initMobileSheet() {
  const bar     = document.getElementById('mobile-tab-bar');
  const handle  = document.getElementById('mobile-sheet-handle');
  const content = document.getElementById('mobile-sheet-content');
  const area    = document.getElementById('canvas-area');
  if (!bar) return;

  // Tab switching
  bar.querySelectorAll('.mobile-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      bar.querySelectorAll('.mobile-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      content.innerHTML = SHEET_SECTIONS[tab]?.() ?? '';
      if (!bar.classList.contains('open')) toggleSheet(true);
    });
  });

  // Handle tap to toggle
  handle.addEventListener('click', () => toggleSheet(!bar.classList.contains('open')));

  // Handle drag to open/close
  let startY = 0;
  handle.addEventListener('pointerdown', e => {
    startY = e.clientY;
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove', e => {
    const dy = e.clientY - startY;
    if (Math.abs(dy) > 20) toggleSheet(dy < 0);
  });

  function toggleSheet(open) {
    bar.classList.toggle('open', open);
    area.classList.toggle('sheet-open', open);
  }

  // ── Build mobile toolbar ─────────────────────
  const mobileToolbar = document.getElementById('mobile-toolbar');
  if (!mobileToolbar) return;

  // Tool buttons — group 1: draw tools
  const drawTools = ['pencil', 'brush', 'eraser', 'fill', 'eyedropper', 'text'];
  drawTools.forEach(toolName => {
    const original = document.querySelector(`.tool-btn[data-tool="${toolName}"]`);
    if (!original) return;
    const clone = original.cloneNode(true);
    clone.addEventListener('click', () => setActiveTool(clone.dataset.tool));
    mobileToolbar.appendChild(clone);
  });

  // Divider
  const div1 = document.createElement('div');
  div1.className = 'mobile-divider';
  mobileToolbar.appendChild(div1);

  // Tool buttons — group 2: shape tools
  const shapeTools = ['rect', 'ellipse', 'line'];
  shapeTools.forEach(toolName => {
    const original = document.querySelector(`.tool-btn[data-tool="${toolName}"]`);
    if (!original) return;
    const clone = original.cloneNode(true);
    clone.addEventListener('click', () => setActiveTool(clone.dataset.tool));
    mobileToolbar.appendChild(clone);
  });

  // Divider
  const div2 = document.createElement('div');
  div2.className = 'mobile-divider';
  mobileToolbar.appendChild(div2);

  // Color dot (opens native color picker)
  const colorDot = document.createElement('div');
  colorDot.className = 'mobile-color-dot';
  colorDot.style.background = state.fgColor;
  colorDot.title = 'Foreground color';
  colorDot.addEventListener('click', () => {
    document.getElementById('color-fg').click();
  });
  // Keep dot in sync when color changes
  document.getElementById('color-fg').addEventListener('input', e => {
    colorDot.style.background = e.target.value;
  });
  mobileToolbar.appendChild(colorDot);

  // Divider
  const div3 = document.createElement('div');
  div3.className = 'mobile-divider';
  mobileToolbar.appendChild(div3);

  // Brush size quick buttons
  [4, 8, 16, 32].forEach(size => {
    const btn = document.createElement('button');
    btn.className = 'mobile-size-btn';
    btn.textContent = size + 'px';
    if (size === state.brushSize) btn.classList.add('active');
    btn.addEventListener('click', () => {
      state.brushSize = size;
      document.getElementById('brush-size').value = size;
      document.getElementById('brush-size-val').textContent = size + 'px';
      mobileToolbar.querySelectorAll('.mobile-size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
    mobileToolbar.appendChild(btn);
  });

  // Divider
  const div4 = document.createElement('div');
  div4.className = 'mobile-divider';
  mobileToolbar.appendChild(div4);

  // Undo / Redo
  ['↩ Undo', '↪ Redo'].forEach((label, i) => {
    const btn = document.createElement('button');
    btn.className = 'mobile-size-btn';
    btn.textContent = label;
    btn.addEventListener('click', () => {
      if (i === 0) document.getElementById('btn-undo').click();
      else         document.getElementById('btn-redo').click();
    });
    mobileToolbar.appendChild(btn);
  });
}