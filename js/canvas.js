// =============================================
// canvas.js — All drawing tool logic
// =============================================

import { state, pushUndo } from './state.js';

let canvas, ctx;
let startX = 0, startY = 0;
let snapshotData = null; // for shape preview

export function initCanvas(mainCanvas) {
  canvas = mainCanvas;
  ctx = canvas.getContext('2d');
  
  // Turn off anti-aliasing for scaling/drawing
  ctx.imageSmoothingEnabled = state.antiAlias;
  ctx.webkitImageSmoothingEnabled = state.antiAlias; // For older browsers
  ctx.mozImageSmoothingEnabled = state.antiAlias;
  ctx.msImageSmoothingEnabled = state.antiAlias;
}

export function getCtx() { return ctx; }
export function getCanvas() { return canvas; }

// ── Coordinate helpers ───────────────────────

export function getCanvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top)  * scaleY,
  };
}

// ── Drawing context helpers ──────────────────

function applyBrushStyle(isEraser = false) {
  ctx.lineWidth   = state.brushSize;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  ctx.globalAlpha = state.brushOpacity;

  if (isEraser) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = state.fgColor;
  }
}

function resetCtx() {
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowBlur  = 0;

  // Turn off anti-aliasing for scaling/drawing
  ctx.imageSmoothingEnabled = state.antiAlias;
  ctx.webkitImageSmoothingEnabled = state.antiAlias; // For older browsers
  ctx.mozImageSmoothingEnabled = state.antiAlias;
  ctx.msImageSmoothingEnabled = state.antiAlias;
}

// ── Tool: Pencil / Brush ─────────────────────

export function startStroke(e) {
  if (!canvas) return;
  pushUndo(canvas);
  state.isDrawing = true;
  const { x, y } = getCanvasPos(e);
  startX = x;
  startY = y;

  const isEraser = state.tool === 'eraser';
  const isBrush  = state.tool === 'brush';

  applyBrushStyle(isEraser);

  if (isBrush) {
    ctx.shadowBlur  = state.brushSize * 0.6;
    ctx.shadowColor = state.fgColor;
  }

  //ctx.beginPath();
  //ctx.moveTo(x, y);
  //ctx.lineTo(x + 0.1, y + 0.1); // dot on click
  //ctx.stroke();

  // Snapshot for shape tools
  if (['rect', 'ellipse', 'line'].includes(state.tool)) {
    snapshotData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }
}

export function continueStroke(e) {
  if (!state.isDrawing || !canvas) return;
  const { x, y } = getCanvasPos(e);

  if (state.tool === 'pencil' || state.tool === 'brush' || state.tool === 'eraser') {
    ctx.lineTo(x, y);
    ctx.stroke();

  } else if (state.tool === 'rect') {
    ctx.putImageData(snapshotData, 0, 0);
    resetCtx();
    ctx.globalAlpha = state.brushOpacity;
    ctx.strokeStyle = state.fgColor;
    ctx.fillStyle   = state.fgColor;
    ctx.lineWidth   = state.brushSize;
    // Snap to 0.5 for crisp pixel-aligned edges — eliminates anti-aliasing
    const rx0 = state.antiAlias ? startX : Math.floor(startX) + 0.5;
    const ry0 = state.antiAlias ? startY : Math.floor(startY) + 0.5;
    const rw  = state.antiAlias ? x - startX : Math.floor(x - startX);
    const rh  = state.antiAlias ? y - startY : Math.floor(y - startY);
    if (state.shapeFilled) ctx.fillRect(rx0 - 0.5, ry0 - 0.5, rw, rh);
    else ctx.strokeRect(rx0, ry0, rw, rh);

  } else if (state.tool === 'ellipse') {
    ctx.putImageData(snapshotData, 0, 0);
    resetCtx();
    ctx.globalAlpha = state.brushOpacity;
    ctx.strokeStyle = state.fgColor;
    ctx.fillStyle   = state.fgColor;
    ctx.lineWidth   = state.brushSize;
    const rx = Math.abs(x - startX) / 2;
    const ry = Math.abs(y - startY) / 2;
    const cx = state.antiAlias ? startX + (x - startX) / 2 : Math.floor(startX + (x - startX) / 2) + 0.5;
    const cy = state.antiAlias ? startY + (y - startY) / 2 : Math.floor(startY + (y - startY) / 2) + 0.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    if (state.shapeFilled) ctx.fill();
    else ctx.stroke();

  } else if (state.tool === 'line') {
    ctx.putImageData(snapshotData, 0, 0);
    resetCtx();
    ctx.globalAlpha = state.brushOpacity;
    ctx.strokeStyle = state.fgColor;
    ctx.lineWidth   = state.brushSize;
    ctx.lineCap     = 'round';
    ctx.beginPath();
    // Snap line endpoints to pixel grid
    const rx0 = state.antiAlias ? startX : Math.floor(startX) + 0.5;
    const ry0 = state.antiAlias ? startY : Math.floor(startY) + 0.5;
    const rw  = state.antiAlias ? x : Math.floor(x) + 0.5;
    const rh  = state.antiAlias ? y : Math.floor(y) + 0.5;

    ctx.moveTo(rx0, ry0);
    ctx.lineTo(rw, rh);
    ctx.stroke();
  }
}

