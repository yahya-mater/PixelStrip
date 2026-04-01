// =============================================
// cropTool.js — Crop tool logic
// =============================================

import { state, pushUndo } from './state.js';
import { getCanvas, getCtx, clearOverlay } from './canvas.js';

// Crop box in canvas pixel coordinates
let crop = { x: 0, y: 0, w: 0, h: 0 };

// Drag state
let dragging     = false;
let activeHandle = null;
let dragStartX   = 0;
let dragStartY   = 0;
let cropAtDrag   = null;

// Aspect ratio — null means free
let lockedRatio  = null;

// Handle definitions — 8 handles
// Each: { id, getCx, getCy, cursor, xDir, yDir }
// xDir/yDir: -1 = move start edge, 0 = no change, 1 = move end edge
function getHandles() {
  const { x, y, w, h } = crop;
  const mx = x + w / 2;
  const my = y + h / 2;
  return [
    { id: 'tl', cx: x,      cy: y,      cursor: 'nw-resize', xDir: -1, yDir: -1 },
    { id: 'tm', cx: mx,     cy: y,      cursor: 'n-resize',  xDir:  0, yDir: -1 },
    { id: 'tr', cx: x + w,  cy: y,      cursor: 'ne-resize', xDir:  1, yDir: -1 },
    { id: 'ml', cx: x,      cy: my,     cursor: 'w-resize',  xDir: -1, yDir:  0 },
    { id: 'mr', cx: x + w,  cy: my,     cursor: 'e-resize',  xDir:  1, yDir:  0 },
    { id: 'bl', cx: x,      cy: y + h,  cursor: 'sw-resize', xDir: -1, yDir:  1 },
    { id: 'bm', cx: mx,     cy: y + h,  cursor: 's-resize',  xDir:  0, yDir:  1 },
    { id: 'br', cx: x + w,  cy: y + h,  cursor: 'se-resize', xDir:  1, yDir:  1 },
  ];
}

// ── Draw overlay ─────────────────────────────

export function drawCropOverlay() {
  const canvas  = getCanvas();
  const overlay = document.getElementById('overlay-canvas');
  const octx    = overlay.getContext('2d');
  const { x, y, w, h } = crop;

  octx.clearRect(0, 0, overlay.width, overlay.height);

  // Darken outside the crop box
  octx.save();
  octx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  // Top
  octx.fillRect(0, 0, overlay.width, y);
  // Bottom
  octx.fillRect(0, y + h, overlay.width, overlay.height - y - h);
  // Left
  octx.fillRect(0, y, x, h);
  // Right
  octx.fillRect(x + w, y, overlay.width - x - w, h);
  octx.restore();

  // Crop box border
  octx.save();
  octx.strokeStyle = '#FFDD00';
  octx.lineWidth   = 1.5;
  octx.strokeRect(x, y, w, h);
  octx.restore();

  // 3×3 grid lines inside box
  octx.save();
  octx.strokeStyle = 'rgba(255, 221, 0, 0.4)';
  octx.lineWidth   = 0.75;
  octx.setLineDash([4, 4]);

  // Vertical thirds
  for (let i = 1; i <= 2; i++) {
    const lx = x + (w / 3) * i;
    octx.beginPath();
    octx.moveTo(lx, y);
    octx.lineTo(lx, y + h);
    octx.stroke();
  }

  // Horizontal thirds
  for (let i = 1; i <= 2; i++) {
    const ly = y + (h / 3) * i;
    octx.beginPath();
    octx.moveTo(x, ly);
    octx.lineTo(x + w, ly);
    octx.stroke();
  }

  octx.restore();

  // Handles
  const HANDLE_R = Math.max(5, Math.min(8, Math.min(w, h) * 0.04));
  octx.save();
  getHandles().forEach(handle => {
    octx.beginPath();
    octx.arc(handle.cx, handle.cy, HANDLE_R, 0, Math.PI * 2);
    octx.fillStyle   = '#FFDD00';
    octx.fill();
    octx.strokeStyle = '#000';
    octx.lineWidth   = 1;
    octx.stroke();
  });
  octx.restore();

  // Update size label
  const label = document.getElementById('crop-size-label');
  if (label) label.textContent = `${Math.round(w)} × ${Math.round(h)}`;
}

