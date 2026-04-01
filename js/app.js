// =============================================
// app.js — Main entry point
// Wires all modules together
// =============================================

import { state, pushUndo, undo, redo } from './state.js';
import {
  initCanvas,
  loadImageToCanvas,
  startStroke,
  continueStroke,
  endStroke,
  floodFill,
  pickColor,
  drawText,
  drawTextPreview,
  clearOverlay,
  drawCursor,
  drawMagnifier,
  clearMagnifier,
  getCanvasPos,
  flipHorizontal,
  flipVertical,
  rotate,
  resizeCanvas,
  getCanvas,
  applyZoom,
} from './canvas.js';

import {
  showToast,
  updateInfo,
  zoomIn,
  zoomOut,
  zoomFit,
  zoomAround,
  initResizePanel,
  syncResizeInputs,
  setActiveTool,
  initMobileSheet,
} from './ui.js';

import {
  initCrop,
  applyCrop,
  cancelCrop,
  cropPointerDown,
  cropPointerMove,
  cropPointerUp,
  setAspectRatio,
} from './cropTool.js';

import { removeBackground, loadModel } from './bgremover.js';
import { exportPNG, exportJPG, exportICO } from './exporter.js';
import { initResizers } from './resizer.js';
import { initCursor } from './cursor.js';

// ── DOM references ───────────────────────────

const mainCanvas    = document.getElementById('main-canvas');
const canvasWrapper = document.getElementById('canvas-wrapper');
const dropZone      = document.getElementById('drop-zone');
const dropHint      = document.getElementById('drop-hint');
const fileInput     = document.getElementById('file-input');
const textInput     = document.getElementById('text-input');


// ── Init canvas module ───────────────────────

initCanvas(mainCanvas);
initResizePanel();

// ── Tool buttons ─────────────────────────────

document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => setActiveTool(btn.dataset.tool));
});

// ── Color pickers ────────────────────────────

const colorFg = document.getElementById('color-fg');
const swatchFg = document.getElementById('swatch-fg');
const swatchBg = document.getElementById('swatch-bg');
const colorBg  = document.getElementById('color-bg');

swatchFg.style.background = state.fgColor;
swatchBg.style.background = state.bgColor;
colorFg.value = state.fgColor;

colorFg.addEventListener('input', e => {
  state.fgColor = e.target.value;
  swatchFg.style.background = e.target.value;
});

swatchFg.addEventListener('click', () => colorFg.click());
swatchBg.addEventListener('click', () => {
  colorBg.click();
});

colorBg.addEventListener('input', e => {
  state.bgColor = e.target.value;
  swatchBg.style.background = e.target.value;
});

// ── Brush size & opacity ──────────────────────

const brushSizeEl   = document.getElementById('brush-size');
const brushSizeVal  = document.getElementById('brush-size-val');
const brushOpacEl   = document.getElementById('brush-opacity');
const brushOpacVal  = document.getElementById('brush-opacity-val');

brushSizeEl.addEventListener('input', e => {
  state.brushSize = parseInt(e.target.value);
  brushSizeVal.textContent = state.brushSize + 'px';
});

brushOpacEl.addEventListener('input', e => {
  state.brushOpacity = parseInt(e.target.value) / 100;
  brushOpacVal.textContent = e.target.value + '%';
});

// Fill tolerance
const fillTolEl  = document.getElementById('fill-tolerance');
const fillTolVal = document.getElementById('fill-tolerance-val');

fillTolEl.addEventListener('input', e => {
  state.fillTolerance = parseInt(e.target.value);
  fillTolVal.textContent = e.target.value;
});

// ── Shape fill toggle ────────────────────────

document.getElementById('shape-filled').addEventListener('change', e => {
  state.shapeFilled = e.target.checked;
});

document.getElementById('anti-alias').addEventListener('change', e => {
  state.antiAlias = e.target.checked;
  const ctx = document.getElementById('main-canvas').getContext('2d');
  ctx.imageSmoothingEnabled = e.target.checked;
});

// ── Text tool ────────────────────────────────