export function endStroke() {
  if (!state.isDrawing) return;
  state.isDrawing = false;
  resetCtx();
  ctx.beginPath(); // reset path
  snapshotData = null;
}

// ── Tool: Flood Fill ─────────────────────────

export function floodFill(e) {
  const { x, y } = getCanvasPos(e);
  pushUndo(canvas);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;

  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix >= width || iy >= height) return;

  // Parse fill color
  const tmp = document.createElement('canvas');
  tmp.width = tmp.height = 1;
  const tmpCtx = tmp.getContext('2d');
  tmpCtx.fillStyle = state.fgColor;
  tmpCtx.fillRect(0, 0, 1, 1);
  const fillPixel = tmpCtx.getImageData(0, 0, 1, 1).data;
  const fillR = fillPixel[0];
  const fillG = fillPixel[1];
  const fillB = fillPixel[2];
  const fillA = Math.round(state.brushOpacity * 255);

  // Sample seed color at click point
  const seedIdx = (iy * width + ix) * 4;
  const seedR = data[seedIdx];
  const seedG = data[seedIdx + 1];
  const seedB = data[seedIdx + 2];
  const seedA = data[seedIdx + 3];

  // Already fill color — nothing to do
  if (seedR === fillR && seedG === fillG && seedB === fillB && seedA === fillA) return;

  // Tolerance from state — user controlled
  const TOLERANCE = state.fillTolerance;

  function distToSeed(i) {
    const dr = data[i]     - seedR;
    const dg = data[i + 1] - seedG;
    const db = data[i + 2] - seedB;
    const da = data[i + 3] - seedA;
    return Math.sqrt(dr*dr + dg*dg + db*db + da*da);
  }

  // Single BFS — clean and predictable
  const visited = new Uint8Array(width * height);
  const queue   = [ix + iy * width];
  visited[ix + iy * width] = 1;

  while (queue.length) {
    const pos = queue.pop();
    const i   = pos * 4;

    if (distToSeed(i) > TOLERANCE) continue;

    data[i]     = fillR;
    data[i + 1] = fillG;
    data[i + 2] = fillB;
    data[i + 3] = fillA;

    const px = pos % width;
    const py = Math.floor(pos / width);

    if (px > 0          && !visited[pos - 1])     { visited[pos - 1]     = 1; queue.push(pos - 1); }
    if (px < width - 1  && !visited[pos + 1])     { visited[pos + 1]     = 1; queue.push(pos + 1); }
    if (py > 0          && !visited[pos - width]) { visited[pos - width] = 1; queue.push(pos - width); }
    if (py < height - 1 && !visited[pos + width]) { visited[pos + width] = 1; queue.push(pos + width); }
  }

  ctx.putImageData(imageData, 0, 0);
}

// ── Tool: Eyedropper ─────────────────────────

export function pickColor(e) {
  const { x, y } = getCanvasPos(e);
  const pixel = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
  const hex = '#' + [pixel[0], pixel[1], pixel[2]]
    .map(v => v.toString(16).padStart(2, '0'))
    .join('');
  return hex;
}

// ── Resize canvas ────────────────────────────

export function resizeCanvas(newW, newH) {
  pushUndo(canvas);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Draw existing content into an offscreen canvas
  const offscreen = document.createElement('canvas');
  offscreen.width  = canvas.width;
  offscreen.height = canvas.height;
  offscreen.getContext('2d').putImageData(imageData, 0, 0);

  canvas.width  = newW;
  canvas.height = newH;

  // Draw scaled version back
  ctx.drawImage(offscreen, 0, 0, newW, newH);
}

// ── Flip / Rotate ────────────────────────────

export function flipHorizontal() {
  pushUndo(canvas);
  const offscreen = document.createElement('canvas');
  offscreen.width  = canvas.width;
  offscreen.height = canvas.height;
  const offCtx = offscreen.getContext('2d');
  offCtx.drawImage(canvas, 0, 0);

  ctx.save();
  ctx.scale(-1, 1);
  ctx.drawImage(offscreen, -canvas.width, 0);
  ctx.restore();
}