// ── Init crop box to full canvas ─────────────

export function initCrop() {
  const canvas = getCanvas();
  crop = { x: 0, y: 0, w: canvas.width, h: canvas.height };
  lockedRatio = null;
  // Reset dropdown
  const sel = document.getElementById('crop-ratio');
  if (sel) sel.value = 'free';
  drawCropOverlay();
}

export function setAspectRatio(value) {
  const canvas = getCanvas();

  if (value === 'free') {
    lockedRatio = null;
    return;
  }

  if (value === 'canvas') {
    lockedRatio = canvas.width / canvas.height;
  } else {
    const [rw, rh] = value.split(':').map(Number);
    lockedRatio = rw / rh;
  }

  // Immediately enforce ratio on current box
  // Keep width, adjust height
  enforceRatio();
  drawCropOverlay();
}

function enforceRatio() {
  if (!lockedRatio) return;
  const canvas = getCanvas();

  // Adjust height to match ratio based on current width
  let newH = crop.w / lockedRatio;

  // If that pushes outside canvas, shrink width instead
  if (crop.y + newH > canvas.height) {
    newH  = canvas.height - crop.y;
    crop.w = newH * lockedRatio;
  }

  // Clamp width too
  if (crop.x + crop.w > canvas.width) {
    crop.w = canvas.width - crop.x;
    newH   = crop.w / lockedRatio;
  }

  crop.h = newH;
}

// ── Hit test — returns handle or null ────────

function hitHandle(cx, cy) {
  const canvas  = getCanvas();
  const overlay = document.getElementById('overlay-canvas');
  // Handle radius in canvas px — scale with zoom for easier grabbing
  const HANDLE_R = Math.max(10, Math.min(16, Math.min(crop.w, crop.h) * 0.06));

  for (const h of getHandles()) {
    const dx = cx - h.cx;
    const dy = cy - h.cy;
    if (Math.sqrt(dx*dx + dy*dy) <= HANDLE_R) return h;
  }
  return null;
}

function hitInsideBox(cx, cy) {
  return (
    cx >= crop.x && cx <= crop.x + crop.w &&
    cy >= crop.y && cy <= crop.y + crop.h
  );
}

// ── Pointer events ───────────────────────────

export function cropPointerDown(canvasX, canvasY, canvasWrapper) {
  const handle = hitHandle(canvasX, canvasY);

  if (handle) {
    dragging     = true;
    activeHandle = handle;
    dragStartX   = canvasX;
    dragStartY   = canvasY;
    cropAtDrag   = { ...crop };
    canvasWrapper.style.cursor = handle.cursor;
    return;
  }

  // Drag whole box if clicked inside
  if (hitInsideBox(canvasX, canvasY)) {
    dragging     = true;
    activeHandle = { id: 'move', xDir: 0, yDir: 0 };
    dragStartX   = canvasX;
    dragStartY   = canvasY;
    cropAtDrag   = { ...crop };
    canvasWrapper.style.cursor = 'move';
  }
}