document.getElementById('font-size-select').addEventListener('change', e => {
  state.fontSize = parseInt(e.target.value);
});

// ── JPG quality ──────────────────────────────

const jpgQualEl  = document.getElementById('jpg-quality');
const jpgQualVal = document.getElementById('jpg-quality-val');

jpgQualEl.addEventListener('input', e => {
  state.jpgQuality = parseInt(e.target.value) / 100;
  jpgQualVal.textContent = e.target.value + '%';
});

// ── Undo / Redo ───────────────────────────────

document.getElementById('btn-undo').addEventListener('click', () => {
  if (!undo(mainCanvas)) showToast('Nothing to undo', 'info');
  else showToast('Undone', '');
});

document.getElementById('btn-redo').addEventListener('click', () => {
  if (!redo(mainCanvas)) showToast('Nothing to redo', 'info');
  else showToast('Redone', '');
});

// ── Keyboard shortcuts ────────────────────────

const keyToolMap = {
  'p': 'pencil',
  'b': 'brush',
  'e': 'eraser',
  'f': 'fill',
  'k': 'eyedropper',
  't': 'text',
  'r': 'rect',
  'o': 'ellipse',
  'l': 'line',
  'z': 'zoom',
  'c': 'crop',
};

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;

  if (e.ctrlKey && e.key === 'z') { undo(mainCanvas); return; }
  if (e.ctrlKey && e.key === 'y') { redo(mainCanvas); return; }
  if (e.key === '+' || e.key === '=') { zoomIn(); return; }
  if (e.key === '-') { zoomOut(); return; }
  if (e.key === '0') { zoomFit(); return; }

  const tool = keyToolMap[e.key.toLowerCase()];
  if (tool) setActiveTool(tool);
});

// ── Zoom buttons ─────────────────────────────

document.getElementById('btn-zoom-in').addEventListener('click', zoomIn);
document.getElementById('btn-zoom-out').addEventListener('click', zoomOut);
document.getElementById('btn-zoom-fit').addEventListener('click', zoomFit);

// ── Mouse wheel zoom on canvas ───────────────

document.getElementById('canvas-area').addEventListener('wheel', e => {
  if (!e.ctrlKey) return;
  e.preventDefault();
  if (e.deltaY < 0) zoomIn(e.clientX, e.clientY);
  else zoomOut(e.clientX, e.clientY);
}, { passive: false });

// ── Transform buttons ────────────────────────

document.getElementById('btn-flip-h').addEventListener('click', () => {
  flipHorizontal();
  showToast('Flipped horizontally');
});
document.getElementById('btn-flip-v').addEventListener('click', () => {
  flipVertical();
  showToast('Flipped vertically');
});
document.getElementById('btn-rotate-l').addEventListener('click', () => {
  rotate(-90);
  updateCanvasSize();
  showToast('Rotated 90° left');
});
document.getElementById('btn-rotate-r').addEventListener('click', () => {
  rotate(90);
  updateCanvasSize();
  showToast('Rotated 90° right');
});

function updateCanvasSize() {
  const c = getCanvas();
  state.canvasW = c.width;
  state.canvasH = c.height;
  const overlay = document.getElementById('overlay-canvas');
  overlay.width  = c.width;
  overlay.height = c.height;
  applyZoom(state.zoom, canvasWrapper);
  syncResizeInputs();
  updateInfo();
}

// ── Resize ───────────────────────────────────

document.getElementById('btn-resize').addEventListener('click', () => {
  const w = parseInt(document.getElementById('resize-w').value);
  const h = parseInt(document.getElementById('resize-h').value);
  if (!w || !h || w < 1 || h < 1) {
    showToast('Enter valid width and height', 'error');
    return;
  }
  resizeCanvas(w, h);
  updateCanvasSize();
  showToast(`Resized to ${w}×${h}`, 'success');
});

// ── Background removal ───────────────────────

document.getElementById('btn-remove-bg').addEventListener('click', async () => {
  await removeBackground();
  updateInfo();
});

// ── Export buttons ───────────────────────────