export function flipVertical() {
  pushUndo(canvas);
  const offscreen = document.createElement('canvas');
  offscreen.width  = canvas.width;
  offscreen.height = canvas.height;
  offscreen.getContext('2d').drawImage(canvas, 0, 0);

  ctx.save();
  ctx.scale(1, -1);
  ctx.drawImage(offscreen, 0, -canvas.height);
  ctx.restore();
}

export function rotate(degrees) {
  pushUndo(canvas);
  const rad = (degrees * Math.PI) / 180;
  const offscreen = document.createElement('canvas');
  offscreen.width  = canvas.width;
  offscreen.height = canvas.height;
  offscreen.getContext('2d').drawImage(canvas, 0, 0);

  const newW = degrees === 90 || degrees === -90 ? canvas.height : canvas.width;
  const newH = degrees === 90 || degrees === -90 ? canvas.width  : canvas.height;

  canvas.width  = newW;
  canvas.height = newH;

  ctx.save();
  ctx.translate(newW / 2, newH / 2);
  ctx.rotate(rad);
  ctx.drawImage(offscreen, -offscreen.width / 2, -offscreen.height / 2);
  ctx.restore();
}

// ── Draw text ────────────────────────────────
export function drawTextPreview(text, x, y, boxW, boxH, color, fontSize) {
  const overlay    = document.getElementById('overlay-canvas');
  const octx       = overlay.getContext('2d');
  const lineH      = fontSize * 1.3;

  octx.clearRect(0, 0, overlay.width, overlay.height);
  

  // Dashed box
  octx.save();
  octx.strokeStyle    = '#FFDD00';
  octx.lineWidth      = 1 / (boxW > 0 ? 1 : 1); // always 1px
  octx.setLineDash([4, 3]);
  octx.strokeRect(x + 0.5, y + 0.5, boxW, boxH);
  octx.restore();

  // Live text preview
  if (text.trim()) {
    octx.save();
    octx.fillStyle    = color;
    octx.font         = `${fontSize}px 'JetBrains Mono', monospace`;
    octx.textBaseline = 'top';

    const lines = text.split('\n');
    let curY    = y;

    for (const rawLine of lines) {
      if (curY + lineH > y + boxH && boxH > 0) break; // clip to box height
      const words   = rawLine.split(' ');
      let   current = '';

      for (const word of words) {
        const test = current ? current + ' ' + word : word;
        //if (ctx.measureText(test).width > boxW && current) {
        if (octx.measureText(test).width > boxW && current) {
          octx.fillText(current, x, curY);
          curY   += lineH;
          current = word;
        } else {
          current = test;
        }
      }
      if (current) {
        octx.fillText(current, x, curY);
        curY += lineH;
      }
    }

    octx.restore();
  }
}

export function clearOverlay() {
  const overlay = document.getElementById('overlay-canvas');
  overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height);
}

export function drawCursor(text, x, y, boxW, boxH, color, fontSize, visible) {
  const overlay = document.getElementById('overlay-canvas');
  const octx    = overlay.getContext('2d');

  // Measure where the cursor should be after the last character
  octx.font         = `${fontSize}px 'JetBrains Mono', monospace`;
  octx.textBaseline = 'top';

  const lineH   = fontSize * 1.3;
  const lines   = text.split('\n');
  const lastLine = lines[lines.length - 1];

  // Cursor X = end of last line text width
  // Cursor Y = top of last line
  const cursorX = x + octx.measureText(lastLine).width;
  const cursorY = y + (lines.length - 1) * lineH;

  // Redraw the full preview first then add cursor on top
  // (cursor is drawn on top of existing overlay — caller manages full redraw)
  if (visible) {
    octx.save();
    octx.strokeStyle = color;
    octx.lineWidth   = 1.5;
    octx.beginPath();
    octx.moveTo(cursorX + 1, cursorY);
    octx.lineTo(cursorX + 1, cursorY + fontSize);
    octx.stroke();
    octx.restore();
  }
}

export function drawText(text, x, y, boxW, boxH) {
  if (!text.trim()) return;
  pushUndo(canvas);

  ctx.globalAlpha  = state.brushOpacity;
  ctx.fillStyle    = state.fgColor;
  ctx.font         = `${state.fontSize}px 'JetBrains Mono', monospace`;
  ctx.textBaseline = 'top';

  const lines    = text.split('\n');
  const lineH    = state.fontSize * 1.3;
  const maxWidth = (boxW || 9999);
  let   curY     = y;

  for (const rawLine of lines) {
    const words   = rawLine.split(' ');
    let   current = '';

    for (const word of words) {
      const test = current ? current + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        ctx.fillText(current, x, curY);
        curY   += lineH;
        current = word;
      } else {
        current = test;
      }
    }
    if (current) {
      ctx.fillText(current, x, curY);
      curY += lineH;
    }
  }

  resetCtx();
}