export function cropPointerMove(canvasX, canvasY, canvasWrapper) {
  const canvas = getCanvas();

  if (!dragging) {
    // Update cursor on hover
    const handle = hitHandle(canvasX, canvasY);
    if (handle) {
      canvasWrapper.style.cursor = handle.cursor;
    } else if (hitInsideBox(canvasX, canvasY)) {
      canvasWrapper.style.cursor = 'move';
    } else {
      canvasWrapper.style.cursor = 'crosshair';
    }
    return;
  }

  const dx = canvasX - dragStartX;
  const dy = canvasY - dragStartY;
  const MIN = 10;

  if (activeHandle.id === 'move') {
    // Move entire box
    let nx = cropAtDrag.x + dx;
    let ny = cropAtDrag.y + dy;
    nx = Math.max(0, Math.min(nx, canvas.width  - crop.w));
    ny = Math.max(0, Math.min(ny, canvas.height - crop.h));
    crop.x = nx;
    crop.y = ny;

  } else {
    // Resize based on which handle
    let { x, y, w, h } = cropAtDrag;

    if (lockedRatio) {
      // With locked ratio — use the dominant drag axis to drive both dimensions
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Which axis is the user dragging more?
      let newW = w;
      let newH = h;

      if (activeHandle.xDir !== 0 && activeHandle.yDir !== 0) {
        // Corner handle — use larger delta axis
        if (absDx >= absDy) {
          newW = Math.max(MIN, x + w + dx * activeHandle.xDir - (activeHandle.xDir === -1 ? x + dx : x));
          if (activeHandle.xDir === 1) newW = Math.max(MIN, Math.min(x + w + dx, canvas.width) - x);
          if (activeHandle.xDir === -1) {
            const newX = Math.max(0, Math.min(x + dx, x + w - MIN));
            newW = w - (newX - x);
            crop.x = newX;
          }
          newH = newW / lockedRatio;
        } else {
          if (activeHandle.yDir === 1) newH = Math.max(MIN, Math.min(y + h + dy, canvas.height) - y);
          if (activeHandle.yDir === -1) {
            const newY = Math.max(0, Math.min(y + dy, y + h - MIN));
            newH = h - (newY - y);
            crop.y = newY;
          }
          newW = newH * lockedRatio;
        }
      } else if (activeHandle.xDir !== 0) {
        // Edge handle — X only, derive Y
        if (activeHandle.xDir === 1) newW = Math.max(MIN, Math.min(x + w + dx, canvas.width) - x);
        if (activeHandle.xDir === -1) {
          const newX = Math.max(0, Math.min(x + dx, x + w - MIN));
          newW = w - (newX - x);
          crop.x = newX;
        }
        newH = newW / lockedRatio;
      } else if (activeHandle.yDir !== 0) {
        // Edge handle — Y only, derive X
        if (activeHandle.yDir === 1) newH = Math.max(MIN, Math.min(y + h + dy, canvas.height) - y);
        if (activeHandle.yDir === -1) {
          const newY = Math.max(0, Math.min(y + dy, y + h - MIN));
          newH = h - (newY - y);
          crop.y = newY;
        }
        newW = newH * lockedRatio;
      }

      // Clamp to canvas bounds
      newW = Math.min(newW, canvas.width  - crop.x);
      newH = Math.min(newH, canvas.height - crop.y);

      crop.w = newW;
      crop.h = newH;

    } else {
      // Free resize — original logic
      if (activeHandle.xDir === -1) {
        const newX = Math.max(0, Math.min(x + dx, x + w - MIN));
        const newW = w - (newX - x);
        crop.x = newX;
        crop.w = newW;
      } else if (activeHandle.xDir === 1) {
        crop.w = Math.max(MIN, Math.min(x + w + dx, canvas.width) - x);
      }

      if (activeHandle.yDir === -1) {
        const newY = Math.max(0, Math.min(y + dy, y + h - MIN));
        const newH = h - (newY - y);
        crop.y = newY;
        crop.h = newH;
      } else if (activeHandle.yDir === 1) {
        crop.h = Math.max(MIN, Math.min(y + h + dy, canvas.height) - y);
      }
    }
  }

  drawCropOverlay();
}

export function cropPointerUp(canvasWrapper) {
  dragging     = false;
  activeHandle = null;
  cropAtDrag   = null;
  canvasWrapper.style.cursor = 'default';
}

// ── Apply crop ───────────────────────────────

export function applyCrop() {
  const canvas = getCanvas();
  const ctx    = getCtx();
  pushUndo(canvas);

  const { x, y, w, h } = crop;
  const cw = Math.round(w);
  const ch = Math.round(h);
  const cx = Math.round(x);
  const cy = Math.round(y);

  // Copy cropped region
  const imageData = ctx.getImageData(cx, cy, cw, ch);

  // Resize canvas to crop dimensions
  canvas.width  = cw;
  canvas.height = ch;

  // Update overlay canvas size
  const overlay = document.getElementById('overlay-canvas');
  overlay.width  = cw;
  overlay.height = ch;

  // Draw cropped content
  ctx.putImageData(imageData, 0, 0);

  // Update state
  state.canvasW = cw;
  state.canvasH = ch;

  clearOverlay();
}

export function cancelCrop() {
  clearOverlay();
}