['btn-export-png', 'btn-export-png2'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', exportPNG);
});
['btn-export-jpg', 'btn-export-jpg2'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', exportJPG);
});
['btn-export-ico', 'btn-export-ico2'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', exportICO);
});

// ── File loading ─────────────────────────────

function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('Please load a valid image file', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      dropHint.style.display  = 'none';
      canvasWrapper.style.display = 'block';
      loadImageToCanvas(img, canvasWrapper);
      syncResizeInputs();
      updateInfo();
      showToast(`Loaded: ${file.name}`, 'success');
      // Pre-warm model in background
      if (!state.modelReady && !state.modelLoading) {
        setTimeout(() => loadModel(), 500);
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

document.getElementById('btn-new-canvas').addEventListener('click', () => {
  // Show the drop hint with the form so user can set size
  dropHint.style.display      = 'flex';
  dropHint.style.flexDirection = 'column';
  dropHint.style.alignItems   = 'center';
  canvasWrapper.style.display = 'none';
});


fileInput.addEventListener('change', e => {
  if (e.target.files[0]) loadFile(e.target.files[0]);
});

// ── Drag & drop ──────────────────────────────

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) loadFile(file);
});

// ── Text tool state ───────────────────────────
// All coordinates are in CANVAS pixels — no conversion needed
let textBoxX = 0, textBoxY = 0;
let textBoxW = 0, textBoxH = 0;
let textDragging  = false;
let textCommitted = false;
let cursorBlinkInterval = null;
let cursorVisible       = true;

// ── Canvas pointer events ─────────────────────

canvasWrapper.addEventListener('pointerdown', e => {
  if (!state.imageLoaded) return;

  if (state.tool === 'fill') {
    floodFill(e);
    return;
  }

  if (state.tool === 'eyedropper') {
    const hex = pickColor(e);
    state.fgColor = hex;
    swatchFg.style.background = hex;
    colorFg.value = hex;
    showToast('Color picked: ' + hex, 'info');
    setActiveTool('pencil');
    return;
  }

  if (state.tool === 'crop') {
    const { x, y } = getCanvasPos(e);
    cropPointerDown(x, y, canvasWrapper);
    canvasWrapper.setPointerCapture(e.pointerId);
    return;
  }

  if (state.tool === 'text') {
    const { x, y } = getCanvasPos(e);

    // If box exists and click is inside it — keep editing
    if (textCommitted) {
      const insideBox =
        x >= textBoxX && x <= textBoxX + textBoxW &&
        y >= textBoxY && y <= textBoxY + textBoxH;
      if (insideBox) {
        textInput.focus();
        return;
      }
      // Clicked outside — commit first then start new box
      commitText();
    }

    // Start new box in canvas coordinates directly
    textBoxX      = x;
    textBoxY      = y;
    textBoxW      = 0;
    textBoxH      = 0;
    textDragging  = true;
    textCommitted = false;
    textInput.value = '';

    canvasWrapper.setPointerCapture(e.pointerId);
    return;
  }
  
  canvasWrapper.setPointerCapture(e.pointerId);
  startStroke(e);
});

canvasWrapper.addEventListener('pointermove', e => {
  if (state.tool === 'crop') {
    const { x, y } = getCanvasPos(e);
    cropPointerMove(x, y, canvasWrapper);
    return;
  }
  
  if (state.tool === 'text' && textDragging) {
    const { x, y } = getCanvasPos(e);

    const w = x - textBoxX;
    const h = y - textBoxY;

    // Allow drag in any direction
    textBoxX = w >= 0 ? textBoxX : textBoxX + w;
    textBoxY = h >= 0 ? textBoxY : textBoxY + h;
    textBoxW = Math.abs(w);
    textBoxH = Math.abs(h);

    // Draw live box preview on overlay canvas
    drawTextPreview('', textBoxX, textBoxY, textBoxW, textBoxH, state.fgColor, state.fontSize);
    return;
  }

  if (state.isDrawing) continueStroke(e);
});