// ── Load image onto canvas ───────────────────

export function loadImageToCanvas(img, canvasWrapper) {
  const maxW = canvasWrapper.parentElement.clientWidth  - 80;
  const maxH = canvasWrapper.parentElement.clientHeight - 80;

  let w = img.naturalWidth  || img.width;
  let h = img.naturalHeight || img.height;

  // Store original size in state
  state.canvasW = w;
  state.canvasH = h;

  canvas.width  = w;
  canvas.height = h;

  // overlay canvas must match
  const overlay = document.getElementById('overlay-canvas');
  overlay.width  = w;
  overlay.height = h;

  // clear & draw
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  // Fit zoom
  const zoomX = maxW / w;
  const zoomY = maxH / h;
  const zoom  = Math.min(1, Math.min(zoomX, zoomY));
  applyZoom(zoom, canvasWrapper);

  state.imageLoaded = true;
  state.undoStack   = [];
  state.redoStack   = [];
}

export function applyZoom(zoom, canvasWrapper) {
  state.zoom = zoom;
  const w = state.canvasW || canvas.width;
  const h = state.canvasH || canvas.height;
  canvasWrapper.style.width  = (w * zoom) + 'px';
  canvasWrapper.style.height = (h * zoom) + 'px';

  const mainCvs    = document.getElementById('main-canvas');
  const overlayCvs = document.getElementById('overlay-canvas');
  mainCvs.style.width     = (w * zoom) + 'px';
  mainCvs.style.height    = (h * zoom) + 'px';
  overlayCvs.style.width  = (w * zoom) + 'px';
  overlayCvs.style.height = (h * zoom) + 'px';

  // Pad the drop zone so canvas can always be scrolled to center
  const area = document.getElementById('canvas-area');
  if (area) {
    const padH = Math.max(0, (area.clientHeight - h * zoom) / 2);
    const padW = Math.max(0, (area.clientWidth  - w * zoom) / 2);
    const dropZone = document.getElementById('drop-zone');
    if (dropZone) {
      dropZone.style.padding = `${padH}px ${padW}px`;
    }
  }
}


// ── Magnifier overlay ─────────────────────────

let magnifierActive   = false;
let magnifierRAF      = null;
const MAGNIFIER_R     = 80;  // radius in screen px
const MAGNIFIER_ZOOM  = 4;   // magnification factor

export function drawMagnifier(screenX, screenY) {
  const overlay = document.getElementById('overlay-canvas');
  const octx    = overlay.getContext('2d');
  const rect    = canvas.getBoundingClientRect();

  // Canvas pixel under cursor
  const scaleX  = canvas.width  / rect.width;
  const scaleY  = canvas.height / rect.height;
  const cx      = (screenX - rect.left) * scaleX;
  const cy      = (screenY - rect.top)  * scaleY;

  // How many canvas pixels fit inside the magnifier circle at this zoom
  const sampleR = MAGNIFIER_R / MAGNIFIER_ZOOM;

  octx.clearRect(0, 0, overlay.width, overlay.height);

  // Convert screen magnifier position to overlay canvas coords
  const ox = (screenX - rect.left) * scaleX;
  const oy = (screenY - rect.top)  * scaleY;
  const or = MAGNIFIER_R * scaleX; // radius in canvas px

  octx.save();

  // Clip to circle
  octx.beginPath();
  octx.arc(ox, oy, or, 0, Math.PI * 2);
  octx.clip();

  // Draw magnified portion of main canvas
  octx.drawImage(
    canvas,
    cx - sampleR, cy - sampleR,   // source top-left
    sampleR * 2,  sampleR * 2,    // source size
    ox - or,      oy - or,        // dest top-left
    or * 2,       or * 2          // dest size
  );

  octx.restore();

  // Outer ring
  octx.save();
  octx.beginPath();
  octx.arc(ox, oy, or, 0, Math.PI * 2);
  octx.strokeStyle = '#FFDD00';
  octx.lineWidth   = 2 * scaleX;
  octx.stroke();

  // Crosshair lines
  octx.strokeStyle = 'rgba(255,221,0,0.6)';
  octx.lineWidth   = 1 * scaleX;
  octx.setLineDash([3 * scaleX, 3 * scaleX]);

  // Horizontal
  octx.beginPath();
  octx.moveTo(ox - or, oy);
  octx.lineTo(ox + or, oy);
  octx.stroke();

  // Vertical
  octx.beginPath();
  octx.moveTo(ox, oy - or);
  octx.lineTo(ox, oy + or);
  octx.stroke();

  octx.restore();
}

export function clearMagnifier() {
  const overlay = document.getElementById('overlay-canvas');
  overlay.getContext('2d').clearRect(0, 0, overlay.width, overlay.height);
}