canvasWrapper.addEventListener('pointerup', e => {
  if (state.tool === 'crop') {
    cropPointerUp(canvasWrapper);
    return;
  }

  if (state.tool === 'text' && textDragging) {
    textDragging = false;

    // Default size if user just clicked without dragging
    if (textBoxW < 10 || textBoxH < 10) {
      textBoxW = Math.round(200 / state.zoom);
      textBoxH = Math.round(60  / state.zoom);
    }

    // Draw the final box outline on overlay
    drawTextPreview('', textBoxX, textBoxY, textBoxW, textBoxH, state.fgColor, state.fontSize);

    textCommitted = true;
    textInput.value = '';
    startCursorBlink();
    textInput.focus();
    return;
  }

  endStroke();
});

canvasWrapper.addEventListener('pointerleave', () => {
  if (state.tool === 'text' && textDragging) return; // keep dragging
  endStroke();
});

// Commit on Escape, allow Enter for new lines (it's a textarea now)
// Use document-level keydown so focus on the hidden textarea doesn't matter
document.addEventListener('keydown', e => {
  if (!textCommitted) return;
  if (e.key === 'Escape')             { e.preventDefault(); cancelText();  return; }
  if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); commitText();  return; }

  // Block shortcuts that would interfere (undo/redo handled separately)
  if (e.ctrlKey && (e.key === 'z' || e.key === 'y')) return;

  // Printable characters
  if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    textInput.value += e.key;
    refreshTextPreview();
    return;
  }

  // Backspace
  if (e.key === 'Backspace') {
    e.preventDefault();
    textInput.value = textInput.value.slice(0, -1);
    refreshTextPreview();
    return;
  }

  // Enter = new line
  if (e.key === 'Enter' && !e.ctrlKey) {
    e.preventDefault();
    textInput.value += '\n';
    refreshTextPreview();
    return;
  }
});

function refreshTextPreview() {
  drawTextPreview(
    textInput.value,
    textBoxX, textBoxY,
    textBoxW, textBoxH,
    state.fgColor,
    state.fontSize
  );
  // Always show cursor immediately on keystroke then let blink continue
  cursorVisible = true;
  drawCursor(
    textInput.value,
    textBoxX, textBoxY,
    textBoxW, textBoxH,
    state.fgColor,
    state.fontSize,
    true
  );
}

function startCursorBlink() {
  stopCursorBlink();
  cursorVisible = true;
  cursorBlinkInterval = setInterval(() => {
    cursorVisible = !cursorVisible;
    // Redraw preview + cursor each blink tick
    drawTextPreview(
      textInput.value,
      textBoxX, textBoxY,
      textBoxW, textBoxH,
      state.fgColor,
      state.fontSize
    );
    drawCursor(
      textInput.value,
      textBoxX, textBoxY,
      textBoxW, textBoxH,
      state.fgColor,
      state.fontSize,
      cursorVisible
    );
  }, 530); // ~standard cursor blink rate
}

function stopCursorBlink() {
  if (cursorBlinkInterval) {
    clearInterval(cursorBlinkInterval);
    cursorBlinkInterval = null;
  }
}

// Click outside canvas while box is active — commit
document.addEventListener('pointerdown', e => {
  if (textCommitted && !canvasWrapper.contains(e.target)) {
    commitText();
  }
});

// Switch away from text tool — commit any open box
document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (textCommitted) commitText();
  });
});

function commitText() {
  if (!textCommitted) return;
  stopCursorBlink();
  const txt = textInput.value;
  // Coordinates are already in canvas pixels — draw directly, no conversion
  if (txt.trim()) drawText(txt, textBoxX, textBoxY, textBoxW, textBoxH);
  clearOverlay();
  textInput.value   = '';
  textCommitted     = false;
  textDragging      = false;
}

function cancelText() {
  stopCursorBlink();
  clearOverlay();
  textInput.value   = '';
  textCommitted     = false;
  textDragging      = false;
}

// ── Zoom tool (magnifier) ─────────────────────

// Add hint pill to DOM
const zoomHint = document.createElement('div');
zoomHint.className = 'zoom-hint';
zoomHint.textContent = 'Click to zoom in · Right-click to zoom out · Alt+Click to reset';
document.body.appendChild(zoomHint);

canvasWrapper.addEventListener('pointermove', e => {
  if (state.tool !== 'zoom') return;
  drawMagnifier(e.clientX, e.clientY);
});

canvasWrapper.addEventListener('pointerenter', e => {
  if (state.tool !== 'zoom') return;
  zoomHint.classList.add('visible');
});

canvasWrapper.addEventListener('pointerleave', e => {
  if (state.tool !== 'zoom') return;
  clearMagnifier();
  zoomHint.classList.remove('visible');
});

canvasWrapper.addEventListener('click', e => {
  if (state.tool !== 'zoom') return;
  if (e.altKey) {
    zoomFit();
    showToast('Zoom reset', 'info');
    return;
  }
  zoomIn(e.clientX, e.clientY);
  setTimeout(() => drawMagnifier(e.clientX, e.clientY), 50);
});

canvasWrapper.addEventListener('contextmenu', e => {
  if (state.tool !== 'zoom') return;
  e.preventDefault();
  zoomOut(e.clientX, e.clientY);
  setTimeout(() => drawMagnifier(e.clientX, e.clientY), 50);
});

// ── Paste image from clipboard ───────────────

document.addEventListener('paste', e => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) loadFile(file);
      break;
    }
  }
});

// ── New Image ─────────────────────────────────

function initNewImageForm() {
  // Background option toggle
  document.querySelectorAll('.bg-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.bg-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Create button
  document.getElementById('btn-new-image').addEventListener('click', () => {
    createNewImage();
  });

  // Allow Enter key on width/height inputs
  ['new-img-w', 'new-img-h'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') createNewImage();
    });
  });

  // Create a default canvas on launch
  createNewImage(800, 600, 'white');
}

function createNewImage(w, h, bg) {
  const width  = (w  ?? parseInt(document.getElementById('new-img-w').value))  || 800;
  const height = (h  ?? parseInt(document.getElementById('new-img-h').value))  || 600;
  const bgType = bg ?? document.querySelector('.bg-opt.active')?.dataset.bg  ?? 'white';

  if (width < 1 || height < 1 || width > 8000 || height > 8000) {
    showToast('Size must be between 1 and 8000px', 'error');
    return;
  }

  // Set canvas size
  mainCanvas.width  = width;
  mainCanvas.height = height;

  const overlay = document.getElementById('overlay-canvas');
  overlay.width  = width;
  overlay.height = height;

  // Fill background
  const ctx = mainCanvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);

  if (bgType === 'white') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  } else if (bgType === 'black') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);
  }
  // transparent = leave cleared (nothing drawn)

  // Update state
  state.canvasW    = width;
  state.canvasH    = height;
  state.imageLoaded = true;
  state.undoStack  = [];
  state.redoStack  = [];

  // Show canvas, hide drop hint
  dropHint.style.display      = 'none';
  canvasWrapper.style.display = 'block';

  // Fit zoom to canvas area
  const area = document.getElementById('canvas-area');
  const maxW = area.clientWidth  - 80;
  const maxH = area.clientHeight - 80;
  const zoom = Math.min(1, Math.min(maxW / width, maxH / height));
  applyZoom(zoom, canvasWrapper);

  syncResizeInputs();
  updateInfo();
  showToast(`New image: ${width}×${height}`, 'success');
}

// ── Crop tool buttons ─────────────────────────
document.getElementById('crop-ratio').addEventListener('change', e => {
  setAspectRatio(e.target.value);
});

document.getElementById('btn-crop-confirm').addEventListener('click', () => {
  applyCrop();
  setActiveTool('pencil');
  syncResizeInputs();
  zoomFit();
  updateInfo();
  showToast('Cropped!', 'success');
});

document.getElementById('btn-crop-cancel').addEventListener('click', () => {
  cancelCrop();
  setActiveTool('pencil');
});


// ── Init resizers ─────────────────────────────
initResizers();
initMobileSheet();
initCursor();

// ── New image form ────────────────────────────
initNewImageForm();

// ── Fit on browser resize ─────────────────────
window.addEventListener('resize', () => {
  if (state.imageLoaded) zoomFit();
});

// ── Initial info update ───────────────────────
updateInfo();